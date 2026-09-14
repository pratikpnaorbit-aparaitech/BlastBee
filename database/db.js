const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = process.env.DB_PATH || (process.env.VERCEL ? path.join('/tmp', 'mailblast.db') : path.join(__dirname, 'mailblast.db'));
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Run schema migrations first
    const schemaSql = fs.readFileSync(SCHEMA_PATH, 'utf8');
    db.exec(schemaSql);

    // Migration: Ensure import_batch_id & import_source columns exist on students table
    try {
      const cols = db.prepare("PRAGMA table_info(students)").all().map(c => c.name);
      if (cols.length > 0) {
        if (!cols.includes('import_batch_id')) {
          db.exec("ALTER TABLE students ADD COLUMN import_batch_id TEXT;");
        }
        if (!cols.includes('import_source')) {
          db.exec("ALTER TABLE students ADD COLUMN import_source TEXT DEFAULT 'Manual Entry';");
        }
      }
    } catch (e) {
      // ignore if table doesn't exist yet
    }

    // Migration: Ensure campaign_recipients has smtp_account_id & smtp_sender columns
    try {
      const crCols = db.prepare("PRAGMA table_info(campaign_recipients)").all().map(c => c.name);
      if (crCols.length > 0) {
        if (!crCols.includes('smtp_account_id')) {
          db.exec("ALTER TABLE campaign_recipients ADD COLUMN smtp_account_id INTEGER;");
        }
        if (!crCols.includes('smtp_sender')) {
          db.exec("ALTER TABLE campaign_recipients ADD COLUMN smtp_sender TEXT;");
        }
      }
    } catch (e) {
      // ignore
    }

    // Migration: Ensure campaigns has apply_link column
    try {
      const campCols = db.prepare("PRAGMA table_info(campaigns)").all().map(c => c.name);
      if (campCols.length > 0 && !campCols.includes('apply_link')) {
        db.exec("ALTER TABLE campaigns ADD COLUMN apply_link TEXT DEFAULT 'https://aparaitech.org/apply';");
      }
    } catch (e) {
      // ignore
    }

    // Ensure index exists
    try {
      db.exec("CREATE INDEX IF NOT EXISTS idx_students_import_batch ON students(import_batch_id);");
      db.exec("CREATE INDEX IF NOT EXISTS idx_smtp_accounts_active ON smtp_accounts(is_active);");
    } catch (e) {
      // ignore
    }

    // Migration: Ensure admin_users has company, phone, last_login, and login_count columns
    try {
      const uCols = db.prepare("PRAGMA table_info(admin_users)").all().map(c => c.name);
      if (uCols.length > 0) {
        if (!uCols.includes('company')) db.exec("ALTER TABLE admin_users ADD COLUMN company TEXT DEFAULT '';");
        if (!uCols.includes('phone')) db.exec("ALTER TABLE admin_users ADD COLUMN phone TEXT DEFAULT '';");
        if (!uCols.includes('last_login')) db.exec("ALTER TABLE admin_users ADD COLUMN last_login DATETIME;");
        if (!uCols.includes('login_count')) db.exec("ALTER TABLE admin_users ADD COLUMN login_count INTEGER DEFAULT 0;");
      }
    } catch (e) {}

    // Migration: Ensure subscriptions has user_id and trial_ends_at columns
    try {
      const subCols = db.prepare("PRAGMA table_info(subscriptions)").all().map(c => c.name);
      if (subCols.length > 0) {
        if (!subCols.includes('user_id')) db.exec("ALTER TABLE subscriptions ADD COLUMN user_id INTEGER;");
        if (!subCols.includes('trial_ends_at')) db.exec("ALTER TABLE subscriptions ADD COLUMN trial_ends_at DATETIME;");
        db.exec("CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);");
      }
    } catch (e) {}

    // Migration: Ensure smtp_accounts has user_id column
    try {
      const smtpCols = db.prepare("PRAGMA table_info(smtp_accounts)").all().map(c => c.name);
      if (smtpCols.length > 0 && !smtpCols.includes('user_id')) {
        db.exec("ALTER TABLE smtp_accounts ADD COLUMN user_id INTEGER;");
      }
    } catch (e) {}

    // Migration: Ensure students has user_id column
    try {
      const sCols = db.prepare("PRAGMA table_info(students)").all().map(c => c.name);
      if (sCols.length > 0 && !sCols.includes('user_id')) {
        db.exec("ALTER TABLE students ADD COLUMN user_id INTEGER;");
        db.exec("CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);");
      }
    } catch (e) {}

    // Migration: Migrate students table from global email UNIQUE to workspace-scoped UNIQUE(email, COALESCE(user_id, 0))
    try {
      const idxs = db.prepare("PRAGMA index_list(students)").all();
      const hasOldEmailUnique = idxs.some(i => {
        if (i.unique && i.origin === 'u') {
          const cols = db.prepare(`PRAGMA index_info('${i.name}')`).all();
          return cols.length === 1 && cols[0].name === 'email';
        }
        return false;
      });

      if (hasOldEmailUnique) {
        console.log('🔄 Migrating students table to workspace-scoped email uniqueness...');
        db.pragma('foreign_keys = OFF');
        db.exec(`
          BEGIN TRANSACTION;
          CREATE TABLE IF NOT EXISTS students_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              email TEXT NOT NULL,
              college TEXT NOT NULL,
              phone TEXT,
              branch TEXT DEFAULT 'Computer Science',
              batch TEXT DEFAULT '2026',
              status TEXT DEFAULT 'Active',
              import_batch_id TEXT,
              import_source TEXT DEFAULT 'Manual Entry',
              tags TEXT DEFAULT '[]',
              notes TEXT DEFAULT '',
              user_id INTEGER,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          INSERT INTO students_new (id, name, email, college, phone, branch, batch, status, import_batch_id, import_source, tags, notes, user_id, created_at, updated_at)
          SELECT id, name, email, college, phone, branch, batch, status, import_batch_id, import_source, tags, notes, user_id, created_at, updated_at
          FROM students;
          DROP TABLE students;
          ALTER TABLE students_new RENAME TO students;
          CREATE INDEX IF NOT EXISTS idx_students_college ON students(college);
          CREATE INDEX IF NOT EXISTS idx_students_batch ON students(batch);
          CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
          CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
          CREATE INDEX IF NOT EXISTS idx_students_import_batch ON students(import_batch_id);
          CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
          CREATE UNIQUE INDEX IF NOT EXISTS idx_students_email_workspace ON students(email, COALESCE(user_id, 0));
          COMMIT;
        `);
        db.pragma('foreign_keys = ON');
        console.log('✅ Students table migrated successfully with workspace-scoped email uniqueness.');
      } else {
        db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_students_email_workspace ON students(email, COALESCE(user_id, 0));");
      }
    } catch (e) {
      console.error('Students migration error:', e.message);
      try { db.pragma('foreign_keys = ON'); } catch (_) {}
    }

    // Migration: Ensure campaigns has user_id column
    try {
      const cCols = db.prepare("PRAGMA table_info(campaigns)").all().map(c => c.name);
      if (cCols.length > 0 && !cCols.includes('user_id')) {
        db.exec("ALTER TABLE campaigns ADD COLUMN user_id INTEGER;");
        db.exec("CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);");
      }
    } catch (e) {}

    // Migration: Ensure subscription_payments has screenshot_url, admin_note, reviewed_at, reviewed_by
    try {
      const payCols = db.prepare("PRAGMA table_info(subscription_payments)").all().map(c => c.name);
      if (payCols.length > 0) {
        if (!payCols.includes('screenshot_url')) db.exec("ALTER TABLE subscription_payments ADD COLUMN screenshot_url TEXT;");
        if (!payCols.includes('admin_note')) db.exec("ALTER TABLE subscription_payments ADD COLUMN admin_note TEXT;");
        if (!payCols.includes('reviewed_at')) db.exec("ALTER TABLE subscription_payments ADD COLUMN reviewed_at DATETIME;");
        if (!payCols.includes('reviewed_by')) db.exec("ALTER TABLE subscription_payments ADD COLUMN reviewed_by INTEGER;");
      }
    } catch (e) {}

    // Ensure payment proof upload directory exists
    try {
      const uploadDir = path.join(__dirname, '..', 'public', 'uploads', 'payments');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
    } catch (e) {}

    // Initialize default settings and migrate existing SMTP to smtp_accounts
    initDefaultSettings(db);
    migrateExistingSmtpToAccounts(db);

    // Seed default admin user & subscription tiers
    seedAdminUser(db);
    const { seedSubscriptionData } = require('../services/subscriptionService');
    seedSubscriptionData(db);
    seedDemoCustomer(db);
  }
  return db;
}

function initDefaultSettings(database) {
  const defaultSettings = [
    { key: 'mailer_mode', value: 'smtp' },
    { key: 'smtp_rotation_strategy', value: 'round_robin' }, // 'round_robin', 'auto_failover', 'single'
    { key: 'smtp_host', value: 'smtp.gmail.com' },
    { key: 'smtp_port', value: '587' },
    { key: 'smtp_secure', value: 'false' },
    { key: 'smtp_user', value: 'recruitment@aparaitech.org' },
    { key: 'smtp_pass', value: '' },
    { key: 'from_name', value: 'Aparaitech Software Recruitment Team' },
    { key: 'from_email', value: 'recruitment@aparaitech.org' },
    { key: 'reply_to', value: 'careers@aparaitech.org' },
    { key: 'send_delay_ms', value: '350' }, // Delay between emails in blast
    { key: 'company_name', value: 'Aparaitech Software' },
    { key: 'company_website', value: 'https://aparaitech.org' },
    { key: 'company_logo', value: '/assets/logo.svg' },
    { key: 'company_location', value: 'Bengaluru & Pune / Baramati Tech Centers' }
  ];

  const checkStmt = database.prepare('SELECT value FROM settings WHERE key = ?');
  const insertStmt = database.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');

  const insertTx = database.transaction(() => {
    for (const setting of defaultSettings) {
      const existing = checkStmt.get(setting.key);
      if (!existing) {
        insertStmt.run(setting.key, setting.value);
      }
    }
  });

  insertTx();
}

const DEFAULT_SMTP_ACCOUNTS = [
  {
    name: 'Anurag Primary Sender',
    host: 'smtp.gmail.com',
    port: 587,
    secure: 0,
    user: 'anurag.aparaitech@gmail.com',
    pass: 'kmnitimmwqmbzoha',
    from_name: 'Aparaitech Software Recruitment Team',
    from_email: 'anurag.aparaitech@gmail.com',
    reply_to: 'careers@aparaitech.org',
    daily_limit: 500,
    priority: 1,
    is_active: 1
  },
  {
    name: 'Vivek Tech Recruitment',
    host: 'smtp.gmail.com',
    port: 587,
    secure: 0,
    user: 'vivek.aparaitech@gmail.com',
    pass: 'lsejhomvrffjuawu',
    from_name: 'Aparaitech Software Recruitment Team',
    from_email: 'vivek.aparaitech@gmail.com',
    reply_to: 'careers@aparaitech.org',
    daily_limit: 500,
    priority: 2,
    is_active: 1
  },
  {
    name: 'Anurag00 Campus Outreach',
    host: 'smtp.gmail.com',
    port: 587,
    secure: 0,
    user: 'anurag00.aparaitech@gmail.com',
    pass: 'kkrrxmqkhbmcaplq',
    from_name: 'Aparaitech Software Recruitment Team',
    from_email: 'anurag00.aparaitech@gmail.com',
    reply_to: 'careers@aparaitech.org',
    daily_limit: 500,
    priority: 3,
    is_active: 1
  },
  {
    name: 'Anurag01 Talent Acquisition',
    host: 'smtp.gmail.com',
    port: 587,
    secure: 0,
    user: 'anurag01.aparaitech@gmail.com',
    pass: 'tfyykuuavxpamjvo',
    from_name: 'Aparaitech Software Recruitment Team',
    from_email: 'anurag01.aparaitech@gmail.com',
    reply_to: 'careers@aparaitech.org',
    daily_limit: 500,
    priority: 4,
    is_active: 1
  },
  {
    name: 'Kshitij HR Operations',
    host: 'smtp.gmail.com',
    port: 587,
    secure: 0,
    user: 'kshitij.aparaitech@gmail.com',
    pass: 'zxlwpwxwwskdfmwh',
    from_name: 'Aparaitech Software Recruitment Team',
    from_email: 'kshitij.aparaitech@gmail.com',
    reply_to: 'careers@aparaitech.org',
    daily_limit: 500,
    priority: 5,
    is_active: 1
  },
  {
    name: 'Snehal Recruitment Operations',
    host: 'smtp.gmail.com',
    port: 587,
    secure: 0,
    user: 'snehal.aparaitech@gmail.com',
    pass: 'jkmazdnblxqvhihs',
    from_name: 'Aparaitech Software Recruitment Team',
    from_email: 'snehal.aparaitech@gmail.com',
    reply_to: 'careers@aparaitech.org',
    daily_limit: 500,
    priority: 6,
    is_active: 1
  },
  {
    name: 'Sakshi Campus Recruitment',
    host: 'smtp.gmail.com',
    port: 587,
    secure: 0,
    user: 'sakshishinde.aparaitech@gmail.com',
    pass: 'chqnngfksklvjarp',
    from_name: 'Aparaitech Software Recruitment Team',
    from_email: 'sakshishinde.aparaitech@gmail.com',
    reply_to: 'careers@aparaitech.org',
    daily_limit: 500,
    priority: 7,
    is_active: 1
  },
  {
    name: 'Pratik Talent Acquisition',
    host: 'smtp.gmail.com',
    port: 587,
    secure: 0,
    user: 'pratikumeshpawar@gmail.com',
    pass: 'vghisddgwdgwwgmo',
    from_name: 'Aparaitech Software Recruitment Team',
    from_email: 'pratikumeshpawar@gmail.com',
    reply_to: 'careers@aparaitech.org',
    daily_limit: 500,
    priority: 8,
    is_active: 1
  }
];

function migrateExistingSmtpToAccounts(database) {
  try {
    const existingAccounts = database.prepare('SELECT * FROM smtp_accounts').all();
    const existingUsers = new Set(existingAccounts.map(a => a.user.toLowerCase()));

    const insertStmt = database.prepare(`
      INSERT INTO smtp_accounts (name, host, port, secure, user, pass, from_name, from_email, reply_to, daily_limit, sent_today, is_active, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
    `);

    const updatePassStmt = database.prepare(`
      UPDATE smtp_accounts 
      SET pass = ?, host = ?, port = ?, from_name = ?, from_email = ?, reply_to = ?, is_active = 1
      WHERE user = ?
    `);

    const tx = database.transaction(() => {
      for (const acc of DEFAULT_SMTP_ACCOUNTS) {
        if (!existingUsers.has(acc.user.toLowerCase())) {
          insertStmt.run(
            acc.name,
            acc.host,
            acc.port,
            acc.secure,
            acc.user,
            acc.pass,
            acc.from_name,
            acc.from_email,
            acc.reply_to,
            acc.daily_limit,
            acc.is_active,
            acc.priority
          );
        } else {
          // Keep credentials up to date
          updatePassStmt.run(
            acc.pass,
            acc.host,
            acc.port,
            acc.from_name,
            acc.from_email,
            acc.reply_to,
            acc.user
          );
        }
      }
    });

    tx();
  } catch (e) {
    console.error('Error seeding SMTP accounts in db.js:', e.message);
  }
}

function seedAdminUser(database) {
  try {
    const existing = database.prepare('SELECT id FROM admin_users WHERE email = ?').get('admin@aparaitech.org');
    if (!existing) {
      const authService = require('../services/authService');
      authService.createUser(database, {
        username: 'admin',
        email: 'admin@aparaitech.org',
        password: 'admin123',
        role: 'superadmin',
        fullName: 'Super Administrator',
        avatar: '👨‍💼'
      });
      console.log('👑 Default Admin User created (admin@aparaitech.org / admin123)');
    }
  } catch (err) {
    console.error('Error seeding admin user in db.js:', err.message);
  }
}

function seedDemoCustomer(database) {
  try {
    const existing = database.prepare('SELECT id FROM admin_users WHERE email = ?').get('customer@example.com');
    if (!existing) {
      const authService = require('../services/authService');
      authService.registerCustomer(database, {
        fullName: 'Demo Campus Recruiter',
        email: 'customer@example.com',
        password: 'customer123',
        company: 'Apex Tech Placement Cell',
        phone: '+91 9876543210'
      });
      console.log('👤 Demo Customer created with 7-Day Trial (customer@example.com / customer123)');
    }
  } catch (err) {
    console.error('Error seeding demo customer in db.js:', err.message);
  }
}

module.exports = {
  getDb,
  DB_PATH,
  DEFAULT_SMTP_ACCOUNTS,
  migrateExistingSmtpToAccounts,
  seedAdminUser,
  seedDemoCustomer
};
