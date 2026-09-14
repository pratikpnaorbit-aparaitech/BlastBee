const crypto = require('crypto');

/**
 * Hash a plain text password using PBKDF2 with SHA-512 and salt
 * @param {string} password 
 * @param {string} salt 
 * @returns {object} { hash, salt }
 */
function hashPassword(password, salt) {
  if (!password) throw new Error('Password is required');
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512').toString('hex');
  return { hash, salt: actualSalt };
}

/**
 * Verify a plain text password against a stored hash and salt
 * @param {string} password 
 * @param {string} storedHash 
 * @param {string} salt 
 * @returns {boolean}
 */
function verifyPassword(password, storedHash, salt) {
  if (!password || !storedHash || !salt) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

/**
 * Generate a cryptographically secure random session token
 * @returns {string}
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new session in the database
 * @param {object} db - better-sqlite3 db instance
 * @param {number} userId 
 * @param {number} daysValid 
 * @returns {object} { token, expiresAt }
 */
function createSession(db, userId, daysValid = 30) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000).toISOString();
  
  db.prepare(`
    INSERT INTO auth_sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `).run(token, userId, expiresAt);

  return { token, expiresAt };
}

/**
 * Validate a session token
 * @param {object} db 
 * @param {string} token 
 * @returns {object|null} user object if valid, null if invalid or expired
 */
function validateSession(db, token) {
  if (!token) return null;

  const session = db.prepare(`
    SELECT s.token, s.expires_at, u.id, u.username, u.email, u.role, u.full_name, u.avatar
    FROM auth_sessions s
    JOIN admin_users u ON s.user_id = u.id
    WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
  `).get(token);

  return session || null;
}

/**
 * Delete a session (logout)
 * @param {object} db 
 * @param {string} token 
 */
function deleteSession(db, token) {
  if (!token) return;
  db.prepare('DELETE FROM auth_sessions WHERE token = ?').run(token);
}

/**
 * Clean up expired sessions
 * @param {object} db 
 */
function cleanExpiredSessions(db) {
  try {
    db.prepare("DELETE FROM auth_sessions WHERE datetime(expires_at) <= datetime('now')").run();
  } catch (e) {
    // ignore
  }
}

/**
 * Create a new admin user
 * @param {object} db 
 * @param {object} data - { username, email, password, role, fullName, avatar }
 * @returns {object} Created user safe object
 */
function createUser(db, { username, email, password, role = 'admin', fullName = 'Admin User', avatar = '' }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanUsername = (username || cleanEmail.split('@')[0]).trim().toLowerCase();

  if (!cleanEmail) throw new Error('Email is required.');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.');

  const existing = db.prepare('SELECT id FROM admin_users WHERE email = ? OR username = ?').get(cleanEmail, cleanUsername);
  if (existing) {
    throw new Error('A user with that email or username already exists.');
  }

  const { hash, salt } = hashPassword(password);

  const result = db.prepare(`
    INSERT INTO admin_users (username, email, password_hash, salt, role, full_name, avatar, last_login, login_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), 1)
  `).run(cleanUsername, cleanEmail, hash, salt, role, fullName, avatar || '');

  return {
    id: result.lastInsertRowid,
    username: cleanUsername,
    email: cleanEmail,
    role,
    full_name: fullName,
    avatar
  };
}

/**
 * Change user password
 * @param {object} db 
 * @param {number} userId 
 * @param {string} newPassword 
 */
function changePassword(db, userId, newPassword) {
  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }
  const { hash, salt } = hashPassword(newPassword);
  db.prepare(`
    UPDATE admin_users
    SET password_hash = ?, salt = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(hash, salt, userId);

  // Invalidate all sessions except current or all sessions
  db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(userId);
}

/**
 * Get user by Email or Username
 * @param {object} db 
 * @param {string} identifier 
 */
function getUserByIdentifier(db, identifier) {
  const clean = (identifier || '').trim().toLowerCase();
  return db.prepare(`
    SELECT * FROM admin_users WHERE lower(email) = ? OR lower(username) = ?
  `).get(clean, clean);
}

/**
 * Get all admin users safe list
 * @param {object} db 
 */
function getAllUsers(db) {
  const users = db.prepare(`
    SELECT id, username, email, role, full_name, avatar, company, phone, last_login, login_count, created_at, updated_at
    FROM admin_users
    ORDER BY id ASC
  `).all();

  return users.map(u => {
    let isOnline = false;
    try {
      const sess = db.prepare("SELECT count(*) as count FROM auth_sessions WHERE user_id = ? AND datetime(expires_at) > datetime('now')").get(u.id);
      isOnline = sess && sess.count > 0;
    } catch (e) {}

    return {
      ...u,
      is_online: isOnline,
      has_logged_in: Boolean(u.last_login || (u.login_count && u.login_count > 0) || isOnline)
    };
  });
}

/**
 * Register a new customer with a 7-day free trial (1 SMTP server only)
 * @param {object} db 
 * @param {object} data - { fullName, email, password, company, phone }
 */
function registerCustomer(db, { fullName, email, password, company = '', phone = '' }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanUsername = cleanEmail.split('@')[0].trim().toLowerCase();

  if (!cleanEmail) throw new Error('Valid email address is required.');
  if (!password || password.length < 6) throw new Error('Password must be at least 6 characters.');

  const existing = db.prepare('SELECT id FROM admin_users WHERE email = ?').get(cleanEmail);
  if (existing) {
    throw new Error('An account with this email already exists. Please log in.');
  }

  const { hash, salt } = hashPassword(password);

  const result = db.prepare(`
    INSERT INTO admin_users (username, email, password_hash, salt, role, full_name, company, phone, avatar, last_login, login_count)
    VALUES (?, ?, ?, ?, 'customer', ?, ?, ?, '🎓', datetime('now'), 1)
  `).run(cleanUsername, cleanEmail, hash, salt, fullName || cleanUsername, company, phone);

  const userId = result.lastInsertRowid;

  // Provision 7-Day Free Trial (1 SMTP server ONLY)
  const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const trialFeatures = JSON.stringify([
    '1 Dedicated SMTP Server Allowed',
    '7-Day Full Platform Access',
    'Up to 500 Emails / Day',
    'Excel & CSV Candidate Importer',
    'Dynamic Personalization Studio',
    'Live Blast Cockpit'
  ]);

  db.prepare(`
    INSERT INTO subscriptions (user_id, plan_id, plan_name, status, max_servers, max_emails_per_month, emails_sent_this_cycle, max_contacts, billing_cycle, start_date, trial_ends_at, expires_at, features)
    VALUES (?, 'trial', '7-Day Free Trial', 'trial', 1, 3500, 0, 1000, 'trial', datetime('now'), ?, ?, ?)
  `).run(userId, trialEndsAt, trialEndsAt, trialFeatures);

  const { token, expiresAt } = createSession(db, userId, 30);

  return {
    token,
    expiresAt,
    user: {
      id: userId,
      username: cleanUsername,
      email: cleanEmail,
      role: 'customer',
      full_name: fullName || cleanUsername,
      company,
      phone,
      avatar: '🎓'
    }
  };
}

/**
 * Permanently delete a user/customer and cascade purge all their data
 * @param {object} db 
 * @param {number} userId 
 * @param {number|null} currentAdminId
 */
function deleteUser(db, userId, currentAdminId = null) {
  const target = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(userId);
  if (!target) {
    throw new Error('User not found.');
  }

  if (currentAdminId && target.id === currentAdminId) {
    throw new Error('You cannot delete your own logged-in account.');
  }

  // Check if target is the only superadmin
  if (target.role === 'superadmin') {
    const superAdminCount = db.prepare("SELECT count(*) as count FROM admin_users WHERE role = 'superadmin'").get().count;
    if (superAdminCount <= 1) {
      throw new Error('Cannot delete the last remaining SuperAdmin account.');
    }
  }

  db.pragma('foreign_keys = OFF');
  try {
    db.exec('BEGIN TRANSACTION;');

    // 1. Delete campaign recipients for user's campaigns
    db.prepare(`
      DELETE FROM campaign_recipients 
      WHERE campaign_id IN (SELECT id FROM campaigns WHERE user_id = ?)
    `).run(userId);

    // 2. Delete campaigns
    db.prepare('DELETE FROM campaigns WHERE user_id = ?').run(userId);

    // 3. Delete students
    db.prepare('DELETE FROM students WHERE user_id = ?').run(userId);

    // 4. Delete user's custom SMTP accounts
    db.prepare('DELETE FROM smtp_accounts WHERE user_id = ?').run(userId);

    // 5. Delete subscriptions & payments
    db.prepare('DELETE FROM subscription_payments WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM subscriptions WHERE user_id = ?').run(userId);

    // 7. Delete user sessions
    db.prepare('DELETE FROM auth_sessions WHERE user_id = ?').run(userId);

    // 8. Delete user record
    db.prepare('DELETE FROM admin_users WHERE id = ?').run(userId);

    db.exec('COMMIT;');
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  } finally {
    db.pragma('foreign_keys = ON');
  }

  return { 
    success: true, 
    message: `User "${target.full_name || target.username}" and all associated data deleted successfully.` 
  };
}

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  createSession,
  validateSession,
  deleteSession,
  cleanExpiredSessions,
  createUser,
  registerCustomer,
  changePassword,
  getUserByIdentifier,
  getAllUsers,
  deleteUser
};
