// Emirates ID utilities.
//
// An Emirates ID is a 15-digit number, conventionally written as:
//     784-YYYY-NNNNNNN-N
//        │    │        └─ single check digit (Luhn over the first 14 digits)
//        │    └────────── 7-digit serial / random number
//        │  YYYY ──────── year of birth / issue block
//        └─ 784 ────────── ISO-3166 numeric country code for the UAE
//
// The leading "784" and the 15-digit length are mandatory. The final digit is
// a Luhn checksum; we compute and report it but do not, by default, reject an
// otherwise well-formed number on the checksum alone (so reception is never
// blocked by an edge case). Callers can opt into strict checksum enforcement.

const PREFIX = '784';
const LENGTH = 15;

/** Strip everything except digits. */
export function normalizeEmiratesId(value) {
  return String(value ?? '').replace(/\D/g, '');
}

/** Standard Luhn checksum validation over the full 15-digit string. */
export function luhnValid(digits) {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/**
 * Validate an Emirates ID.
 * @returns {{ valid: boolean, normalized: string, checksumValid: boolean, error?: string }}
 */
export function validateEmiratesId(value, { requireChecksum = false } = {}) {
  const normalized = normalizeEmiratesId(value);

  if (normalized.length === 0) {
    return { valid: false, normalized, checksumValid: false, error: 'Emirates ID is required.' };
  }
  if (!/^\d+$/.test(normalized)) {
    return { valid: false, normalized, checksumValid: false, error: 'Emirates ID must contain digits only.' };
  }
  if (normalized.length !== LENGTH) {
    return {
      valid: false,
      normalized,
      checksumValid: false,
      error: `Emirates ID must be ${LENGTH} digits (you entered ${normalized.length}).`,
    };
  }
  if (!normalized.startsWith(PREFIX)) {
    return {
      valid: false,
      normalized,
      checksumValid: false,
      error: `Emirates ID must start with ${PREFIX}.`,
    };
  }

  const checksumValid = luhnValid(normalized);
  if (requireChecksum && !checksumValid) {
    return {
      valid: false,
      normalized,
      checksumValid,
      error: 'Emirates ID checksum is invalid — please re-check the number.',
    };
  }

  return { valid: true, normalized, checksumValid };
}

/** Format normalised digits as 784-YYYY-NNNNNNN-N for display. */
export function formatEmiratesId(value) {
  const d = normalizeEmiratesId(value);
  if (d.length !== LENGTH) return d;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7, 14)}-${d.slice(14)}`;
}

/** Mask for list views: show only the final 2 digits (784 prefix is constant). */
export function maskEmiratesId(value) {
  const d = normalizeEmiratesId(value);
  if (d.length !== LENGTH) return '•••';
  return `784-••••-•••••••-${d.slice(-2)}`;
}

export default validateEmiratesId;
