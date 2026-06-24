import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = path.join(os.tmpdir(), `vh-api-${process.pid}-${Date.now()}`);
process.env.DATABASE_PATH = tmp + '.db';
process.env.EMAIL_TRANSPORT = 'preview';
process.env.EMAIL_PREVIEW_DIR = tmp + '-emails';
process.env.NODE_ENV = 'test';
process.env.ADMIN_EMAIL = 'admin@example.com';
process.env.ADMIN_PASSWORD = 'changeme123';

const { createApp } = await import('../src/app.js');
const { getDb, closeDb } = await import('../src/db/index.js');
const { ensureSeed } = await import('../src/db/seed.js');

getDb();
ensureSeed();
const app = createApp();
const server = app.listen(0);
const base = `http://localhost:${server.address().port}`;

test.after(() => {
  server.close();
  closeDb();
  for (const ext of ['.db', '.db-wal', '.db-shm']) fs.rmSync(tmp + ext, { force: true });
  fs.rmSync(tmp + '-emails', { recursive: true, force: true });
});

async function req(method, pathname, { body, cookie } = {}) {
  const res = await fetch(base + pathname, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON (e.g. CSV) */ }
  return { status: res.status, data, setCookie: res.headers.get('set-cookie'), res };
}

test('public: lists staff and active policy', async () => {
  const staff = await req('GET', '/api/staff');
  assert.equal(staff.status, 200);
  assert.ok(staff.data.staff.length > 0);
  const policy = await req('GET', '/api/policy');
  assert.equal(policy.status, 200);
  assert.ok(policy.data.policy.version >= 1);
});

let hostId;
let policyVersion;

test('public: check-in validates input', async () => {
  const staff = await req('GET', '/api/staff');
  hostId = staff.data.staff[0].id;
  policyVersion = (await req('GET', '/api/policy')).data.policy.version;

  const bad = await req('POST', '/api/checkin', { body: { visitorName: '', idType: 'emirates_id', idNumber: '123', email: 'nope', hostStaffId: 99999, acknowledged: false, policyVersion } });
  assert.equal(bad.status, 400);
  assert.ok(bad.data.errors.visitorName);
  assert.ok(bad.data.errors.idNumber);
  assert.ok(bad.data.errors.email);
  assert.ok(bad.data.errors.hostStaffId);
  assert.ok(bad.data.errors.acknowledged);
});

test('public: full check-in then check-out lifecycle', async () => {
  const checkin = await req('POST', '/api/checkin', {
    body: {
      visitorName: 'Brandon Abaki', idType: 'emirates_id', idNumber: '784-1985-1234567-1',
      email: 'Brandon.Abaki@Example.com', phone: '0501234567', hostStaffId: hostId,
      purpose: 'Parent meeting', acknowledged: true, policyVersion,
    },
  });
  assert.equal(checkin.status, 201);
  assert.equal(checkin.data.visit.status, 'checked_in');
  assert.equal(checkin.data.visit.receiptStatus, 'preview');

  // Duplicate while still on site → 409.
  const dup = await req('POST', '/api/checkin', {
    body: { visitorName: 'Brandon Abaki', idType: 'emirates_id', idNumber: '784198512345671', email: 'b@x.com', hostStaffId: hostId, acknowledged: true, policyVersion },
  });
  assert.equal(dup.status, 409);

  // Lookup tolerates spaced formatting.
  const lookup = await req('POST', '/api/checkout/lookup', { body: { idNumber: '784 1985 1234567 1' } });
  assert.equal(lookup.status, 200);
  assert.equal(lookup.data.visit.visitorName, 'Brandon Abaki');

  const confirm = await req('POST', '/api/checkout/confirm', { body: { idNumber: '784198512345671' } });
  assert.equal(confirm.status, 200);
  assert.equal(confirm.data.visit.status, 'checked_out');

  // A receipt file was written by the preview transport.
  const files = fs.readdirSync(tmp + '-emails');
  assert.ok(files.some((f) => f.includes('checkin')));
});

test('admin: routes require authentication', async () => {
  const r = await req('GET', '/api/admin/stats');
  assert.equal(r.status, 401);
});

test('admin: login, stats, history masking, and CSV export', async () => {
  const badLogin = await req('POST', '/api/auth/login', { body: { email: 'admin@example.com', password: 'wrong' } });
  assert.equal(badLogin.status, 401);

  const login = await req('POST', '/api/auth/login', { body: { email: 'admin@example.com', password: 'changeme123' } });
  assert.equal(login.status, 200);
  const cookie = login.setCookie.split(';')[0];

  const stats = await req('GET', '/api/admin/stats', { cookie });
  assert.equal(stats.status, 200);
  assert.ok(stats.data.stats.today >= 1);

  const history = await req('GET', '/api/admin/visits', { cookie });
  assert.equal(history.status, 200);
  // List view masks the ID number and does not leak the raw value.
  const row = history.data.visits[0];
  assert.ok(row.idNumberMasked.includes('•'));
  assert.equal(row.idNumber, undefined);

  const csv = await fetch(base + '/api/admin/visits.csv', { headers: { Cookie: cookie } });
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get('content-type'), /text\/csv/);
  const text = await csv.text();
  assert.match(text, /visitor_name/);
  assert.match(text, /Brandon Abaki/);
});

test('admin: publishing a new policy version increments and activates it', async () => {
  const login = await req('POST', '/api/auth/login', { body: { email: 'admin@example.com', password: 'changeme123' } });
  const cookie = login.setCookie.split(';')[0];
  const before = (await req('GET', '/api/policy')).data.policy.version;
  const pub = await req('POST', '/api/admin/policies', { cookie, body: { title: 'Updated', body: '<p>New rules.</p>' } });
  assert.equal(pub.status, 201);
  assert.equal(pub.data.policy.version, before + 1);
  assert.equal((await req('GET', '/api/policy')).data.policy.version, before + 1);
});
