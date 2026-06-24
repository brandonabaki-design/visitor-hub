import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEmiratesId,
  normalizeEmiratesId,
  formatEmiratesId,
  maskEmiratesId,
  luhnValid,
} from '../src/util/emiratesId.js';

test('normalizeEmiratesId strips non-digits', () => {
  assert.equal(normalizeEmiratesId('784-1985-1234567-1'), '784198512345671');
  assert.equal(normalizeEmiratesId('784 1985 1234567 1'), '784198512345671');
  assert.equal(normalizeEmiratesId(null), '');
});

test('accepts a well-formed 15-digit 784 number (format-only by default)', () => {
  const r = validateEmiratesId('784-1985-1234567-1');
  assert.equal(r.valid, true);
  assert.equal(r.normalized, '784198512345671');
});

test('rejects wrong length with a count-aware message', () => {
  const r = validateEmiratesId('78419851');
  assert.equal(r.valid, false);
  assert.match(r.error, /15 digits/);
  assert.match(r.error, /you entered 8/);
});

test('rejects a number that does not start with 784', () => {
  const r = validateEmiratesId('123456789012345');
  assert.equal(r.valid, false);
  assert.match(r.error, /784/);
});

test('rejects empty and non-numeric input', () => {
  assert.equal(validateEmiratesId('').valid, false);
  assert.equal(validateEmiratesId('784ABCD').valid, false);
});

test('checksum is advisory by default but enforceable via requireChecksum', () => {
  const value = '784198512345671';
  const checksum = luhnValid(value);
  // Default: format passes regardless of checksum.
  assert.equal(validateEmiratesId(value).valid, true);
  // Strict: result must match the Luhn outcome.
  assert.equal(validateEmiratesId(value, { requireChecksum: true }).valid, checksum);
});

test('luhnValid agrees with a known-valid Luhn string', () => {
  assert.equal(luhnValid('79927398713'), true); // classic Luhn test vector
  assert.equal(luhnValid('79927398710'), false);
});

test('formatEmiratesId produces the dashed form', () => {
  assert.equal(formatEmiratesId('784198512345671'), '784-1985-1234567-1');
  assert.equal(formatEmiratesId('123'), '123'); // leaves malformed input untouched
});

test('maskEmiratesId hides the middle digits', () => {
  const masked = maskEmiratesId('784198512345671');
  assert.match(masked, /^784-/);
  assert.ok(!masked.includes('19851234'));
});
