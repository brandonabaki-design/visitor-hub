// Visitor categories collected at check-in (drives reporting and, later,
// badge colour / escort rules). Tailored for an ADEK school.

export const VISITOR_CATEGORIES = [
  { value: 'parent', label: 'Parent' },
  { value: 'contractor', label: 'Contractor' },
  { value: 'adek', label: 'ADEK' },
  { value: 'inspector', label: 'Inspector' },
  { value: 'other_school', label: 'Visitor from another school' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'other', label: 'Other' },
];

const VALUES = new Set(VISITOR_CATEGORIES.map((c) => c.value));

export function isValidCategory(value) {
  return VALUES.has(value);
}

export function categoryLabel(value) {
  const found = VISITOR_CATEGORIES.find((c) => c.value === value);
  return found ? found.label : value || '—';
}
