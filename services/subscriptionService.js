const { getDb } = require('../database/db');

const UPI_CONFIG = {
  upi_id: '8261840199-3@ibl',
  payee_name: 'Aparaitech Software',
  currency: 'INR'
};

const DEFAULT_PLANS = [
  {
    id: 'trial',
    name: '7-Day Free Trial',
    price: 0,
    currency: 'INR',
    billing_interval: '7-days',
    max_servers: 1, // EXACTLY 1 SMTP Server allowed during free trial
    max_emails_per_month: 3500,
    max_contacts: 1000,
    features: JSON.stringify([
      '1 Dedicated SMTP Server Allowed',
      '7 Days Full Platform Access',
      'Up to 500 Emails / Day',
      'Excel & CSV Spreadsheet Importer',
      'Dynamic Personalization Studio',
      'Live SSE Blast Cockpit'
    ]),
    description: 'Try all recruitment email blast features free for 7 days with 1 SMTP server.',
    is_popular: 0
  },
  {
    id: 'starter',
    name: 'Starter Recruiter Tier',
    price: 1499,
    currency: 'INR',
    billing_interval: 'month',
    max_servers: 2, // 2 SMTP Servers given
    max_emails_per_month: 15000,
    max_contacts: 5000,
    features: JSON.stringify([
      '2 Dedicated Active SMTP Servers',
      'Up to 15,000 Emails / Month',
      'Up to 5,000 Candidate Contacts',
      'Basic Email Personalization ({Name}, {College})',
      'Excel & CSV Spreadsheet Importer',
      'Standard Blast Throttling (350ms delay)'
    ]),
    description: 'Essential toolkit for individual recruiters running small campus placement drives.',
    is_popular: 0
  },
  {
    id: 'growth',
    name: 'Pro Growth Placement Tier',
    price: 3499,
    currency: 'INR',
    billing_interval: 'month',
    max_servers: 5, // 5 SMTP Servers given
    max_emails_per_month: 50000,
    max_contacts: 25000,
    features: JSON.stringify([
      '5 Active Multi-SMTP Servers Granted',
      'Round-Robin Auto-Rotation Delivery',
      'Up to 50,000 Emails / Month',
      'Up to 25,000 Candidate Contacts',
      'Dynamic {ApplyLink} Token Injection',
      'Anti-Spam Shield & DNS MX Diagnostics',
      'Live SSE Delivery Speed Cockpit'
    ]),
    description: 'Ideal for fast-growing recruitment teams running mid-to-large college drives.',
    is_popular: 1
  },
  {
    id: 'enterprise',
    name: 'Enterprise Scale License',
    price: 8999,
    currency: 'INR',
    billing_interval: 'month',
    max_servers: 10, // 10 SMTP Servers given
    max_emails_per_month: 200000,
    max_contacts: 100000,
    features: JSON.stringify([
      '10 Active Multi-SMTP Servers Granted',
      'All Aparaitech Sender Accounts Unlocked',
      'Auto-Failover & Quota Protection',
      'Up to 200,000 Emails / Month',
      'Unlimited Candidate Pool & Batches',
      'MongoDB Atlas Cloud Database Sync',
      'Full Multi-Admin User Management',
      'Priority 24/7 Placement Engine Support'
    ]),
    description: 'Complete recruitment enterprise suite with full multi-server fleet & unlimited power.',
    is_popular: 0
  }
];

/**
 * Seed default subscription plans and initial active subscription
 * @param {object} db 
 */
function seedSubscriptionData(db) {
  try {
    const insertPlanStmt = db.prepare(`
      INSERT OR IGNORE INTO subscription_plans (id, name, price, currency, billing_interval, max_servers, max_emails_per_month, max_contacts, features, description, is_popular)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of DEFAULT_PLANS) {
      insertPlanStmt.run(
        p.id,
        p.name,
        p.price,
        p.currency,
        p.billing_interval,
        p.max_servers,
        p.max_emails_per_month,
        p.max_contacts,
        p.features,
        p.description,
        p.is_popular
      );
    }

    const existingSub = db.prepare('SELECT count(*) as count FROM subscriptions WHERE user_id IS NULL').get().count;
    if (existingSub === 0) {
      // Global system license (Enterprise)
      const entPlan = DEFAULT_PLANS.find(p => p.id === 'enterprise');
      const oneYearLater = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      db.prepare(`
        INSERT INTO subscriptions (user_id, plan_id, plan_name, status, max_servers, max_emails_per_month, emails_sent_this_cycle, max_contacts, billing_cycle, expires_at, features)
        VALUES (NULL, ?, ?, 'active', ?, ?, 0, ?, 'annual', ?, ?)
      `).run(
        entPlan.id,
        entPlan.name,
        entPlan.max_servers,
        entPlan.max_emails_per_month,
        entPlan.max_contacts,
        oneYearLater,
        entPlan.features
      );
    }
  } catch (err) {
    console.error('Error seeding subscription data:', err.message);
  }
}

/**
 * Get active subscription for a specific user (or global system subscription if no userId)
 * @param {object} db 
 * @param {number|null} userId 
 * @returns {object}
 */
function getActiveSubscription(db, userId = null) {
  let sub = null;

  if (userId) {
    sub = db.prepare(`
      SELECT s.*, p.price, p.currency, p.description as plan_description
      FROM subscriptions s
      LEFT JOIN subscription_plans p ON s.plan_id = p.id
      WHERE s.user_id = ?
      ORDER BY s.id DESC
      LIMIT 1
    `).get(userId);
  }

  // Fallback to global subscription if not found or if checking platform
  if (!sub) {
    sub = db.prepare(`
      SELECT s.*, p.price, p.currency, p.description as plan_description
      FROM subscriptions s
      LEFT JOIN subscription_plans p ON s.plan_id = p.id
      WHERE s.user_id IS NULL
      ORDER BY s.id DESC
      LIMIT 1
    `).get();
  }

  if (!sub) {
    seedSubscriptionData(db);
    sub = db.prepare('SELECT * FROM subscriptions WHERE user_id IS NULL ORDER BY id DESC LIMIT 1').get();
  }

  // Parse features JSON safely
  let features = [];
  try {
    features = typeof sub.features === 'string' ? JSON.parse(sub.features) : (sub.features || []);
  } catch (e) {
    features = [];
  }

  // Calculate 7-Day Free Trial countdown
  let trialDaysRemaining = null;
  let isTrialExpired = false;

  if (sub.status === 'trial' && sub.trial_ends_at) {
    const trialEndTime = new Date(sub.trial_ends_at).getTime();
    const msLeft = trialEndTime - Date.now();
    trialDaysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
    isTrialExpired = msLeft <= 0;
  }

  // Active SMTP server counts (customer-specific or platform)
  let activeServers = 0;
  let totalConfiguredServers = 0;

  if (userId) {
    totalConfiguredServers = db.prepare('SELECT count(*) as count FROM smtp_accounts WHERE user_id = ?').get(userId).count;
    activeServers = db.prepare('SELECT count(*) as count FROM smtp_accounts WHERE user_id = ? AND is_active = 1').get(userId).count;
  } else {
    totalConfiguredServers = db.prepare('SELECT count(*) as count FROM smtp_accounts').get().count;
    activeServers = db.prepare('SELECT count(*) as count FROM smtp_accounts WHERE is_active = 1').get().count;
  }
  
  // Total candidate contacts in DB
  const totalContacts = db.prepare('SELECT count(*) as count FROM students').get().count;

  // Server quota calculations ("how much server you gave")
  const maxServersGiven = parseInt(sub.max_servers, 10) || 1;
  const remainingServers = Math.max(0, maxServersGiven - activeServers);
  const serverUtilizationPct = Math.min(100, Math.round((activeServers / maxServersGiven) * 100));

  // Email quota calculations
  const maxEmails = parseInt(sub.max_emails_per_month, 10) || 10000;
  const sentEmails = parseInt(sub.emails_sent_this_cycle, 10) || 0;
  const remainingEmails = Math.max(0, maxEmails - sentEmails);
  const emailUtilizationPct = Math.min(100, Math.round((sentEmails / maxEmails) * 100));

  return {
    id: sub.id,
    user_id: sub.user_id,
    plan_id: sub.plan_id,
    plan_name: sub.plan_name,
    status: isTrialExpired ? 'expired' : sub.status,
    billing_cycle: sub.billing_cycle,
    start_date: sub.start_date,
    trial_ends_at: sub.trial_ends_at,
    trial_days_remaining: trialDaysRemaining,
    is_trial_expired: isTrialExpired,
    expires_at: sub.expires_at,
    features,
    serverAllocation: {
      max_servers_given: maxServersGiven,
      active_servers: activeServers,
      total_configured_servers: totalConfiguredServers,
      remaining_servers: remainingServers,
      utilization_pct: serverUtilizationPct,
      is_quota_reached: activeServers >= maxServersGiven
    },
    emailQuota: {
      max_monthly: maxEmails,
      sent_this_cycle: sentEmails,
      remaining: remainingEmails,
      utilization_pct: emailUtilizationPct,
      is_quota_reached: sentEmails >= maxEmails
    },
    contactQuota: {
      max_contacts: sub.max_contacts,
      current_contacts: totalContacts,
      is_quota_reached: sub.max_contacts > 0 && totalContacts >= sub.max_contacts
    },
    pendingPayment: userId ? (db.prepare(`
      SELECT p.id, p.plan_id, p.amount, p.currency, p.utr_number, p.screenshot_url, p.status, p.created_at,
             pl.name as plan_name, pl.max_servers as plan_servers
      FROM subscription_payments p
      LEFT JOIN subscription_plans pl ON p.plan_id = pl.id
      WHERE p.user_id = ? AND p.status = 'pending'
      ORDER BY p.id DESC
      LIMIT 1
    `).get(userId) || null) : null
  };
}

/**
 * Check if another server can be activated or added under current subscription
 * @param {object} db 
 * @param {number|null} userId 
 * @param {number|null} accountIdToEnable - If enabling an existing disabled account
 * @returns {object} { allowed: boolean, message: string }
 */
function canAddServer(db, userId = null, accountIdToEnable = null) {
  const sub = getActiveSubscription(db, userId);
  const maxGiven = sub.serverAllocation.max_servers_given;

  if (sub.is_trial_expired) {
    return {
      allowed: false,
      message: 'Your 7-Day Free Trial has expired. Please upgrade your subscription to continue sending email blasts.'
    };
  }

  // If enabling an account that is already active, it's allowed
  if (accountIdToEnable) {
    const account = db.prepare('SELECT is_active FROM smtp_accounts WHERE id = ?').get(accountIdToEnable);
    if (account && account.is_active === 1) {
      return { allowed: true };
    }
  }

  if (sub.serverAllocation.active_servers >= maxGiven) {
    if (sub.status === 'trial') {
      return {
        allowed: false,
        message: 'Free Trial allows strictly 1 active SMTP Server. Upgrade your subscription to unlock Multi-SMTP server fleet (up to 10 servers)!'
      };
    }
    return {
      allowed: false,
      message: `Server Quota Exceeded: Your plan ("${sub.plan_name}") allows up to ${maxGiven} active SMTP server${maxGiven === 1 ? '' : 's'}. You currently have ${sub.serverAllocation.active_servers} active servers. Upgrade your plan to activate more servers.`
    };
  }

  return { allowed: true };
}

/**
 * Upgrade or switch subscription plan
 * @param {object} db 
 * @param {string} planId 
 * @param {number|null} userId
 * @returns {object}
 */
function upgradePlan(db, planId, userId = null) {
  const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(planId);
  if (!plan) {
    throw new Error(`Plan "${planId}" does not exist.`);
  }

  const oneYearLater = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

  if (userId) {
    db.prepare(`
      UPDATE subscriptions
      SET plan_id = ?,
          plan_name = ?,
          max_servers = ?,
          max_emails_per_month = ?,
          max_contacts = ?,
          features = ?,
          status = 'active',
          trial_ends_at = NULL,
          expires_at = ?,
          updated_at = datetime('now')
      WHERE user_id = ?
    `).run(
      plan.id,
      plan.name,
      plan.max_servers,
      plan.max_emails_per_month,
      plan.max_contacts,
      plan.features,
      oneYearLater,
      userId
    );
    return getActiveSubscription(db, userId);
  } else {
    db.prepare(`
      UPDATE subscriptions
      SET plan_id = ?,
          plan_name = ?,
          max_servers = ?,
          max_emails_per_month = ?,
          max_contacts = ?,
          features = ?,
          status = 'active',
          expires_at = ?,
          updated_at = datetime('now')
      WHERE user_id IS NULL
    `).run(
      plan.id,
      plan.name,
      plan.max_servers,
      plan.max_emails_per_month,
      plan.max_contacts,
      plan.features,
      oneYearLater
    );
    return getActiveSubscription(db, null);
  }
}

/**
 * Manually update subscription limits (Admin override: "How much servers gave")
 * @param {object} db 
 * @param {object} limits - { max_servers, max_emails_per_month, max_contacts, expires_at, status }
 * @param {number|null} userId
 */
function updateSubscriptionLimits(db, limits, userId = null) {
  const current = userId
    ? db.prepare('SELECT id FROM subscriptions WHERE user_id = ? ORDER BY id DESC LIMIT 1').get(userId)
    : db.prepare('SELECT id FROM subscriptions WHERE user_id IS NULL ORDER BY id DESC LIMIT 1').get();

  if (!current) {
    throw new Error('No active subscription found to update.');
  }

  const updates = [];
  const params = [];

  if (limits.max_servers !== undefined) {
    updates.push('max_servers = ?');
    params.push(Math.max(1, parseInt(limits.max_servers, 10)));
  }

  if (limits.max_emails_per_month !== undefined) {
    updates.push('max_emails_per_month = ?');
    params.push(Math.max(100, parseInt(limits.max_emails_per_month, 10)));
  }

  if (limits.max_contacts !== undefined) {
    updates.push('max_contacts = ?');
    params.push(parseInt(limits.max_contacts, 10));
  }

  if (limits.status) {
    updates.push('status = ?');
    params.push(limits.status);
  }

  if (limits.expires_at) {
    updates.push('expires_at = ?');
    params.push(limits.expires_at);
  }

  if (updates.length === 0) {
    return getActiveSubscription(db, userId);
  }

  updates.push("updated_at = datetime('now')");
  params.push(current.id);

  const query = `UPDATE subscriptions SET ${updates.join(', ')} WHERE id = ?`;
  db.prepare(query).run(...params);

  return getActiveSubscription(db, userId);
}

/**
 * Get all customer accounts with their subscription & trial details (for Admin Portal)
 * @param {object} db 
 */
function getAllCustomerSubscriptions(db) {
  const customers = db.prepare(`
    SELECT u.id, u.username, u.email, u.full_name, u.company, u.phone, u.role, u.avatar, u.created_at, u.last_login, u.login_count,
           s.id as subscription_id, s.plan_id, s.plan_name, s.status, s.max_servers, s.max_emails_per_month,
           s.emails_sent_this_cycle, s.trial_ends_at, s.expires_at, s.start_date
    FROM admin_users u
    LEFT JOIN subscriptions s ON s.user_id = u.id
    WHERE u.role = 'customer'
    ORDER BY u.id DESC
  `).all();

  return customers.map(c => {
    let daysRemaining = null;
    let isTrialExpired = false;
    if (c.status === 'trial' && c.trial_ends_at) {
      const msLeft = new Date(c.trial_ends_at).getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
      isTrialExpired = msLeft <= 0;
    }

    let activeServers = 0;
    try {
      activeServers = db.prepare('SELECT count(*) as count FROM smtp_accounts WHERE user_id = ? AND is_active = 1').get(c.id).count;
    } catch (e) {}

    let isOnline = false;
    try {
      const sess = db.prepare("SELECT count(*) as count FROM auth_sessions WHERE user_id = ? AND datetime(expires_at) > datetime('now')").get(c.id);
      isOnline = sess && sess.count > 0;
    } catch (e) {}

    let pendingPayment = null;
    try {
      pendingPayment = db.prepare("SELECT * FROM subscription_payments WHERE user_id = ? AND status = 'pending' ORDER BY id DESC LIMIT 1").get(c.id) || null;
    } catch (e) {}

    return {
      ...c,
      max_servers: c.max_servers || 1,
      active_servers: activeServers,
      days_remaining: daysRemaining,
      is_trial_expired: isTrialExpired,
      is_online: isOnline,
      has_logged_in: Boolean(c.last_login || (c.login_count && c.login_count > 0) || isOnline),
      pending_payment: pendingPayment
    };
  });
}

/**
 * Extend a customer's 7-Day Free Trial by extra days (Admin Control)
 * @param {object} db 
 * @param {number} customerId 
 * @param {number} extraDays 
 */
function extendTrial(db, customerId, extraDays = 7) {
  const sub = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').get(customerId);
  if (!sub) throw new Error('No subscription found for customer.');

  const currentEnd = sub.trial_ends_at ? new Date(sub.trial_ends_at).getTime() : Date.now();
  const base = Math.max(Date.now(), currentEnd);
  const newEnd = new Date(base + extraDays * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(`
    UPDATE subscriptions
    SET trial_ends_at = ?, expires_at = ?, status = 'trial', updated_at = datetime('now')
    WHERE id = ?
  `).run(newEnd, newEnd, sub.id);

  return getActiveSubscription(db, customerId);
}

/**
 * Record sent emails to current billing cycle
 * @param {object} db 
 * @param {number} count 
 * @param {number|null} userId 
 */
function recordEmailSent(db, count = 1, userId = null) {
  try {
    if (userId) {
      db.prepare(`
        UPDATE subscriptions
        SET emails_sent_this_cycle = emails_sent_this_cycle + ?,
            updated_at = datetime('now')
        WHERE user_id = ?
      `).run(count, userId);
    } else {
      db.prepare(`
        UPDATE subscriptions
        SET emails_sent_this_cycle = emails_sent_this_cycle + ?,
            updated_at = datetime('now')
        WHERE user_id IS NULL
      `).run(count);
    }
  } catch (err) {
    console.error('Error recording subscription email count:', err.message);
  }
}

/**
 * Get all available subscription plans
 * @param {object} db 
 */
function getAllPlans(db) {
  seedSubscriptionData(db);
  const plans = db.prepare('SELECT * FROM subscription_plans ORDER BY price ASC').all();
  return plans.map(p => ({
    ...p,
    features: typeof p.features === 'string' ? JSON.parse(p.features) : (p.features || [])
  }));
}

/**
 * Record a UPI payment submission with proof screenshot (pending admin approval)
 * @param {object} db
 * @param {object} param1
 */
function recordUpiPayment(db, { userId, planId, amount, upiId = UPI_CONFIG.upi_id, utrNumber = '', screenshotUrl = '' }) {
  const stmt = db.prepare(`
    INSERT INTO subscription_payments (user_id, plan_id, amount, currency, upi_id, utr_number, screenshot_url, status)
    VALUES (?, ?, ?, 'INR', ?, ?, ?, 'pending')
  `);
  const res = stmt.run(userId, planId, amount, upiId, utrNumber || `UPI_${Date.now()}`, screenshotUrl || null);

  return {
    paymentId: res.lastInsertRowid,
    status: 'pending',
    message: 'Payment proof screenshot and UTR submitted successfully! Access will be unlocked upon Admin verification.'
  };
}

/**
 * Get all pending payments for Admin review
 * @param {object} db
 */
function getPendingPayments(db) {
  return db.prepare(`
    SELECT p.*, u.username, u.email, u.full_name, u.company, u.phone,
           pl.name as plan_name, pl.max_servers as plan_servers
    FROM subscription_payments p
    LEFT JOIN admin_users u ON p.user_id = u.id
    LEFT JOIN subscription_plans pl ON p.plan_id = pl.id
    WHERE p.status = 'pending'
    ORDER BY p.id DESC
  `).all();
}

/**
 * Get all payments history for Admin
 * @param {object} db
 */
function getAllPayments(db) {
  return db.prepare(`
    SELECT p.*, u.username, u.email, u.full_name, u.company, u.phone,
           pl.name as plan_name, pl.max_servers as plan_servers,
           admin.full_name as reviewed_by_name
    FROM subscription_payments p
    LEFT JOIN admin_users u ON p.user_id = u.id
    LEFT JOIN subscription_plans pl ON p.plan_id = pl.id
    LEFT JOIN admin_users admin ON p.reviewed_by = admin.id
    ORDER BY p.id DESC
    LIMIT 100
  `).all();
}

/**
 * Approve a UPI payment, upgrade customer subscription, and release server access
 * @param {object} db
 * @param {number} paymentId
 * @param {number|null} adminUserId
 */
function approvePayment(db, paymentId, adminUserId = null) {
  const payment = db.prepare('SELECT * FROM subscription_payments WHERE id = ?').get(paymentId);
  if (!payment) {
    throw new Error('Payment record not found.');
  }

  db.prepare(`
    UPDATE subscription_payments
    SET status = 'approved',
        reviewed_at = datetime('now'),
        reviewed_by = ?
    WHERE id = ?
  `).run(adminUserId, paymentId);

  // Release access by upgrading the customer subscription
  const updatedSub = upgradePlan(db, payment.plan_id, payment.user_id);

  return {
    paymentId,
    status: 'approved',
    subscription: updatedSub,
    message: `Payment approved! Customer access released with ${updatedSub.serverAllocation.max_servers_given} SMTP servers granted.`
  };
}

/**
 * Reject a UPI payment with a reason note
 * @param {object} db
 * @param {number} paymentId
 * @param {number|null} adminUserId
 * @param {string} adminNote
 */
function rejectPayment(db, paymentId, adminUserId = null, adminNote = '') {
  const payment = db.prepare('SELECT * FROM subscription_payments WHERE id = ?').get(paymentId);
  if (!payment) {
    throw new Error('Payment record not found.');
  }

  db.prepare(`
    UPDATE subscription_payments
    SET status = 'rejected',
        admin_note = ?,
        reviewed_at = datetime('now'),
        reviewed_by = ?
    WHERE id = ?
  `).run(adminNote || 'Payment verification failed. Please check UTR and receipt.', adminUserId, paymentId);

  return {
    paymentId,
    status: 'rejected',
    message: 'Payment marked as rejected.'
  };
}

/**
 * Update plan details (Admin edition of subscription amount & quotas)
 * @param {object} db
 * @param {string} planId
 * @param {object} data
 */
function updatePlanDetails(db, planId, data = {}) {
  const plan = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(planId);
  if (!plan) {
    throw new Error(`Plan "${planId}" does not exist.`);
  }

  const updates = [];
  const params = [];

  if (data.name !== undefined && data.name.trim()) {
    updates.push('name = ?');
    params.push(data.name.trim());
  }
  if (data.price !== undefined) {
    updates.push('price = ?');
    params.push(Math.max(0, Number(data.price)));
  }
  if (data.max_servers !== undefined) {
    updates.push('max_servers = ?');
    params.push(Math.max(1, parseInt(data.max_servers, 10)));
  }
  if (data.max_emails_per_month !== undefined) {
    updates.push('max_emails_per_month = ?');
    params.push(Math.max(100, parseInt(data.max_emails_per_month, 10)));
  }
  if (data.max_contacts !== undefined) {
    updates.push('max_contacts = ?');
    params.push(parseInt(data.max_contacts, 10));
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    params.push(data.description.trim());
  }

  if (updates.length > 0) {
    params.push(planId);
    db.prepare(`UPDATE subscription_plans SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  }

  const updated = db.prepare('SELECT * FROM subscription_plans WHERE id = ?').get(planId);
  return {
    ...updated,
    features: typeof updated.features === 'string' ? JSON.parse(updated.features) : (updated.features || [])
  };
}

module.exports = {
  seedSubscriptionData,
  getActiveSubscription,
  canAddServer,
  upgradePlan,
  updateSubscriptionLimits,
  getAllCustomerSubscriptions,
  extendTrial,
  recordEmailSent,
  getAllPlans,
  DEFAULT_PLANS,
  UPI_CONFIG,
  recordUpiPayment,
  getPendingPayments,
  getAllPayments,
  approvePayment,
  rejectPayment,
  updatePlanDetails
};
