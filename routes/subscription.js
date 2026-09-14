const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { getDb } = require('../database/db');
const subscriptionService = require('../services/subscriptionService');
const { requireAuth, requireSuperAdmin } = require('./auth');

// Multer storage for payment proof screenshots
const paymentsUploadDir = path.join(__dirname, '..', 'public', 'uploads', 'payments');
if (!fs.existsSync(paymentsUploadDir)) {
  fs.mkdirSync(paymentsUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, paymentsUploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.png';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'payment-' + uniqueSuffix + ext);
  }
});

const uploadProof = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

// GET /api/subscription - Fetch active subscription & server allocation (customer-specific or platform)
router.get('/', (req, res) => {
  try {
    const db = getDb();
    let userId = null;

    // Optional user token check
    const authHeader = req.headers.authorization || req.headers['x-auth-token'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    if (token) {
      const authService = require('../services/authService');
      const sessionUser = authService.validateSession(db, token);
      if (sessionUser && sessionUser.role === 'customer') {
        userId = sessionUser.id;
      }
    }

    const subscription = subscriptionService.getActiveSubscription(db, userId);
    res.json({ success: true, subscription });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/subscription/plans - Fetch all subscription tiers
router.get('/plans', (req, res) => {
  try {
    const db = getDb();
    const plans = subscriptionService.getAllPlans(db);
    res.json({ success: true, plans, upi: subscriptionService.UPI_CONFIG });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/subscription/upi-info - Get UPI payment gateway details
router.get('/upi-info', (req, res) => {
  res.json({
    success: true,
    upi: subscriptionService.UPI_CONFIG
  });
});

// POST /api/subscription/pay-upi - Submit UPI payment with screenshot proof (pending admin approval)
router.post('/pay-upi', requireAuth, uploadProof.single('screenshot'), (req, res) => {
  try {
    const { planId, utrNumber, amount, screenshotData } = req.body;
    if (!planId) {
      return res.status(400).json({ success: false, message: 'planId is required.' });
    }

    const db = getDb();
    const userId = req.user.role === 'customer' ? req.user.id : null;
    const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(planId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan not found.' });
    }

    let screenshotUrl = '';
    if (req.file) {
      screenshotUrl = `/uploads/payments/${req.file.filename}`;
    } else if (screenshotData && typeof screenshotData === 'string') {
      const matches = screenshotData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1].includes('png') ? '.png' : (matches[1].includes('jpeg') || matches[1].includes('jpg') ? '.jpg' : '.png');
        const filename = `payment-${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`;
        fs.writeFileSync(path.join(paymentsUploadDir, filename), Buffer.from(matches[2], 'base64'));
        screenshotUrl = `/uploads/payments/${filename}`;
      } else if (screenshotData.startsWith('/uploads/')) {
        screenshotUrl = screenshotData;
      }
    }

    const finalAmount = amount ? Number(amount) : plan.price;
    const cleanUtr = (utrNumber || '').trim();

    const result = subscriptionService.recordUpiPayment(db, {
      userId,
      planId,
      amount: finalAmount,
      upiId: subscriptionService.UPI_CONFIG.upi_id,
      utrNumber: cleanUtr,
      screenshotUrl
    });

    res.json({
      success: true,
      message: `Payment proof (UTR: ${cleanUtr || 'Submitted'}) recorded successfully! Your subscription will be unlocked immediately upon Admin approval.`,
      paymentId: result.paymentId,
      status: 'pending'
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/subscription/my-payments - Logged-in customer: View personal payment submissions and approvals
router.get('/my-payments', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const payments = db.prepare(`
      SELECT p.*, sp.name as plan_name, sp.max_servers as plan_servers
      FROM payments p
      LEFT JOIN subscription_plans sp ON p.plan_id = sp.id
      WHERE p.user_id = ?
      ORDER BY p.id DESC
    `).all(req.user.id);
    res.json({ success: true, payments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/subscription/admin/payments - Admin: List all pending and historical payment submissions
router.get('/admin/payments', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const db = getDb();
    const pending = subscriptionService.getPendingPayments(db);
    const history = subscriptionService.getAllPayments(db);
    res.json({ success: true, pending, history });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/subscription/admin/payments/:id/approve - Admin: Approve payment & release customer access
router.post('/admin/payments/:id/approve', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    const db = getDb();
    const result = subscriptionService.approvePayment(db, paymentId, req.user.id);
    res.json({
      success: true,
      message: result.message,
      subscription: result.subscription
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/subscription/admin/payments/:id/reject - Admin: Reject payment with reason
router.post('/admin/payments/:id/reject', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const paymentId = parseInt(req.params.id, 10);
    const { adminNote } = req.body;
    const db = getDb();
    const result = subscriptionService.rejectPayment(db, paymentId, req.user.id, adminNote);
    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/subscription/plans/:id - Admin: Edit plan pricing & quotas
router.put('/plans/:id', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const planId = req.params.id;
    const db = getDb();
    const updated = subscriptionService.updatePlanDetails(db, planId, req.body);
    res.json({
      success: true,
      message: `Plan "${updated.name}" updated successfully!`,
      plan: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/subscription/upgrade - Switch or upgrade subscription plan
router.post('/upgrade', requireAuth, (req, res) => {
  try {
    const { planId } = req.body;
    if (!planId) {
      return res.status(400).json({ success: false, message: 'planId is required.' });
    }

    const db = getDb();
    const userId = req.user.role === 'customer' ? req.user.id : null;
    const updated = subscriptionService.upgradePlan(db, planId, userId);

    res.json({
      success: true,
      message: `Subscription successfully updated to "${updated.plan_name}"!`,
      subscription: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/subscription/limits - Admin override: modify servers given & quotas directly
router.put('/limits', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const db = getDb();
    const { max_servers, max_emails_per_month, max_contacts, status, expires_at } = req.body;

    const updated = subscriptionService.updateSubscriptionLimits(db, {
      max_servers,
      max_emails_per_month,
      max_contacts,
      status,
      expires_at
    });

    res.json({
      success: true,
      message: `Subscription server allocation updated! Given servers: ${updated.serverAllocation.max_servers_given}`,
      subscription: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/subscription/customers - Admin: List all customer accounts & trial statuses
router.get('/customers', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const db = getDb();
    const customers = subscriptionService.getAllCustomerSubscriptions(db);
    res.json({ success: true, customers });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/subscription/customers/:id/extend-trial - Admin: Extend a customer's trial
router.post('/customers/:id/extend-trial', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    const extraDays = parseInt(req.body.extraDays, 10) || 7;
    const db = getDb();

    const updated = subscriptionService.extendTrial(db, customerId, extraDays);

    res.json({
      success: true,
      message: `Trial extended by ${extraDays} days! New expiration: ${new Date(updated.trial_ends_at).toLocaleDateString()}`,
      subscription: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/subscription/customers/:id/upgrade - Admin or Customer: Upgrade customer's plan
router.post('/customers/:id/upgrade', requireAuth, (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { planId } = req.body;

    if (req.user.role !== 'superadmin' && req.user.id !== targetId) {
      return res.status(403).json({ success: false, message: 'Permission denied to modify another account.' });
    }

    const db = getDb();
    const updated = subscriptionService.upgradePlan(db, planId, targetId);

    res.json({
      success: true,
      message: `Customer upgraded to "${updated.plan_name}" with ${updated.serverAllocation.max_servers_given} SMTP servers granted!`,
      subscription: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/subscription/customers/:id/limits - Admin: Modify customer server allocation ("How much server you gave")
router.put('/customers/:id/limits', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const customerId = parseInt(req.params.id, 10);
    const { max_servers, max_emails_per_month, status } = req.body;
    const db = getDb();

    const updated = subscriptionService.updateSubscriptionLimits(db, {
      max_servers,
      max_emails_per_month,
      status
    }, customerId);

    res.json({
      success: true,
      message: `Updated customer server quota! Granted servers: ${updated.serverAllocation.max_servers_given}`,
      subscription: updated
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// GET /api/subscription/server-fleet - Detailed server fleet breakdown
router.get('/server-fleet', (req, res) => {
  try {
    const db = getDb();
    const sub = subscriptionService.getActiveSubscription(db);
    const accounts = db.prepare(`
      SELECT id, name, host, port, secure, user, from_name, from_email, reply_to, daily_limit, sent_today, is_active, priority, last_used_at, created_at
      FROM smtp_accounts
      ORDER BY priority ASC, id ASC
    `).all();

    const maxGiven = sub.serverAllocation.max_servers_given;
    let activeAssignedCount = 0;

    const fleet = accounts.map(acc => {
      let allocationStatus = 'unassigned';
      if (acc.is_active === 1) {
        activeAssignedCount++;
        if (activeAssignedCount <= maxGiven) {
          allocationStatus = 'allocated';
        } else {
          allocationStatus = 'exceeds_quota';
        }
      } else {
        allocationStatus = 'disabled';
      }

      return {
        ...acc,
        allocationStatus,
        remainingDaily: acc.daily_limit > 0 ? Math.max(0, acc.daily_limit - acc.sent_today) : Infinity,
        utilizationPct: acc.daily_limit > 0 ? Math.min(100, Math.round((acc.sent_today / acc.daily_limit) * 100)) : 0
      };
    });

    res.json({
      success: true,
      serverAllocation: sub.serverAllocation,
      fleet
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
