const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { verifySmtpConnection, getMailerConfig } = require('../services/mailer');
const smtpPool = require('../services/smtpPool');
const { syncSmtpConfiguration } = require('../database/mongo');
const subscriptionService = require('../services/subscriptionService');

// GET /api/settings - Fetch all settings as key-value object
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const config = {};
    rows.forEach(r => { config[r.key] = r.value; });

    // Mask password for security if returned
    if (config.smtp_pass) {
      config.smtp_pass_masked = config.smtp_pass ? '••••••••' : '';
    }

    res.json({ success: true, settings: config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/settings - Update settings
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const updates = req.body;

    const updateStmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    const updateTx = db.transaction(() => {
      for (const [key, value] of Object.entries(updates)) {
        if (value === undefined || value === null) continue;
        
        // If password is sent as masked bullet dots '••••••••' without edit, keep existing password
        if (key === 'smtp_pass' && value === '••••••••') {
          continue;
        }
        
        updateStmt.run(key, String(value));
      }
    });

    updateTx();

    if (process.env.MONGODB_URI) await syncSmtpConfiguration();

    res.json({ success: true, message: 'Settings & SMTP credentials saved successfully!' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/settings/test-smtp - Test SMTP connection
router.post('/test-smtp', async (req, res) => {
  try {
    const result = await verifySmtpConnection(req.body);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/settings/smtp-accounts - List all multi-SMTP sender accounts
router.get('/smtp-accounts', (req, res) => {
  try {
    const db = getDb();
    smtpPool.checkAndResetDailyCounters(db);

    const { getOptionalAuth } = require('./auth');
    const user = getOptionalAuth(req);

    let accounts;
    if (user && user.role === 'customer') {
      accounts = db.prepare(`
        SELECT * FROM smtp_accounts
        WHERE user_id = ?
        ORDER BY priority ASC, id ASC
      `).all(user.id);
    } else {
      accounts = db.prepare(`
        SELECT * FROM smtp_accounts
        ORDER BY priority ASC, id ASC
      `).all();
    }

    res.json({
      success: true,
      accounts: accounts.map(acc => ({
        ...acc,
        isLimitReached: acc.daily_limit > 0 && acc.sent_today >= acc.daily_limit,
        remainingToday: acc.daily_limit > 0 ? Math.max(0, acc.daily_limit - acc.sent_today) : Infinity
      }))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/settings/smtp-accounts - Add new SMTP account
router.post('/smtp-accounts', async (req, res) => {
  try {
    const db = getDb();
    const {
      name,
      host = 'smtp.gmail.com',
      port = 587,
      secure = 0,
      user,
      pass,
      from_name = 'Aparaitech Recruitment Team',
      from_email,
      reply_to = 'careers@aparaitech.org',
      daily_limit = 500,
      priority = 1,
      is_active = 1
    } = req.body;

    if (!name || !user || !pass) {
      return res.status(400).json({
        success: false,
        message: 'Account Name, Username/Email, and App Password are required.'
      });
    }

    // Determine customer context if logged in
    let userId = null;
    const authHeader = req.headers.authorization || req.headers['x-auth-token'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    if (token) {
      const authService = require('../services/authService');
      const sessionUser = authService.validateSession(db, token);
      if (sessionUser && sessionUser.role === 'customer') {
        userId = sessionUser.id;
      }
    }

    // Check subscription server allocation quota ("how much server you gave")
    if (is_active !== 0 && is_active !== false) {
      const serverCheck = subscriptionService.canAddServer(db, userId);
      if (!serverCheck.allowed) {
        return res.status(403).json({
          success: false,
          quotaExceeded: true,
          message: serverCheck.message
        });
      }
    }

    const cleanPass = pass ? pass.trim().replace(/\s+/g, '') : '';

    const result = db.prepare(`
      INSERT INTO smtp_accounts (name, host, port, secure, user, pass, from_name, from_email, reply_to, daily_limit, sent_today, is_active, priority, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
    `).run(
      name.trim(),
      host.trim(),
      parseInt(port, 10) || 587,
      secure ? 1 : 0,
      user.trim(),
      cleanPass,
      from_name.trim(),
      (from_email || user).trim(),
      (reply_to || 'careers@aparaitech.org').trim(),
      parseInt(daily_limit, 10) || 500,
      is_active ? 1 : 0,
      parseInt(priority, 10) || 1,
      userId
    );

    const newAccount = db.prepare('SELECT * FROM smtp_accounts WHERE id = ?').get(result.lastInsertRowid);
    if (process.env.MONGODB_URI) await syncSmtpConfiguration();
    res.status(201).json({
      success: true,
      message: `SMTP sender account "${name}" created successfully!`,
      account: newAccount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/settings/smtp-accounts/:id - Update SMTP account
router.put('/smtp-accounts/:id', async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const {
      name,
      host,
      port,
      secure,
      user,
      pass,
      from_name,
      from_email,
      reply_to,
      daily_limit,
      priority,
      is_active
    } = req.body;

    const existing = db.prepare('SELECT * FROM smtp_accounts WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'SMTP account not found.' });
    }

    const updatedPass = (pass && pass !== '••••••••') ? pass.trim().replace(/\s+/g, '') : existing.pass;

    db.prepare(`
      UPDATE smtp_accounts
      SET name = ?, host = ?, port = ?, secure = ?, user = ?, pass = ?,
          from_name = ?, from_email = ?, reply_to = ?, daily_limit = ?,
          priority = ?, is_active = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name ? name.trim() : existing.name,
      host ? host.trim() : existing.host,
      port !== undefined ? parseInt(port, 10) : existing.port,
      secure !== undefined ? (secure ? 1 : 0) : existing.secure,
      user ? user.trim() : existing.user,
      updatedPass,
      from_name ? from_name.trim() : existing.from_name,
      from_email ? from_email.trim() : existing.from_email,
      reply_to ? reply_to.trim() : existing.reply_to,
      daily_limit !== undefined ? parseInt(daily_limit, 10) : existing.daily_limit,
      priority !== undefined ? parseInt(priority, 10) : existing.priority,
      is_active !== undefined ? (is_active ? 1 : 0) : existing.is_active,
      id
    );

    const updated = db.prepare('SELECT * FROM smtp_accounts WHERE id = ?').get(id);
    if (process.env.MONGODB_URI) await syncSmtpConfiguration();
    res.json({
      success: true,
      message: `SMTP sender account "${updated.name}" updated successfully!`,
      account: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PATCH /api/settings/smtp-accounts/:id/toggle - Toggle active status
router.patch('/smtp-accounts/:id/toggle', async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const account = db.prepare('SELECT * FROM smtp_accounts WHERE id = ?').get(id);
    if (!account) {
      return res.status(404).json({ success: false, message: 'SMTP account not found.' });
    }

    const newStatus = account.is_active === 1 ? 0 : 1;

    // If enabling account, check subscription server quota ("how much server you gave")
    if (newStatus === 1) {
      const serverCheck = subscriptionService.canAddServer(db, id);
      if (!serverCheck.allowed) {
        return res.status(403).json({
          success: false,
          quotaExceeded: true,
          message: serverCheck.message
        });
      }
    }

    db.prepare('UPDATE smtp_accounts SET is_active = ?, updated_at = datetime("now") WHERE id = ?').run(newStatus, id);
    if (process.env.MONGODB_URI) await syncSmtpConfiguration();

    res.json({
      success: true,
      isActive: newStatus === 1,
      message: `Account "${account.name}" is now ${newStatus === 1 ? 'ACTIVE (Enabled)' : 'DISABLED'}.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/settings/smtp-accounts/:id - Delete SMTP account
router.delete('/smtp-accounts/:id', async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const result = db.prepare('DELETE FROM smtp_accounts WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'SMTP account not found.' });
    }

    if (process.env.MONGODB_URI) await syncSmtpConfiguration();

    res.json({ success: true, message: 'SMTP sender account removed from pool.' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/settings/smtp-accounts/test - Test connection for an SMTP account
router.post('/smtp-accounts/test', async (req, res) => {
  try {
    const accountData = req.body;
    const result = await smtpPool.testAccountConnection(accountData);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/settings/smtp-accounts/reset-counters - Reset all daily sent counters
router.post('/smtp-accounts/reset-counters', (req, res) => {
  try {
    const result = smtpPool.resetAllDailyCounters();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/settings/test-mongodb - Test MongoDB Atlas connection
router.post('/test-mongodb', async (req, res) => {
  try {
    const { uri } = req.body;
    const { testMongoConnection } = require('../database/mongo');
    const result = await testMongoConnection(uri);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/settings/save-mongodb - Save MongoDB URI and connect
router.post('/save-mongodb', async (req, res) => {
  try {
    const { uri } = req.body;
    const db = getDb();
    const { connectMongo } = require('../database/mongo');

    // Save URI to settings table
    const updateStmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES ('mongodb_uri', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);
    updateStmt.run(uri || '');

    if (uri && uri.trim()) {
      const conn = await connectMongo(uri.trim());
      if (!conn.success) {
        return res.status(400).json(conn);
      }
      res.json({
        success: true,
        message: `Connected to MongoDB Atlas database "${conn.database}" successfully!`
      });
    } else {
      res.json({
        success: true,
        message: 'MongoDB URI cleared. Using local database.'
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/settings/sync-to-mongodb - Migrate all local SQLite data to MongoDB Atlas
router.post('/sync-to-mongodb', async (req, res) => {
  try {
    const { uri } = req.body;
    const { syncSqliteToMongo } = require('../database/mongo');
    const result = await syncSqliteToMongo(uri);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
