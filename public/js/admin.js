'use strict';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, data };
}

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function fmtDateTime(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return iso; }
}

function statusPill(status) {
  return status === 'checked_in'
    ? '<span class="pill in">On site</span>'
    : '<span class="pill out">Signed out</span>';
}
function receiptPill(s) {
  if (s === 'sent') return '<span class="pill in">Sent</span>';
  if (s === 'preview') return '<span class="pill warn">Preview</span>';
  if (s === 'failed') return '<span class="pill warn">Failed</span>';
  return '<span class="pill out">Pending</span>';
}

let toastTimer;
function toast(msg, el = '#dash-toast') {
  const t = $(el);
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 4000);
}

// ── Modal ────────────────────────────────────────────────────────────────────
function openModal(html) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal-bg"><div class="modal">${html}</div></div>`;
  root.querySelector('.modal-bg').addEventListener('click', (e) => { if (e.target.classList.contains('modal-bg')) closeModal(); });
}
function closeModal() { $('#modal-root').innerHTML = ''; }

// ── Auth / boot ──────────────────────────────────────────────────────────────
async function boot() {
  const { data: cfg } = await api('/api/config');
  if (cfg.schoolName) { $('#brand').textContent = cfg.schoolName; document.title = `${cfg.schoolName} · Admin`; }

  $('#loginBtn').addEventListener('click', login);
  $('#loginPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') login(); });
  $('#logoutBtn').addEventListener('click', logout);
  wireTabs();
  wireHistory();
  wireStaff();
  wirePolicy();
  wireSettings();

  const me = await api('/api/auth/me');
  if (me.ok) enterDashboard(me.data.admin);
  else showLogin();
}

function showLogin() {
  $('#dash').classList.add('hidden');
  $('#login').classList.remove('hidden');
  $('#logoutBtn').classList.add('hidden');
}

async function login() {
  const scope = $('#login');
  $$('.field', scope).forEach((f) => f.classList.remove('invalid'));
  $('#login-alert').hidden = true;
  const email = $('#loginEmail').value.trim();
  const password = $('#loginPassword').value;
  if (!email || !password) { $('#login-alert').textContent = 'Enter your email and password.'; $('#login-alert').hidden = false; return; }
  const btn = $('#loginBtn'); btn.disabled = true; btn.textContent = 'Signing in…';
  const { ok, data } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
  btn.disabled = false; btn.textContent = 'Sign in';
  if (!ok) { $('#login-alert').textContent = data.error || 'Login failed.'; $('#login-alert').hidden = false; return; }
  $('#loginPassword').value = '';
  enterDashboard(data.admin);
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  showLogin();
}

function enterDashboard(admin) {
  $('#login').classList.add('hidden');
  $('#dash').classList.remove('hidden');
  $('#logoutBtn').classList.remove('hidden');
  $('#who').textContent = admin ? `Signed in as ${admin.name}` : '';
  refreshStats();
  switchTab('onsite');
}

async function refreshStats() {
  const { ok, data } = await api('/api/admin/stats');
  if (!ok) return;
  $('#stat-onsite').textContent = data.stats.onSite;
  $('#stat-today').textContent = data.stats.today;
  $('#stat-week').textContent = data.stats.week;
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
function wireTabs() {
  $$('.tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));
}
function switchTab(tab) {
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $$('.tabpane').forEach((p) => p.classList.toggle('hidden', p.id !== 'pane-' + tab));
  if (tab === 'onsite') loadOnsite();
  if (tab === 'history') loadHistory();
  if (tab === 'staff') loadStaff();
  if (tab === 'policy') loadPolicy();
}

// ── On site now ──────────────────────────────────────────────────────────────
async function loadOnsite() {
  const { ok, data } = await api('/api/admin/visits/current');
  if (!ok) return;
  const visits = data.visits;
  $('#onsite-count').textContent = visits.length ? `${visits.length} visitor(s) currently on site` : '';
  if (!visits.length) { $('#onsite-table').innerHTML = '<p class="muted">No visitors are currently signed in.</p>'; return; }
  $('#onsite-table').innerHTML = `
    <table><thead><tr>
      <th>Visitor</th><th>Visiting</th><th>ID</th><th>Checked in</th><th></th>
    </tr></thead><tbody>
    ${visits.map((v) => `<tr>
      <td><strong>${escapeHtml(v.visitorName)}</strong><br><span class="muted">${escapeHtml(v.email)}</span></td>
      <td>${escapeHtml(v.hostName)}${v.hostDepartment ? '<br><span class="muted">' + escapeHtml(v.hostDepartment) + '</span>' : ''}</td>
      <td>${escapeHtml(v.idLabel)}<br><span class="muted">${escapeHtml(v.idNumberMasked)}</span></td>
      <td>${fmtDateTime(v.checkInAt)}</td>
      <td style="white-space:nowrap;">
        <button class="btn secondary sm" data-action="view" data-id="${v.id}">View</button>
        <button class="btn sm" data-action="checkout" data-id="${v.id}">Sign out</button>
      </td>
    </tr>`).join('')}
    </tbody></table>`;
  bindRowActions('#onsite-table', loadOnsite);
}
$('#onsite-refresh').addEventListener('click', () => { loadOnsite(); refreshStats(); });

// ── History ──────────────────────────────────────────────────────────────────
function historyQuery() {
  const p = new URLSearchParams();
  const q = $('#h-q').value.trim();
  const status = $('#h-status').value;
  const from = $('#h-from').value;
  const to = $('#h-to').value;
  if (q) p.set('q', q);
  if (status) p.set('status', status);
  if (from) p.set('from', from);
  if (to) p.set('to', to + 'T23:59:59');
  return p;
}
async function loadHistory() {
  const { ok, data } = await api('/api/admin/visits?' + historyQuery().toString());
  if (!ok) return;
  const visits = data.visits;
  if (!visits.length) { $('#history-table').innerHTML = '<p class="muted">No matching visits.</p>'; return; }
  $('#history-table').innerHTML = `
    <p class="muted">${data.total} result(s)</p>
    <table><thead><tr>
      <th>Visitor</th><th>Visiting</th><th>ID</th><th>Check-in</th><th>Check-out</th><th>Status</th><th>Receipt</th><th></th>
    </tr></thead><tbody>
    ${visits.map((v) => `<tr>
      <td><strong>${escapeHtml(v.visitorName)}</strong><br><span class="muted">${escapeHtml(v.email)}</span></td>
      <td>${escapeHtml(v.hostName)}</td>
      <td><span class="muted">${escapeHtml(v.idNumberMasked)}</span></td>
      <td>${fmtDateTime(v.checkInAt)}</td>
      <td>${fmtDateTime(v.checkOutAt)}</td>
      <td>${statusPill(v.status)}</td>
      <td>${receiptPill(v.receiptStatus)}</td>
      <td><button class="btn secondary sm" data-action="view" data-id="${v.id}">View</button></td>
    </tr>`).join('')}
    </tbody></table>`;
  bindRowActions('#history-table', loadHistory);
}
function wireHistory() {
  $('#h-apply').addEventListener('click', loadHistory);
  $('#h-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadHistory(); });
  $('#h-csv').addEventListener('click', () => { window.location.href = '/api/admin/visits.csv?' + historyQuery().toString(); });
}

// ── Visit detail / row actions ───────────────────────────────────────────────
function bindRowActions(container, reload) {
  $$(`${container} [data-action]`).forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (btn.dataset.action === 'view') return viewVisit(id, reload);
      if (btn.dataset.action === 'checkout') {
        const { ok, data } = await api(`/api/admin/visits/${id}/checkout`, { method: 'POST' });
        if (!ok) return toast(data.error || 'Could not sign out.');
        toast('Visitor signed out.'); reload && reload(); refreshStats();
      }
    });
  });
}

async function viewVisit(id, reload) {
  const { ok, data } = await api(`/api/admin/visits/${id}`);
  if (!ok) return toast(data.error || 'Could not load visit.');
  const v = data.visit;
  const rows = [
    ['Visitor', v.visitorName],
    [v.idLabel, v.idNumber],
    ['Nationality', v.nationality],
    ['Email', v.email],
    ['Phone', v.phone],
    ['Visiting', v.hostName + (v.hostDepartment ? ' — ' + v.hostDepartment : '')],
    ['Purpose', v.purpose],
    ['Checked in', fmtDateTime(v.checkInAt)],
    ['Checked out', fmtDateTime(v.checkOutAt)],
    ['Status', v.status === 'checked_in' ? 'On site' : 'Signed out'],
    ['Acknowledged', `${fmtDateTime(v.acknowledgedAt)} (policy v${v.policyVersion})`],
    ['Receipt', v.receiptStatus + (v.receiptDetail ? ` — ${v.receiptDetail}` : '')],
  ].filter(([, val]) => val != null && val !== '');
  openModal(`
    <h2>Visit #${v.id}</h2>
    <div class="summary">${rows.map(([k, val]) => `<div><span class="k">${k}</span><span class="v">${escapeHtml(val)}</span></div>`).join('')}</div>
    <div class="actions">
      ${v.status === 'checked_in' ? `<button class="btn" data-m="checkout">Sign out visitor</button>` : ''}
      <button class="btn secondary" data-m="resend">Resend receipt</button>
      <button class="btn ghost" data-m="close">Close</button>
    </div>`);
  $('[data-m="close"]').addEventListener('click', closeModal);
  const resend = $('[data-m="resend"]');
  if (resend) resend.addEventListener('click', async () => {
    resend.disabled = true; resend.textContent = 'Sending…';
    const r = await api(`/api/admin/visits/${id}/resend-receipt`, { method: 'POST' });
    closeModal();
    toast(r.ok ? `Receipt ${r.data.receiptStatus}.` : (r.data.error || 'Could not resend.'));
  });
  const co = $('[data-m="checkout"]');
  if (co) co.addEventListener('click', async () => {
    const r = await api(`/api/admin/visits/${id}/checkout`, { method: 'POST' });
    closeModal();
    toast(r.ok ? 'Visitor signed out.' : (r.data.error || 'Could not sign out.'));
    reload && reload(); refreshStats();
  });
}

// ── Staff ────────────────────────────────────────────────────────────────────
async function loadStaff() {
  const { ok, data } = await api('/api/admin/staff');
  if (!ok) return;
  const staff = data.staff;
  $('#staff-table').innerHTML = `
    <table><thead><tr><th>Name</th><th>Department</th><th>Email</th><th>Status</th><th></th></tr></thead><tbody>
    ${staff.map((s) => `<tr>
      <td><strong>${escapeHtml(s.name)}</strong></td>
      <td>${escapeHtml(s.department || '—')}</td>
      <td>${escapeHtml(s.email || '—')}</td>
      <td>${s.active ? '<span class="pill in">Active</span>' : '<span class="pill out">Hidden</span>'}</td>
      <td style="white-space:nowrap;">
        <button class="btn secondary sm" data-edit="${s.id}">Edit</button>
        <button class="btn ghost sm" data-del="${s.id}" style="color:var(--danger);">Delete</button>
      </td>
    </tr>`).join('')}
    </tbody></table>`;
  $$('#staff-table [data-edit]').forEach((b) => b.addEventListener('click', () => staffModal(staff.find((s) => s.id === Number(b.dataset.edit)))));
  $$('#staff-table [data-del]').forEach((b) => b.addEventListener('click', () => deleteStaff(Number(b.dataset.del))));
}
function wireStaff() { $('#staff-add').addEventListener('click', () => staffModal(null)); }

function staffModal(staff) {
  const editing = !!staff;
  openModal(`
    <h2>${editing ? 'Edit' : 'Add'} staff member</h2>
    <div class="alert error" id="sm-alert" hidden></div>
    <div class="field" data-for="name"><label>Name</label><input type="text" id="sm-name" value="${escapeHtml(staff?.name || '')}"><div class="error"></div></div>
    <div class="field" data-for="department"><label>Department</label><input type="text" id="sm-dept" value="${escapeHtml(staff?.department || '')}"><div class="error"></div></div>
    <div class="field" data-for="email"><label>Email <span class="muted">(optional)</span></label><input type="email" id="sm-email" value="${escapeHtml(staff?.email || '')}"><div class="error"></div></div>
    ${editing ? `<label class="ack" style="background:#f8fafc;"><input type="checkbox" id="sm-active" ${staff.active ? 'checked' : ''}><span>Active (visitors can select this person)</span></label>` : ''}
    <div class="actions">
      <button class="btn" id="sm-save">${editing ? 'Save changes' : 'Add staff'}</button>
      <button class="btn ghost" id="sm-cancel">Cancel</button>
    </div>`);
  $('#sm-cancel').addEventListener('click', closeModal);
  $('#sm-save').addEventListener('click', async () => {
    const payload = {
      name: $('#sm-name').value.trim(),
      department: $('#sm-dept').value.trim(),
      email: $('#sm-email').value.trim(),
    };
    if (editing) payload.active = $('#sm-active').checked;
    const path = editing ? `/api/admin/staff/${staff.id}` : '/api/admin/staff';
    const { ok, data } = await api(path, { method: editing ? 'PUT' : 'POST', body: payload });
    if (!ok) {
      const a = $('#sm-alert'); a.textContent = data.error || 'Could not save.'; a.hidden = false;
      Object.entries(data.errors || {}).forEach(([k, v]) => {
        const f = document.querySelector(`#modal-root .field[data-for="${k}"]`);
        if (f) { f.classList.add('invalid'); f.querySelector('.error').textContent = v; }
      });
      return;
    }
    closeModal(); toast(editing ? 'Staff updated.' : 'Staff added.'); loadStaff();
  });
}

async function deleteStaff(id) {
  openModal(`<h2>Delete staff member?</h2><p class="muted">Past visit records are kept; the host name on those visits is preserved. This person will no longer appear at check-in.</p>
    <div class="actions"><button class="btn danger" id="del-yes">Delete</button><button class="btn ghost" id="del-no">Cancel</button></div>`);
  $('#del-no').addEventListener('click', closeModal);
  $('#del-yes').addEventListener('click', async () => {
    const { ok, data } = await api(`/api/admin/staff/${id}`, { method: 'DELETE' });
    closeModal();
    toast(ok ? 'Staff deleted.' : (data.error || 'Could not delete.'));
    loadStaff();
  });
}

// ── Policy ───────────────────────────────────────────────────────────────────
async function loadPolicy() {
  const { ok, data } = await api('/api/admin/policies');
  if (!ok) return;
  const active = data.active;
  if (active) {
    $('#policy-title').value = active.title;
    $('#policy-body').value = active.body;
    $('#policy-version').textContent = `Active: v${active.version}`;
  }
  $('#policy-history').innerHTML = `
    <table><thead><tr><th>Version</th><th>Title</th><th>Published</th><th>Status</th></tr></thead><tbody>
    ${data.policies.map((p) => `<tr>
      <td>v${p.version}</td><td>${escapeHtml(p.title)}</td><td>${fmtDateTime(p.created_at)}</td>
      <td>${p.active ? '<span class="pill in">Active</span>' : '<span class="pill out">Archived</span>'}</td>
    </tr>`).join('')}
    </tbody></table>`;
}
function wirePolicy() {
  $('#policy-publish').addEventListener('click', async () => {
    $('#policy-alert').hidden = true;
    const title = $('#policy-title').value.trim();
    const body = $('#policy-body').value.trim();
    if (!title || !body) { $('#policy-alert').textContent = 'Title and body are both required.'; $('#policy-alert').hidden = false; return; }
    const { ok, data } = await api('/api/admin/policies', { method: 'POST', body: { title, body } });
    if (!ok) { $('#policy-alert').textContent = data.error || 'Could not publish.'; $('#policy-alert').hidden = false; return; }
    toast(`Published policy v${data.policy.version}.`);
    loadPolicy();
  });
}

// ── Settings (retention purge) ───────────────────────────────────────────────
function wireSettings() {
  $('#purge-btn').addEventListener('click', async () => {
    const days = Number($('#purge-days').value);
    if (!days || days <= 0) return toast('Enter a positive number of days.', '#purge-toast');
    openModal(`<h2>Purge old records?</h2><p class="muted">This permanently deletes visit records older than <strong>${days}</strong> days. This cannot be undone.</p>
      <div class="actions"><button class="btn danger" id="pg-yes">Purge</button><button class="btn ghost" id="pg-no">Cancel</button></div>`);
    $('#pg-no').addEventListener('click', closeModal);
    $('#pg-yes').addEventListener('click', async () => {
      const { ok, data } = await api('/api/admin/maintenance/purge', { method: 'POST', body: { days } });
      closeModal();
      if (!ok) return toast(data.error || 'Could not purge.', '#purge-toast');
      toast(`Removed ${data.removed} record(s) older than ${data.retainedDays} days.`, '#purge-toast');
      refreshStats();
    });
  });
}

boot();
