import bcrypt from 'bcryptjs';
import { getDb } from './index.js';
import { defaultPolicy } from './defaultPolicy.js';
import config from '../config.js';

const SAMPLE_STAFF = [
  { name: 'Ms. Sarah Khan', email: 'sarah.khan@example.com', department: 'Reception' },
  { name: 'Mr. Omar Haddad', email: 'omar.haddad@example.com', department: 'Principal’s Office' },
  { name: 'Ms. Aisha Rahman', email: 'aisha.rahman@example.com', department: 'Admissions' },
  { name: 'Mr. David Lee', email: 'david.lee@example.com', department: 'Primary School' },
  { name: 'Ms. Fatima Al Suwaidi', email: 'fatima.als@example.com', department: 'Safeguarding (DSL)' },
];

/**
 * Ensure the database has an initial admin, an active policy, and (optionally)
 * sample staff. Idempotent: only inserts what is missing.
 */
export function ensureSeed(db = getDb()) {
  const summary = { adminCreated: false, policyCreated: false, staffCreated: 0 };

  // 1. Initial admin (only if no admins exist at all).
  const adminCount = db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
  if (adminCount === 0) {
    const hash = bcrypt.hashSync(config.admin.password, 10);
    db.prepare('INSERT INTO admins (name, email, password_hash) VALUES (?, ?, ?)').run(
      config.admin.name,
      config.admin.email,
      hash,
    );
    summary.adminCreated = true;
  }

  // 2. Active safeguarding policy.
  const policyCount = db.prepare('SELECT COUNT(*) AS n FROM policies').get().n;
  if (policyCount === 0) {
    db.prepare(
      'INSERT INTO policies (version, title, body, active) VALUES (?, ?, ?, 1)',
    ).run(defaultPolicy.version, defaultPolicy.title, defaultPolicy.body);
    summary.policyCreated = true;
  }

  // 3. Sample staff (only on a completely empty staff table).
  const staffCount = db.prepare('SELECT COUNT(*) AS n FROM staff').get().n;
  if (staffCount === 0) {
    const insert = db.prepare(
      'INSERT INTO staff (name, email, department) VALUES (@name, @email, @department)',
    );
    const tx = db.transaction((rows) => rows.forEach((r) => insert.run(r)));
    tx(SAMPLE_STAFF);
    summary.staffCreated = SAMPLE_STAFF.length;
  }

  return summary;
}

// Allow running directly: `npm run seed`
if (import.meta.url === `file://${process.argv[1]}`) {
  const summary = ensureSeed();
  console.log('Seed complete:', summary);
  if (summary.adminCreated) {
    console.log(`Admin login -> ${config.admin.email} / (password from ADMIN_PASSWORD env)`);
  }
}

export default ensureSeed;
