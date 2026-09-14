const express = require('express');
const { ObjectId } = require('mongodb');
const xlsx = require('xlsx');
const { getPersistentMongoDb } = require('../database/mongo');
const { getDb } = require('../database/db');

const router = express.Router();

function serialize(student) {
  if (!student) return student;
  const { _id, ...rest } = student;
  return { id: String(_id), ...rest };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function idFilter(id) {
  if (!id) return null;
  const strId = String(id).trim();
  if (ObjectId.isValid(strId)) {
    return { $or: [{ _id: new ObjectId(strId) }, { sqlite_id: Number(strId) || -1 }] };
  }
  const numId = Number(strId);
  if (!isNaN(numId)) {
    return { sqlite_id: numId };
  }
  return null;
}

function studentFilter(query) {
  const filter = {};
  const { search = '', college = '', batch = '', branch = '', status = '', import_batch_id = '' } = query;
  if (search && search.trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { college: regex }, { phone: regex }];
  }
  if (college && college.trim()) filter.college = college.trim();
  if (batch && batch.trim()) filter.batch = batch.trim();
  if (branch && branch.trim()) filter.branch = branch.trim();
  if (status && status.trim()) filter.status = status.trim();
  if (import_batch_id && import_batch_id.trim()) filter.import_batch_id = import_batch_id.trim();

  return filter;
}

// GET /api/students - List students with search, filters, and pagination
router.get('/', async (req, res, next) => {
  try {
    const db = await getPersistentMongoDb();
    const filter = studentFilter(req.query);
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const allowed = ['name', 'email', 'college', 'branch', 'batch', 'status', 'created_at', 'updated_at'];
    const sortBy = allowed.includes(req.query.sortBy) ? req.query.sortBy : 'created_at';
    const sortOrder = String(req.query.sortOrder).toUpperCase() === 'ASC' ? 1 : -1;

    const students = await db.collection('students')
      .find(filter)
      .sort({ [sortBy]: sortOrder, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .toArray();

    const [total, colleges, batches, branches, uploadBatches] = await Promise.all([
      db.collection('students').countDocuments(filter),
      db.collection('students').aggregate([
        { $match: { college: { $nin: [null, ''] } } },
        { $group: { _id: '$college', count: { $sum: 1 } } },
        { $project: { _id: 0, college: '$_id', count: 1 } },
        { $sort: { count: -1 } }
      ]).toArray(),
      db.collection('students').distinct('batch', { batch: { $nin: [null, ''] } }),
      db.collection('students').distinct('branch', { branch: { $nin: [null, ''] } }),
      db.collection('students').aggregate([
        { $match: { import_batch_id: { $nin: [null, ''] } } },
        { $group: {
            _id: '$import_batch_id',
            import_source: { $first: '$import_source' },
            student_count: { $sum: 1 },
            created_at: { $min: '$created_at' }
          }
        },
        { $project: {
            _id: 0,
            import_batch_id: '$_id',
            import_source: { $ifNull: ['$import_source', 'Uploaded Spreadsheet'] },
            student_count: 1,
            created_at: 1
          }
        },
        { $sort: { created_at: -1 } }
      ]).toArray()
    ]);

    res.json({
      success: true,
      students: students.map(serialize),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      },
      filterOptions: {
        colleges,
        batches: batches.filter(Boolean).sort().reverse(),
        branches: branches.filter(Boolean).sort(),
        uploadBatches
      }
    });
  } catch (error) {
    console.warn('MongoDB students query fallback to SQLite:', error.message);
    return require('./students')(req, res, next);
  }
});

// GET /api/students/batches - Get all distinct bulk upload batches with counts
router.get('/batches', async (req, res, next) => {
  try {
    const db = await getPersistentMongoDb();
    const batches = await db.collection('students').aggregate([
      { $match: { import_batch_id: { $nin: [null, ''] } } },
      { $group: {
          _id: '$import_batch_id',
          import_source: { $first: '$import_source' },
          student_count: { $sum: 1 },
          created_at: { $min: '$created_at' }
        }
      },
      { $project: {
          _id: 0,
          import_batch_id: '$_id',
          import_source: { $ifNull: ['$import_source', 'Uploaded Spreadsheet'] },
          student_count: 1,
          created_at: 1
        }
      },
      { $sort: { created_at: -1 } }
    ]).toArray();
    res.json({ success: true, batches });
  } catch (error) {
    console.warn('MongoDB batches query fallback to SQLite:', error.message);
    return require('./students')(req, res, next);
  }
});

// GET /api/students/colleges - Unique colleges list with student counts
router.get('/colleges', async (req, res, next) => {
  try {
    const db = await getPersistentMongoDb();
    const colleges = await db.collection('students').aggregate([
      { $group: { _id: '$college', student_count: { $sum: 1 } } },
      { $project: { _id: 0, college: '$_id', student_count: 1 } },
      { $sort: { student_count: -1 } }
    ]).toArray();
    res.json({ success: true, colleges });
  } catch (error) {
    console.warn('MongoDB colleges query fallback to SQLite:', error.message);
    return require('./students')(req, res, next);
  }
});

// GET /api/students/export - Export students to CSV/Excel
router.get('/export', async (req, res, next) => {
  try {
    const db = await getPersistentMongoDb();
    const filter = studentFilter(req.query);
    if (req.query.ids) {
      const idList = req.query.ids.split(',').map(s => s.trim()).filter(Boolean);
      const objIds = idList.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
      const numIds = idList.map(Number).filter(n => !isNaN(n));
      filter.$or = [
        ...(objIds.length ? [{ _id: { $in: objIds } }] : []),
        ...(numIds.length ? [{ sqlite_id: { $in: numIds } }] : [])
      ];
    }
    const students = (await db.collection('students').find(filter).toArray()).map(serialize);
    const full = req.query.fields !== 'name_email';
    const rows = students.map(s => full ? ({
      'Student Name': s.name,
      'Email Address': s.email,
      'College / University': s.college,
      'Phone Number': s.phone || '',
      'Branch / Degree': s.branch,
      'Graduation Year': s.batch,
      'Status': s.status,
      'Registered Date': s.created_at
    }) : ({
      'Name': s.name,
      'Email': s.email
    }));

    const sheet = xlsx.utils.json_to_sheet(rows);
    const book = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(book, sheet, 'Students');
    const prefix = full ? 'aparaitech_students_full' : 'aparaitech_students_name_email';

    if (req.query.format === 'xlsx') {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${prefix}.xlsx"`);
      return res.send(xlsx.write(book, { type: 'buffer', bookType: 'xlsx' }));
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${prefix}.csv"`);
    res.send(xlsx.utils.sheet_to_csv(sheet));
  } catch (error) {
    console.warn('MongoDB export fallback to SQLite:', error.message);
    return require('./students')(req, res, next);
  }
});

// DELETE /api/students/batch/:batchId - Delete all candidates from a bulk upload
router.delete('/batch/:batchId', async (req, res, next) => {
  try {
    const { batchId } = req.params;
    const db = await getPersistentMongoDb();
    const result = await db.collection('students').deleteMany({ import_batch_id: batchId });

    // Also delete from SQLite
    try {
      getDb().prepare('DELETE FROM students WHERE import_batch_id = ?').run(batchId);
    } catch (e) {}

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Successfully deleted all ${result.deletedCount} candidates from this bulk upload.`
    });
  } catch (error) {
    console.warn('MongoDB delete batch fallback to SQLite:', error.message);
    return require('./students')(req, res, next);
  }
});

// POST /api/students/bulk-delete - Bulk delete selected students
router.post('/bulk-delete', async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ success: false, message: 'An array of student IDs is required.' });

    const objIds = ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id));
    const numIds = ids.map(Number).filter(n => !isNaN(n));
    const filter = {
      $or: [
        ...(objIds.length ? [{ _id: { $in: objIds } }] : []),
        ...(numIds.length ? [{ sqlite_id: { $in: numIds } }] : [])
      ]
    };

    const db = await getPersistentMongoDb();
    const result = await db.collection('students').deleteMany(filter);

    // Also delete from SQLite
    try {
      const sqlite = getDb();
      if (numIds.length) {
        const placeholders = numIds.map(() => '?').join(',');
        sqlite.prepare(`DELETE FROM students WHERE id IN (${placeholders})`).run(...numIds);
      }
    } catch (e) {}

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Successfully deleted ${result.deletedCount} students.`
    });
  } catch (error) {
    console.warn('MongoDB bulk delete fallback to SQLite:', error.message);
    return require('./students')(req, res, next);
  }
});

// GET /api/students/:id - Get single student
router.get('/:id', async (req, res, next) => {
  try {
    const filter = idFilter(req.params.id);
    if (!filter) return res.status(404).json({ success: false, message: 'Student not found' });
    const db = await getPersistentMongoDb();
    const student = await db.collection('students').findOne(filter);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.json({ success: true, student: serialize(student) });
  } catch (error) {
    console.warn('MongoDB get student fallback to SQLite:', error.message);
    return require('./students')(req, res, next);
  }
});

// POST /api/students - Add single student
router.post('/', async (req, res, next) => {
  try {
    const { name, email, college, phone, branch, batch, tags, notes } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, message: 'Name and Email are required fields.' });
    const cleanEmail = email.trim().toLowerCase();
    const db = await getPersistentMongoDb();
    if (await db.collection('students').findOne({ email: cleanEmail })) {
      return res.status(409).json({ success: false, message: `A student with email "${cleanEmail}" already exists.` });
    }
    const now = new Date().toISOString();
    const student = {
      name: name.trim(),
      email: cleanEmail,
      college: (college || 'General Pool').trim(),
      phone: (phone || '').trim(),
      branch: (branch || 'Computer Science').trim(),
      batch: (batch || '2026').trim(),
      status: 'Active',
      import_batch_id: null,
      import_source: 'Manual Entry',
      tags: Array.isArray(tags) ? tags : (tags || '[]'),
      notes: (notes || '').trim(),
      created_at: now,
      updated_at: now
    };
    const result = await db.collection('students').insertOne(student);

    // Also mirror to SQLite
    try {
      getDb().prepare(`
        INSERT OR IGNORE INTO students (name, email, college, phone, branch, batch, status, import_batch_id, import_source, tags, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        student.name,
        student.email,
        student.college,
        student.phone,
        student.branch,
        student.batch,
        student.status,
        student.import_batch_id,
        student.import_source,
        typeof student.tags === 'string' ? student.tags : JSON.stringify(student.tags),
        student.notes
      );
    } catch (e) {}

    res.status(201).json({
      success: true,
      student: serialize({ ...student, _id: result.insertedId }),
      message: 'Student added successfully'
    });
  } catch (error) {
    console.warn('MongoDB post student fallback to SQLite:', error.message);
    return require('./students')(req, res, next);
  }
});

// PUT /api/students/:id - Update student
router.put('/:id', async (req, res, next) => {
  try {
    const filter = idFilter(req.params.id);
    if (!filter) return res.status(404).json({ success: false, message: 'Student not found' });
    const db = await getPersistentMongoDb();
    const existing = await db.collection('students').findOne(filter);
    if (!existing) return res.status(404).json({ success: false, message: 'Student not found' });

    const cleanEmail = req.body.email ? req.body.email.trim().toLowerCase() : existing.email;
    if (cleanEmail !== existing.email && await db.collection('students').findOne({ email: cleanEmail, _id: { $ne: existing._id } })) {
      return res.status(409).json({ success: false, message: `Email "${cleanEmail}" is already used by another student.` });
    }

    const update = {
      name: req.body.name ? req.body.name.trim() : existing.name,
      email: cleanEmail,
      college: req.body.college ? req.body.college.trim() : existing.college,
      phone: req.body.phone !== undefined ? req.body.phone.trim() : existing.phone,
      branch: req.body.branch ? req.body.branch.trim() : existing.branch,
      batch: req.body.batch ? req.body.batch.trim() : existing.batch,
      status: req.body.status || existing.status,
      tags: Array.isArray(req.body.tags) ? req.body.tags : (req.body.tags || existing.tags),
      notes: req.body.notes !== undefined ? req.body.notes.trim() : existing.notes,
      updated_at: new Date().toISOString()
    };

    await db.collection('students').updateOne(filter, { $set: update });

    // Also mirror to SQLite
    try {
      getDb().prepare(`
        UPDATE students
        SET name = ?, email = ?, college = ?, phone = ?, branch = ?, batch = ?, status = ?, tags = ?, notes = ?, updated_at = datetime('now')
        WHERE email = ?
      `).run(
        update.name,
        update.email,
        update.college,
        update.phone,
        update.branch,
        update.batch,
        update.status,
        typeof update.tags === 'string' ? update.tags : JSON.stringify(update.tags),
        update.notes,
        existing.email
      );
    } catch (e) {}

    res.json({
      success: true,
      student: serialize({ ...existing, ...update }),
      message: 'Student updated successfully'
    });
  } catch (error) {
    console.warn('MongoDB put student fallback to SQLite:', error.message);
    return require('./students')(req, res, next);
  }
});

// DELETE /api/students/:id - Delete single student
router.delete('/:id', async (req, res, next) => {
  try {
    const filter = idFilter(req.params.id);
    if (!filter) return res.status(404).json({ success: false, message: 'Student not found' });
    const db = await getPersistentMongoDb();
    const existing = await db.collection('students').findOne(filter);
    const result = await db.collection('students').deleteOne(filter);
    if (!result.deletedCount) return res.status(404).json({ success: false, message: 'Student not found' });

    // Also mirror to SQLite
    try {
      if (existing?.email) {
        getDb().prepare('DELETE FROM students WHERE email = ?').run(existing.email);
      }
    } catch (e) {}

    res.json({ success: true, message: 'Student deleted successfully' });
  } catch (error) {
    console.warn('MongoDB delete student fallback to SQLite:', error.message);
    return require('./students')(req, res, next);
  }
});

module.exports = router;
