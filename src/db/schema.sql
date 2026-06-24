-- Visitor Hub database schema.
-- Applied idempotently on startup (CREATE TABLE IF NOT EXISTS).

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Administrators who can access the dashboard.
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Staff members a visitor can ask to see (the "host").
CREATE TABLE IF NOT EXISTS staff (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  email       TEXT,
  department  TEXT,
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Versioned safeguarding / child-protection policy text shown at check-in.
-- Exactly one row should have active = 1.
CREATE TABLE IF NOT EXISTS policies (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  version     INTEGER NOT NULL UNIQUE,
  title       TEXT    NOT NULL,
  body        TEXT    NOT NULL,
  active      INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Each visit: one row per check-in. check_out_at is NULL until the visitor
-- signs out on the way out.
CREATE TABLE IF NOT EXISTS visits (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  visitor_name        TEXT    NOT NULL,
  id_type             TEXT    NOT NULL DEFAULT 'emirates_id'
                              CHECK (id_type IN ('emirates_id', 'passport')),
  id_number           TEXT    NOT NULL,          -- normalised (EID: 15 digits; passport: A-Z0-9)
  nationality         TEXT,                       -- captured for passport visitors
  email               TEXT    NOT NULL,
  phone               TEXT,
  host_staff_id       INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  host_name           TEXT    NOT NULL,          -- snapshot of host name at check-in
  purpose             TEXT,
  policy_id           INTEGER REFERENCES policies(id) ON DELETE SET NULL,
  policy_version      INTEGER NOT NULL,
  acknowledged_at     TEXT    NOT NULL,
  check_in_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  check_out_at        TEXT,
  status              TEXT    NOT NULL DEFAULT 'checked_in'
                              CHECK (status IN ('checked_in', 'checked_out')),
  receipt_status      TEXT    NOT NULL DEFAULT 'pending'
                              CHECK (receipt_status IN ('pending', 'sent', 'failed', 'preview')),
  receipt_detail      TEXT,
  created_at          TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_visits_status    ON visits(status);
CREATE INDEX IF NOT EXISTS idx_visits_id_number ON visits(id_number);
CREATE INDEX IF NOT EXISTS idx_visits_check_in  ON visits(check_in_at);
