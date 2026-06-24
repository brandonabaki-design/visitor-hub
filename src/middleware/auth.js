import { SESSION_COOKIE, verifyToken, getAdminById } from '../services/auth.js';

/** Reject unauthenticated requests to admin API routes. */
export function requireAdmin(req, res, next) {
  const token = req.cookies?.[SESSION_COOKIE];
  const payload = token && verifyToken(token);
  // Verify the token is valid AND the admin still exists — so a forged or
  // stale token for a deleted account cannot reach protected routes.
  const admin = payload && getAdminById(payload.sub);
  if (!payload || !admin) {
    return res.status(401).json({ error: 'Not authenticated.' });
  }
  req.admin = { id: admin.id, name: admin.name, email: admin.email };
  next();
}

export default requireAdmin;
