require('dotenv').config();
const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./src/routes/auth');
const submissionRoutes = require('./src/routes/submissions');

const app = express();
const PORT = process.env.PORT || 4000;

// If the customer-facing site is hosted on a different domain, list it here
// (comma separated) as ALLOWED_ORIGINS in .env, e.g:
// ALLOWED_ORIGINS=https://javekprinting.com,https://www.javekprinting.com
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-.env',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 8, // 8 hour session
    secure: process.env.NODE_ENV === 'production', // requires HTTPS in production
  },
}));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/submissions', submissionRoutes);

// Staff dashboard (static HTML/JS/CSS) — served at /staff
app.use('/staff', express.static(path.join(__dirname, 'public', 'staff')));

app.get('/', (req, res) => {
  res.send('Javek Printing backend is running. Staff dashboard: /staff');
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`Javek Printing backend listening on http://localhost:${PORT}`);
  console.log(`Staff dashboard: http://localhost:${PORT}/staff`);
});
