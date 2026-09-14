const nodemailer = require('nodemailer');
const { getDb } = require('../database/db');
const { primeDns } = require('./dnsHelper');

class SmtpPoolManager {
  constructor() {
    this.roundRobinIndex = 0;
  }

  /**
   * Get today's date string in YYYY-MM-DD format
   */
  getTodayString() {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Auto-reset daily counters for accounts if date has changed
   */
  checkAndResetDailyCounters(db) {
    const today = this.getTodayString();
    db.prepare(`
      UPDATE smtp_accounts 
      SET sent_today = 0, last_sent_date = ?
      WHERE last_sent_date != ? OR last_sent_date IS NULL OR last_sent_date = ''
    `).run(today, today);
  }

  /**
   * Get all active SMTP accounts that have not exceeded their daily limit
   */
  getAvailableAccounts() {
    const db = getDb();
    this.checkAndResetDailyCounters(db);

    const accounts = db.prepare(`
      SELECT * FROM smtp_accounts 
      WHERE is_active = 1
      ORDER BY priority ASC, id ASC
    `).all();

    // Separate accounts that haven't reached daily limit vs limit reached
    return accounts.map(acc => {
      const limit = parseInt(acc.daily_limit, 10) || 0;
      const sent = parseInt(acc.sent_today, 10) || 0;
      const isLimitReached = limit > 0 && sent >= limit;
      return {
        ...acc,
        isLimitReached,
        remainingToday: limit > 0 ? Math.max(0, limit - sent) : Infinity
      };
    });
  }

  /**
   * Get next SMTP account based on rotation strategy
   * @param {string} strategy - 'round_robin', 'auto_failover', or 'single'
   * @param {Array<number>} excludeIds - IDs of accounts that failed in current retry loop
   */
  getNextAccount(strategy = 'round_robin', excludeIds = []) {
    const accounts = this.getAvailableAccounts();
    const available = accounts.filter(a => !a.isLimitReached && !excludeIds.includes(a.id));

    if (available.length === 0) {
      // Fallback: If all available accounts exceeded limits, check if any active account exists
      const anyActive = accounts.filter(a => !excludeIds.includes(a.id));
      if (anyActive.length > 0) {
        return anyActive[0];
      }
      return null;
    }

    if (strategy === 'round_robin') {
      const selected = available[this.roundRobinIndex % available.length];
      this.roundRobinIndex = (this.roundRobinIndex + 1) % available.length;
      return selected;
    } else if (strategy === 'auto_failover' || strategy === 'single') {
      // Pick the first highest-priority account with remaining capacity
      return available[0];
    }

    return available[0];
  }

  /**
   * Record successful email send for an SMTP account
   */
  recordSendSuccess(accountId) {
    if (!accountId) return;
    try {
      const db = getDb();
      const today = this.getTodayString();
      db.prepare(`
        UPDATE smtp_accounts 
        SET sent_today = sent_today + 1,
            last_sent_date = ?,
            last_used_at = datetime('now'),
            updated_at = datetime('now')
        WHERE id = ?
      `).run(today, accountId);
    } catch (err) {
      console.error('Error recording send success:', err.message);
    }
  }

  /**
   * Check if error message indicates quota / rate limit exceeded
   */
  isQuotaError(errorMessage) {
    if (!errorMessage) return false;
    const lower = errorMessage.toLowerCase();
    return (
      lower.includes('quota') ||
      lower.includes('limit') ||
      lower.includes('550 5.4.5') ||
      lower.includes('421 4.7.0') ||
      lower.includes('too many') ||
      lower.includes('rate exceeded') ||
      lower.includes('daily user sending')
    );
  }

  /**
   * Check if error is transient, connection-related, or quota-related so it can be retried on another pool sender
   */
  isRetryableError(errorMessage) {
    if (!errorMessage) return false;
    const lower = errorMessage.toLowerCase();
    return (
      this.isQuotaError(errorMessage) ||
      lower.includes('etimedout') ||
      lower.includes('etimeout') ||
      lower.includes('econnreset') ||
      lower.includes('econnrefused') ||
      lower.includes('greeting') ||
      lower.includes('socket') ||
      lower.includes('network') ||
      lower.includes('edns') ||
      lower.includes('temporary') ||
      lower.includes('try again')
    );
  }

  /**
   * Mark account as limit reached when quota error is encountered
   */
  markLimitReached(accountId) {
    if (!accountId) return;
    try {
      const db = getDb();
      const account = db.prepare('SELECT * FROM smtp_accounts WHERE id = ?').get(accountId);
      if (account) {
        const limit = account.daily_limit > 0 ? account.daily_limit : 500;
        db.prepare(`
          UPDATE smtp_accounts 
          SET sent_today = ?,
              last_sent_date = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).run(limit, this.getTodayString(), accountId);
      }
    } catch (err) {
      console.error('Error marking limit reached:', err.message);
    }
  }

  /**
   * Test SMTP account connection
   */
  async testAccountConnection(account) {
    try {
      const host = account.host || 'smtp.gmail.com';
      await primeDns(host);

      const transporter = nodemailer.createTransport({
        host,
        port: parseInt(account.port, 10) || 587,
        secure: account.secure === 1 || account.secure === true || account.port === '465' || account.port === 465,
        auth: {
          user: (account.user || '').trim(),
          pass: (account.pass || '').trim().replace(/\s+/g, '')
        },
        tls: {
          rejectUnauthorized: false
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
        dnsTimeout: 5000
      });

      await transporter.verify();
      return {
        success: true,
        message: `Successfully connected to SMTP server (${account.host}:${account.port}) for user ${account.user}`
      };
    } catch (err) {
      return {
        success: false,
        message: `Connection failed for ${account.user}: ${err.message}`
      };
    }
  }

  /**
   * Reset all daily sending counters
   */
  resetAllDailyCounters() {
    const db = getDb();
    const today = this.getTodayString();
    const result = db.prepare(`
      UPDATE smtp_accounts 
      SET sent_today = 0, last_sent_date = ?
    `).run(today);
    return {
      success: true,
      resetCount: result.changes,
      message: `Reset daily counters for ${result.changes} SMTP account(s).`
    };
  }
}

module.exports = new SmtpPoolManager();
