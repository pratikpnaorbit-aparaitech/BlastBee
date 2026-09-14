-- ==========================================================
-- Aparaitech Software - Student Email Blast Database Schema
-- ==========================================================

-- Table: students
CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    college TEXT NOT NULL,
    phone TEXT,
    branch TEXT DEFAULT 'Computer Science',
    batch TEXT DEFAULT '2026',
    status TEXT DEFAULT 'Active', -- 'Active', 'Unsubscribed', 'Placed', 'Blacklisted'
    import_batch_id TEXT,        -- Unique ID for the bulk upload batch (e.g. batch_1723871234_iitb)
    import_source TEXT DEFAULT 'Manual Entry', -- Name of spreadsheet file or source
    tags TEXT DEFAULT '[]',       -- JSON array of tags, e.g. ["B.Tech", "Shortlisted", "Baramati"]
    notes TEXT DEFAULT '',
    user_id INTEGER,              -- Scopes student to customer workspace (NULL = platform seed)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast lookup & filtering
CREATE INDEX IF NOT EXISTS idx_students_college ON students(college);
CREATE INDEX IF NOT EXISTS idx_students_batch ON students(batch);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_students_import_batch ON students(import_batch_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_email_workspace ON students(email, COALESCE(user_id, 0));

-- Table: templates
CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT DEFAULT 'Placement Drive', -- 'Placement Drive', 'Internship', 'Hackathon', 'Interview', 'Offer'
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    tags_used TEXT DEFAULT '["{Name}", "{College}"]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: campaigns
CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    body_html TEXT NOT NULL,
    apply_link TEXT DEFAULT 'https://aparaitech.org/apply', -- Dedicated application / apply now hyperlink
    target_type TEXT DEFAULT 'all',      -- 'all', 'college', 'batch', 'selected'
    target_filter TEXT DEFAULT '',       -- JSON filter metadata
    total_recipients INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',         -- 'draft', 'in_progress', 'paused', 'completed', 'cancelled'
    speed_eps REAL DEFAULT 0,            -- emails per second
    user_id INTEGER,                     -- Scopes campaign to customer account
    started_at DATETIME,
    completed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: campaign_recipients
CREATE TABLE IF NOT EXISTS campaign_recipients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    student_id INTEGER,
    recipient_name TEXT NOT NULL,
    recipient_email TEXT NOT NULL,
    recipient_college TEXT,
    recipient_phone TEXT,
    status TEXT DEFAULT 'pending',       -- 'pending', 'sent', 'failed'
    error_message TEXT DEFAULT '',
    latency_ms INTEGER DEFAULT 0,
    rendered_subject TEXT,
    rendered_body TEXT,
    sent_at DATETIME,
    attempts INTEGER DEFAULT 0,
    smtp_account_id INTEGER,
    smtp_sender TEXT,
    FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
    FOREIGN KEY(student_id) REFERENCES students(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_camp_recip_camp_id ON campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_camp_recip_status ON campaign_recipients(status);

-- Table: settings
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: smtp_accounts (Multi-SMTP Senders Pool for Load Balancing & Auto-Rotation)
CREATE TABLE IF NOT EXISTS smtp_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,                     -- e.g. "Primary HR 1 - Gmail", "Backup Sender 2"
    host TEXT NOT NULL DEFAULT 'smtp.gmail.com',
    port INTEGER DEFAULT 587,
    secure INTEGER DEFAULT 0,               -- 1 for 465 SSL, 0 for 587 TLS
    user TEXT NOT NULL,                     -- e.g. "hr1@aparaitech.org"
    pass TEXT NOT NULL,                     -- App password
    from_name TEXT DEFAULT 'Aparaitech Recruitment Team',
    from_email TEXT NOT NULL,
    reply_to TEXT DEFAULT 'careers@aparaitech.org',
    daily_limit INTEGER DEFAULT 500,        -- Max emails per 24 hours (e.g. 500 for Google, 100 for free)
    sent_today INTEGER DEFAULT 0,           -- Count sent in current day
    last_sent_date TEXT DEFAULT '',         -- YYYY-MM-DD to auto-reset daily count
    is_active INTEGER DEFAULT 1,            -- 1: enabled, 0: disabled
    priority INTEGER DEFAULT 1,             -- 1 = highest priority
    last_used_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_smtp_accounts_active ON smtp_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_smtp_accounts_priority ON smtp_accounts(priority);

-- Table: admin_users (Admin, Recruiter & Customer Accounts)
CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    role TEXT DEFAULT 'customer',        -- 'superadmin', 'admin', 'recruiter', 'customer'
    full_name TEXT NOT NULL,
    company TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    avatar TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- Table: auth_sessions (Active session tokens)
CREATE TABLE IF NOT EXISTS auth_sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token);

-- Table: subscription_plans (Predefined Tiers with Server Allocations)
CREATE TABLE IF NOT EXISTS subscription_plans (
    id TEXT PRIMARY KEY,                 -- 'trial', 'starter', 'pro', 'enterprise', 'custom'
    name TEXT NOT NULL,                  -- '7-Day Free Trial', 'Starter Tier', 'Pro Growth Tier', 'Enterprise Tier'
    price REAL DEFAULT 0,
    currency TEXT DEFAULT 'USD',
    billing_interval TEXT DEFAULT 'month',
    max_servers INTEGER NOT NULL,        -- HOW MUCH SERVER GIVEN: 1 for trial, 5 for pro, 10 for enterprise
    max_emails_per_month INTEGER NOT NULL,
    max_contacts INTEGER NOT NULL,
    features TEXT DEFAULT '[]',          -- JSON array of features
    description TEXT DEFAULT '',
    is_popular INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Table: subscriptions (Current Active Subscription & Server Quota)
CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,                     -- Links to customer (NULL for system global)
    plan_id TEXT NOT NULL,
    plan_name TEXT NOT NULL,
    status TEXT DEFAULT 'trial',         -- 'trial', 'active', 'expired'
    max_servers INTEGER NOT NULL,        -- HOW MUCH SERVER GIVEN: 1 for trial
    max_emails_per_month INTEGER NOT NULL,
    emails_sent_this_cycle INTEGER DEFAULT 0,
    max_contacts INTEGER NOT NULL,
    billing_cycle TEXT DEFAULT 'monthly',
    start_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    trial_ends_at DATETIME,              -- 7-Day Free Trial expiration date
    expires_at DATETIME,
    features TEXT DEFAULT '[]',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
    FOREIGN KEY(plan_id) REFERENCES subscription_plans(id)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Table: subscription_payments (Direct UPI & Gateway Transactions)
CREATE TABLE IF NOT EXISTS subscription_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    plan_id TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'INR',
    upi_id TEXT DEFAULT '8261840199-3@ibl',
    utr_number TEXT,
    screenshot_url TEXT,
    status TEXT DEFAULT 'pending',
    admin_note TEXT,
    reviewed_at DATETIME,
    reviewed_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES admin_users(id) ON DELETE CASCADE,
    FOREIGN KEY(plan_id) REFERENCES subscription_plans(id)
);

CREATE INDEX IF NOT EXISTS idx_sub_payments_user ON subscription_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_sub_payments_utr ON subscription_payments(utr_number);
