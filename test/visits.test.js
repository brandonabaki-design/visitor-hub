import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Isolate this test process onto its own temp database BEFORE importing modules
// that read config at import time.
const dbPath = path.join(os.tmpdir(), `vh-visits-${process.pid}-${Date.now()}.db`);
process.env.DATABASE_PATH = dbPath;
process.env.EMAIL_TRANSPORT = 'preview';
process.env.NODE_ENV = 'test';

const { getDb, closeDb } = await import('../src/db/index.js');
const { ensureSeed } = await import('../src/db/seed.js');
const { listActiveStaff } = await import('../src/services/staff.js');
const { getActivePolicy } = await import('../src/services/policy.js');
const visits = await import('../src/services/visits.js');

const db = getDb();
ensureSeed(db);
const host = listActiveStaff(db)[0];
const policy = getActivePolicy(db);

function baseInput(overrides = {}) {
  return {
    visitorName: 'Test Visitor',
    idType: 'emirates_id',
    idNumber: '784198512345671',
    nationality: null,
    email: 'visitor@example.com',
    host,
    policy,
    ...overrides,
  };
}

test.after(() => {
  closeDb();
  for (const ext of ['', '-wal', '-shm']) fs.rmSync(dbPath + ext, { force: true });
});

test('checkIn records a visit with snapshotted host and policy version', () => {
  const v = visits.checkIn(baseInput(), db);
  assert.equal(v.status, 'checked_in');
  assert.equal(v.host_name, host.name);
  assert.equal(v.policy_version, policy.version);
  assert.equal(v.id_number, '784198512345671');
  assert.ok(v.acknowledged_at);
});

test('findActiveByIdNumber matches regardless of formatting', () => {
  const found = visits.findActiveByIdNumber('784-1985-1234567-1', db);
  assert.ok(found);
  assert.equal(found.email, 'visitor@example.com');
});

test('duplicate check-in for an open visit throws ALREADY_CHECKED_IN', () => {
  assert.throws(() => visits.checkIn(baseInput(), db), (err) => err.code === 'ALREADY_CHECKED_IN');
});

test('a passport visitor can also check in and be found', () => {
  const v = visits.checkIn(baseInput({ idType: 'passport', idNumber: 'AB123456', nationality: 'France', email: 'p@example.com' }), db);
  assert.equal(v.id_type, 'passport');
  const found = visits.findActiveByIdNumber('ab-123456', db);
  assert.equal(found.id, v.id);
});

test('listCurrent and stats reflect open visits', () => {
  assert.equal(visits.listCurrent(db).length, 2);
  assert.ok(visits.stats(db).onSite === 2);
  assert.ok(visits.stats(db).today >= 2);
});

test('checkOut closes the visit and clears it from active lookups', () => {
  const open = visits.findActiveByIdNumber('784198512345671', db);
  const out = visits.checkOut(open.id, db);
  assert.equal(out.status, 'checked_out');
  assert.ok(out.check_out_at);
  assert.equal(visits.findActiveByIdNumber('784198512345671', db), undefined);
  // A second checkout is a no-op.
  assert.equal(visits.checkOut(open.id, db), null);
});

test('history search and filters work', () => {
  const all = visits.listHistory({}, db);
  assert.equal(all.total, 2);
  const onSite = visits.listHistory({ status: 'checked_in' }, db);
  assert.equal(onSite.rows.every((r) => r.status === 'checked_in'), true);
  const byName = visits.listHistory({ q: 'Test Visitor' }, db);
  assert.ok(byName.total >= 1);
});

test('purgeOlderThan only removes records past the window', () => {
  assert.equal(visits.purgeOlderThan(0, db), 0);
  assert.equal(visits.purgeOlderThan(365, db), 0); // nothing is that old yet
});
