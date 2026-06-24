'use strict';

// ── Tiny helpers ─────────────────────────────────────────────────────────────
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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

const VIEWS = ['home', 'ci-details', 'ci-host', 'ci-policy', 'ci-done', 'co-lookup', 'co-confirm', 'co-done'];
function show(id) {
  VIEWS.forEach((v) => $('#' + v).classList.toggle('hidden', v !== id));
  window.scrollTo(0, 0);
  resetIdle();
}

function showAlert(id, msg) {
  const el = $('#' + id);
  if (!el) return;
  if (msg) { el.textContent = msg; el.hidden = false; } else { el.hidden = true; }
}

function fieldEl(name, scope) { return scope.querySelector(`.field[data-for="${name}"]`); }
function clearErrors(scope) {
  $$('.field.invalid', scope).forEach((f) => f.classList.remove('invalid'));
  $$('.alert', scope).forEach((a) => (a.hidden = true));
}
function setError(scope, name, msg) {
  const f = fieldEl(name, scope);
  if (!f) return;
  f.classList.add('invalid');
  const e = f.querySelector('.error');
  if (e) e.textContent = msg;
}
function applyServerErrors(scope, errors = {}) {
  Object.entries(errors).forEach(([k, v]) => setError(scope, k, v));
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Dubai', dateStyle: 'medium', timeStyle: 'short' });
  } catch { return iso; }
}

function summaryRows(target, rows) {
  target.innerHTML = rows
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `<div><span class="k">${k}</span><span class="v">${escapeHtml(v)}</span></div>`)
    .join('');
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function busy(btn, on, labelWhenIdle) {
  if (on) { btn.dataset.label = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spin"></span>'; }
  else { btn.disabled = false; btn.innerHTML = labelWhenIdle || btn.dataset.label || btn.innerHTML; }
}

// ── App state ────────────────────────────────────────────────────────────────
const state = { idType: 'emirates_id', policy: null, staff: [], details: {}, host: null };

// ── Bootstrap ────────────────────────────────────────────────────────────────
async function boot() {
  const { data: cfg } = await api('/api/config');
  if (cfg.schoolName) {
    $('#brand').textContent = cfg.schoolName;
    $('#welcome').textContent = `Welcome to ${cfg.schoolName}`;
    document.title = `${cfg.schoolName} · Visitor Check-in`;
  }
  if (cfg.logoUrl) { const l = $('#logo'); l.src = cfg.logoUrl; l.hidden = false; }

  // Generic navigation buttons.
  $$('[data-go]').forEach((b) => b.addEventListener('click', () => goTo(b.dataset.go)));

  wireCheckIn();
  wireCheckOut();
  show('home');
}

function goTo(view) {
  if (view === 'ci-details') startCheckIn();
  else if (view === 'co-lookup') startCheckOut();
  else show(view);
}

// ── Check-in ─────────────────────────────────────────────────────────────────
function startCheckIn() {
  state.details = {}; state.host = null; state.idType = 'emirates_id';
  $('#visitorName').value = ''; $('#idNumber').value = ''; $('#nationality').value = '';
  $('#email').value = ''; $('#phone').value = ''; $('#purpose').value = ''; $('#hostSearch').value = '';
  $('#acknowledged').checked = false; $('#ci-submit').disabled = true;
  setIdType('emirates_id');
  clearErrors($('#ci-details'));
  show('ci-details');
}

function setIdType(type) {
  state.idType = type;
  $$('#idTypeSeg button').forEach((b) => b.classList.toggle('active', b.dataset.type === type));
  const passport = type === 'passport';
  $('#nationalityField').classList.toggle('hidden', !passport);
  $('#idNumberLabel').textContent = passport ? 'Passport number' : 'Emirates ID number';
  $('#idNumberHint').textContent = passport ? '5–15 letters and digits.' : '15 digits, starting with 784.';
  $('#idNumber').setAttribute('inputmode', passport ? 'text' : 'numeric');
  $('#idNumber').placeholder = passport ? 'e.g. X1234567' : '784-XXXX-XXXXXXX-X';
}

function validateDetails() {
  const scope = $('#ci-details');
  clearErrors(scope);
  const d = {
    visitorName: $('#visitorName').value.trim(),
    idType: state.idType,
    idNumber: $('#idNumber').value.trim(),
    nationality: $('#nationality').value.trim(),
    email: $('#email').value.trim(),
    phone: $('#phone').value.trim(),
  };
  const errors = {};
  if (!d.visitorName) errors.visitorName = 'Please enter your full name.';
  if (!d.idNumber) {
    errors.idNumber = state.idType === 'passport' ? 'Please enter your passport number.' : 'Please enter your Emirates ID.';
  } else if (state.idType === 'emirates_id') {
    const digits = d.idNumber.replace(/\D/g, '');
    if (digits.length !== 15) errors.idNumber = `Emirates ID must be 15 digits (you entered ${digits.length}).`;
    else if (!digits.startsWith('784')) errors.idNumber = 'Emirates ID must start with 784.';
  } else {
    const p = d.idNumber.replace(/[^a-z0-9]/gi, '');
    if (p.length < 5 || p.length > 15) errors.idNumber = 'Passport number must be 5–15 letters and digits.';
    if (!d.nationality) errors.nationality = 'Please enter your nationality.';
  }
  if (!d.email) errors.email = 'Please enter your email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) errors.email = 'Please enter a valid email.';
  if (d.phone && d.phone.length > 40) errors.phone = 'Phone must be 40 characters or fewer.';

  if (Object.keys(errors).length) { applyServerErrors(scope, errors); return null; }
  state.details = d;
  return d;
}

function renderStaff(filter = '') {
  const sel = $('#hostStaffId');
  const term = filter.toLowerCase();
  const matches = state.staff.filter((s) =>
    !term || s.name.toLowerCase().includes(term) || (s.department || '').toLowerCase().includes(term));
  sel.disabled = matches.length === 0;
  sel.innerHTML = matches
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}${s.department ? ' — ' + escapeHtml(s.department) : ''}</option>`)
    .join('') || '<option disabled>No matching staff</option>';
  if (state.host && matches.some((m) => m.id === state.host.id)) sel.value = String(state.host.id);
}

function wireCheckIn() {
  $$('#idTypeSeg button').forEach((b) => b.addEventListener('click', () => setIdType(b.dataset.type)));

  $('#ci-details-next').addEventListener('click', async () => {
    if (!validateDetails()) return;
    // Load staff + policy on the way to step 2/3 (cached after first load).
    if (!state.staff.length) {
      const { data } = await api('/api/staff');
      state.staff = data.staff || [];
    }
    renderStaff();
    show('ci-host');
  });

  $('#hostSearch').addEventListener('input', (e) => renderStaff(e.target.value));

  $('#ci-host-next').addEventListener('click', async () => {
    const scope = $('#ci-host');
    clearErrors(scope);
    const id = Number($('#hostStaffId').value);
    const host = state.staff.find((s) => s.id === id);
    if (!host) { setError(scope, 'hostStaffId', 'Please choose who you are here to see.'); return; }
    state.host = host;
    state.details.purpose = $('#purpose').value.trim();

    if (!state.policy) {
      const { ok, data } = await api('/api/policy');
      if (!ok) { showAlert('ci-host-alert', data.error || 'Could not load the safeguarding policy.'); return; }
      state.policy = data.policy;
    }
    $('#policyTitle').textContent = state.policy.title;
    $('#policyBody').innerHTML = state.policy.body;
    $('#acknowledged').checked = false;
    $('#ci-submit').disabled = true;
    show('ci-policy');
  });

  $('#acknowledged').addEventListener('change', (e) => { $('#ci-submit').disabled = !e.target.checked; });

  $('#ci-submit').addEventListener('click', async () => {
    const btn = $('#ci-submit');
    clearErrors($('#ci-policy'));
    busy(btn, true);
    const payload = {
      visitorName: state.details.visitorName,
      idType: state.details.idType,
      idNumber: state.details.idNumber,
      nationality: state.details.nationality || undefined,
      email: state.details.email,
      phone: state.details.phone || undefined,
      hostStaffId: state.host.id,
      purpose: state.details.purpose || undefined,
      acknowledged: $('#acknowledged').checked,
      policyVersion: state.policy.version,
    };
    const { ok, status, data } = await api('/api/checkin', { method: 'POST', body: payload });
    busy(btn, false, 'Submit &amp; check in');

    if (!ok) {
      if (status === 409) { showAlert('ci-policy-alert', data.error); return; }
      if (data.errors) {
        // Errors may belong to earlier steps — surface a message and let them go back.
        showAlert('ci-policy-alert', data.error || 'Please review your details.');
        applyServerErrors($('#ci-details'), data.errors);
        applyServerErrors($('#ci-host'), data.errors);
      } else {
        showAlert('ci-policy-alert', data.error || 'Something went wrong. Please see reception.');
      }
      return;
    }

    const v = data.visit;
    $('#ci-done-msg').textContent = data.message || 'You are checked in.';
    summaryRows($('#ci-done-summary'), [
      ['Visitor', v.visitorName],
      ['Visiting', v.hostName],
      [v.idLabel, v.idNumber],
      ['Checked in', fmtDateTime(v.checkInAt)],
    ]);
    const warn = v.receiptStatus === 'failed';
    $('#ci-done-title').textContent = warn ? 'Checked in (email pending)' : "You're checked in";
    show('ci-done');
    autoReturn('ci-auto', 15);
  });
}

// ── Check-out ────────────────────────────────────────────────────────────────
function startCheckOut() {
  $('#coId').value = '';
  clearErrors($('#co-lookup'));
  show('co-lookup');
}

function wireCheckOut() {
  $('#co-lookup-next').addEventListener('click', async () => {
    const btn = $('#co-lookup-next');
    const scope = $('#co-lookup');
    clearErrors(scope);
    const idNumber = $('#coId').value.trim();
    if (!idNumber) { setError(scope, 'coId', 'Please enter your ID number.'); return; }
    busy(btn, true);
    const { ok, data } = await api('/api/checkout/lookup', { method: 'POST', body: { idNumber } });
    busy(btn, false, 'Find my visit');
    if (!ok) { showAlert('co-lookup-alert', data.error || 'No active visit found.'); return; }
    state.checkout = { idNumber, visit: data.visit };
    summaryRows($('#co-summary'), [
      ['Visitor', data.visit.visitorName],
      ['Visiting', data.visit.hostName],
      ['Checked in', fmtDateTime(data.visit.checkInAt)],
    ]);
    show('co-confirm');
  });

  $('#co-confirm-btn').addEventListener('click', async () => {
    const btn = $('#co-confirm-btn');
    clearErrors($('#co-confirm'));
    busy(btn, true);
    const { ok, data } = await api('/api/checkout/confirm', { method: 'POST', body: { idNumber: state.checkout.idNumber } });
    busy(btn, false, 'Confirm sign-out');
    if (!ok) { showAlert('co-confirm-alert', data.error || 'Could not sign you out. Please see reception.'); return; }
    $('#co-done-msg').textContent = data.message || 'You have signed out. Thank you for visiting.';
    show('co-done');
    autoReturn('co-auto', 10);
  });
}

// ── Idle handling: return to home automatically ──────────────────────────────
let idleTimer;
function resetIdle() {
  clearTimeout(idleTimer);
  // Don't auto-reset while on the home screen.
  if ($('#home').classList.contains('hidden')) {
    idleTimer = setTimeout(() => show('home'), 120000);
  }
}
// Any interaction resets the idle countdown; resetIdle() itself only arms the
// timer when the user is away from the home screen.
['click', 'keydown', 'input', 'touchstart'].forEach((ev) =>
  document.addEventListener(ev, () => resetIdle(), { passive: true }));

let autoTimer;
function autoReturn(elId, seconds) {
  clearInterval(autoTimer);
  let left = seconds;
  const el = $('#' + elId);
  const tick = () => {
    el.textContent = `Returning to the start in ${left}s…`;
    if (left <= 0) { clearInterval(autoTimer); show('home'); return; }
    left -= 1;
  };
  tick();
  autoTimer = setInterval(tick, 1000);
}

boot();
