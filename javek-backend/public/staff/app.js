const loginView = document.getElementById('loginView');
const dashView = document.getElementById('dashView');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const whoami = document.getElementById('whoami');
const logoutBtn = document.getElementById('logoutBtn');
const subTableBody = document.getElementById('subTableBody');
const emptyState = document.getElementById('emptyState');
const filters = document.getElementById('filters');
const refreshBtn = document.getElementById('refreshBtn');
const detailOverlay = document.getElementById('detailOverlay');
const detailContent = document.getElementById('detailContent');
const closeDetail = document.getElementById('closeDetail');

let currentStatusFilter = '';
const STATUS_LABELS = {
  new: 'New',
  in_progress: 'In progress',
  ready: 'Ready',
  completed: 'Completed',
};

async function checkSession() {
  const res = await fetch('/api/auth/me');
  const data = await res.json();
  if (data.loggedIn) {
    showDashboard(data.username);
  } else {
    showLogin();
  }
}

function showLogin() {
  loginView.classList.remove('hidden');
  dashView.classList.add('hidden');
}

function showDashboard(username) {
  loginView.classList.add('hidden');
  dashView.classList.remove('hidden');
  whoami.textContent = username;
  loadSubmissions();
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();

  if (!res.ok) {
    loginError.textContent = data.error || 'Login failed.';
    return;
  }
  showDashboard(data.username);
});

logoutBtn.addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' });
  showLogin();
});

filters.addEventListener('click', (e) => {
  const btn = e.target.closest('.filter-chip');
  if (!btn) return;
  filters.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  btn.classList.add('active');
  currentStatusFilter = btn.dataset.status;
  loadSubmissions();
});

refreshBtn.addEventListener('click', loadSubmissions);

async function loadSubmissions() {
  const url = currentStatusFilter
    ? `/api/submissions?status=${encodeURIComponent(currentStatusFilter)}`
    : '/api/submissions';
  const res = await fetch(url);
  if (res.status === 401) return showLogin();

  const rows = await res.json();
  renderTable(rows);
}

function renderTable(rows) {
  subTableBody.innerHTML = '';
  emptyState.classList.toggle('hidden', rows.length > 0);

  rows.forEach((r) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(r.reference)}</td>
      <td>${escapeHtml(r.full_name)}</td>
      <td>${escapeHtml(r.service || '—')}</td>
      <td>${r.fileCount}</td>
      <td><span class="status-badge status-${r.status}">${STATUS_LABELS[r.status] || r.status}</span></td>
      <td>${formatDate(r.created_at)}</td>
    `;
    tr.addEventListener('click', () => openDetail(r.id));
    subTableBody.appendChild(tr);
  });
}

async function openDetail(id) {
  const res = await fetch(`/api/submissions/${id}`);
  if (res.status === 401) return showLogin();
  const s = await res.json();

  detailContent.innerHTML = `
    <h2>${escapeHtml(s.full_name)}</h2>
    <div class="ref">${escapeHtml(s.reference)}</div>

    <div class="detail-row">
      <div class="label">Contact</div>
      <div class="value">${escapeHtml(s.email)} · ${escapeHtml(s.phone)}</div>
    </div>
    <div class="detail-row">
      <div class="label">Service</div>
      <div class="value">${escapeHtml(s.service || '—')}</div>
    </div>
    <div class="detail-row">
      <div class="label">Notes</div>
      <div class="value">${escapeHtml(s.notes || '—')}</div>
    </div>
    <div class="detail-row">
      <div class="label">Received</div>
      <div class="value">${formatDate(s.created_at)}</div>
    </div>

    <div class="detail-row">
      <div class="label">Files (${s.files.length})</div>
      ${s.files.map(f => `
        <div class="file-item">
          <span>${escapeHtml(f.original_name)} · ${formatSize(f.size_bytes)}</span>
          <a href="/api/submissions/${s.id}/files/${f.id}" target="_blank" rel="noopener">View</a>
        </div>
      `).join('') || '<p class="value">No files attached.</p>'}
    </div>

    <div class="detail-row">
      <div class="label">Status</div>
      <select class="status-select" id="statusSelect">
        ${Object.entries(STATUS_LABELS).map(([val, label]) =>
          `<option value="${val}" ${val === s.status ? 'selected' : ''}>${label}</option>`
        ).join('')}
      </select>
    </div>
  `;

  document.getElementById('statusSelect').addEventListener('change', async (e) => {
    await fetch(`/api/submissions/${s.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: e.target.value }),
    });
    loadSubmissions();
  });

  detailOverlay.classList.remove('hidden');
}

closeDetail.addEventListener('click', () => detailOverlay.classList.add('hidden'));
detailOverlay.addEventListener('click', (e) => {
  if (e.target === detailOverlay) detailOverlay.classList.add('hidden');
});

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(iso) {
  const d = new Date(iso + 'Z');
  return d.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function formatSize(bytes) {
  if (!bytes) return '0 KB';
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

checkSession();
