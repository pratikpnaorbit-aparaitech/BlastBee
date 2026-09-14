const EventEmitter = require('events');
const { getDb } = require('../database/db');
const { renderText } = require('./templateEngine');
const { sendEmail, getMailerConfig } = require('./mailer');
const smtpPool = require('./smtpPool');
const { syncCampaignDelivery } = require('../database/mongo');
const { humanizeDelay } = require('./spamShield');
const subscriptionService = require('./subscriptionService');

class BlastManager extends EventEmitter {
  constructor() {
    super();
    this.activeCampaigns = new Map(); // campaignId -> state { isPaused, isCancelled, startTime, processedInSession }
    this.sseClients = new Map(); // campaignId -> Set of res objects
  }

  /**
   * Subscribe SSE client to a campaign
   */
  addSseClient(campaignId, res) {
    if (!this.sseClients.has(campaignId)) {
      this.sseClients.set(campaignId, new Set());
    }
    this.sseClients.get(campaignId).add(res);

    res.on('close', () => {
      const clients = this.sseClients.get(campaignId);
      if (clients) {
        clients.delete(res);
        if (clients.size === 0) {
          this.sseClients.delete(campaignId);
        }
      }
    });
  }

  /**
   * Broadcast SSE event to campaign subscribers
   */
  broadcast(campaignId, eventType, data) {
    const clients = this.sseClients.get(campaignId);
    if (clients) {
      const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
      clients.forEach(res => {
        try {
          res.write(payload);
        } catch (err) {
          console.error('Error writing SSE payload:', err.message);
        }
      });
    }
    this.emit(`${eventType}:${campaignId}`, data);
    this.emit('any', { campaignId, eventType, data });
  }

  /**
   * Start or Resume a Campaign Blast
   */
  async startCampaign(campaignId) {
    const db = getDb();
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);

    if (!campaign) {
      throw new Error(`Campaign with ID ${campaignId} not found.`);
    }

    if (this.activeCampaigns.has(campaignId)) {
      const state = this.activeCampaigns.get(campaignId);
      if (state.isPaused) {
        state.isPaused = false;
        db.prepare("UPDATE campaigns SET status = 'in_progress' WHERE id = ?").run(campaignId);
        this.broadcast(campaignId, 'status_change', { status: 'in_progress', message: 'Campaign resumed' });
        return { success: true, message: 'Campaign resumed' };
      }
      return { success: true, message: 'Campaign is already running' };
    }

    // Set up state
    const state = {
      isPaused: false,
      isCancelled: false,
      startTime: Date.now(),
      processedCount: campaign.sent_count || 0
    };
    this.activeCampaigns.set(campaignId, state);

    // Update database status
    db.prepare(`
      UPDATE campaigns 
      SET status = 'in_progress', started_at = COALESCE(started_at, datetime('now'))
      WHERE id = ?
    `).run(campaignId);

    this.broadcast(campaignId, 'status_change', { status: 'in_progress', message: 'Blast initiated' });

    // Run queue in background asynchronously
    this.processCampaignQueue(campaignId).catch(err => {
      console.error(`Error processing campaign ${campaignId}:`, err);
    });

    return { success: true, message: 'Blast started' };
  }

  /**
   * Pause an active campaign
   */
  pauseCampaign(campaignId) {
    const state = this.activeCampaigns.get(campaignId);
    if (state) {
      state.isPaused = true;
      const db = getDb();
      db.prepare("UPDATE campaigns SET status = 'paused' WHERE id = ?").run(campaignId);
      this.broadcast(campaignId, 'status_change', { status: 'paused', message: 'Campaign paused' });
      return { success: true, message: 'Campaign paused' };
    }
    return { success: false, message: 'Campaign is not currently running' };
  }

  /**
   * Cancel an active campaign
   */
  cancelCampaign(campaignId) {
    const state = this.activeCampaigns.get(campaignId);
    if (state) {
      state.isCancelled = true;
      const db = getDb();
      db.prepare("UPDATE campaigns SET status = 'cancelled', completed_at = datetime('now') WHERE id = ?").run(campaignId);
      this.broadcast(campaignId, 'status_change', { status: 'cancelled', message: 'Campaign aborted by recruiter' });
      this.activeCampaigns.delete(campaignId);
      return { success: true, message: 'Campaign cancelled' };
    }
    return { success: false, message: 'Campaign is not active' };
  }

  /**
   * Internal queue runner
   */
  async processCampaignQueue(campaignId) {
    const db = getDb();

    while (this.activeCampaigns.has(campaignId)) {
      const state = this.activeCampaigns.get(campaignId);

      if (state.isCancelled) {
        break;
      }

      if (state.isPaused) {
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }

      // Fetch next pending recipient
      const recipient = db.prepare(`
        SELECT cr.*, s.branch, s.batch, s.phone as s_phone
        FROM campaign_recipients cr
        LEFT JOIN students s ON cr.student_id = s.id
        WHERE cr.campaign_id = ? AND cr.status = 'pending'
        ORDER BY cr.id ASC
        LIMIT 1
      `).get(campaignId);

      if (!recipient) {
        // All recipients processed!
        break;
      }

      const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
      const config = getMailerConfig();
      const sendDelay = parseInt(config.send_delay_ms || '300', 10);
      const rotationStrategy = config.smtp_rotation_strategy || 'round_robin';

      // Render personalized subject and body with campaign's dynamic Apply Now link
      const studentData = {
        name: recipient.recipient_name,
        email: recipient.recipient_email,
        college: recipient.recipient_college,
        phone: recipient.recipient_phone || recipient.s_phone || '',
        branch: recipient.branch || 'Computer Science',
        batch: recipient.batch || '2026'
      };

      const customVars = {
        apply_link: campaign.apply_link || 'https://aparaitech.org/apply',
        ApplyLink: campaign.apply_link || 'https://aparaitech.org/apply',
        Application_Link: campaign.apply_link || 'https://aparaitech.org/apply'
      };

      const renderedSubject = renderText(campaign.subject, studentData, customVars);
      const renderedBody = renderText(campaign.body_html, studentData, customVars);

      // Pick next SMTP account from pool with failover support
      let chosenSmtp = smtpPool.getNextAccount(rotationStrategy);
      let sendResult = null;
      let failoverAttempts = 0;
      const excludedSmtpIds = [];

      while (failoverAttempts < 3) {
        sendResult = await sendEmail({
          to: recipient.recipient_email,
          recipientName: recipient.recipient_name,
          subject: renderedSubject,
          html: renderedBody,
          campaignId,
          studentId: recipient.student_id,
          student: studentData,
          smtpAccount: chosenSmtp
        });

        if (!sendResult.success && chosenSmtp && smtpPool.isRetryableError(sendResult.error)) {
          excludedSmtpIds.push(chosenSmtp.id);
          const nextSmtp = smtpPool.getNextAccount(rotationStrategy, excludedSmtpIds);
          if (nextSmtp && nextSmtp.id !== chosenSmtp.id) {
            this.broadcast(campaignId, 'smtp_switched', {
              oldSender: chosenSmtp.from_email || chosenSmtp.user,
              newSender: nextSmtp.from_email || nextSmtp.user,
              reason: sendResult.isQuotaError
                ? 'Daily quota limit reached on sender. Auto-switched to backup sender seamlessly.'
                : `Transmission issue (${sendResult.error}). Auto-failover to backup sender.`
            });
            chosenSmtp = nextSmtp;
            failoverAttempts++;
            continue;
          }
        }
        break;
      }

      // Update recipient record
      if (sendResult.success) {
        db.prepare(`
          UPDATE campaign_recipients
          SET status = 'sent',
              latency_ms = ?,
              rendered_subject = ?,
              rendered_body = ?,
              sent_at = datetime('now'),
              attempts = attempts + 1,
              smtp_account_id = ?,
              smtp_sender = ?
          WHERE id = ?
        `).run(
          sendResult.latencyMs,
          renderedSubject,
          renderedBody,
          sendResult.smtpAccountId || null,
          sendResult.smtpSender || (chosenSmtp ? chosenSmtp.from_email : ''),
          recipient.id
        );

        db.prepare(`
          UPDATE campaigns
          SET sent_count = sent_count + 1,
              success_count = success_count + 1
          WHERE id = ?
        `).run(campaignId);

        subscriptionService.recordEmailSent(db, 1);
      } else {
        db.prepare(`
          UPDATE campaign_recipients
          SET status = 'failed',
              error_message = ?,
              latency_ms = ?,
              rendered_subject = ?,
              rendered_body = ?,
              sent_at = datetime('now'),
              attempts = attempts + 1,
              smtp_account_id = ?,
              smtp_sender = ?
          WHERE id = ?
        `).run(
          sendResult.error,
          sendResult.latencyMs,
          renderedSubject,
          renderedBody,
          sendResult.smtpAccountId || null,
          sendResult.smtpSender || (chosenSmtp ? chosenSmtp.from_email : ''),
          recipient.id
        );

        db.prepare(`
          UPDATE campaigns
          SET sent_count = sent_count + 1,
              failed_count = failed_count + 1
          WHERE id = ?
        `).run(campaignId);
      }

      // Store delivery result in Atlas asynchronously so blast execution is never delayed
      if (process.env.MONGODB_URI) {
        syncCampaignDelivery(campaignId, recipient.id).catch(() => {});
      }

      state.processedCount++;

      // Compute live stats
      const updatedCampaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
      const elapsedSeconds = Math.max(0.1, (Date.now() - state.startTime) / 1000);
      const speedEps = (state.processedCount / elapsedSeconds).toFixed(1);
      const remainingCount = updatedCampaign.total_recipients - updatedCampaign.sent_count;
      const etaSeconds = speedEps > 0 ? Math.ceil(remainingCount / parseFloat(speedEps)) : 0;
      const percentage = Math.round((updatedCampaign.sent_count / updatedCampaign.total_recipients) * 100) || 0;

      // Broadcast progress event
      this.broadcast(campaignId, 'progress', {
        campaignId,
        total: updatedCampaign.total_recipients,
        sent: updatedCampaign.sent_count,
        success: updatedCampaign.success_count,
        failed: updatedCampaign.failed_count,
        percentage,
        speedEps: parseFloat(speedEps),
        etaSeconds,
        currentRecipient: {
          name: recipient.recipient_name,
          email: recipient.recipient_email,
          college: recipient.recipient_college,
          status: sendResult.success ? 'sent' : 'failed',
          latencyMs: sendResult.latencyMs,
          error: sendResult.error || null
        }
      });

      // Broadcast log event
      this.broadcast(campaignId, 'log', {
        timestamp: new Date().toLocaleTimeString(),
        level: sendResult.success ? 'info' : 'error',
        recipientEmail: recipient.recipient_email,
        recipientName: recipient.recipient_name,
        college: recipient.recipient_college,
        status: sendResult.success ? 'Delivered' : 'Failed',
        latencyMs: sendResult.latencyMs,
        error: sendResult.error || null,
        message: sendResult.success
          ? `Dispatched to ${recipient.recipient_email} (${recipient.recipient_college}) [${sendResult.latencyMs}ms]`
          : `Failed for ${recipient.recipient_email}: ${sendResult.error}`
      });

      // Anti-Spam Humanized Pacing: apply randomized jitter variance
      const actualDelay = humanizeDelay(sendDelay);

      // Strategic micro-pause every 25 emails (2.5s breather to reset recipient ESP rate traps)
      if (state.processedCount > 0 && state.processedCount % 25 === 0) {
        this.broadcast(campaignId, 'log', {
          timestamp: new Date().toLocaleTimeString(),
          level: 'info',
          recipientEmail: '',
          recipientName: '',
          college: '',
          status: 'Pacing',
          latencyMs: 2500,
          error: null,
          message: '🛡️ Anti-Spam Shield: Natural breathing pause (2.5s) to protect sender reputation & avoid ESP rate limits.'
        });
        await new Promise(resolve => setTimeout(resolve, 2500));
      } else if (actualDelay > 0) {
        await new Promise(resolve => setTimeout(resolve, actualDelay));
      }
    }

    // Wrap up completed campaign
    const finalCampaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
    const finalStatus = (finalCampaign && finalCampaign.status === 'cancelled') ? 'cancelled' : 'completed';

    db.prepare(`
      UPDATE campaigns
      SET status = ?, completed_at = datetime('now')
      WHERE id = ?
    `).run(finalStatus, campaignId);

    this.broadcast(campaignId, 'done', {
      campaignId,
      status: finalStatus,
      total: finalCampaign ? finalCampaign.total_recipients : 0,
      success: finalCampaign ? finalCampaign.success_count : 0,
      failed: finalCampaign ? finalCampaign.failed_count : 0,
      completedAt: new Date().toISOString()
    });

    this.activeCampaigns.delete(campaignId);
  }

  /**
   * Retry failed recipients in a campaign
   */
  retryFailed(campaignId) {
    const db = getDb();
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    // Reset failed recipients to pending
    const updateResult = db.prepare(`
      UPDATE campaign_recipients
      SET status = 'pending', error_message = ''
      WHERE campaign_id = ? AND status = 'failed'
    `).run(campaignId);

    if (updateResult.changes === 0) {
      return { success: false, message: 'No failed recipients found to retry in this campaign.' };
    }

    // Recalculate campaign counts
    const pendingCount = db.prepare(`
      SELECT count(*) as count FROM campaign_recipients WHERE campaign_id = ? AND status = 'pending'
    `).get(campaignId).count;

    const successCount = db.prepare(`
      SELECT count(*) as count FROM campaign_recipients WHERE campaign_id = ? AND status = 'sent'
    `).get(campaignId).count;

    const failedCount = 0;
    const sentCount = successCount;

    db.prepare(`
      UPDATE campaigns
      SET sent_count = ?, success_count = ?, failed_count = ?, status = 'draft'
      WHERE id = ?
    `).run(sentCount, successCount, failedCount, campaignId);

    return {
      success: true,
      retriedCount: updateResult.changes,
      message: `Re-queued ${updateResult.changes} failed recipients for retry.`
    };
  }
}

const blastManager = new BlastManager();
module.exports = blastManager;
