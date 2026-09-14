const express = require('express');
const router = express.Router();
const { getDb } = require('../database/db');
const { renderText, extractTags } = require('../services/templateEngine');

const { SAMPLE_TEMPLATES } = require('../services/sampleTemplates');

// GET /api/templates/samples - Get all standard sample templates catalog
router.get('/samples', (req, res) => {
  res.json({ success: true, samples: SAMPLE_TEMPLATES });
});

// POST /api/templates/reset-samples - Restore/re-seed standard sample templates into database
router.post('/reset-samples', async (req, res) => {
  try {
    const db = getDb();
    const findTemplate = db.prepare('SELECT id FROM templates WHERE name = ?');
    const updateTemplate = db.prepare(`
      UPDATE templates 
      SET category = ?, subject = ?, body_html = ?, tags_used = ?, updated_at = datetime('now')
      WHERE name = ?
    `);
    const insertTemplate = db.prepare(`
      INSERT INTO templates (name, category, subject, body_html, tags_used)
      VALUES (?, ?, ?, ?, ?)
    `);

    let addedCount = 0;
    let updatedCount = 0;

    const tx = db.transaction(() => {
      for (const t of SAMPLE_TEMPLATES) {
        const existing = findTemplate.get(t.name);
        if (existing) {
          updateTemplate.run(t.category, t.subject, t.body_html, JSON.stringify(t.tags_used), t.name);
          updatedCount++;
        } else {
          insertTemplate.run(t.name, t.category, t.subject, t.body_html, JSON.stringify(t.tags_used));
          addedCount++;
        }
      }
    });
    tx();

    const allTemplates = db.prepare(`
      SELECT * FROM templates 
      ORDER BY 
        CASE WHEN name LIKE '%Campus Placement Drive 2026 - Software Engineer%' THEN 0 
             WHEN category = 'Placement Drive' THEN 1 
             ELSE 2 END, id ASC
    `).all();

    res.json({
      success: true,
      message: `Standard sample templates restored successfully (${addedCount} added, ${updatedCount} refreshed).`,
      templates: allTemplates
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/templates - List all templates
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const templates = db.prepare(`
      SELECT * FROM templates 
      ORDER BY 
        CASE WHEN name LIKE '%Campus Placement Drive 2026 - Software Engineer%' THEN 0 
             WHEN category = 'Placement Drive' THEN 1 
             ELSE 2 END, id ASC
    `).all();
    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/templates/:id - Get single template
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const template = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }
    res.json({ success: true, template });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

const { getPersistentMongoDb, syncTemplateToMongo, deleteTemplateFromMongo } = require('../database/mongo');
const { ObjectId } = require('mongodb');

// POST /api/templates - Create new template
router.post('/', async (req, res) => {
  try {
    const db = getDb();
    const { name, category, subject, body_html } = req.body;

    if (!name || !subject || !body_html) {
      return res.status(400).json({ success: false, message: 'Name, Subject, and Body are required.' });
    }

    const tags = extractTags(subject + ' ' + body_html);

    const stmt = db.prepare(`
      INSERT INTO templates (name, category, subject, body_html, tags_used)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name.trim(),
      category || 'Placement Drive',
      subject.trim(),
      body_html,
      JSON.stringify(tags)
    );

    const newTemplate = db.prepare('SELECT * FROM templates WHERE id = ?').get(result.lastInsertRowid);
    if (process.env.MONGODB_URI) {
      await syncTemplateToMongo(newTemplate.id);
    }

    res.status(201).json({ success: true, template: newTemplate, message: 'Template saved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/templates/:id - Update template
router.put('/:id', async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { name, category, subject, body_html } = req.body;

    const existing = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    const tags = extractTags((subject || existing.subject) + ' ' + (body_html || existing.body_html));

    db.prepare(`
      UPDATE templates
      SET name = ?, category = ?, subject = ?, body_html = ?, tags_used = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name ? name.trim() : existing.name,
      category || existing.category,
      subject ? subject.trim() : existing.subject,
      body_html || existing.body_html,
      JSON.stringify(tags),
      id
    );

    const updated = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    if (process.env.MONGODB_URI) {
      await syncTemplateToMongo(id);
    }

    res.json({ success: true, template: updated, message: 'Template updated successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/templates/:id - Delete template
router.delete('/:id', async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const result = db.prepare('DELETE FROM templates WHERE id = ?').run(id);

    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Template not found' });
    }

    if (process.env.MONGODB_URI) {
      await deleteTemplateFromMongo(id);
    }

    res.json({ success: true, message: 'Template deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/templates/preview - Live render subject & body for a selected student
router.post('/preview', async (req, res) => {
  try {
    const { subject = '', body_html = '', apply_link = 'https://aparaitech.org/apply', studentId, customStudent = null } = req.body;
    const db = getDb();

    const { getOptionalAuth } = require('./auth');
    const user = getOptionalAuth(req);

    let studentData = customStudent;

    if (user && user.role === 'customer') {
      if (studentId) {
        studentData = db.prepare('SELECT * FROM students WHERE id = ? AND user_id = ?').get(studentId, user.id);
      }
      if (!studentData) {
        studentData = db.prepare('SELECT * FROM students WHERE user_id = ? LIMIT 1').get(user.id);
      }
      if (!studentData) {
        studentData = {
          name: 'Candidate Name',
          email: 'candidate@university.edu',
          college: 'Engineering Institute',
          phone: '+91 9876543210',
          branch: 'Computer Science & Engineering',
          batch: '2026'
        };
      }
    } else {
      if (studentId) {
        if (process.env.MONGODB_URI) {
          try {
            const mongo = await getPersistentMongoDb();
            if (ObjectId.isValid(studentId)) {
              studentData = await mongo.collection('students').findOne({ _id: new ObjectId(studentId) });
            }
          } catch (e) {}
        }
        if (!studentData) {
          studentData = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
        }
      }

      if (!studentData && process.env.MONGODB_URI) {
        try {
          const mongo = await getPersistentMongoDb();
          studentData = await mongo.collection('students').findOne({});
        } catch (e) {}
      }

      if (!studentData) {
        // Pick first student from DB or default
        studentData = db.prepare('SELECT * FROM students LIMIT 1').get() || {
          name: 'Rahul Sharma',
          email: 'rahul.sharma@iitb.ac.in',
          college: 'IIT Bombay',
          phone: '+91 9820123456',
          branch: 'Computer Science & Engineering',
          batch: '2026'
        };
      }
    }

    const customVars = {
      apply_link: apply_link || 'https://aparaitech.org/apply',
      ApplyLink: apply_link || 'https://aparaitech.org/apply',
      Application_Link: apply_link || 'https://aparaitech.org/apply'
    };

    const renderedSubject = renderText(subject, studentData, customVars);
    const renderedBody = renderText(body_html, studentData, customVars);

    res.json({
      success: true,
      student: studentData,
      renderedSubject,
      renderedBody
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
