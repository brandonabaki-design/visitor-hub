import { getDb } from '../db/index.js';
import { normalizeForLookup } from '../util/identity.js';

const SELECT = `
  SELECT v.*, s.department AS host_department
  FROM visits v
  LEFT JOIN staff s ON s.id = v.host_staff_id
`;

export function getVisit(id, db = getDb()) {
  return db.prepare(`${SELECT} WHERE v.id = ?`).get(id);
}

/** The visitor's open (not yet checked-out) visit for a given ID number. */
export function findActiveByIdNumber(idNumber, db = getDb()) {
  const normalized = normalizeForLookup(idNumber);
  return db
    .prepare(`${SELECT} WHERE v.id_number = ? AND v.status = 'checked_in' ORDER BY v.check_in_at DESC LIMIT 1`)
    .get(normalized);
}

/**
 * Record a check-in. Expects already-validated inputs:
 *   { visitorName, idType, idNumber (normalised), nationality?, email, phone?,
 *     host (staff row), purpose?, policy (row) }
 * Throws { code: 'ALREADY_CHECKED_IN' } if the visitor still has an open visit.
 */
export function checkIn(input, db = getDb()) {
  const open = findActiveByIdNumber(input.idNumber, db);
  if (open) {
    const err = new Error('This visitor is already checked in.');
    err.code = 'ALREADY_CHECKED_IN';
    err.visit = open;
    throw err;
  }

  const now = new Date().toISOString();
  const info = db
    .prepare(
      `INSERT INTO visits
        (visitor_name, id_type, id_number, nationality, email, phone, host_staff_id,
         host_name, visitor_category, purpose, policy_id, policy_version, acknowledged_at, check_in_at, status)
       VALUES
        (@visitor_name, @id_type, @id_number, @nationality, @email, @phone, @host_staff_id,
         @host_name, @visitor_category, @purpose, @policy_id, @policy_version, @acknowledged_at, @check_in_at, 'checked_in')`,
    )
    .run({
      visitor_name: input.visitorName,
      id_type: input.idType,
      id_number: input.idNumber,
      nationality: input.nationality || null,
      email: input.email,
      phone: input.phone || null,
      host_staff_id: input.host.id,
      host_name: input.host.name,
      visitor_category: input.visitorCategory || null,
      purpose: input.purpose || null,
      policy_id: input.policy.id,
      policy_version: input.policy.version,
      acknowledged_at: now,
      check_in_at: now,
    });

  return getVisit(info.lastInsertRowid, db);
}

/** Mark a visit checked out. Returns the updated visit, or null if not found/already out. */
export function checkOut(id, db = getDb()) {
  const now = new Date().toISOString();
  const info = db
    .prepare(`UPDATE visits SET status = 'checked_out', check_out_at = ? WHERE id = ? AND status = 'checked_in'`)
    .run(now, id);
  if (info.changes === 0) return null;
  return getVisit(id, db);
}

export function updateReceiptStatus(id, status, detail, db = getDb()) {
  db.prepare('UPDATE visits SET receipt_status = ?, receipt_detail = ? WHERE id = ?').run(
    status,
    detail || null,
    id,
  );
}

/** All currently checked-in visitors, newest first. */
export function listCurrent(db = getDb()) {
  return db.prepare(`${SELECT} WHERE v.status = 'checked_in' ORDER BY v.check_in_at DESC`).all();
}

/**
 * Filtered visit history.
 * @param {{ status?, q?, from?, to?, limit?, offset? }} opts
 */
export function listHistory(opts = {}, db = getDb()) {
  const where = [];
  const params = {};

  if (opts.status === 'checked_in' || opts.status === 'checked_out') {
    where.push('v.status = @status');
    params.status = opts.status;
  }
  if (opts.q) {
    where.push('(v.visitor_name LIKE @q OR v.host_name LIKE @q OR v.email LIKE @q OR v.id_number LIKE @q)');
    params.q = `%${opts.q}%`;
  }
  if (opts.from) {
    where.push('v.check_in_at >= @from');
    params.from = opts.from;
  }
  if (opts.to) {
    where.push('v.check_in_at <= @to');
    params.to = opts.to;
  }

  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const limit = Math.min(Math.max(Number(opts.limit) || 100, 1), 1000);
  const offset = Math.max(Number(opts.offset) || 0, 0);

  const rows = db
    .prepare(`${SELECT} ${clause} ORDER BY v.check_in_at DESC LIMIT ${limit} OFFSET ${offset}`)
    .all(params);
  const total = db.prepare(`SELECT COUNT(*) AS n FROM visits v ${clause}`).get(params).n;

  return { rows, total, limit, offset };
}

/** Headline numbers for the dashboard. */
export function stats(db = getDb()) {
  const onSite = db.prepare(`SELECT COUNT(*) AS n FROM visits WHERE status = 'checked_in'`).get().n;
  const today = db
    .prepare(`SELECT COUNT(*) AS n FROM visits WHERE date(check_in_at) = date('now')`)
    .get().n;
  const week = db
    .prepare(`SELECT COUNT(*) AS n FROM visits WHERE check_in_at >= datetime('now', '-7 days')`)
    .get().n;
  return { onSite, today, week };
}

/** Delete visits whose check-in is older than `days` days. Returns count removed. */
export function purgeOlderThan(days, db = getDb()) {
  if (!days || days <= 0) return 0;
  const info = db
    .prepare(`DELETE FROM visits WHERE check_in_at < datetime('now', ?)`)
    .run(`-${Math.floor(days)} days`);
  return info.changes;
}
