import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  SESSION_COOKIE,
  verifyCredentials,
  issueToken,
  verifyToken,
  cookieOptions,
} from '../services/auth.js';
import { str } from '../util/validation.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait a few minutes and try again.' },
});

router.post('/login', loginLimiter, (req, res) => {
  const email = str(req.body?.email);
  const password = str(req.body?.password);
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }
  const admin = verifyCredentials(email, password);
  if (!admin) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }
  const token = issueToken(admin);
  res.cookie(SESSION_COOKIE, token, cookieOptions());
  res.json({ admin });
});

router.post('/logout', (req, res) => {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Not authenticated.' });
  res.json({ admin: { id: payload.sub, name: payload.name, email: payload.email } });
});

export default router;
