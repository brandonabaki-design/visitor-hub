// Small hand-rolled validation helpers — no external schema dependency.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trim a value to a string, collapsing nullish to ''. */
export function str(value) {
  return typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();
}

export function isEmail(value) {
  return EMAIL_RE.test(str(value));
}

/**
 * Validate a field set against a tiny rule spec.
 * rules: { field: { label, required, max, email, custom } }
 * @returns {{ valid: boolean, errors: Record<string,string>, values: Record<string,string> }}
 */
export function validateFields(input, rules) {
  const errors = {};
  const values = {};

  for (const [field, rule] of Object.entries(rules)) {
    const label = rule.label || field;
    const value = str(input?.[field]);
    values[field] = value;

    if (rule.required && !value) {
      errors[field] = `${label} is required.`;
      continue;
    }
    if (!value && !rule.required) continue;

    if (rule.max && value.length > rule.max) {
      errors[field] = `${label} must be ${rule.max} characters or fewer.`;
      continue;
    }
    if (rule.email && !isEmail(value)) {
      errors[field] = `Please enter a valid ${label.toLowerCase()}.`;
      continue;
    }
    if (typeof rule.custom === 'function') {
      const msg = rule.custom(value, input);
      if (msg) {
        errors[field] = msg;
        continue;
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors, values };
}

export default validateFields;
