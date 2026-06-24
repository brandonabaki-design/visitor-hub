import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function resolvePath(p, fallback) {
  const value = p && p.trim() ? p : fallback;
  return path.isAbsolute(value) ? value : path.resolve(projectRoot, value);
}

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function int(value, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

const env = process.env.NODE_ENV || 'development';

export const config = {
  env,
  isTest: env === 'test',
  port: int(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',

  school: {
    name: process.env.SCHOOL_NAME || 'Our School',
    logoUrl: process.env.SCHOOL_LOGO_URL || '',
    supportEmail: process.env.SUPPORT_EMAIL || 'reception@example.com',
  },

  databasePath: resolvePath(process.env.DATABASE_PATH, './data/visitor-hub.db'),
  sessionSecret: process.env.SESSION_SECRET || 'dev-insecure-secret-change-me',
  sessionTtlHours: int(process.env.SESSION_TTL_HOURS, 12),

  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@example.com',
    password: process.env.ADMIN_PASSWORD || 'changeme123',
    name: process.env.ADMIN_NAME || 'Reception Admin',
  },

  email: {
    transport: (process.env.EMAIL_TRANSPORT || 'preview').toLowerCase(),
    from: process.env.EMAIL_FROM || 'Visitor Hub <no-reply@example.com>',
    previewDir: resolvePath(process.env.EMAIL_PREVIEW_DIR, './sent-emails'),
    smtp: {
      host: process.env.SMTP_HOST || '',
      port: int(process.env.SMTP_PORT, 587),
      secure: bool(process.env.SMTP_SECURE, false),
      user: process.env.SMTP_USER || '',
      pass: process.env.SMTP_PASS || '',
    },
  },

  retentionDays: int(process.env.RETENTION_DAYS, 365),
};

export default config;
