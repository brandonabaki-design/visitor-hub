import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDb } from '../db/index.js';
import config from '../config.js';

export const SESSION_COOKIE = 'vh_session';

export function getAdminByEmail(email, db = getDb()) {
  return db.prepare('SELECT * FROM admins WHERE email = ? COLLATE NOCASE').get(email);
}

export function getAdminById(id, db = getDb()) {
  return db.prepare('SELECT id, name, email, created_at FROM admins WHERE id = ?').get(id);
}

/** Verify credentials. Returns the admin row (sans hash) or null. */
export function verifyCredentials(email, password, db = getDb()) {
  const admin = getAdminByEmail(email, db);
  if (!admin) return null;
  if (!bcrypt.compareSync(password || '', admin.password_hash)) return null;
  return { id: admin.id, name: admin.name, email: admin.email };
}

export function issueToken(admin) {
  return jwt.sign(
    { sub: admin.id, name: admin.name, email: admin.email },
    config.sessionSecret,
    { expiresIn: `${config.sessionTtlHours}h` },
  );
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, config.sessionSecret);
  } catch {
    return null;
  }
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.env === 'production',
    maxAge: config.sessionTtlHours * 60 * 60 * 1000,
    path: '/',
  };
}
