'use strict';
/*
 * Browser-only mock backend for the GitHub Pages demo.
 *
 * This file intercepts window.fetch for any /api/* request and serves it from
 * in-browser state (localStorage), so the REAL frontend (kiosk.js / admin.js)
 * runs unmodified with no server. It mirrors the shapes returned by the actual
 * Express API in src/routes/*. It is NOT used by the production app — the real
 * backend in src/ is untouched.
 */
(function () {
  const LS_KEY = 'visitorHubDemo.v1';
  const realFetch = window.fetch.bind(window);

  const SCHOOL = {
    schoolName: 'American International School in Abu Dhabi (Demo)',
    logoUrl: '',
    supportEmail: '',
  };

  const CATEGORIES = [
    { value: 'parent', label: 'Parent' },
    { value: 'contractor', label: 'Contractor' },
    { value: 'adek', label: 'ADEK' },
    { value: 'inspector', label: 'Inspector' },
    { value: 'other_school', label: 'Visitor from another school' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'other', label: 'Other' },
  ];
  const CATEGORY_VALUES = new Set(CATEGORIES.map((c) => c.value));
  const categoryLabel = (v) => (CATEGORIES.find((c) => c.value === v) || {}).label || (v || '—');

  const POLICY_BODY = `
<p>The safety and wellbeing of every student is our highest priority. In line with
the Abu Dhabi Department of Education and Knowledge (ADEK) Student Protection Policy
and the UAE Child Rights Law (Wadeema's Law, Federal Law No. 3 of 2016), all
visitors, parents, contractors, officials and volunteers must read and agree to the
following before entering the school.</p>
<h3>While you are on site, you agree to:</h3>
<ul>
  <li><strong>Wear your visitor badge</strong> visibly at all times and return it when you sign out.</li>
  <li><strong>Remain with your host</strong> or an authorised staff member, stay only in areas authorised for your visit, and accept that you may be escorted at the school's discretion. Do not enter classrooms, toilets, or changing areas unaccompanied.</li>
  <li><strong>Have no unsupervised contact</strong> with any student at any time, and not exchange personal contact details with students.</li>
  <li><strong>Not photograph, film, or record</strong> students, staff, or school activities, and not share any images of children, without prior written permission from the school administration.</li>
  <li><strong>Keep mobile and recording devices put away</strong> in areas where children are present, except for the legitimate purpose of your visit.</li>
  <li><strong>Follow all health, safety, and emergency instructions</strong>, including fire evacuation and roll-call procedures and any directions given by staff.</li>
  <li><strong>Comply with the school's Child Protection &amp; Safeguarding Policy, Code of Conduct, and site rules</strong> for the full duration of your visit.</li>
</ul>
<h3>Your duty to report:</h3>
<p>Under Wadeema's Law you have a duty to report any suspected harm, abuse, neglect,
or risk to a child immediately. Report any safeguarding concern at once to your host
or to the school's Designated Safeguarding Lead at reception.</p>
<h3>You also confirm that:</h3>
<ul>
  <li>The identity details you have provided are accurate.</li>
  <li>You are not subject to any restriction that would make it inappropriate for you to be on a school site or in contact with children.</li>
  <li>You understand the school may refuse or revoke entry at its discretion.</li>
</ul>
<p>Your information is collected only to manage your visit and is handled in line with
the UAE Personal Data Protection Law (Federal Decree-Law No. 45 of 2021).</p>
<p><em>By submitting this form you confirm you have read, understood, and agree to
abide by this policy for the duration of your visit.</em></p>`.trim();

  const SEED_STAFF = [
    { id: 1, name: 'Ms. Sarah Khan', email: 'sarah.khan@example.com', department: 'Reception', active: 1 },
    { id: 2, name: 'Mr. Omar Haddad', email: 'omar.haddad@example.com', department: 'Principal’s Office', active: 1 },
    { id: 3, name: 'Ms. Aisha Rahman', email: 'aisha.rahman@example.com', department: 'Admissions', active: 1 },
    { id: 4, name: 'Mr. David Lee', email: 'david.lee@example.com', department: 'Primary School', active: 1 },
    { id: 5, name: 'Ms. Fatima Al Suwaidi', email: 'fatima.als@example.com', department: 'Safeguarding (DSL)', active: 1 },
  ];

  // ── identity helpers (mirror src/util) ─────────────────────────────────────
  const normEid = (v) => String(v ?? '').replace(/\D/g, '');
  const normPassport = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const idLabel = (t) => (t === 'passport' ? 'Passport' : 'Emirates ID');
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());
  function normalizeForLookup(v) {
    const d = normEid(v);
    if (d.length === 15 && d.startsWith('784')) return d;
    return normPassport(v);
  }
  function formatId(type, v) {
    if (type === 'passport') return normPassport(v);
    const d = normEid(v);
    if (d.length !== 15) return d;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 14)}-${d.slice(14)}`;
  }
  function maskId(type, v) {
    if (type === 'passport') {
      const p = normPassport(v);
      return p.length <= 4 ? '••••' : `${p.slice(0, 2)}••••${p.slice(-2)}`;
    }
    const d = normEid(v);
    if (d.length !== 15) return '•••';
    return `784-••••-•••••••-${d.slice(-2)}`;
  }

  // ── state ───────────────────────────────────────────────────────────────────
  function nowMinus(min) { return new Date(Date.now() - min * 60000).toISOString(); }
  function freshState() {
    return {
      admin: false,
      nextVisitId: 3,
      nextStaffId: 6,
      policies: [{ id: 1, version: 1, title: 'Child Protection & Safeguarding — Visitor Acknowledgment', body: POLICY_BODY, active: 1, created_at: nowMinus(60 * 24 * 7) }],
      staff: SEED_STAFF.map((s) => ({ ...s, created_at: nowMinus(60 * 24 * 30) })),
      visits: [
        {
          id: 1, visitor_name: 'Layla Hassan', id_type: 'emirates_id', id_number: '784198812345673',
          nationality: null, visitor_category: 'parent', email: 'layla.hassan@example.com', phone: '0501112222', host_staff_id: 3,
          host_name: 'Ms. Aisha Rahman', host_department: 'Admissions', purpose: 'Admissions tour',
          policy_id: 1, policy_version: 1, acknowledged_at: nowMinus(35), check_in_at: nowMinus(35),
          check_out_at: null, status: 'checked_in', receipt_status: 'preview', receipt_detail: '(demo)', created_at: nowMinus(35),
        },
        {
          id: 2, visitor_name: 'James Carter', id_type: 'passport', id_number: 'P1234567',
          nationality: 'United Kingdom', visitor_category: 'contractor', email: 'james.carter@example.com', phone: null, host_staff_id: 2,
          host_name: 'Mr. Omar Haddad', host_department: 'Principal’s Office', purpose: 'Supplier meeting',
          policy_id: 1, policy_version: 1, acknowledged_at: nowMinus(180), check_in_at: nowMinus(180),
          check_out_at: nowMinus(90), status: 'checked_out', receipt_status: 'preview', receipt_detail: '(demo)', created_at: nowMinus(180),
        },
      ],
    };
  }
  let state;
  try { state = JSON.parse(localStorage.getItem(LS_KEY)); } catch { state = null; }
  if (!state || !state.visits) { state = freshState(); save(); }
  function save() { try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* ignore */ } }

  // ── response helpers ──────────────────────────────────────────────────────
  const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
  const activeStaff = () => state.staff.filter((s) => s.active);
  const activePolicy = () => state.policies.find((p) => p.active) || state.policies[state.policies.length - 1];
  const findActive = (idNumber) => {
    const n = normalizeForLookup(idNumber);
    return state.visits.filter((v) => v.status === 'checked_in' && v.id_number === n).sort((a, b) => b.check_in_at.localeCompare(a.check_in_at))[0];
  };

  function summary(v) {
    return {
      id: v.id, visitorName: v.visitor_name, hostName: v.host_name, purpose: v.purpose,
      category: v.visitor_category, categoryLabel: categoryLabel(v.visitor_category),
      idType: v.id_type, idLabel: idLabel(v.id_type), idNumber: maskId(v.id_type, v.id_number),
      checkInAt: v.check_in_at, checkOutAt: v.check_out_at, status: v.status, receiptStatus: v.receipt_status,
    };
  }
  function listItem(v) {
    return {
      id: v.id, visitorName: v.visitor_name, idType: v.id_type, idLabel: idLabel(v.id_type),
      idNumberMasked: maskId(v.id_type, v.id_number), email: v.email, hostName: v.host_name,
      hostDepartment: v.host_department, category: v.visitor_category, categoryLabel: categoryLabel(v.visitor_category),
      purpose: v.purpose, checkInAt: v.check_in_at,
      checkOutAt: v.check_out_at, status: v.status, receiptStatus: v.receipt_status,
    };
  }
  function detail(v) {
    return {
      ...listItem(v), idNumber: formatId(v.id_type, v.id_number), nationality: v.nationality,
      phone: v.phone, policyVersion: v.policy_version, acknowledgedAt: v.acknowledged_at,
      receiptDetail: v.receipt_detail, createdAt: v.created_at,
    };
  }

  // ── router ──────────────────────────────────────────────────────────────────
  async function route(method, path, body, query) {
    // public
    if (method === 'GET' && path === '/api/config') return json({ ...SCHOOL, categories: CATEGORIES });
    if (method === 'GET' && path === '/api/health') return json({ ok: true });
    if (method === 'GET' && path === '/api/policy') {
      const p = activePolicy();
      return json({ policy: { id: p.id, version: p.version, title: p.title, body: p.body } });
    }
    if (method === 'GET' && path === '/api/staff') {
      return json({ staff: activeStaff().map((s) => ({ id: s.id, name: s.name, department: s.department })) });
    }
    if (method === 'POST' && path === '/api/checkin') return checkin(body);
    if (method === 'POST' && path === '/api/checkout/lookup') {
      const v = findActive(body.idNumber);
      return v ? json({ visit: summary(v) }) : json({ error: 'No active visit found for that ID number.' }, 404);
    }
    if (method === 'POST' && path === '/api/checkout/confirm') return checkoutConfirm(body);

    // auth
    if (method === 'POST' && path === '/api/auth/login') {
      if (body.email === 'admin@example.com' && body.password === 'changeme123') {
        state.admin = true; save();
        return json({ admin: { id: 1, name: 'Reception Admin', email: 'admin@example.com' } });
      }
      return json({ error: 'Invalid email or password.' }, 401);
    }
    if (method === 'POST' && path === '/api/auth/logout') { state.admin = false; save(); return json({ ok: true }); }
    if (method === 'GET' && path === '/api/auth/me') {
      return state.admin ? json({ admin: { id: 1, name: 'Reception Admin', email: 'admin@example.com' } }) : json({ error: 'Not authenticated.' }, 401);
    }

    // admin (gated)
    if (path.startsWith('/api/admin/')) {
      if (!state.admin) return json({ error: 'Not authenticated.' }, 401);
      return adminRoute(method, path, body, query);
    }
    return json({ error: 'Not found (demo).' }, 404);
  }

  function checkin(b) {
    const errors = {};
    const name = String(b.visitorName || '').trim();
    if (!name) errors.visitorName = 'Please enter your full name.';
    const email = String(b.email || '').trim();
    if (!email) errors.email = 'Please enter your email.';
    else if (!isEmail(email)) errors.email = 'Please enter a valid email.';
    const type = b.idType === 'passport' ? 'passport' : 'emirates_id';
    let idNumber;
    if (type === 'emirates_id') {
      idNumber = normEid(b.idNumber);
      if (idNumber.length !== 15) errors.idNumber = `Emirates ID must be 15 digits (you entered ${idNumber.length}).`;
      else if (!idNumber.startsWith('784')) errors.idNumber = 'Emirates ID must start with 784.';
    } else {
      idNumber = normPassport(b.idNumber);
      if (idNumber.length < 5 || idNumber.length > 15) errors.idNumber = 'Passport number must be 5–15 letters and digits.';
      if (!String(b.nationality || '').trim()) errors.nationality = 'Nationality is required when using a passport.';
    }
    const host = activeStaff().find((s) => s.id === Number(b.hostStaffId));
    if (!host) errors.hostStaffId = 'Please choose who you are here to see.';
    const category = String(b.visitorCategory || '');
    if (!CATEGORY_VALUES.has(category)) errors.visitorCategory = 'Please select the type of visit.';
    if (b.acknowledged !== true) errors.acknowledged = 'You must acknowledge the safeguarding policy to continue.';
    const policy = activePolicy();
    if (Number(b.policyVersion) !== policy.version) errors.policyVersion = 'The safeguarding policy has been updated. Please review it again.';
    if (Object.keys(errors).length) return json({ error: 'Please correct the highlighted fields.', errors }, 400);

    const open = findActive(idNumber);
    if (open) return json({ error: 'This visitor is already checked in. Please sign out before checking in again.', visit: summary(open) }, 409);

    const now = new Date().toISOString();
    const v = {
      id: state.nextVisitId++, visitor_name: name, id_type: type, id_number: idNumber,
      nationality: String(b.nationality || '').trim() || null, visitor_category: category, email: email.toLowerCase(),
      phone: String(b.phone || '').trim() || null, host_staff_id: host.id, host_name: host.name,
      host_department: host.department, purpose: String(b.purpose || '').trim() || null,
      policy_id: policy.id, policy_version: policy.version, acknowledged_at: now, check_in_at: now,
      check_out_at: null, status: 'checked_in', receipt_status: 'preview', receipt_detail: '(demo email)', created_at: now,
    };
    state.visits.push(v); save();
    return json({ visit: { ...summary(v), receiptStatus: 'preview' }, message: 'You are checked in. A copy of your form has been sent to your email.' }, 201);
  }

  function checkoutConfirm(b) {
    const v = findActive(b.idNumber);
    if (!v) return json({ error: 'No active visit found for that ID number.' }, 404);
    v.status = 'checked_out'; v.check_out_at = new Date().toISOString(); save();
    return json({ visit: summary(v), message: 'You have signed out. Thank you for visiting.' });
  }

  function adminRoute(method, path, body, query) {
    if (method === 'GET' && path === '/api/admin/stats') {
      const today = new Date().toISOString().slice(0, 10);
      const weekAgo = nowMinus(60 * 24 * 7);
      return json({ stats: {
        onSite: state.visits.filter((v) => v.status === 'checked_in').length,
        today: state.visits.filter((v) => (v.check_in_at || '').slice(0, 10) === today).length,
        week: state.visits.filter((v) => v.check_in_at >= weekAgo).length,
      } });
    }
    if (method === 'GET' && path === '/api/admin/visits/current') {
      return json({ visits: state.visits.filter((v) => v.status === 'checked_in').sort((a, b) => b.check_in_at.localeCompare(a.check_in_at)).map(listItem) });
    }
    if (method === 'GET' && path === '/api/admin/visits') {
      let rows = state.visits.slice();
      if (query.get('status')) rows = rows.filter((v) => v.status === query.get('status'));
      if (query.get('q')) {
        const q = query.get('q').toLowerCase();
        rows = rows.filter((v) => [v.visitor_name, v.host_name, v.email, v.id_number].some((x) => String(x || '').toLowerCase().includes(q)));
      }
      if (query.get('from')) rows = rows.filter((v) => v.check_in_at >= query.get('from'));
      if (query.get('to')) rows = rows.filter((v) => v.check_in_at <= query.get('to'));
      rows.sort((a, b) => b.check_in_at.localeCompare(a.check_in_at));
      return json({ visits: rows.map(listItem), total: rows.length, limit: 100, offset: 0 });
    }
    let m;
    if (method === 'GET' && (m = path.match(/^\/api\/admin\/visits\/(\d+)$/))) {
      const v = state.visits.find((x) => x.id === Number(m[1]));
      return v ? json({ visit: detail(v) }) : json({ error: 'Visit not found.' }, 404);
    }
    if (method === 'POST' && (m = path.match(/^\/api\/admin\/visits\/(\d+)\/checkout$/))) {
      const v = state.visits.find((x) => x.id === Number(m[1]) && x.status === 'checked_in');
      if (!v) return json({ error: 'Visit not found or already signed out.' }, 409);
      v.status = 'checked_out'; v.check_out_at = new Date().toISOString(); save();
      return json({ visit: detail(v) });
    }
    if (method === 'POST' && (m = path.match(/^\/api\/admin\/visits\/(\d+)\/resend-receipt$/))) {
      return json({ receiptStatus: 'preview', detail: '(demo) email regenerated' });
    }
    if (method === 'GET' && path === '/api/admin/staff') {
      return json({ staff: state.staff.slice().sort((a, b) => (b.active - a.active) || a.name.localeCompare(b.name)) });
    }
    if (method === 'POST' && path === '/api/admin/staff') {
      if (!String(body.name || '').trim()) return json({ error: 'Please correct the highlighted fields.', errors: { name: 'Name is required.' } }, 400);
      const s = { id: state.nextStaffId++, name: body.name.trim(), email: body.email || null, department: body.department || null, active: 1, created_at: new Date().toISOString() };
      state.staff.push(s); save();
      return json({ staff: s }, 201);
    }
    if (method === 'PUT' && (m = path.match(/^\/api\/admin\/staff\/(\d+)$/))) {
      const s = state.staff.find((x) => x.id === Number(m[1]));
      if (!s) return json({ error: 'Staff member not found.' }, 404);
      if (!String(body.name || '').trim()) return json({ error: 'Please correct the highlighted fields.', errors: { name: 'Name is required.' } }, 400);
      s.name = body.name.trim(); s.email = body.email || null; s.department = body.department || null;
      if (body.active !== undefined) s.active = body.active ? 1 : 0;
      save();
      return json({ staff: s });
    }
    if (method === 'DELETE' && (m = path.match(/^\/api\/admin\/staff\/(\d+)$/))) {
      const i = state.staff.findIndex((x) => x.id === Number(m[1]));
      if (i < 0) return json({ error: 'Staff member not found.' }, 404);
      state.staff.splice(i, 1); save();
      return json({ ok: true });
    }
    if (method === 'GET' && path === '/api/admin/policies') {
      return json({
        policies: state.policies.slice().sort((a, b) => b.version - a.version).map((p) => ({ id: p.id, version: p.version, title: p.title, active: p.active, created_at: p.created_at })),
        active: activePolicy(),
      });
    }
    if (method === 'POST' && path === '/api/admin/policies') {
      if (!String(body.title || '').trim() || !String(body.body || '').trim()) return json({ error: 'A policy title and body are both required.' }, 400);
      const version = Math.max(...state.policies.map((p) => p.version)) + 1;
      state.policies.forEach((p) => (p.active = 0));
      const p = { id: state.policies.length + 1, version, title: body.title.trim(), body: body.body.trim(), active: 1, created_at: new Date().toISOString() };
      state.policies.push(p); save();
      return json({ policy: p }, 201);
    }
    if (method === 'POST' && path === '/api/admin/maintenance/purge') {
      const days = Number(body.days) || 365;
      const cutoff = nowMinus(60 * 24 * days);
      const before = state.visits.length;
      state.visits = state.visits.filter((v) => v.check_in_at >= cutoff);
      save();
      return json({ removed: before - state.visits.length, retainedDays: days });
    }
    return json({ error: 'Not found (demo).' }, 404);
  }

  // ── fetch interception ──────────────────────────────────────────────────────
  window.fetch = async function (input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    if (!url || !url.includes('/api/')) return realFetch(input, init);
    const u = new URL(url, window.location.origin);
    const method = (init.method || 'GET').toUpperCase();
    let body = {};
    if (init.body) { try { body = JSON.parse(init.body); } catch { body = {}; } }
    try { return await route(method, u.pathname.replace(/^.*?(\/api\/)/, '/api/'), body, u.searchParams); }
    catch (e) { return json({ error: 'Demo error: ' + e.message }, 500); }
  };

  // ── demo niceties: CSV download + reset link ─────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const reset = document.getElementById('demo-reset');
    if (reset) reset.addEventListener('click', (e) => { e.preventDefault(); localStorage.removeItem(LS_KEY); location.reload(); });

    const csv = document.getElementById('h-csv');
    if (csv) {
      // Capture-phase handler runs before admin.js's (which navigates to /api/...).
      csv.addEventListener('click', (e) => {
        e.preventDefault(); e.stopImmediatePropagation();
        const headers = ['id', 'visitor_name', 'visitor_category', 'id_type', 'id_number', 'nationality', 'email', 'phone', 'host', 'host_department', 'purpose', 'check_in_at', 'check_out_at', 'status', 'policy_version', 'acknowledged_at', 'receipt_status'];
        const cell = (val) => { const s = val == null ? '' : String(val); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
        const lines = [headers.join(',')];
        state.visits.forEach((v) => lines.push([v.id, v.visitor_name, categoryLabel(v.visitor_category), v.id_type, formatId(v.id_type, v.id_number), v.nationality, v.email, v.phone, v.host_name, v.host_department, v.purpose, v.check_in_at, v.check_out_at, v.status, v.policy_version, v.acknowledged_at, v.receipt_status].map(cell).join(',')));
        const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `visitor-log-demo-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
      }, true);
    }
  });
})();
