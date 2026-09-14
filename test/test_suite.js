const assert = require('assert');
const { getDb } = require('../database/db');
const { seedDatabase } = require('../database/seed');
const { renderText, extractTags } = require('../services/templateEngine');
const { parseFileBuffer, validateAndNormalizeRows, generateSampleData } = require('../services/excelParser');
const blastManager = require('../services/blastManager');
const xlsx = require('xlsx');

async function runTestSuite() {
  console.log('====================================================');
  console.log('🧪 Starting Aparaitech Student Email Blast Test Suite');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function test(name, fn) {
    totalTests++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}\n`);
    }
  }

  async function testAsync(name, fn) {
    totalTests++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(`     Error: ${err.message}\n`);
    }
  }

  // 1. Database & Seed Verification
  test('Database & Seed: DB initializes and contains seed students', () => {
    const db = getDb();
    seedDatabase();
    const studentsCount = db.prepare('SELECT count(*) as count FROM students').get().count;
    assert(studentsCount >= 40, `Expected at least 40 seed students, got ${studentsCount}`);

    const templatesCount = db.prepare('SELECT count(*) as count FROM templates').get().count;
    assert(templatesCount >= 1, `Expected at least 1 recruitment template, got ${templatesCount}`);
  });

  // 2. Personalization Template Engine
  test('Template Engine: Correctly substitutes dynamic tags {Name}, {College}, {Package}', () => {
    const template = 'Hello {Name}, welcome from {College}! Role: {Job_Role}, Package: {Package}. First name: {First_Name}.';
    const student = {
      name: 'Aditya Kulkarni',
      college: 'COEP Tech Pune'
    };

    const rendered = renderText(template, student);
    assert(rendered.includes('Hello Aditya Kulkarni'), 'Name was not substituted properly');
    assert(rendered.includes('from COEP Tech Pune'), 'College was not substituted properly');
    assert(rendered.includes('First name: Aditya'), 'First name was not extracted properly');
    assert(rendered.includes('₹6.5 LPA'), 'Default package was not filled in');
  });

  test('Template Engine: Extract tags correctly', () => {
    const text = 'Dear {Name} of {College}, your interview date is {Drive_Date}. Good luck {Name}!';
    const tags = extractTags(text);
    assert.deepStrictEqual(tags.sort(), ['{College}', '{Drive_Date}', '{Name}'].sort());
  });

  // 3. Spreadsheet Parser & Validation
  test('Excel/CSV Parser: Auto-detects columns and parses valid/invalid rows', () => {
    const sample = generateSampleData();
    // Add one invalid row
    sample.push({
      'Student Name': 'Invalid Email Student',
      'Email ID': 'invalid-email-address',
      'College Name': 'VPKBIET Baramati',
      'Phone Number': '+91 9999999999',
      'Branch / Degree': 'Computer Science',
      'Graduation Year': '2026'
    });

    const ws = xlsx.utils.json_to_sheet(sample);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const parsed = parseFileBuffer(buffer);
    assert(parsed.detectedMapping.name, 'Name column not detected');
    assert(parsed.detectedMapping.email, 'Email column not detected');
    assert(parsed.detectedMapping.college, 'College column not detected');

    const validated = validateAndNormalizeRows(parsed.rawRows, parsed.detectedMapping);
    assert.strictEqual(validated.validCount, 5, `Expected 5 valid rows, got ${validated.validCount}`);
    assert.strictEqual(validated.invalidCount, 1, `Expected 1 invalid row, got ${validated.invalidCount}`);
    assert(validated.rows[5].errors.length > 0, 'Invalid row had no error messages attached');
  });

  test('Excel/CSV Parser: Successfully parses spreadsheet containing ONLY Name and Email columns', () => {
    const minimalData = [
      { 'Name': 'Kunal Joshi', 'Email': 'kunal.j@gmail.com' },
      { 'Name': 'Priya Singh', 'Email': 'priya.s@yahoo.com' },
      { 'Name': 'Amit Verma', 'Email': 'amit.v@outlook.com' }
    ];

    const ws = xlsx.utils.json_to_sheet(minimalData);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const parsed = parseFileBuffer(buffer);
    assert(parsed.detectedMapping.name, 'Name column not detected');
    assert(parsed.detectedMapping.email, 'Email column not detected');

    const validated = validateAndNormalizeRows(parsed.rawRows, parsed.detectedMapping);
    assert.strictEqual(validated.validCount, 3, `Expected 3 valid rows, got ${validated.validCount}`);
    assert.strictEqual(validated.invalidCount, 0, `Expected 0 invalid rows, got ${validated.invalidCount}`);
  });

  // 4. Blast Campaign Queue & Execution
  await testAsync('Blast Manager: Creates campaign and records delivery outcomes', async () => {
    const db = getDb();
    
    // Pick 3 students
    const testStudents = db.prepare('SELECT * FROM students LIMIT 3').all();
    
    const campStmt = db.prepare(`
      INSERT INTO campaigns (title, subject, body_html, target_type, total_recipients, status)
      VALUES (?, ?, ?, 'all', ?, 'draft')
    `);

    const campRes = campStmt.run(
      'Automated Test Blast',
      'Test Invitation for {Name}',
      '<p>Hello {Name} from {College}</p>',
      testStudents.length
    );

    const campId = campRes.lastInsertRowid;

    const recipStmt = db.prepare(`
      INSERT INTO campaign_recipients (campaign_id, student_id, recipient_name, recipient_email, recipient_college, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `);

    for (const s of testStudents) {
      recipStmt.run(campId, s.id, s.name, s.email, s.college);
    }

    // Run campaign
    await blastManager.startCampaign(campId);

    // Wait for completion
    let attempts = 0;
    while (attempts < 300) {
      const c = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campId);
      if (c.status === 'completed' || c.status === 'cancelled') {
        break;
      }
      await new Promise(r => setTimeout(r, 250));
      attempts++;
    }

    const finalCamp = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campId);
    assert.strictEqual(finalCamp.status, 'completed', 'Campaign did not complete successfully');
    assert.strictEqual(finalCamp.sent_count, 3, `Expected 3 sent emails, got ${finalCamp.sent_count}`);
  });

  // 5. 1-Click Retry Failed Logic
  test('Blast Manager: 1-Click Retry re-queues failed recipients without duplicate sends', () => {
    const db = getDb();

    // Create a mock campaign with 1 failed and 2 sent recipients
    const campRes = db.prepare(`
      INSERT INTO campaigns (title, subject, body_html, total_recipients, sent_count, success_count, failed_count, status)
      VALUES ('Retry Test Campaign', 'Subject', 'Body', 3, 3, 2, 1, 'completed')
    `).run();

    const campId = campRes.lastInsertRowid;

    db.prepare(`INSERT INTO campaign_recipients (campaign_id, recipient_name, recipient_email, status) VALUES (?, 'Sent 1', 's1@test.com', 'sent')`).run(campId);
    db.prepare(`INSERT INTO campaign_recipients (campaign_id, recipient_name, recipient_email, status) VALUES (?, 'Sent 2', 's2@test.com', 'sent')`).run(campId);
    db.prepare(`INSERT INTO campaign_recipients (campaign_id, recipient_name, recipient_email, status, error_message) VALUES (?, 'Failed 1', 'f1@test.com', 'failed', 'Connection timeout')`).run(campId);

    const retryRes = blastManager.retryFailed(campId);
    assert.strictEqual(retryRes.success, true, 'Retry failed to initiate');
    assert.strictEqual(retryRes.retriedCount, 1, 'Expected exactly 1 failed recipient to be re-queued');

    const updatedCamp = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campId);
    assert.strictEqual(updatedCamp.failed_count, 0, 'Failed count not reset on campaign');

    const pendingCount = db.prepare("SELECT count(*) as c FROM campaign_recipients WHERE campaign_id = ? AND status = 'pending'").get(campId).c;
    assert.strictEqual(pendingCount, 1, 'Failed recipient not changed to pending');
  });

  // 6. 500+ Bulk Record Saving Test
  test('Bulk Upload: Saves 500+ records together in bulk in a single atomic transaction', () => {
    const db = getDb();
    const beforeCount = db.prepare('SELECT COUNT(*) as c FROM students').get().c;
    const testBatchId = `batch_bulk500_${Date.now()}`;

    // Generate 500 unique student records
    const bulk500 = [];
    const timestamp = Date.now();
    for (let i = 1; i <= 500; i++) {
      bulk500.push({
        'Name': `Bulk Student ${i}`,
        'Email': `bulk.student.${timestamp}.${i}@college.edu`
      });
    }

    const { validateAndNormalizeRows } = require('../services/excelParser');
    const validated = validateAndNormalizeRows(bulk500, { name: 'Name', email: 'Email' });
    assert.strictEqual(validated.validCount, 500, 'Expected all 500 records to be valid');

    const insertStmt = db.prepare(`
      INSERT INTO students (name, email, college, phone, branch, batch, status, import_batch_id, import_source, tags, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const commitTx = db.transaction(() => {
      for (const row of validated.rows) {
        const item = row.normalized;
        insertStmt.run(
          item.name,
          item.email,
          item.college,
          item.phone,
          item.branch,
          item.batch,
          'Active',
          testBatchId,
          'Bulk 500 Test File.xlsx',
          item.tags,
          'Bulk 500 test'
        );
      }
    });

    commitTx();

    const afterCount = db.prepare('SELECT COUNT(*) as c FROM students').get().c;
    assert.strictEqual(afterCount, beforeCount + 500, `Expected ${beforeCount + 500} students, got ${afterCount}`);
  });

  // 7. SMTP Password / App Password Persistence Test
  test('Settings: Successfully saves, updates, and persists SMTP Password / App Password in database', () => {
    const db = getDb();
    const testAppPassword = 'abcd efgh ijkl mnop';

    const updateStmt = db.prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES ('smtp_pass', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `);

    updateStmt.run(testAppPassword);

    const savedPass = db.prepare("SELECT value FROM settings WHERE key = 'smtp_pass'").get();
    assert.strictEqual(savedPass.value, testAppPassword, 'SMTP Password not saved or matched');
  });

  // 8. Single Bulk Upload Batch Selection & Targeting Test
  test('Upload Batches: Filter and select data of one bulk upload for blast', () => {
    const db = getDb();
    const ts = Date.now();
    const batchId = `batch_test_selection_${ts}`;
    const batchFilename = 'IIT_Bombay_Placement_Drive.xlsx';

    // Insert 5 students in this upload batch
    for (let i = 1; i <= 5; i++) {
      db.prepare(`
        INSERT INTO students (name, email, college, status, import_batch_id, import_source)
        VALUES (?, ?, 'IIT Bombay', 'Active', ?, ?)
      `).run(`Batch Candidate ${i}`, `batch.candidate.${ts}.${i}@iitb.ac.in`, batchId, batchFilename);
    }

    const batchStudents = db.prepare('SELECT * FROM students WHERE import_batch_id = ?').all(batchId);
    assert.strictEqual(batchStudents.length, 5, 'Expected 5 students in test bulk upload batch');
  });

  // 9. Delete All Data of One Bulk Upload Test
  test('Upload Batches: Select and delete all data of one bulk upload atomically', () => {
    const db = getDb();
    const ts = Date.now();
    const batchId = `batch_test_deletion_${ts}`;

    // Insert 10 students in this upload batch
    for (let i = 1; i <= 10; i++) {
      db.prepare(`
        INSERT INTO students (name, email, college, status, import_batch_id, import_source)
        VALUES (?, ?, 'COEP Tech', 'Active', ?, 'COEP_Batch_To_Delete.csv')
      `).run(`COEP Student ${i}`, `coep.delete.${ts}.${i}@coep.ac.in`, batchId);
    }

    const beforeDelete = db.prepare('SELECT COUNT(*) as c FROM students WHERE import_batch_id = ?').get(batchId).c;
    assert.strictEqual(beforeDelete, 10, 'Expected 10 students before delete');

    // Delete all data of this bulk upload
    const result = db.prepare('DELETE FROM students WHERE import_batch_id = ?').run(batchId);
    assert.strictEqual(result.changes, 10, 'Expected exactly 10 students to be deleted');

    const afterDelete = db.prepare('SELECT COUNT(*) as c FROM students WHERE import_batch_id = ?').get(batchId).c;
    assert.strictEqual(afterDelete, 0, 'Expected 0 students remaining in deleted bulk upload batch');
  });

  // 10. Multi-SMTP Accounts Pool & Round-Robin Rotation Test
  test('Multi-SMTP: Pool creates 5 sender accounts and alternates them in Round-Robin mode', () => {
    const db = getDb();
    const smtpPool = require('../services/smtpPool');

    // Clear existing test accounts and insert 5 accounts
    db.prepare('DELETE FROM smtp_accounts').run();

    const insertAccount = db.prepare(`
      INSERT INTO smtp_accounts (name, host, port, secure, user, pass, from_name, from_email, daily_limit, sent_today, is_active, priority)
      VALUES (?, 'smtp.gmail.com', 587, 0, ?, 'app-pass-1234', 'Aparaitech Recruitment', ?, 500, 0, 1, ?)
    `);

    for (let i = 1; i <= 5; i++) {
      insertAccount.run(`HR Sender Account #${i}`, `hr${i}@aparaitech.org`, `hr${i}@aparaitech.org`, i);
    }

    const accounts = smtpPool.getAvailableAccounts();
    assert.strictEqual(accounts.length, 5, 'Expected 5 active SMTP accounts in pool');

    // Test round robin order: 1 -> 2 -> 3 -> 4 -> 5 -> 1
    const first = smtpPool.getNextAccount('round_robin');
    const second = smtpPool.getNextAccount('round_robin');
    const third = smtpPool.getNextAccount('round_robin');

    assert.notStrictEqual(first.id, second.id, 'Expected different accounts in round robin');
    assert.notStrictEqual(second.id, third.id, 'Expected different accounts in round robin');
  });

  // 11. Multi-SMTP Auto-Failover & Limit Switching Test
  test('Multi-SMTP: Auto-switches to next sender when daily limit is reached or quota exceeded', () => {
    const db = getDb();
    const smtpPool = require('../services/smtpPool');

    // Find first account and simulate daily limit reached
    const accounts = db.prepare('SELECT * FROM smtp_accounts ORDER BY id ASC').all();
    assert(accounts.length >= 2, 'Need at least 2 accounts for failover test');

    const acc1 = accounts[0];
    const acc2 = accounts[1];

    // Set acc1 as exhausted (sent_today = 500 / daily_limit = 500)
    db.prepare("UPDATE smtp_accounts SET sent_today = 500, daily_limit = 500, last_sent_date = ? WHERE id = ?").run(smtpPool.getTodayString(), acc1.id);

    // Get next account in auto_failover mode - should skip acc1 and pick acc2
    const nextAcc = smtpPool.getNextAccount('auto_failover');
    assert.strictEqual(nextAcc.id, acc2.id, `Expected next available account (${acc2.user}), got ${nextAcc.user}`);

    // Restore default SMTP accounts
    db.prepare('DELETE FROM smtp_accounts').run();
    const { migrateExistingSmtpToAccounts } = require('../database/db');
    migrateExistingSmtpToAccounts(db);
  });

  // 12. MongoDB Atlas Module & URI Validator Test
  test('MongoDB Atlas: Driver initializes and properly handles URI connection validation', async () => {
    const { testMongoConnection } = require('../database/mongo');

    // Test empty URI validation
    const emptyResult = await testMongoConnection('');
    assert.strictEqual(emptyResult.success, false, 'Expected false for empty URI');

    // Test invalid URI format validation
    const invalidResult = await testMongoConnection('invalid-protocol://fake-host:1234');
    assert.strictEqual(invalidResult.success, false, 'Expected false for invalid protocol URI');
  });

  // 13. Dynamic Application / Apply Now Link Substitution Test
  test('Template Engine: Renders custom dynamic {ApplyLink} and {Application_Link} correctly in hyperlinks', () => {
    const { renderText } = require('../services/templateEngine');
    const student = {
      name: 'Aditi Deshmukh',
      college: 'VPKBIET Baramati',
      batch: '2026'
    };

    const customUrl = 'https://careers.aparaitech.org/apply?drive=2026-pune-campus';
    const htmlTemplate = '<p>Hi {Name},</p><a href="{ApplyLink}">Apply Now</a><p>Or visit {Application_Link}</p>';

    const rendered = renderText(htmlTemplate, student, { apply_link: customUrl });
    assert(rendered.includes(`href="${customUrl}"`), 'Expected rendered HTML to include custom dynamic ApplyLink href');
    assert(rendered.includes(`visit ${customUrl}`), 'Expected rendered HTML to include custom dynamic Application_Link');
    assert(rendered.includes('Hi Aditi Deshmukh'), 'Expected name personalization');
  });

  // 14. Campaigns DB Schema: apply_link column exists
  test('Database Schema: campaigns table has apply_link column for persistent custom URLs', () => {
    const db = getDb();
    const cols = db.prepare("PRAGMA table_info(campaigns)").all().map(c => c.name);
    assert(cols.includes('apply_link'), 'Expected campaigns table to include apply_link column');
  });

  // 15. Templates Management: Create, Update, Delete operations
  test('Templates Manager: Successfully creates, updates, and deletes email templates', () => {
    const db = getDb();
    const initialCount = db.prepare('SELECT count(*) as count FROM templates').get().count;

    // 1. Create template
    const ins = db.prepare(`
      INSERT INTO templates (name, category, subject, body_html, tags_used)
      VALUES (?, ?, ?, ?, ?)
    `).run('Test Special Drive Template', 'Placement Drive', 'Drive for {Name}', '<p>Hello {Name}</p>', '["{Name}"]');

    const createdId = ins.lastInsertRowid;
    assert(createdId > 0, 'Expected valid template ID on insert');

    const created = db.prepare('SELECT * FROM templates WHERE id = ?').get(createdId);
    assert.strictEqual(created.name, 'Test Special Drive Template');

    // 2. Update template
    db.prepare(`
      UPDATE templates SET name = ?, subject = ?, updated_at = datetime('now') WHERE id = ?
    `).run('Updated Drive Template', 'Updated Subject {Name}', createdId);

    const updated = db.prepare('SELECT * FROM templates WHERE id = ?').get(createdId);
    assert.strictEqual(updated.name, 'Updated Drive Template');
    assert.strictEqual(updated.subject, 'Updated Subject {Name}');

    // 3. Delete template
    const del = db.prepare('DELETE FROM templates WHERE id = ?').run(createdId);
    assert.strictEqual(del.changes, 1, 'Expected 1 template row deleted');

    const finalCount = db.prepare('SELECT count(*) as count FROM templates').get().count;
    assert.strictEqual(finalCount, initialCount, 'Expected template count to return to original');
  });

  // 16. Upload Commit & Batch Import SQLite Parity Test
  test('Bulk Upload: Successfully parses and commits valid spreadsheet rows into database', () => {
    const db = getDb();
    const { validateAndNormalizeRows } = require('../services/excelParser');
    
    const sampleRows = [
      { 'Student Full Name': 'Amit Verma', 'Email': 'amit.verma@testcollege.edu', 'Institute': 'Test College of Engineering', 'Year': '2026' },
      { 'Student Full Name': 'Sneha Rao', 'Email': 'sneha.rao@testcollege.edu', 'Institute': 'Test College of Engineering', 'Year': '2026' }
    ];
    const mapping = { name: 'Student Full Name', email: 'Email', college: 'Institute', batch: 'Year' };
    const validated = validateAndNormalizeRows(sampleRows, mapping);
    assert.strictEqual(validated.validCount, 2, 'Expected 2 valid normalized rows');

    const testBatchId = `test_batch_${Date.now()}`;
    const insertStmt = db.prepare(`
      INSERT INTO students (name, email, college, batch, status, import_batch_id, import_source)
      VALUES (?, ?, ?, ?, 'Active', ?, 'Test Import')
    `);

    for (const r of validated.rows) {
      insertStmt.run(r.normalized.name, r.normalized.email, r.normalized.college, r.normalized.batch, testBatchId);
    }

    const inserted = db.prepare('SELECT * FROM students WHERE import_batch_id = ?').all(testBatchId);
    assert.strictEqual(inserted.length, 2, 'Expected 2 students inserted in batch');

    // Clean up test batch
    db.prepare('DELETE FROM students WHERE import_batch_id = ?').run(testBatchId);
  });

  // 17. Campaign Test-Send & Personalized Variable Substitution Test
  test('Campaigns: Test-send endpoint handles variable rendering without throwing errors', () => {
    const { renderText } = require('../services/templateEngine');
    const student = { name: 'Pooja Patel', email: 'pooja.patel@vjti.ac.in', college: 'VJTI Mumbai', branch: 'IT', batch: '2026' };
    const template = 'Dear {Name} from {College}, apply at {ApplyLink}';
    const rendered = renderText(template, student, { apply_link: 'https://aparaitech.org/apply?drive=2026' });

    assert(rendered.includes('Dear Pooja Patel from VJTI Mumbai'), 'Expected name and college to be rendered');
    assert(rendered.includes('https://aparaitech.org/apply?drive=2026'), 'Expected dynamic ApplyLink to be rendered');
  });

  // 18. Authentication Service (PBKDF2 Password Hashing & Salt)
  test('Auth Service: Hashes passwords with salt and validates credentials correctly', () => {
    const authService = require('../services/authService');
    const { hash, salt } = authService.hashPassword('secretPass123');
    assert(hash && hash.length === 128, 'Expected 128-char hex hash from SHA-512');
    assert(salt && salt.length === 32, 'Expected 32-char hex salt');

    assert(authService.verifyPassword('secretPass123', hash, salt), 'Expected valid password to verify');
    assert(!authService.verifyPassword('wrongPassword', hash, salt), 'Expected invalid password to fail verification');
  });

  // 19. Authentication Sessions & Login Flow
  test('Auth Service: Creates session tokens, validates active session, and logs out', () => {
    const authService = require('../services/authService');
    const db = getDb();
    const admin = db.prepare('SELECT id FROM admin_users WHERE email = ?').get('admin@aparaitech.org');
    assert(admin, 'Expected seeded admin user to exist in database');

    const session = authService.createSession(db, admin.id, 1);
    assert(session.token && session.token.length === 64, 'Expected 64-char session token');

    const validated = authService.validateSession(db, session.token);
    assert(validated, 'Expected session to be valid');
    assert.strictEqual(validated.email, 'admin@aparaitech.org');

    authService.deleteSession(db, session.token);
    const postLogout = authService.validateSession(db, session.token);
    assert.strictEqual(postLogout, null, 'Expected session to be invalidated after logout');
  });

  // 20. Subscription & Server Allocation ("How Much Server You Gave")
  test('Subscription Service: Tracks active subscription and server allocation correctly', () => {
    const subscriptionService = require('../services/subscriptionService');
    const db = getDb();
    const sub = subscriptionService.getActiveSubscription(db);

    assert(sub, 'Expected active subscription object');
    assert(sub.serverAllocation, 'Expected server allocation stats');
    assert(sub.serverAllocation.max_servers_given >= 1, 'Expected at least 1 server given');
    assert(typeof sub.serverAllocation.active_servers === 'number', 'Expected numeric active server count');
    assert(sub.emailQuota.max_monthly >= 1000, 'Expected monthly email quota');
  });

  // 21. Subscription Server Quota Guard
  test('Subscription Service: Enforces server quota limit when adding active servers', () => {
    const subscriptionService = require('../services/subscriptionService');
    const db = getDb();

    // Temporarily set max_servers to 1 to test quota guard
    const originalSub = subscriptionService.getActiveSubscription(db);
    db.prepare('UPDATE subscriptions SET max_servers = 1 WHERE id = ?').run(originalSub.id);

    const check = subscriptionService.canAddServer(db);
    // Since we have 8 active accounts and limit is 1, it should NOT be allowed
    assert.strictEqual(check.allowed, false, 'Expected server addition to be rejected when quota exceeded');
    assert(check.message.includes('Server Quota Exceeded'), 'Expected quota error message');

    // Restore original limit
    db.prepare('UPDATE subscriptions SET max_servers = ? WHERE id = ?').run(originalSub.serverAllocation.max_servers_given, originalSub.id);
  });

  // 22. Admin Manual Limit Override (Directly configure "How much servers gave")
  test('Subscription Service: Allows Admin to override servers given and monthly limits', () => {
    const subscriptionService = require('../services/subscriptionService');
    const db = getDb();

    const updated = subscriptionService.updateSubscriptionLimits(db, {
      max_servers: 15,
      max_emails_per_month: 250000
    });

    assert.strictEqual(updated.serverAllocation.max_servers_given, 15, 'Expected servers given to be updated to 15');
    assert.strictEqual(updated.emailQuota.max_monthly, 250000, 'Expected monthly quota to be updated to 250000');

    // Restore to 10 servers
    subscriptionService.updateSubscriptionLimits(db, {
      max_servers: 10,
      max_emails_per_month: 200000
    });
  });

  // 23. Customer Registration with 7-Day Free Trial & 1-Server Limit
  test('Customer Auth & Trial: Registers customer with 7-day trial and 1-server quota', () => {
    const authService = require('../services/authService');
    const subscriptionService = require('../services/subscriptionService');
    const db = getDb();

    const testEmail = `test_customer_${Date.now()}@campus.edu`;
    const regResult = authService.registerCustomer(db, {
      email: testEmail,
      password: 'password123',
      fullName: 'Campus Hiring Lead',
      company: 'Campus Hire Inc',
      phone: '+91 9876543210'
    });

    assert(regResult.user, 'Expected registered user object');
    assert.strictEqual(regResult.user.role, 'customer', 'Expected customer role');
    assert.strictEqual(regResult.user.company, 'Campus Hire Inc');
    assert(regResult.token, 'Expected session auth token');

    const sub = subscriptionService.getActiveSubscription(db, regResult.user.id);
    assert.strictEqual(sub.status, 'trial', 'Expected trial status');
    assert.strictEqual(sub.plan_id, 'trial', 'Expected trial plan_id');
    assert.strictEqual(sub.serverAllocation.max_servers_given, 1, 'Expected trial to enforce exactly 1 server');
    assert.strictEqual(sub.trial_days_remaining, 7, 'Expected 7 days remaining on trial start');
    assert.strictEqual(sub.is_trial_expired, false, 'Expected trial not to be expired');

    // Verify customer quota allows 1 server and rejects 2nd server
    const checkFirst = subscriptionService.canAddServer(db, regResult.user.id);
    assert.strictEqual(checkFirst.allowed, true, 'Expected customer with 0 servers to be allowed to add 1 server');

    // Add 1 SMTP account for this customer
    const insertAcc = db.prepare(`
      INSERT INTO smtp_accounts (name, host, port, user, pass, from_email, is_active, user_id)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?)
    `).run('Customer Primary SMTP', 'smtp.gmail.com', 587, 'c1@campus.edu', 'pass', 'c1@campus.edu', regResult.user.id);

    // Now adding 2nd server should be rejected by 1-server quota
    const checkSecond = subscriptionService.canAddServer(db, regResult.user.id);
    assert.strictEqual(checkSecond.allowed, false, 'Expected 2nd server to be rejected under 1-server trial quota');
    assert(checkSecond.message.includes('Server Quota Exceeded') || checkSecond.message.includes('1'), 'Expected quota error message');

    // Clean up test account and temporary test customer
    db.prepare('DELETE FROM smtp_accounts WHERE id = ?').run(insertAcc.lastInsertRowid);
    const admin = db.prepare("SELECT id FROM admin_users WHERE role = 'superadmin' LIMIT 1").get();
    authService.deleteUser(db, regResult.user.id, admin.id);
  });

  // 24. Trial Expiration Logic
  test('Subscription Service: Detects expired 7-day trial correctly', () => {
    const subscriptionService = require('../services/subscriptionService');
    const db = getDb();

    // Create a temporary expired trial subscription
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const customer = db.prepare("SELECT id FROM admin_users WHERE role = 'customer' LIMIT 1").get();
    assert(customer, 'Expected seeded customer user');

    db.prepare('UPDATE subscriptions SET trial_ends_at = ?, status = ? WHERE user_id = ?').run(pastDate, 'trial', customer.id);

    const expiredSub = subscriptionService.getActiveSubscription(db, customer.id);
    assert.strictEqual(expiredSub.is_trial_expired, true, 'Expected is_trial_expired to be true');
    assert.strictEqual(expiredSub.trial_days_remaining, 0, 'Expected 0 days remaining for expired trial');

    // Restore to future trial
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE subscriptions SET trial_ends_at = ?, status = ? WHERE user_id = ?').run(futureDate, 'trial', customer.id);
  });

  // 25. Admin Trial Extension
  test('Subscription Service: Admin can extend customer trial period', () => {
    const subscriptionService = require('../services/subscriptionService');
    const db = getDb();

    const customer = db.prepare("SELECT id FROM admin_users WHERE role = 'customer' LIMIT 1").get();
    assert(customer, 'Expected seeded customer user');

    const extended = subscriptionService.extendTrial(db, customer.id, 14);
    assert.strictEqual(extended.status, 'trial');
    assert(extended.trial_days_remaining >= 13, `Expected at least 13 days remaining after 14-day extension, got ${extended.trial_days_remaining}`);
  });

  // 26. Plan Upgrade & Direct Server Quota Modification ("How much server you gave")
  test('Subscription Service: Customer can upgrade to Pro (5 servers) and Admin can override quota', () => {
    const subscriptionService = require('../services/subscriptionService');
    const db = getDb();

    const customer = db.prepare("SELECT id FROM admin_users WHERE role = 'customer' LIMIT 1").get();
    assert(customer, 'Expected seeded customer user');

    // Upgrade customer to Pro Growth
    const upgraded = subscriptionService.upgradePlan(db, 'growth', customer.id);
    assert.strictEqual(upgraded.status, 'active');
    assert.strictEqual(upgraded.plan_id, 'growth');
    assert.strictEqual(upgraded.serverAllocation.max_servers_given, 5, 'Expected 5 servers for Growth plan');

    // Admin manually customizes customer server quota to 8 servers ("How much server you gave")
    const customQuota = subscriptionService.updateSubscriptionLimits(db, {
      max_servers: 8,
      max_emails_per_month: 75000
    }, customer.id);

    assert.strictEqual(customQuota.serverAllocation.max_servers_given, 8, 'Expected admin to give 8 servers');
    assert.strictEqual(customQuota.emailQuota.max_monthly, 75000, 'Expected admin to configure 75,000 monthly quota');

    // Reset customer back to 7-day trial for clean test state
    const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(`
      UPDATE subscriptions 
      SET plan_id = 'trial', status = 'trial', max_servers = 1, max_emails_per_month = 3500, trial_ends_at = ?
      WHERE user_id = ?
    `).run(sevenDaysLater, customer.id);
  });

  // 27. UPI Payment Proof Submission (Pending State)
  test('Subscription Service: Customer submits UPI payment with screenshot and UTR in pending state', () => {
    const subscriptionService = require('../services/subscriptionService');
    const db = getDb();

    const customer = db.prepare("SELECT id FROM admin_users WHERE role = 'customer' LIMIT 1").get();
    assert(customer, 'Expected customer user');

    // Customer submits proof for Pro Growth (₹3,499)
    const payment = subscriptionService.recordUpiPayment(db, {
      userId: customer.id,
      planId: 'growth',
      amount: 3499,
      utrNumber: '987654321098',
      screenshotUrl: '/uploads/payments/test_receipt.png'
    });

    assert.strictEqual(payment.status, 'pending', 'Payment must be in pending status waiting for admin');
    assert(payment.paymentId > 0, 'Payment ID must be generated');

    // Customer subscription should STILL be on trial until admin approves
    const sub = subscriptionService.getActiveSubscription(db, customer.id);
    assert.strictEqual(sub.status, 'trial', 'Subscription must not activate before admin approval');
    assert(sub.pendingPayment, 'Expected pendingPayment object in subscription');
    assert.strictEqual(sub.pendingPayment.utr_number, '987654321098');
    assert.strictEqual(sub.pendingPayment.screenshot_url, '/uploads/payments/test_receipt.png');
  });

  // 28. Admin Payment Approval & Access Release
  test('Subscription Service: Admin approves pending UPI payment and unlocks 5 dedicated servers', () => {
    const subscriptionService = require('../services/subscriptionService');
    const db = getDb();

    const pendingList = subscriptionService.getPendingPayments(db);
    assert(pendingList.length > 0, 'Expected at least 1 pending payment submission');
    const targetPayment = pendingList[0];

    const admin = db.prepare("SELECT id FROM admin_users WHERE role = 'superadmin' LIMIT 1").get();

    // Admin approves payment
    const approved = subscriptionService.approvePayment(db, targetPayment.id, admin.id);
    assert.strictEqual(approved.status, 'approved');
    assert.strictEqual(approved.subscription.status, 'active', 'Customer subscription must now be active');
    assert.strictEqual(approved.subscription.plan_id, 'growth');
    assert.strictEqual(approved.subscription.serverAllocation.max_servers_given, 5, 'Must have unlocked 5 servers');

    // Verify payment record in DB
    const dbPayment = db.prepare('SELECT * FROM subscription_payments WHERE id = ?').get(targetPayment.id);
    assert.strictEqual(dbPayment.status, 'approved');
    assert(dbPayment.reviewed_at, 'Reviewed timestamp must be recorded');

    // Clean up test payment record so it doesn't pollute payment history
    db.prepare('DELETE FROM subscription_payments WHERE id = ?').run(targetPayment.id);
  });

  // 29. Admin Plan Pricing & Quotas Editor
  test('Subscription Service: Admin can edit subscription plan price (INR ₹) and server quotas', () => {
    const subscriptionService = require('../services/subscriptionService');
    const db = getDb();

    // Admin updates Starter plan price from ₹1,499 to ₹1,799 and servers to 3
    const updated = subscriptionService.updatePlanDetails(db, 'starter', {
      price: 1799,
      max_servers: 3,
      name: 'Starter Pro Hiring Tier'
    });

    assert.strictEqual(updated.price, 1799, 'Expected price updated to ₹1,799');
    assert.strictEqual(updated.max_servers, 3, 'Expected max servers updated to 3');
    assert.strictEqual(updated.name, 'Starter Pro Hiring Tier');

    // Verify all plans endpoint reflects this update
    const allPlans = subscriptionService.getAllPlans(db);
    const starter = allPlans.find(p => p.id === 'starter');
    assert.strictEqual(starter.price, 1799);
    assert.strictEqual(starter.max_servers, 3);

    // Reset back to ₹1,499 & 2 servers
    subscriptionService.updatePlanDetails(db, 'starter', {
      price: 1499,
      max_servers: 2,
      name: 'Starter Recruiter Tier'
    });
  });

  // 30. Admin User Deletion (Cascading cleanup)
  test('Auth Service: Admin can delete a user account with cascading data cleanup', () => {
    const authService = require('../services/authService');
    const db = getDb();

    // Create a temporary customer to test deletion
    const tempUser = authService.registerCustomer(db, {
      fullName: 'Temporary Delete Candidate',
      email: `temp_delete_${Date.now()}@example.com`,
      password: 'Password123!',
      company: 'Temp Org',
      phone: '9998887777'
    });

    // Add a candidate student for this temp user
    db.prepare(`
      INSERT INTO students (name, email, college, phone, branch, batch, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('Student Temp', `stud_${Date.now()}@temp.org`, 'Temp College', '1234567890', 'CS', '2026', tempUser.user.id);

    // Verify student exists for user
    const studentCountBefore = db.prepare('SELECT count(*) as count FROM students WHERE user_id = ?').get(tempUser.user.id).count;
    assert.strictEqual(studentCountBefore, 1);

    // SuperAdmin deletes the temp user
    const admin = db.prepare("SELECT id FROM admin_users WHERE role = 'superadmin' LIMIT 1").get();
    const result = authService.deleteUser(db, tempUser.user.id, admin.id);
    assert.strictEqual(result.success, true);

    // Verify user is gone
    const checkUser = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(tempUser.user.id);
    assert.strictEqual(checkUser, undefined, 'User record must be deleted');

    // Verify user student is gone (cascading cleanup)
    const studentCountAfter = db.prepare('SELECT count(*) as count FROM students WHERE user_id = ?').get(tempUser.user.id).count;
    assert.strictEqual(studentCountAfter, 0, 'Associated students must be deleted');

    // Verify subscriptions and sessions are gone
    const subCount = db.prepare('SELECT count(*) as count FROM subscriptions WHERE user_id = ?').get(tempUser.user.id).count;
    assert.strictEqual(subCount, 0, 'Associated subscriptions must be deleted');
  });

  console.log('\n====================================================');
  console.log(`📊 Test Results: ${passedTests} / ${totalTests} Passed (${Math.round((passedTests / totalTests) * 100)}%)`);
  console.log('====================================================');

  if (passedTests === totalTests) {
    console.log('🎉 ALL TESTS PASSED SUCCESSFULLY!');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

if (require.main === module) {
  runTestSuite().catch(err => {
    console.error('Test Suite Failed:', err);
    process.exit(1);
  });
}

module.exports = { runTestSuite };
