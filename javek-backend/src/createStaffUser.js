// Usage: node src/createStaffUser.js <username> <password>
// Creates a new staff account, or updates the password if the username already exists.
const db = require('./db');
const bcrypt = require('bcryptjs');

const [, , username, password] = process.argv;

if (!username || !password) {
  console.error('Usage: node src/createStaffUser.js <username> <password>');
  process.exit(1);
}

if (password.length < 8) {
  console.error('Password should be at least 8 characters.');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
const existing = db.prepare('SELECT id FROM staff_users WHERE username = ?').get(username);

if (existing) {
  db.prepare('UPDATE staff_users SET password_hash = ? WHERE username = ?').run(hash, username);
  console.log(`Password updated for existing staff user "${username}".`);
} else {
  db.prepare('INSERT INTO staff_users (username, password_hash) VALUES (?, ?)').run(username, hash);
  console.log(`Staff user "${username}" created.`);
}
