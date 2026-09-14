const { MongoClient } = require('mongodb');
const { getDb, DEFAULT_SMTP_ACCOUNTS } = require('./db');

const DEFAULT_MONGODB_URI = "mongodb://mailblast:Aparaitech2129@ac-rl6rdwo-shard-00-00.kmi9oku.mongodb.net:27017,ac-rl6rdwo-shard-00-01.kmi9oku.mongodb.net:27017,ac-rl6rdwo-shard-00-02.kmi9oku.mongodb.net:27017/?ssl=true&replicaSet=atlas-3ebffw-shard-0&authSource=admin&appName=Cluster0";

let mongoClient = null;
let mongoDb = null;
let isConnected = false;
let currentUri = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;
let connectionPromise = null;

if (!process.env.MONGODB_URI) {
  process.env.MONGODB_URI = DEFAULT_MONGODB_URI;
}

/**
 * Connect to MongoDB Atlas
 */
async function connectMongo(uri = null) {
  const targetUri = uri || process.env.MONGODB_URI || DEFAULT_MONGODB_URI;
  if (!targetUri) {
    return { success: false, message: 'No MongoDB URI provided.' };
  }

  try {
    if (mongoClient) {
      await mongoClient.close();
    }

    mongoClient = new MongoClient(targetUri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 10000
    });

    await mongoClient.connect();
    mongoDb = mongoClient.db();
    isConnected = true;
    currentUri = targetUri;

    // Ensure collections and indexes
    await ensureMongoIndexes(mongoDb);

    console.log(`🍃 Connected to MongoDB Atlas Database: ${mongoDb.databaseName}`);

    // Synchronize data from MongoDB Atlas to local SQLite in background
    syncMongoToSqlite().catch(err => {
      console.warn('Background MongoDB to SQLite sync note:', err.message);
    });

    return {
      success: true,
      database: mongoDb.databaseName,
      message: `Successfully connected to MongoDB Atlas (${mongoDb.databaseName})`
    };
  } catch (error) {
    isConnected = false;
    mongoClient = null;
    mongoDb = null;
    console.error('MongoDB Atlas Connection Error:', error.message);
    return {
      success: false,
      error: error.message,
      message: `MongoDB Atlas connection failed: ${error.message}`
    };
  }
}

/**
 * Return the configured Atlas database, connecting once per server instance.
 * This is intentionally async: serverless functions must not fall back to
 * Vercel's ephemeral /tmp SQLite database while Atlas is still connecting.
 */
async function getPersistentMongoDb() {
  if (isMongoActive()) return mongoDb;

  if (!connectionPromise) {
    connectionPromise = connectMongo().then(result => {
      if (!result.success) {
        throw new Error(result.message || 'MongoDB Atlas connection failed.');
      }
      return mongoDb;
    }).finally(() => {
      connectionPromise = null;
    });
  }

  return connectionPromise;
}

/**
 * Test a MongoDB connection string without keeping it active
 */
async function testMongoConnection(uri) {
  if (!uri || !uri.trim()) {
    return { success: false, message: 'Please enter a valid MongoDB connection URI.' };
  }

  let tempClient = null;
  const startTime = Date.now();

  try {
    tempClient = new MongoClient(uri.trim(), {
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 8000
    });

    await tempClient.connect();
    const db = tempClient.db();
    await db.command({ ping: 1 });

    const latencyMs = Date.now() - startTime;
    const dbName = db.databaseName || 'mailblast';

    await tempClient.close();

    return {
      success: true,
      database: dbName,
      latencyMs,
      message: `Successfully connected to MongoDB Atlas database "${dbName}" in ${latencyMs}ms!`
    };
  } catch (error) {
    if (tempClient) {
      try { await tempClient.close(); } catch (e) {}
    }
    return {
      success: false,
      message: `MongoDB Atlas test failed: ${error.message}`
    };
  }
}

/**
 * Create indexes in MongoDB collections
 */
async function ensureMongoIndexes(db) {
  try {
    // Students collection - workspace scoped index
    try {
      await db.collection('students').dropIndex('email_1');
    } catch (_) {}
    await db.collection('students').createIndex({ email: 1, user_id: 1 }, { unique: true, sparse: true });
    await db.collection('students').createIndex({ college: 1 });
    await db.collection('students').createIndex({ batch: 1 });
    await db.collection('students').createIndex({ import_batch_id: 1 });
    await db.collection('students').createIndex({ user_id: 1 });

    // Campaigns collection
    await db.collection('campaigns').createIndex({ createdAt: -1 });

    // Campaign recipients collection
    await db.collection('campaign_recipients').createIndex({ campaign_id: 1 });
    await db.collection('campaign_recipients').createIndex({ status: 1 });

    // SMTP accounts collection
    await db.collection('smtp_accounts').createIndex({ is_active: 1 });

    // Auto-sync the 8 primary SMTP accounts with their credentials
    if (DEFAULT_SMTP_ACCOUNTS && DEFAULT_SMTP_ACCOUNTS.length > 0) {
      const activeUsers = DEFAULT_SMTP_ACCOUNTS.map(a => a.user);
      await db.collection('smtp_accounts').deleteMany({ user: { $nin: activeUsers } });
      const ops = DEFAULT_SMTP_ACCOUNTS.map(a => ({
        updateOne: {
          filter: { user: a.user },
          update: {
            $set: {
              name: a.name,
              host: a.host,
              port: a.port,
              secure: a.secure,
              user: a.user,
              pass: a.pass,
              from_name: a.from_name,
              from_email: a.from_email,
              reply_to: a.reply_to,
              daily_limit: a.daily_limit,
              is_active: a.is_active,
              priority: a.priority
            }
          },
          upsert: true
        }
      }));
      await db.collection('smtp_accounts').bulkWrite(ops);
    }
  } catch (err) {
    console.error('Error creating MongoDB indexes / syncing default accounts:', err.message);
  }
}

/**
 * Sync / Migrate all current SQLite data directly into MongoDB Atlas
 */
async function syncSqliteToMongo(uri = null) {
  const targetUri = uri || currentUri || process.env.MONGODB_URI;
  if (!targetUri) {
    throw new Error('MongoDB URI is required to sync data.');
  }

  if (!isConnected || !mongoDb) {
    const connResult = await connectMongo(targetUri);
    if (!connResult.success) {
      throw new Error(connResult.message);
    }
  }

  const sqlite = getDb();
  const summary = {
    students: 0,
    templates: 0,
    campaigns: 0,
    smtp_accounts: 0,
    settings: 0
  };

  // 1. Sync Students
  const students = sqlite.prepare('SELECT * FROM students').all();
  if (students.length > 0) {
    const studentOps = students.map(s => ({
      updateOne: {
        filter: { email: s.email },
        update: {
          $set: {
            name: s.name,
            email: s.email,
            college: s.college,
            phone: s.phone,
            branch: s.branch,
            batch: s.batch,
            status: s.status,
            import_batch_id: s.import_batch_id,
            import_source: s.import_source,
            tags: typeof s.tags === 'string' ? JSON.parse(s.tags || '[]') : s.tags,
            notes: s.notes,
            created_at: s.created_at,
            updated_at: s.updated_at
          }
        },
        upsert: true
      }
    }));
    const res = await mongoDb.collection('students').bulkWrite(studentOps);
    summary.students = (res.upsertedCount || 0) + (res.modifiedCount || 0) || students.length;
  }

  // 2. Sync Templates
  const templates = sqlite.prepare('SELECT * FROM templates').all();
  if (templates.length > 0) {
    const templateOps = templates.map(t => ({
      updateOne: {
        filter: { name: t.name },
        update: {
          $set: {
            name: t.name,
            category: t.category,
            subject: t.subject,
            body_html: t.body_html,
            tags_used: typeof t.tags_used === 'string' ? JSON.parse(t.tags_used || '[]') : t.tags_used,
            created_at: t.created_at
          }
        },
        upsert: true
      }
    }));
    await mongoDb.collection('templates').bulkWrite(templateOps);
    summary.templates = templates.length;
  }

  // 3. Sync SMTP Accounts
  const smtpAccounts = sqlite.prepare('SELECT * FROM smtp_accounts').all();
  if (smtpAccounts.length > 0) {
    const validUsers = smtpAccounts.map(a => a.user);
    await mongoDb.collection('smtp_accounts').deleteMany({ user: { $nin: validUsers } });
    const smtpOps = smtpAccounts.map(a => ({
      updateOne: {
        filter: { user: a.user },
        update: {
          $set: {
            name: a.name,
            host: a.host,
            port: a.port,
            secure: a.secure,
            user: a.user,
            pass: a.pass,
            from_name: a.from_name,
            from_email: a.from_email,
            reply_to: a.reply_to,
            daily_limit: a.daily_limit,
            sent_today: a.sent_today,
            is_active: a.is_active,
            priority: a.priority
          }
        },
        upsert: true
      }
    }));
    await mongoDb.collection('smtp_accounts').bulkWrite(smtpOps);
    summary.smtp_accounts = smtpAccounts.length;
  }

  // 4. Sync Settings
  const settings = sqlite.prepare('SELECT * FROM settings').all();
  if (settings.length > 0) {
    const settingsOps = settings.map(s => ({
      updateOne: {
        filter: { key: s.key },
        update: { $set: { key: s.key, value: s.value } },
        upsert: true
      }
    }));
    await mongoDb.collection('settings').bulkWrite(settingsOps);
    summary.settings = settings.length;
  }

  return {
    success: true,
    message: `Successfully synchronized ${summary.students} candidates, ${summary.templates} templates, and ${summary.smtp_accounts} SMTP accounts to MongoDB Atlas!`,
    summary
  };
}

/** Persist a campaign and its recipient delivery records after each send. */
async function syncCampaignDelivery(campaignId, recipientId = null) {
  try {
    const db = await getPersistentMongoDb();
    if (!db) return;
    const sqlite = getDb();
    const campaign = sqlite.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
    if (!campaign) return;

    await db.collection('campaigns').updateOne(
      { sqlite_id: campaign.id },
      { $set: { ...campaign, sqlite_id: campaign.id, synced_at: new Date().toISOString() } },
      { upsert: true }
    );

    const recipientSql = recipientId
      ? 'SELECT * FROM campaign_recipients WHERE id = ?'
      : 'SELECT * FROM campaign_recipients WHERE campaign_id = ?';
    const recipients = recipientId
      ? sqlite.prepare(recipientSql).all(recipientId)
      : sqlite.prepare(recipientSql).all(campaignId);
    if (recipients.length) {
      await db.collection('campaign_recipients').bulkWrite(recipients.map(recipient => ({
        updateOne: {
          filter: { sqlite_id: recipient.id, campaign_sqlite_id: campaign.id },
          update: { $set: { ...recipient, sqlite_id: recipient.id, campaign_sqlite_id: campaign.id, synced_at: new Date().toISOString() } },
          upsert: true
        }
      })));
    }
  } catch (err) {
    // Non-blocking warning so email sending and campaign progress are not aborted
  }
}

async function syncSmtpConfiguration() {
  try {
    const db = await getPersistentMongoDb();
    if (!db) return;
    const sqlite = getDb();
    const settings = sqlite.prepare('SELECT * FROM settings').all();
    const accounts = sqlite.prepare('SELECT * FROM smtp_accounts').all();
    if (settings.length) {
      await db.collection('settings').bulkWrite(settings.map(setting => ({
        updateOne: { filter: { key: setting.key }, update: { $set: setting }, upsert: true }
      })));
    }
    if (accounts.length) {
      const activeUsers = accounts.map(a => a.user);
      await db.collection('smtp_accounts').deleteMany({ user: { $nin: activeUsers } });
      await db.collection('smtp_accounts').bulkWrite(accounts.map(account => ({
        updateOne: {
          filter: { user: account.user },
          update: { $set: { ...account, sqlite_id: account.id } },
          upsert: true
        }
      })));
    }
  } catch (err) {
    // Non-blocking warning
  }
}

async function syncTemplateToMongo(templateId) {
  try {
    const db = await getPersistentMongoDb();
    if (!db) return;
    const sqlite = getDb();
    const t = sqlite.prepare('SELECT * FROM templates WHERE id = ?').get(templateId);
    if (!t) return;
    await db.collection('templates').updateOne(
      { sqlite_id: t.id },
      {
        $set: {
          sqlite_id: t.id,
          name: t.name,
          category: t.category,
          subject: t.subject,
          body_html: t.body_html,
          tags_used: typeof t.tags_used === 'string' ? JSON.parse(t.tags_used || '[]') : t.tags_used,
          created_at: t.created_at,
          updated_at: t.updated_at
        }
      },
      { upsert: true }
    );
  } catch (err) {
    // Non-blocking warning
  }
}

async function deleteTemplateFromMongo(templateId) {
  try {
    const db = await getPersistentMongoDb();
    if (!db) return;
    await db.collection('templates').deleteOne({ sqlite_id: Number(templateId) });
  } catch (err) {
    // Non-blocking warning
  }
}

async function syncStudentToMongo(studentId) {
  try {
    const db = await getPersistentMongoDb();
    if (!db) return;
    const sqlite = getDb();
    const s = sqlite.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
    if (!s) return;
    await db.collection('students').updateOne(
      { email: s.email },
      {
        $set: {
          sqlite_id: s.id,
          name: s.name,
          email: s.email,
          college: s.college,
          phone: s.phone,
          branch: s.branch,
          batch: s.batch,
          status: s.status,
          import_batch_id: s.import_batch_id,
          import_source: s.import_source,
          tags: typeof s.tags === 'string' ? JSON.parse(s.tags || '[]') : s.tags,
          notes: s.notes,
          created_at: s.created_at,
          updated_at: s.updated_at
        }
      },
      { upsert: true }
    );
  } catch (err) {
    // Non-blocking warning
  }
}

async function deleteStudentFromMongo(studentId, studentEmail = null) {
  try {
    const db = await getPersistentMongoDb();
    if (!db) return;
    const filter = studentEmail ? { email: studentEmail } : { sqlite_id: Number(studentId) };
    await db.collection('students').deleteOne(filter);
  } catch (err) {
    // Non-blocking warning
  }
}

async function deleteStudentBatchFromMongo(batchId) {
  try {
    const db = await getPersistentMongoDb();
    if (!db) return;
    await db.collection('students').deleteMany({ import_batch_id: batchId });
  } catch (err) {
    // Non-blocking warning
  }
}

async function bulkDeleteStudentsFromMongo(studentIds) {
  try {
    const db = await getPersistentMongoDb();
    if (!db || !studentIds || !studentIds.length) return;
    const numIds = studentIds.map(Number).filter(n => !isNaN(n));
    await db.collection('students').deleteMany({ sqlite_id: { $in: numIds } });
  } catch (err) {
    // Non-blocking warning
  }
}

async function syncStudentListToMongo(studentsList) {
  try {
    const db = await getPersistentMongoDb();
    if (!db || !studentsList || !studentsList.length) return;
    const ops = studentsList.map(s => ({
      updateOne: {
        filter: { email: s.email },
        update: {
          $set: {
            sqlite_id: s.id,
            name: s.name,
            email: s.email,
            college: s.college,
            phone: s.phone,
            branch: s.branch,
            batch: s.batch,
            status: s.status || 'Active',
            import_batch_id: s.import_batch_id,
            import_source: s.import_source,
            tags: typeof s.tags === 'string' ? JSON.parse(s.tags || '[]') : (s.tags || []),
            notes: s.notes || '',
            created_at: s.created_at || new Date().toISOString(),
            updated_at: s.updated_at || new Date().toISOString()
          }
        },
        upsert: true
      }
    }));
    await db.collection('students').bulkWrite(ops, { ordered: false });
  } catch (err) {
    // Non-blocking warning
  }
}

async function syncMongoToSqlite() {
  try {
    const mongo = await getPersistentMongoDb();
    if (!mongo) return;
    const sqlite = getDb();

    // 1. Sync Students from Mongo to SQLite
    const mongoStudents = await mongo.collection('students').find({}).toArray();
    if (mongoStudents.length > 0) {
      const findExisting = sqlite.prepare('SELECT id, email FROM students WHERE email = ?');
      const insertStmt = sqlite.prepare(`
        INSERT INTO students (name, email, college, phone, branch, batch, status, import_batch_id, import_source, tags, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const updateStmt = sqlite.prepare(`
        UPDATE students 
        SET name = ?, college = ?, phone = ?, branch = ?, batch = ?, status = ?, import_batch_id = ?, import_source = ?, tags = ?, notes = ?, updated_at = ?
        WHERE id = ?
      `);

      const tx = sqlite.transaction(() => {
        for (const s of mongoStudents) {
          if (!s.email) continue;
          const cleanEmail = s.email.trim().toLowerCase();
          const existing = findExisting.get(cleanEmail);
          const tagsStr = typeof s.tags === 'string' ? s.tags : JSON.stringify(s.tags || []);
          const createdAt = s.created_at || new Date().toISOString();
          const updatedAt = s.updated_at || new Date().toISOString();

          if (existing) {
            updateStmt.run(
              s.name || '',
              s.college || 'General Pool',
              s.phone || '',
              s.branch || 'Computer Science',
              s.batch || '2026',
              s.status || 'Active',
              s.import_batch_id || null,
              s.import_source || 'Manual Entry',
              tagsStr,
              s.notes || '',
              updatedAt,
              existing.id
            );
          } else {
            insertStmt.run(
              s.name || '',
              cleanEmail,
              s.college || 'General Pool',
              s.phone || '',
              s.branch || 'Computer Science',
              s.batch || '2026',
              s.status || 'Active',
              s.import_batch_id || null,
              s.import_source || 'Manual Entry',
              tagsStr,
              s.notes || '',
              createdAt,
              updatedAt
            );
          }
        }
      });
      tx();
      console.log(`🍃 Synced ${mongoStudents.length} candidates from MongoDB Atlas to local database.`);
    }

    // 2. Sync Templates from Mongo to SQLite
    const mongoTemplates = await mongo.collection('templates').find({}).toArray();
    if (mongoTemplates.length > 0) {
      const findTpl = sqlite.prepare('SELECT id FROM templates WHERE name = ?');
      const insertTpl = sqlite.prepare(`
        INSERT INTO templates (name, category, subject, body_html, tags_used, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      const updateTpl = sqlite.prepare(`
        UPDATE templates
        SET category = ?, subject = ?, body_html = ?, tags_used = ?, updated_at = ?
        WHERE id = ?
      `);
      const tplTx = sqlite.transaction(() => {
        for (const t of mongoTemplates) {
          const existing = findTpl.get(t.name);
          const tagsStr = typeof t.tags_used === 'string' ? t.tags_used : JSON.stringify(t.tags_used || []);
          if (existing) {
            updateTpl.run(t.category || 'Placement Drive', t.subject, t.body_html, tagsStr, t.updated_at || new Date().toISOString(), existing.id);
          } else {
            insertTpl.run(t.name, t.category || 'Placement Drive', t.subject, t.body_html, tagsStr, t.created_at || new Date().toISOString(), t.updated_at || new Date().toISOString());
          }
        }
      });
      tplTx();
    }
  } catch (err) {
    console.warn('MongoDB to SQLite sync note:', err.message);
  }
}

function getMongoDb() {
  return mongoDb;
}

function isMongoActive() {
  return isConnected && mongoDb !== null;
}

module.exports = {
  connectMongo,
  testMongoConnection,
  syncSqliteToMongo,
  syncMongoToSqlite,
  syncCampaignDelivery,
  syncSmtpConfiguration,
  syncTemplateToMongo,
  deleteTemplateFromMongo,
  syncStudentToMongo,
  deleteStudentFromMongo,
  deleteStudentBatchFromMongo,
  bulkDeleteStudentsFromMongo,
  syncStudentListToMongo,
  getMongoDb,
  getPersistentMongoDb,
  isMongoActive
};
