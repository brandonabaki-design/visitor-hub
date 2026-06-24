import { getDb } from '../db/index.js';

const publicCols = 'id, name, department';
const adminCols = 'id, name, email, department, active, created_at';

/** Staff a visitor can choose from (active only) — minimal fields for kiosk. */
export function listActiveStaff(db = getDb()) {
  return db
    .prepare(`SELECT ${publicCols} FROM staff WHERE active = 1 ORDER BY name COLLATE NOCASE`)
    .all();
}

/** Full staff list for the admin dashboard. */
export function listAllStaff(db = getDb()) {
  return db.prepare(`SELECT ${adminCols} FROM staff ORDER BY active DESC, name COLLATE NOCASE`).all();
}

export function getStaff(id, db = getDb()) {
  return db.prepare(`SELECT ${adminCols} FROM staff WHERE id = ?`).get(id);
}

export function getActiveStaff(id, db = getDb()) {
  return db.prepare(`SELECT ${adminCols} FROM staff WHERE id = ? AND active = 1`).get(id);
}

export function createStaff({ name, email, department }, db = getDb()) {
  const info = db
    .prepare('INSERT INTO staff (name, email, department) VALUES (?, ?, ?)')
    .run(name, email || null, department || null);
  return getStaff(info.lastInsertRowid, db);
}

export function updateStaff(id, { name, email, department, active }, db = getDb()) {
  const existing = getStaff(id, db);
  if (!existing) return null;
  db.prepare(
    `UPDATE staff SET name = ?, email = ?, department = ?, active = ? WHERE id = ?`,
  ).run(
    name ?? existing.name,
    email !== undefined ? email || null : existing.email,
    department !== undefined ? department || null : existing.department,
    active !== undefined ? (active ? 1 : 0) : existing.active,
    id,
  );
  return getStaff(id, db);
}

export function deleteStaff(id, db = getDb()) {
  return db.prepare('DELETE FROM staff WHERE id = ?').run(id).changes > 0;
}
