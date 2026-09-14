const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const authService = require('../services/authService');

/**
 * Middleware: Require valid session token
 */
function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || req.headers['x-auth-token'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();

    if (!token) {
      return res.status(401).json({ success: false, message: 'Authentication required. Please log in.' });
    }

    const db = getDb();
    const user = authService.validateSession(db, token);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Session expired or invalid. Please log in again.' });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Middleware: Require Super Admin role
 */
function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'superadmin') {
    return res.status(403).json({ success: false, message: 'Access denied. Super Administrator privileges required.' });
  }
  next();
}

/**
 * Helper: Extract authenticated user from session if present (non-blocking)
 */
function getOptionalAuth(req) {
  try {
    const authHeader = req.headers.authorization || req.headers['x-auth-token'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();
    if (!token) return null;
    const db = getDb();
    return authService.validateSession(db, token);
  } catch (err) {
    return null;
  }
}

// POST /api/auth/register - Public customer registration with 7-Day Free Trial (1 SMTP server only)
router.post('/register', (req, res) => {
  try {
    const { fullName, email, password, confirmPassword, company, phone } = req.body;
    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match. Please re-enter identical passwords.' });
    }
    const db = getDb();

    const result = authService.registerCustomer(db, {
      fullName,
      email,
      password,
      company: company || '',
      phone: phone || ''
    });

    res.status(201).json({
      success: true,
      message: `Account created successfully! Your 7-Day Free Trial with 1 SMTP server is now active.`,
      token: result.token,
      expiresAt: result.expiresAt,
      user: result.user,
      redirectUrl: '/app'
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// POST /api/auth/login - Customer & Admin authentication
router.post('/login', (req, res) => {
  try {
    const { email, username, password } = req.body;
    const identifier = (email || username || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Email/Username and password are required.' });
    }

    const db = getDb();
    const user = authService.getUserByIdentifier(db, identifier);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email/username or password.' });
    }

    const isValid = authService.verifyPassword(password, user.password_hash, user.salt);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid email/username or password.' });
    }

    // Generate session token (valid 30 days)
    const { token, expiresAt } = authService.createSession(db, user.id, 30);

    // Update last_login timestamp and increment login count
    try {
      db.prepare("UPDATE admin_users SET last_login = datetime('now'), login_count = COALESCE(login_count, 0) + 1 WHERE id = ?").run(user.id);
    } catch (e) {}

    const isCustomer = user.role === 'customer';
    const redirectUrl = isCustomer ? '/app' : '/admin';

    res.json({
      success: true,
      message: `Welcome back, ${user.full_name}!`,
      token,
      expiresAt,
      redirectUrl,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        company: user.company || '',
        phone: user.phone || '',
        avatar: user.avatar
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/logout - Invalidate session
router.post('/logout', (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers['x-auth-token'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();

    if (token) {
      const db = getDb();
      authService.deleteSession(db, token);
    }

    res.json({ success: true, message: 'Successfully logged out.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/me - Verify current session & return user
router.get('/me', (req, res) => {
  try {
    const authHeader = req.headers.authorization || req.headers['x-auth-token'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();

    if (!token) {
      return res.json({ success: true, authenticated: false, user: null });
    }

    const db = getDb();
    const user = authService.validateSession(db, token);

    if (!user) {
      return res.json({ success: true, authenticated: false, user: null });
    }

    res.json({
      success: true,
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        full_name: user.full_name,
        avatar: user.avatar
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/auth/users - List all admin accounts
router.get('/users', requireAuth, (req, res) => {
  try {
    const db = getDb();
    const users = authService.getAllUsers(db);
    res.json({ success: true, users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /api/auth/users - Create new admin/recruiter user
router.post('/users', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const { username, email, password, role, fullName, avatar } = req.body;
    const db = getDb();

    const newUser = authService.createUser(db, {
      username,
      email,
      password,
      role: role || 'admin',
      fullName: fullName || username || 'Admin User',
      avatar: avatar || '👨‍💼'
    });

    res.status(201).json({
      success: true,
      message: `User "${newUser.full_name}" created successfully!`,
      user: newUser
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// PUT /api/auth/users/:id/password - Change password
router.put('/users/:id/password', requireAuth, (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const { newPassword } = req.body;

    // Users can only change their own password unless they are superadmin
    if (req.user.id !== targetId && req.user.role !== 'superadmin') {
      return res.status(403).json({ success: false, message: 'Permission denied to change another user\'s password.' });
    }

    const db = getDb();
    authService.changePassword(db, targetId, newPassword);

    res.json({ success: true, message: 'Password updated successfully! Please log in again.' });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// DELETE /api/auth/users/:id - Delete user/customer account (SuperAdmin only)
router.delete('/users/:id', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    const db = getDb();

    const result = authService.deleteUser(db, targetId, req.user.id);
    res.json({
      success: true,
      message: result.message
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

module.exports = {
  router,
  requireAuth,
  requireSuperAdmin,
  getOptionalAuth
};
