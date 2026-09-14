const express = require('express');
const router = express.Router();
const xlsx = require('xlsx');
const { getDb } = require('../database/db');
const blastManager = require('../services/blastManager');
const { sendEmail, getMailerConfig } = require('../services/mailer');
const { renderText } = require('../services/templateEngine');
const { syncCampaignDelivery, getPersistentMongoDb } = require('../database/mongo');
const { analyzeSpamRisk, checkDomainDns } = require('../services/spamShield');
const { ObjectId } = require('mongodb');

// GET /api/campaigns - List all campaigns
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const { getOptionalAuth } = require('./auth');
    const user = getOptionalAuth(req);

    let whereSql = '';
    let params = [];

    if (user && user.role === 'customer') {
      whereSql = 'WHERE c.user_id = ?';
      params.push(user.id);
    }

    const campaigns = db.prepare(`
      SELECT 
        c.*,
        (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id = c.id AND cr.status = 'sent') as computed_sent,
        (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id = c.id AND cr.status = 'failed') as computed_failed,
        (SELECT COUNT(*) FROM campaign_recipients cr WHERE cr.campaign_id = c.id AND cr.status = 'pending') as computed_pending
      FROM campaigns c
      ${whereSql}
      ORDER BY c.id DESC
    `).all(...params);

    res.json({ success: true, campaigns });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/campaigns/spam-check - Real-time Anti-Spam Deliverability analysis
router.post('/spam-check', (req, res) => {
  try {
    const { subject = '', body_html = '', apply_link = '', sender_email = '' } = req.body;
    const config = getMailerConfig();
    const activeSender = sender_email || config.from_email || config.smtp_user || 'recruitment@aparaitech.org';

    const result = analyzeSpamRisk({
      subject,
      html: body_html,
      applyLink: apply_link,
      senderEmail: activeSender
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/campaigns/dns-check - Check SPF, MX, and DMARC for sender domain
router.get('/dns-check', async (req, res) => {
  try {
    const config = getMailerConfig();
    let domain = req.query.domain;

    if (!domain) {
      const fromEmail = config.from_email || config.smtp_user || 'aparaitech.org';
      domain = fromEmail.includes('@') ? fromEmail.split('@')[1] : fromEmail;
    }

    const dnsResult = await checkDomainDns(domain);
    res.json({ success: true, ...dnsResult });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/campaigns/:id - Get campaign details
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const { getOptionalAuth } = require('./auth');
    const user = getOptionalAuth(req);

    const campaign = (user && user.role === 'customer')
      ? db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(req.params.id, user.id)
      : db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const summary = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        AVG(CASE WHEN latency_ms > 0 THEN latency_ms ELSE NULL END) as avg_latency
      FROM campaign_recipients
      WHERE campaign_id = ?
    `).get(req.params.id);

    res.json({
      success: true,
      campaign,
      summary: {
        total: summary.total || 0,
        sent: summary.sent || 0,
        failed: summary.failed || 0,
        pending: summary.pending || 0,
        avgLatencyMs: Math.round(summary.avg_latency || 0)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/campaigns/:id/recipients - Get delivery logs for a campaign
router.get('/:id/recipients', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { status = '', search = '', page = 1, limit = 50 } = req.query;

    const { getOptionalAuth } = require('./auth');
    const user = getOptionalAuth(req);

    const campaign = (user && user.role === 'customer')
      ? db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(id, user.id)
      : db.prepare('SELECT id FROM campaigns WHERE id = ?').get(id);

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const validLimit = Math.min(200, Math.max(1, parseInt(limit, 10)));

    let whereClauses = ['campaign_id = ?'];
    let params = [id];

    if (status.trim()) {
      whereClauses.push('status = ?');
      params.push(status.trim());
    }

    if (search.trim()) {
      whereClauses.push('(recipient_name LIKE ? OR recipient_email LIKE ? OR recipient_college LIKE ?)');
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

    const totalRow = db.prepare(`SELECT COUNT(*) as total FROM campaign_recipients ${whereSql}`).get(...params);
    const total = totalRow ? totalRow.total : 0;

    const recipients = db.prepare(`
      SELECT * FROM campaign_recipients
      ${whereSql}
      ORDER BY id ASC
      LIMIT ? OFFSET ?
    `).all(...params, validLimit, offset);

    res.json({
      success: true,
      recipients,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: validLimit,
        totalPages: Math.ceil(total / validLimit) || 1
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/campaigns - Launch a new email blast campaign
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const {
      title,
      subject,
      body_html,
      apply_link = 'https://aparaitech.org/apply',
      target_type = 'all', // 'all', 'college', 'batch', 'selected', 'import_batch', 'upload_batch'
      target_colleges = [],
      target_batches = [],
      target_upload_batches = [],
      target_batch_id = '',
      selected_student_ids = []
    } = req.body;

    if (!title || !subject || !body_html) {
      return res.status(400).json({ success: false, message: 'Campaign Title, Subject, and Email Body are required.' });
    }

    // Check customer subscription & 7-day trial status
    const authHeader = req.headers.authorization || req.headers['x-auth-token'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    let userId = null;
    if (token) {
      const authService = require('../services/authService');
      const sessionUser = authService.validateSession(db, token);
      if (sessionUser && sessionUser.role === 'customer') {
        userId = sessionUser.id;
      }
    }
    const subscriptionService = require('../services/subscriptionService');
    const sub = subscriptionService.getActiveSubscription(db, userId);
    if (sub && sub.status === 'trial' && sub.is_trial_expired) {
      return res.status(403).json({
        success: false,
        message: 'Your 7-day free trial has expired. Please upgrade your subscription to continue launching campaigns.'
      });
    }

    // Determine target students
    let targetStudents = [];

    // 1. If not a customer, try fetching from MongoDB Atlas if active
    if (process.env.MONGODB_URI && !userId) {
      try {
        const mongo = await getPersistentMongoDb();
        const mongoFilter = { status: { $ne: 'Inactive' } };

        if (target_type === 'selected' && Array.isArray(selected_student_ids) && selected_student_ids.length > 0) {
          const objIds = selected_student_ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
          const strIds = selected_student_ids.map(id => String(id));
          const numIds = selected_student_ids.map(id => Number(id)).filter(n => !isNaN(n));
          mongoFilter.$or = [
            ...(objIds.length ? [{ _id: { $in: objIds } }] : []),
            ...(strIds.length ? [{ id: { $in: strIds } }] : []),
            ...(numIds.length ? [{ sqlite_id: { $in: numIds } }] : [])
          ];
        } else if (target_type === 'college' && Array.isArray(target_colleges) && target_colleges.length > 0) {
          mongoFilter.college = { $in: target_colleges };
        } else if (target_type === 'batch' && Array.isArray(target_batches) && target_batches.length > 0) {
          mongoFilter.batch = { $in: target_batches };
        } else if (target_type === 'import_batch' || target_type === 'upload_batch') {
          const batchIds = target_upload_batches.length > 0 ? target_upload_batches : (target_batch_id ? [target_batch_id] : []);
          if (batchIds.length > 0) {
            mongoFilter.import_batch_id = { $in: batchIds };
          }
        }

        const mongoResults = await mongo.collection('students').find(mongoFilter).toArray();
        if (mongoResults && mongoResults.length > 0) {
          targetStudents = mongoResults.map((s) => ({
            id: typeof s.sqlite_id === 'number' ? s.sqlite_id : null,
            sqlite_id: typeof s.sqlite_id === 'number' ? s.sqlite_id : null,
            mongo_id: String(s._id),
            name: s.name || 'Candidate',
            email: s.email,
            college: s.college || 'Aparaitech Partner College',
            phone: s.phone || '',
            branch: s.branch || 'Computer Science',
            batch: s.batch || '2026'
          }));
        }
      } catch (mongoErr) {
        console.warn('MongoDB target students query error, falling back to SQLite:', mongoErr.message);
      }
    }

    // 2. Fetch from SQLite (strictly filtered by customer user_id if customer)
    if (targetStudents.length === 0) {
      const userCondition = userId ? ' AND user_id = ?' : '';
      const userParam = userId ? [userId] : [];

      if (target_type === 'selected' && Array.isArray(selected_student_ids) && selected_student_ids.length > 0) {
        const placeholders = selected_student_ids.map(() => '?').join(',');
        targetStudents = db.prepare(`SELECT * FROM students WHERE id IN (${placeholders}) AND status = 'Active'${userCondition}`).all(...selected_student_ids, ...userParam);
      } else if (target_type === 'college' && Array.isArray(target_colleges) && target_colleges.length > 0) {
        const placeholders = target_colleges.map(() => '?').join(',');
        targetStudents = db.prepare(`SELECT * FROM students WHERE college IN (${placeholders}) AND status = 'Active'${userCondition}`).all(...target_colleges, ...userParam);
      } else if (target_type === 'batch' && Array.isArray(target_batches) && target_batches.length > 0) {
        const placeholders = target_batches.map(() => '?').join(',');
        targetStudents = db.prepare(`SELECT * FROM students WHERE batch IN (${placeholders}) AND status = 'Active'${userCondition}`).all(...target_batches, ...userParam);
      } else if (target_type === 'import_batch' || target_type === 'upload_batch') {
        const batchIds = target_upload_batches.length > 0 ? target_upload_batches : (target_batch_id ? [target_batch_id] : []);
        if (batchIds.length > 0) {
          const placeholders = batchIds.map(() => '?').join(',');
          targetStudents = db.prepare(`SELECT * FROM students WHERE import_batch_id IN (${placeholders}) AND status = 'Active'${userCondition}`).all(...batchIds, ...userParam);
        }
      } else {
        // Default: All active students for this customer (or global if admin)
        targetStudents = db.prepare(`SELECT * FROM students WHERE status = 'Active'${userCondition}`).all(...userParam);
      }
    }

    if (targetStudents.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active student recipients found for the selected audience criteria. Please check your candidate pool or upload a student list.'
      });
    }

    // Insert Campaign
    const targetFilterMeta = JSON.stringify({
      target_type,
      target_colleges,
      target_batches,
      target_upload_batches,
      target_batch_id,
      selected_student_ids_count: selected_student_ids.length
    });

    const createCampStmt = db.prepare(`
      INSERT INTO campaigns (title, subject, body_html, apply_link, target_type, target_filter, total_recipients, sent_count, success_count, failed_count, status, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 'draft', ?)
    `);

    const result = createCampStmt.run(
      title.trim(),
      subject.trim(),
      body_html,
      (apply_link || 'https://aparaitech.org/apply').trim(),
      target_type,
      targetFilterMeta,
      targetStudents.length,
      userId
    );

    const campaignId = result.lastInsertRowid;

    // Insert Recipients in a transaction (with safe foreign key resolution)
    const checkStudentStmt = db.prepare('SELECT id FROM students WHERE id = ?');
    const insertRecipStmt = db.prepare(`
      INSERT INTO campaign_recipients (campaign_id, student_id, recipient_name, recipient_email, recipient_college, recipient_phone, status)
      VALUES (?, ?, ?, ?, ?, ?, 'pending')
    `);

    const insertTx = db.transaction(() => {
      for (const student of targetStudents) {
        let validStudentId = null;
        if (student.sqlite_id && typeof student.sqlite_id === 'number') {
          const found = checkStudentStmt.get(student.sqlite_id);
          if (found) validStudentId = student.sqlite_id;
        } else if (student.id && typeof student.id === 'number') {
          const found = checkStudentStmt.get(student.id);
          if (found) validStudentId = student.id;
        }

        insertRecipStmt.run(
          campaignId,
          validStudentId,
          student.name,
          student.email,
          student.college,
          student.phone || ''
        );
      }
    });

    insertTx();

    // Persist the campaign queue before the background sender starts.
    if (process.env.MONGODB_URI) {
      await syncCampaignDelivery(campaignId);
    }

    // Start background mail blast
    blastManager.startCampaign(campaignId).catch(err => {
      console.error(`Blast execution error for ${campaignId}:`, err);
    });

    res.status(201).json({
      success: true,
      campaignId,
      totalRecipients: targetStudents.length,
      message: `Email blast initiated for ${targetStudents.length} students!`
    });
  } catch (error) {
    console.error('Launch campaign error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/campaigns/test-send - Send a single preview test email
router.post('/test-send', async (req, res) => {
  try {
    const db = getDb();
    const { test_email, subject, body_html, apply_link = 'https://aparaitech.org/apply', studentId } = req.body;

    if (!test_email) {
      return res.status(400).json({ success: false, message: 'Test email address is required.' });
    }

    let sampleStudent = null;
    if (studentId) {
      if (process.env.MONGODB_URI) {
        try {
          const mongo = await getPersistentMongoDb();
          if (ObjectId.isValid(studentId)) {
            sampleStudent = await mongo.collection('students').findOne({ _id: new ObjectId(studentId) });
          }
        } catch (e) {}
      }
      if (!sampleStudent) {
        sampleStudent = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
      }
    }
    if (!sampleStudent && process.env.MONGODB_URI) {
      try {
        const mongo = await getPersistentMongoDb();
        sampleStudent = await mongo.collection('students').findOne({});
      } catch (e) {}
    }
    if (!sampleStudent) {
      sampleStudent = db.prepare('SELECT * FROM students LIMIT 1').get() || {
        name: 'Test Recruiter Candidate',
        email: test_email,
        college: 'Aparaitech Partner College',
        phone: '+91 9999999999',
        branch: 'Computer Science',
        batch: '2026'
      };
    }

    const customVars = {
      apply_link: apply_link || 'https://aparaitech.org/apply',
      ApplyLink: apply_link || 'https://aparaitech.org/apply',
      Application_Link: apply_link || 'https://aparaitech.org/apply'
    };

    const renderedSubject = renderText(subject || 'Test Email Blast', sampleStudent, customVars);
    const renderedBody = renderText(body_html || '<p>This is a test recruitment blast preview.</p>', sampleStudent, customVars);

    const result = await sendEmail({
      to: test_email.trim(),
      recipientName: sampleStudent.name,
      subject: `[TEST BLAST] ${renderedSubject}`,
      html: renderedBody,
      student: sampleStudent
    });

    if (result.success) {
      res.json({
        success: true,
        message: `Test email dispatched to ${test_email} (${result.latencyMs}ms)`,
        mode: result.mode
      });
    } else {
      res.status(400).json({
        success: false,
        message: `Failed to send test email: ${result.error}`,
        mode: result.mode
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/campaigns/:id/pause - Pause running blast
router.post('/:id/pause', (req, res) => {
  try {
    const db = getDb();
    const { getOptionalAuth } = require('./auth');
    const user = getOptionalAuth(req);
    const campaignId = parseInt(req.params.id, 10);

    if (user && user.role === 'customer') {
      const camp = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(campaignId, user.id);
      if (!camp) return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const result = blastManager.pauseCampaign(campaignId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/campaigns/:id/resume - Resume paused blast
router.post('/:id/resume', (req, res) => {
  try {
    const db = getDb();
    const { getOptionalAuth } = require('./auth');
    const user = getOptionalAuth(req);
    const campaignId = parseInt(req.params.id, 10);

    if (user && user.role === 'customer') {
      const camp = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(campaignId, user.id);
      if (!camp) return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    blastManager.startCampaign(campaignId);
    res.json({ success: true, message: 'Campaign resumed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/campaigns/:id/cancel - Abort blast
router.post('/:id/cancel', (req, res) => {
  try {
    const db = getDb();
    const { getOptionalAuth } = require('./auth');
    const user = getOptionalAuth(req);
    const campaignId = parseInt(req.params.id, 10);

    if (user && user.role === 'customer') {
      const camp = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(campaignId, user.id);
      if (!camp) return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const result = blastManager.cancelCampaign(campaignId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/campaigns/:id/retry-failed - Retry failed deliveries
router.post('/:id/retry-failed', (req, res) => {
  try {
    const db = getDb();
    const { getOptionalAuth } = require('./auth');
    const user = getOptionalAuth(req);
    const campaignId = parseInt(req.params.id, 10);

    if (user && user.role === 'customer') {
      const camp = db.prepare('SELECT id FROM campaigns WHERE id = ? AND user_id = ?').get(campaignId, user.id);
      if (!camp) return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const retryResult = blastManager.retryFailed(campaignId);

    if (retryResult.success) {
      // Automatically restart blast for retrying
      blastManager.startCampaign(campaignId).catch(err => {
        console.error('Error starting retry blast:', err);
      });
      res.json(retryResult);
    } else {
      res.status(400).json(retryResult);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/campaigns/:id/stream - SSE Live Progress Endpoint
router.get('/:id/stream', (req, res) => {
  const campaignId = parseInt(req.params.id, 10);

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Send initial state
  const db = getDb();
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (campaign) {
    const initialPayload = {
      campaignId,
      total: campaign.total_recipients,
      sent: campaign.sent_count,
      success: campaign.success_count,
      failed: campaign.failed_count,
      status: campaign.status,
      percentage: Math.round((campaign.sent_count / Math.max(1, campaign.total_recipients)) * 100)
    };
    res.write(`event: progress\ndata: ${JSON.stringify(initialPayload)}\n\n`);
  }

  // Subscribe client to manager
  blastManager.addSseClient(campaignId, res);
});

// GET /api/campaigns/:id/export - Export delivery report to CSV
router.get('/:id/export', (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { getOptionalAuth } = require('./auth');
    const user = getOptionalAuth(req);

    const campaign = (user && user.role === 'customer')
      ? db.prepare('SELECT * FROM campaigns WHERE id = ? AND user_id = ?').get(id, user.id)
      : db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);

    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const recipients = db.prepare(`
      SELECT 
        recipient_name as "Student Name",
        recipient_email as "Email Address",
        recipient_college as "College",
        recipient_phone as "Phone",
        status as "Delivery Status",
        latency_ms as "Latency (ms)",
        error_message as "Error Reason",
        sent_at as "Delivery Timestamp"
      FROM campaign_recipients
      WHERE campaign_id = ?
      ORDER BY id ASC
    `).all(id);

    const worksheet = xlsx.utils.json_to_sheet(recipients);
    const csv = xlsx.utils.sheet_to_csv(worksheet);

    const safeTitle = campaign.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="delivery_report_${safeTitle}_${id}.csv"`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
