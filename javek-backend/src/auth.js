const bcrypt = require('bcryptjs');
const db = require('./db');

function findStaffByUsername(username) {
  return db.prepare('SELECT * FROM staff_users WHERE username = ?').get(username);
}

function createStaffUser(username, plainPassword) {
  const hash = bcrypt.hashSync(plainPassword, 10);
  const stmt = db.prepare('INSERT INTO staff_users (username, password_hash) VALUES (?, ?)');
  return stmt.run(username, hash);
}

function verifyPassword(plainPassword, hash) {
  return bcrypt.compareSync(plainPassword, hash);
}

// Middleware: blocks the request unless the session belongs to a logged-in staff member
function requireStaffAuth(req, res, next) {
  if (req.session && req.session.staffId) {
    return next();
  }
  return res.status(401).json({ error: 'Not logged in' });
}

module.exports = { findStaffByUsername, createStaffUser, verifyPassword, requireStaffAuth };
