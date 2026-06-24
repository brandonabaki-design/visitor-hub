// Unified visitor identity handling: Emirates ID (the default/primary path) or
// Passport (fallback for overseas parents, inspectors, tourists and other
// non-residents who do not hold an Emirates ID).

import {
  validateEmiratesId,
  normalizeEmiratesId,
  formatEmiratesId,
  maskEmiratesId,
} from './emiratesId.js';

export const ID_TYPES = ['emirates_id', 'passport'];

export function normalizePassport(value) {
  return String(value ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

export function validatePassport(value) {
  const normalized = normalizePassport(value);
  if (!normalized) {
    return { valid: false, normalized, error: 'Passport number is required.' };
  }
  if (normalized.length < 5 || normalized.length > 15) {
    return { valid: false, normalized, error: 'Passport number must be 5–15 letters and digits.' };
  }
  return { valid: true, normalized };
}

/**
 * Validate a visitor's identity.
 * @param {{ idType?, idNumber?, nationality? }} input
 * @returns {{ valid, error?, field?, normalized: { idType, idNumber, nationality } }}
 */
export function validateIdentity({ idType, idNumber, nationality } = {}) {
  const type = ID_TYPES.includes(idType) ? idType : 'emirates_id';
  const nat = nationality == null ? '' : String(nationality).trim();

  if (type === 'emirates_id') {
    const r = validateEmiratesId(idNumber);
    return {
      valid: r.valid,
      error: r.error,
      field: 'idNumber',
      normalized: { idType: 'emirates_id', idNumber: r.normalized, nationality: nat || null },
    };
  }

  const r = validatePassport(idNumber);
  if (!r.valid) {
    return {
      valid: false,
      error: r.error,
      field: 'idNumber',
      normalized: { idType: 'passport', idNumber: r.normalized, nationality: nat || null },
    };
  }
  if (!nat) {
    return {
      valid: false,
      error: 'Nationality is required when using a passport.',
      field: 'nationality',
      normalized: { idType: 'passport', idNumber: r.normalized, nationality: null },
    };
  }
  return {
    valid: true,
    normalized: { idType: 'passport', idNumber: r.normalized, nationality: nat },
  };
}

/**
 * Normalise a raw ID typed at check-out so it matches the stored id_number,
 * without the visitor having to re-select their document type. An Emirates ID
 * is detected by its 15-digit, 784-prefixed shape; anything else is treated as
 * a passport. (All-digit inputs normalise identically under both rules.)
 */
export function normalizeForLookup(value) {
  const digits = normalizeEmiratesId(value);
  if (digits.length === 15 && digits.startsWith('784')) return digits;
  return normalizePassport(value);
}

export function idLabel(idType) {
  return idType === 'passport' ? 'Passport' : 'Emirates ID';
}

export function formatIdNumber(idType, value) {
  return idType === 'passport' ? normalizePassport(value) : formatEmiratesId(value);
}

export function maskIdNumber(idType, value) {
  if (idType === 'passport') {
    const p = normalizePassport(value);
    if (p.length <= 4) return '••••';
    return `${p.slice(0, 2)}••••${p.slice(-2)}`;
  }
  return maskEmiratesId(value);
}
