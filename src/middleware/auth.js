import { SESSION_COOKIE, verifyToken } from '../services/auth.js';

/** Reject unauthenticated requests to admin API routes. */
export function requireAdmin(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  const payload = token && verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  req.admin = { id: payload.sub, name: payload.name, email: payload.email };
  next();
}

export default requireAdmin;
