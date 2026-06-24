import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateIdentity,
  normalizeForLookup,
  normalizePassport,
  maskIdNumber,
  idLabel,
} from '../src/util/identity.js';

test('validates an Emirates ID identity', () => {
  const r = validateIdentity({ idType: 'emirates_id', idNumber: '784-1985-1234567-1' });
  assert.equal(r.valid, true);
  assert.equal(r.normalized.idType, 'emirates_id');
  assert.equal(r.normalized.idNumber, '784198512345671');
});

test('defaults unknown id types to emirates_id', () => {
  const r = validateIdentity({ idType: 'banana', idNumber: '784-1985-1234567-1' });
  assert.equal(r.normalized.idType, 'emirates_id');
});

test('accepts a passport with nationality', () => {
  const r = validateIdentity({ idType: 'passport', idNumber: 'x123456', nationality: 'United Kingdom' });
  assert.equal(r.valid, true);
  assert.equal(r.normalized.idType, 'passport');
  assert.equal(r.normalized.idNumber, 'X123456'); // upper-cased
  assert.equal(r.normalized.nationality, 'United Kingdom');
});

test('requires nationality for a passport', () => {
  const r = validateIdentity({ idType: 'passport', idNumber: 'X123456' });
  assert.equal(r.valid, false);
  assert.equal(r.field, 'nationality');
});

test('rejects an implausibly short passport number', () => {
  const r = validateIdentity({ idType: 'passport', idNumber: 'X1', nationality: 'France' });
  assert.equal(r.valid, false);
  assert.equal(r.field, 'idNumber');
});

test('normalizeForLookup matches stored values regardless of formatting', () => {
  // Emirates ID typed with dashes/spaces normalises to the stored digit string.
  assert.equal(normalizeForLookup('784-1985-1234567-1'), '784198512345671');
  assert.equal(normalizeForLookup('784 1985 1234567 1'), '784198512345671');
  // Passport typed in any case normalises to the stored upper-cased form.
  assert.equal(normalizeForLookup('x12-3456'), normalizePassport('X123456'));
});

test('maskIdNumber masks both kinds of identifier', () => {
  assert.match(maskIdNumber('emirates_id', '784198512345671'), /^784-/);
  const p = maskIdNumber('passport', 'AB123456');
  assert.ok(p.includes('•'));
  assert.ok(!p.includes('1234'));
});

test('idLabel reflects the document type', () => {
  assert.equal(idLabel('emirates_id'), 'Emirates ID');
  assert.equal(idLabel('passport'), 'Passport');
});
