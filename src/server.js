import { createApp } from './app.js';
import { getDb } from './db/index.js';
import { ensureSeed } from './db/seed.js';
import { purgeOlderThan } from './services/visits.js';
import config from './config.js';

// Fail fast on insecure production configuration.
if (config.env === 'production') {
  if (!process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be set to a strong, random value in production.');
  }
  if (!process.env.ADMIN_PASSWORD) {
    console.warn('[security] ADMIN_PASSWORD is not set — the default password is in use. Set ADMIN_PASSWORD before going live.');
  }
}

// Initialise database + seed before accepting traffic.
getDb();
const seed = ensureSeed();
if (seed.adminCreated) {
  console.log(`[seed] Created initial admin: ${config.admin.email}`);
}

// Lightweight automated retention purge: run on boot and once a day.
function runPurge() {
  if (config.retentionDays > 0) {
    const removed = purgeOlderThan(config.retentionDays);
    if (removed > 0) console.log(`[retention] Purged ${removed} visit(s) older than ${config.retentionDays} days.`);
  }
}
runPurge();
setInterval(runPurge, 24 * 60 * 60 * 1000).unref();

const app = createApp();
const server = app.listen(config.port, config.host, () => {
  console.log(`\n  ${config.school.name} — Visitor Hub`);
  console.log(`  Kiosk:     http://localhost:${config.port}/`);
  console.log(`  Admin:     http://localhost:${config.port}/admin/`);
  console.log(`  Email:     ${config.email.transport === 'smtp' ? 'SMTP' : 'preview (./sent-emails)'}\n`);
});

function shutdown(signal) {
  console.log(`\n${signal} received, shutting down…`);
  server.close(() => process.exit(0));
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export default server;
