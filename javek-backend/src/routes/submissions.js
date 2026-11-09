const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../db');
const { requireStaffAuth } = require('../auth');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024, files: 10 }, // 25MB per file, up to 10 files
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) return cb(null, true);
    cb(new Error(`File type not allowed: ${file.originalname}`));
  },
});

function makeReference() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return `JP-${num}`;
}

// PUBLIC: customer submits a print job with attached files
router.post('/', (req, res) => {
  upload.array('files', 10)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    const { fullName, email, phone, service, notes } = req.body;
    if (!fullName || !email || !phone) {
      return res.status(400).json({ error: 'Full name, email and phone are required.' });
    }

    const reference = makeReference();

    const insertSubmission = db.prepare(`
      INSERT INTO submissions (reference, full_name, email, phone, service, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const result = insertSubmission.run(reference, fullName, email, phone, service || null, notes || null);
    const submissionId = result.lastInsertRowid;

    const insertFile = db.prepare(`
      INSERT INTO submission_files (submission_id, original_name, stored_name, mime_type, size_bytes)
      VALUES (?, ?, ?, ?, ?)
    `);
    (req.files || []).forEach((f) => {
      insertFile.run(submissionId, f.originalname, f.filename, f.mimetype, f.size);
    });

    res.status(201).json({ ok: true, reference, submissionId, filesReceived: (req.files || []).length });
  });
});

// STAFF: list submissions (most recent first), optional ?status= filter
router.get('/', requireStaffAuth, (req, res) => {
  const { status } = req.query;
  let rows;
  if (status) {
    rows = db.prepare('SELECT * FROM submissions WHERE status = ? ORDER BY id DESC').all(status);
  } else {
    rows = db.prepare('SELECT * FROM submissions ORDER BY id DESC').all();
  }

  const fileCountStmt = db.prepare('SELECT COUNT(*) AS c FROM submission_files WHERE submission_id = ?');
  const withCounts = rows.map((r) => ({ ...r, fileCount: fileCountStmt.get(r.id).c }));
  res.json(withCounts);
});

// STAFF: single submission with its files
router.get('/:id', requireStaffAuth, (req, res) => {
  const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
  if (!submission) return res.status(404).json({ error: 'Not found' });

  const files = db.prepare('SELECT * FROM submission_files WHERE submission_id = ?').all(submission.id);
  res.json({ ...submission, files });
});

// STAFF: update job status (new / in_progress / ready / completed)
router.patch('/:id/status', requireStaffAuth, (req, res) => {
  const { status } = req.body;
  const allowed = ['new', 'in_progress', 'ready', 'completed'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Status must be one of: ${allowed.join(', ')}` });
  }
  const result = db.prepare('UPDATE submissions SET status = ? WHERE id = ?').run(status, req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// STAFF: download/view a specific file
router.get('/:submissionId/files/:fileId', requireStaffAuth, (req, res) => {
  const file = db.prepare(
    'SELECT * FROM submission_files WHERE id = ? AND submission_id = ?'
  ).get(req.params.fileId, req.params.submissionId);

  if (!file) return res.status(404).json({ error: 'File not found' });

  const filePath = path.join(uploadsDir, file.stored_name);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing on disk' });

  res.setHeader('Content-Disposition', `inline; filename="${file.original_name}"`);
  res.sendFile(filePath);
});

module.exports = router;
