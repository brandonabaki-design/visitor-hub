import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import config from './config.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'self'"],
          // Only force HTTPS subresources in production — kiosks often run over
          // plain HTTP on a LAN, where this directive would break asset loading.
          upgradeInsecureRequests: config.env === 'production' ? [] : null,
        },
      },
    }),
  );
  app.use(express.json({ limit: '256kb' }));
  app.use(cookieParser());

  // Expose non-sensitive branding to the frontend.
  app.get('/api/health', (req, res) => res.json({ ok: true }));
  app.get('/api/config', (req, res) => {
    res.json({
      schoolName: config.school.name,
      logoUrl: config.school.logoUrl,
      supportEmail: config.school.supportEmail,
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api', publicRoutes);

  // Unknown API routes get JSON, not the SPA.
  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

  // Static frontend (kiosk at /, admin at /admin/).
  app.use(express.static(publicDir, { extensions: ['html'] }));

  // Centralised error handler.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[error]', err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Something went wrong. Please try again or see reception.' });
  });

  return app;
}

export default createApp;
