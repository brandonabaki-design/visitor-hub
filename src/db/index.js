import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import config from '../config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db;

/**
 * Open (and lazily initialise) the SQLite database. Subsequent calls return
 * the same connection. Pass an explicit path to open a separate database
 * (used by tests).
 */
export function getDb(databasePath = config.databasePath) {
  if (db) return db;

  const dir = path.dirname(databasePath);
  if (databasePath !== ':memory:') {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(databasePath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);
  migrate(db);

  return db;
}

/**
 * Forward-compatible column migrations. CREATE TABLE IF NOT EXISTS will not add
 * new columns to a pre-existing table, so add any missing ones here.
 */
function migrate(database) {
  const cols = database.prepare('PRAGMA table_info(visits)').all().map((c) => c.name);
  if (!cols.includes('visitor_category')) {
    database.exec('ALTER TABLE visits ADD COLUMN visitor_category TEXT');
  }
}

/** Close the active connection (used by tests for clean teardown). */
export function closeDb() {
  if (db) {
    db.close();
    db = undefined;
  }
}

export default getDb;
