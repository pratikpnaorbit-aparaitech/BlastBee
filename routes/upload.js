const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { getDb } = require('../database/db');
const { getPersistentMongoDb } = require('../database/mongo');
const { parseFileBuffer, validateAndNormalizeRows, generateSampleData } = require('../services/excelParser');

// Memory storage for fast buffer processing (up to 50MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// POST /api/upload/parse - Parse uploaded file and return column mapping + validation preview
router.post('/parse', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, message: 'Spreadsheet file exceeds 50MB size limit.' });
      }
      return res.status(400).json({ success: false, message: err.message || 'File upload failed.' });
    }

    try {
      if (!req.file) {
        return res.status(400).json({ success: false, message: 'No spreadsheet file uploaded. Please select a valid .csv, .xlsx, or .xls file.' });
      }

      const { headers, detectedMapping, rawRows } = parseFileBuffer(req.file.buffer);

      // Initial validation using detected mapping
      const validationResult = validateAndNormalizeRows(rawRows, detectedMapping);

      res.json({
        success: true,
        filename: req.file.originalname,
        headers,
        detectedMapping,
        totalRows: validationResult.totalRows,
        validCount: validationResult.validCount,
        invalidCount: validationResult.invalidCount,
        previewRows: validationResult.rows.slice(0, 100), // First 100 for interactive preview
        allRows: rawRows // Returned for client-side mapping adjustment if needed
      });
    } catch (error) {
      console.error('Upload parse error:', error);
      res.status(400).json({ success: false, message: error.message });
    }
  });
});

// POST /api/upload/revalidate - Re-validate rows with updated user column mapping
router.post('/revalidate', (req, res) => {
  try {
    const { rawRows, mapping } = req.body;
    if (!rawRows || !mapping) {
      return res.status(400).json({ success: false, message: 'rawRows and mapping are required' });
    }

    const validationResult = validateAndNormalizeRows(rawRows, mapping);

    res.json({
      success: true,
      totalRows: validationResult.totalRows,
      validCount: validationResult.validCount,
      invalidCount: validationResult.invalidCount,
      previewRows: validationResult.rows.slice(0, 100)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/upload/commit - Commit validated rows to the database
router.post('/commit', async (req, res) => {
  try {
    const db = getDb();
    const { rawRows, mapping, duplicateStrategy = 'skip', filename = 'Spreadsheet Upload', importBatchId } = req.body;

    if (!rawRows || !mapping) {
      return res.status(400).json({ success: false, message: 'Data rows and column mapping are required.' });
    }

    const validationResult = validateAndNormalizeRows(rawRows, mapping);
    const validRows = validationResult.rows.filter(r => r.isValid);

    if (validRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid candidate rows found to import. Please ensure Name and Email columns are mapped properly.'
      });
    }

    const currentBatchId = importBatchId || `batch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const currentImportSource = filename || 'Spreadsheet Upload';

    const { getOptionalAuth } = require('./auth');
    const user = getOptionalAuth(req);
    const userId = user ? user.id : null;

    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    const findExisting = userId
      ? db.prepare('SELECT id, name, college, phone, branch, batch FROM students WHERE email = ? AND user_id = ?')
      : db.prepare('SELECT id, name, college, phone, branch, batch FROM students WHERE email = ? AND user_id IS NULL');

    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO students (name, email, college, phone, branch, batch, status, import_batch_id, import_source, tags, notes, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const updateStmt = db.prepare(`
      UPDATE students 
      SET name = ?, college = ?, phone = ?, branch = ?, batch = ?, import_batch_id = ?, import_source = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    const seenEmailsInBatch = new Set();

    const commitTx = db.transaction(() => {
      for (const row of validRows) {
        const item = row.normalized;
        const cleanEmail = (item.email || '').trim().toLowerCase();
        if (!cleanEmail) continue;

        // Check if seen earlier in this spreadsheet file
        if (seenEmailsInBatch.has(cleanEmail)) {
          if (duplicateStrategy === 'skip') {
            skippedCount++;
            continue;
          }
        }
        seenEmailsInBatch.add(cleanEmail);

        const existing = userId ? findExisting.get(cleanEmail, userId) : findExisting.get(cleanEmail);

        if (existing) {
          if (duplicateStrategy === 'skip') {
            skippedCount++;
          } else if (duplicateStrategy === 'update' || duplicateStrategy === 'overwrite') {
            updateStmt.run(
              item.name || existing.name,
              item.college || existing.college,
              item.phone || existing.phone,
              item.branch || existing.branch,
              item.batch || existing.batch,
              currentBatchId,
              currentImportSource,
              existing.id
            );
            updatedCount++;
          }
        } else {
          const info = insertStmt.run(
            item.name,
            cleanEmail,
            item.college || 'General Pool',
            item.phone || '',
            item.branch || 'Computer Science',
            item.batch || '2026',
            'Active',
            currentBatchId,
            currentImportSource,
            item.tags || '[]',
            `Bulk imported from ${currentImportSource}`,
            userId
          );

          if (info.changes > 0) {
            insertedCount++;
          } else {
            // Already present in database
            if (duplicateStrategy === 'update' || duplicateStrategy === 'overwrite') {
              const matched = userId ? findExisting.get(cleanEmail, userId) : findExisting.get(cleanEmail);
              if (matched) {
                updateStmt.run(
                  item.name || matched.name,
                  item.college || matched.college,
                  item.phone || matched.phone,
                  item.branch || matched.branch,
                  item.batch || matched.batch,
                  currentBatchId,
                  currentImportSource,
                  matched.id
                );
                updatedCount++;
              } else {
                skippedCount++;
              }
            } else {
              skippedCount++;
            }
          }
        }
      }
    });

    commitTx();

    // Mirror to MongoDB Atlas if connected
    if (process.env.MONGODB_URI) {
      try {
        const mongo = await getPersistentMongoDb();
        const now = new Date().toISOString();
        const emails = validRows.map(r => (r.normalized.email || '').trim().toLowerCase()).filter(Boolean);
        const mongoFilter = userId ? { email: { $in: emails }, user_id: userId } : { email: { $in: emails } };
        const existingList = await mongo.collection('students').find(mongoFilter).toArray();
        const existingMap = new Map(existingList.map(e => [e.email, e]));
        const operations = [];

        for (const row of validRows) {
          const item = row.normalized;
          const existing = existingMap.get(item.email);
          if (existing && duplicateStrategy === 'skip') {
            continue;
          }
          const document = {
            name: item.name || existing?.name || '',
            email: item.email,
            college: item.college || existing?.college || 'General Pool',
            phone: item.phone || existing?.phone || '',
            branch: item.branch || existing?.branch || 'Computer Science',
            batch: item.batch || existing?.batch || '2026',
            status: existing?.status || 'Active',
            import_batch_id: currentBatchId,
            import_source: currentImportSource,
            tags: item.tags || existing?.tags || '[]',
            notes: `Bulk imported from ${currentImportSource}`,
            user_id: userId || null,
            updated_at: now
          };
          if (existing) {
            operations.push({ updateOne: { filter: { _id: existing._id }, update: { $set: document } } });
          } else {
            operations.push({ insertOne: { document: { ...document, created_at: now } } });
          }
        }
        if (operations.length) await mongo.collection('students').bulkWrite(operations, { ordered: false });
      } catch (mongoErr) {
        console.warn('MongoDB Atlas mirror warning on upload:', mongoErr.message);
      }
    }

    res.json({
      success: true,
      message: `Bulk import completed successfully! Saved ${insertedCount + updatedCount} students to database. (Added: ${insertedCount} new, Updated: ${updatedCount}, Skipped: ${skippedCount})`,
      batchId: currentBatchId,
      importSource: currentImportSource,
      summary: {
        totalAttempted: validRows.length,
        totalSaved: insertedCount + updatedCount,
        inserted: insertedCount,
        updated: updatedCount,
        skipped: skippedCount,
        invalidDiscarded: validationResult.invalidCount
      }
    });
  } catch (error) {
    console.error('Commit error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/upload/sample-csv - Download ready-to-use CSV template
router.get('/sample-csv', (req, res) => {
  try {
    const data = generateSampleData();
    const worksheet = xlsx.utils.json_to_sheet(data);
    const csv = xlsx.utils.sheet_to_csv(worksheet);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="aparaitech_students_template.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/upload/sample-excel - Download ready-to-use Excel (.xlsx) template
router.get('/sample-excel', (req, res) => {
  try {
    const data = generateSampleData();
    const worksheet = xlsx.utils.json_to_sheet(data);
    const workbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Students_Template');

    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="aparaitech_students_template.xlsx"');
    res.send(buffer);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
