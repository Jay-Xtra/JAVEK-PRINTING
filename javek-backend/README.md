# Javek Printing — Backend

A small Node.js/Express backend for the Javek Printing website:

- Customers submit a print job (name, contact, service, notes, and files) through a public API endpoint.
- Files are stored on the server's disk; job details go into a SQLite database.
- Staff sign in at `/staff` with a username and password to view every submission and download the attached files.

## What's included

```
javek-backend/
  server.js              Express app entry point
  src/
    db.js                 SQLite setup (tables: staff_users, submissions, submission_files)
    auth.js                Login/session helpers
    createStaffUser.js     CLI script to add or reset a staff login
    routes/
      auth.js               /api/auth/* (login, logout, session check)
      submissions.js         /api/submissions/* (public upload + staff-only viewing)
  public/staff/            Staff dashboard (plain HTML/CSS/JS, served at /staff)
  uploads/                  Uploaded files are stored here
  data/                     javek.db (SQLite database file) lives here
  .env.example              Copy to .env and fill in
```

## 1. Install dependencies

```bash
cd javek-backend
npm install
```

## 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and set `SESSION_SECRET` to a random string. You can generate one with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 3. Create your first staff login

```bash
node src/createStaffUser.js youradmin "a-strong-password"
```

Run this again any time to add another staff member or reset a password.

## 4. Run the server

```bash
npm start
```

The server starts at `http://localhost:4000` (or whatever `PORT` you set).

- Public upload endpoint: `POST http://localhost:4000/api/submissions`
- Staff dashboard: `http://localhost:4000/staff`

## 5. Connect the customer-facing website

Your `javek-printing.html` upload form currently only *simulates* a submission in the browser. To make it real, point the form's submit handler at this backend instead. Replace the fake success handler in the site's `<script>` with something like:

```javascript
uploadForm.addEventListener('submit', async function (e) {
  e.preventDefault();

  const formData = new FormData();
  formData.append('fullName', document.getElementById('fullName').value);
  formData.append('email', document.getElementById('email').value);
  formData.append('phone', document.getElementById('phone').value);
  formData.append('service', document.getElementById('service').value);
  formData.append('notes', document.getElementById('notes').value);
  selectedFiles.forEach(file => formData.append('files', file));

  const API_BASE = 'https://your-backend-domain.com'; // or http://localhost:4000 while testing
  const res = await fetch(`${API_BASE}/api/submissions`, {
    method: 'POST',
    body: formData,
  });
  const data = await res.json();

  if (!res.ok) {
    successText.textContent = data.error || 'Something went wrong — please try again.';
  } else {
    successText.textContent = `Thanks — reference ${data.reference}. We'll follow up by email or phone with a quote.`;
  }
  successPanel.classList.add('show');
  successPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
});
```

If the website and backend are on different domains, add the website's URL to `ALLOWED_ORIGINS` in `.env`.

## 6. Deploying

This backend needs somewhere that keeps a Node process running and gives you persistent disk storage (for `data/` and `uploads/`) — for example **Render**, **Railway**, or a small **VPS**. Plain static hosts (Netlify, GitHub Pages, Vercel's static tier) won't work for this piece since it needs a live server, not just files.

General steps on any of these platforms:

1. Push this folder to a GitHub repo.
2. Create a new "Web Service" pointing at the repo, with build command `npm install` and start command `npm start`.
3. Set the environment variables from `.env` (`SESSION_SECRET`, `ALLOWED_ORIGINS`, `NODE_ENV=production`) in the platform's dashboard.
4. Attach a persistent disk/volume mounted so `data/` and `uploads/` survive restarts (both Render and Railway support this — check "persistent disks" in their docs, since the free tiers sometimes wipe the filesystem on redeploy).
5. After the first deploy, run `node src/createStaffUser.js <username> <password>` once (via the platform's shell/console) to create your first staff login.
6. Update `API_BASE` in the website's upload form to your deployed backend URL.

## Notes & things to harden before going fully live

- **File size / type limits**: currently 25MB per file, up to 10 files, limited to PDF/DOC/DOCX/XLS/XLSX/JPG/PNG. Adjust in `src/routes/submissions.js` (`ALLOWED_MIME`, `limits`).
- **Backups**: the SQLite file in `data/javek.db` and the `uploads/` folder are the only copies of your data — back them up periodically.
- **HTTPS**: set `NODE_ENV=production` only once the backend is served over HTTPS, since secure cookies won't be sent over plain HTTP.
- **Rate limiting / spam**: consider adding a package like `express-rate-limit` on `POST /api/submissions` if the public form gets abused.
- **Multiple staff accounts**: run `createStaffUser.js` per staff member — there's currently no in-dashboard user management screen.
