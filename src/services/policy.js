import { getDb } from '../db/index.js';

/** The currently active safeguarding policy shown at check-in. */
export function getActivePolicy(db = getDb()) {
  return db.prepare('SELECT * FROM policies WHERE active = 1 ORDER BY version DESC LIMIT 1').get();
}

export function getPolicy(id, db = getDb()) {
  return db.prepare('SELECT * FROM policies WHERE id = ?').get(id);
}

export function listPolicies(db = getDb()) {
  return db.prepare('SELECT id, version, title, active, created_at FROM policies ORDER BY version DESC').all();
}

/**
 * Publish a new policy version. The new version becomes the single active
 * policy; all others are deactivated. Returns the new policy row.
 */
export function publishPolicy({ title, body }, db = getDb()) {
  const tx = db.transaction(() => {
    const maxVersion = db.prepare('SELECT COALESCE(MAX(version), 0) AS v FROM policies').get().v;
    const nextVersion = maxVersion + 1;
    db.prepare('UPDATE policies SET active = 0').run();
    const info = db
      .prepare('INSERT INTO policies (version, title, body, active) VALUES (?, ?, ?, 1)')
      .run(nextVersion, title, body);
    return getPolicy(info.lastInsertRowid, db);
  });
  return tx();
}
