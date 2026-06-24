import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import {
  listCurrent,
  listHistory,
  getVisit,
  checkOut,
  stats,
  purgeOlderThan,
  updateReceiptStatus,
} from '../services/visits.js';
import {
  listAllStaff,
  getStaff,
  createStaff,
  updateStaff,
  deleteStaff,
} from '../services/staff.js';
import { listPolicies, getActivePolicy, publishPolicy, getPolicy } from '../services/policy.js';
import { sendCheckInReceipt } from '../services/email.js';
import { idLabel, formatIdNumber, maskIdNumber } from '../util/identity.js';
import { validateFields, str } from '../util/validation.js';
import config from '../config.js';

const router = Router();
router.use(requireAdmin);

// ── Visit mappers ────────────────────────────────────────────────────────────
// List views mask the ID number (data minimisation); the single-visit detail
// and CSV export — explicit, authenticated actions — show the full number.
function listItem(v) {
  return {
    id: v.id,
    visitorName: v.visitor_name,
    idType: v.id_type,
    idLabel: idLabel(v.id_type),
    idNumberMasked: maskIdNumber(v.id_type, v.id_number),
    email: v.email,
    hostName: v.host_name,
    hostDepartment: v.host_department,
    purpose: v.purpose,
    checkInAt: v.check_in_at,
    checkOutAt: v.check_out_at,
    status: v.status,
    receiptStatus: v.receipt_status,
  };
}

function detail(v) {
  return {
    ...listItem(v),
    idNumber: formatIdNumber(v.id_type, v.id_number),
    nationality: v.nationality,
    phone: v.phone,
    policyVersion: v.policy_version,
    acknowledgedAt: v.acknowledged_at,
    receiptDetail: v.receipt_detail,
    createdAt: v.created_at,
  };
}

// ── Dashboard ────────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  res.json({ stats: stats() });
});

router.get('/visits/current', (req, res) => {
  res.json({ visits: listCurrent().map(listItem) });
});

router.get('/visits', (req, res) => {
  const { rows, total, limit, offset } = listHistory({
    status: req.query.status,
    q: str(req.query.q),
    from: str(req.query.from),
    to: str(req.query.to),
    limit: req.query.limit,
    offset: req.query.offset,
  });
  res.json({ visits: rows.map(listItem), total, limit, offset });
});

router.get('/visits.csv', (req, res) => {
  const { rows } = listHistory({
    status: req.query.status,
    q: str(req.query.q),
    from: str(req.query.from),
    to: str(req.query.to),
    limit: 1000,
  });
  const headers = [
    'id', 'visitor_name', 'id_type', 'id_number', 'nationality', 'email', 'phone',
    'host', 'host_department', 'purpose', 'check_in_at', 'check_out_at',
    'status', 'policy_version', 'acknowledged_at', 'receipt_status',
  ];
  const cell = (val) => {
    const s = val == null ? '' : String(val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const v of rows) {
    lines.push([
      v.id, v.visitor_name, v.id_type, formatIdNumber(v.id_type, v.id_number), v.nationality,
      v.email, v.phone, v.host_name, v.host_department, v.purpose, v.check_in_at,
      v.check_out_at, v.status, v.policy_version, v.acknowledged_at, v.receipt_status,
    ].map(cell).join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="visitor-log-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(lines.join('\n'));
});

router.get('/visits/:id', (req, res) => {
  const visit = getVisit(Number(req.params.id));
  if (!visit) return res.status(404).json({ error: 'Visit not found.' });
  res.json({ visit: detail(visit) });
});

// Admin override: sign a visitor out manually.
router.post('/visits/:id/checkout', (req, res) => {
  const visit = checkOut(Number(req.params.id));
  if (!visit) return res.status(409).json({ error: 'Visit not found or already signed out.' });
  res.json({ visit: detail(visit) });
});

// Re-send the check-in receipt email.
router.post('/visits/:id/resend-receipt', async (req, res) => {
  const visit = getVisit(Number(req.params.id));
  if (!visit) return res.status(404).json({ error: 'Visit not found.' });
  const policy = getPolicy(visit.policy_id) || getActivePolicy();
  const result = await sendCheckInReceipt(visit, policy);
  updateReceiptStatus(visit.id, result.status, result.detail);
  res.json({ receiptStatus: result.status, detail: result.detail });
});

// ── Staff management ─────────────────────────────────────────────────────────
router.get('/staff', (req, res) => {
  res.json({ staff: listAllStaff() });
});

router.post('/staff', (req, res) => {
  const { valid, errors, values } = validateFields(req.body, {
    name: { label: 'Name', required: true, max: 120 },
    email: { label: 'Email', required: false, max: 160, email: true },
    department: { label: 'Department', required: false, max: 120 },
  });
  if (!valid) return res.status(400).json({ error: 'Please correct the highlighted fields.', errors });
  res.status(201).json({ staff: createStaff(values) });
});

router.put('/staff/:id', (req, res) => {
  const existing = getStaff(Number(req.params.id));
  if (!existing) return res.status(404).json({ error: 'Staff member not found.' });
  const { valid, errors, values } = validateFields(req.body, {
    name: { label: 'Name', required: true, max: 120 },
    email: { label: 'Email', required: false, max: 160, email: true },
    department: { label: 'Department', required: false, max: 120 },
  });
  if (!valid) return res.status(400).json({ error: 'Please correct the highlighted fields.', errors });
  const active = req.body.active === undefined ? existing.active : !!req.body.active;
  res.json({ staff: updateStaff(existing.id, { ...values, active }) });
});

router.delete('/staff/:id', (req, res) => {
  const ok = deleteStaff(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Staff member not found.' });
  res.json({ ok: true });
});

// ── Safeguarding policy ──────────────────────────────────────────────────────
router.get('/policies', (req, res) => {
  res.json({ policies: listPolicies(), active: getActivePolicy() });
});

router.post('/policies', (req, res) => {
  const title = str(req.body?.title);
  const body = typeof req.body?.body === 'string' ? req.body.body.trim() : '';
  if (!title || !body) {
    return res.status(400).json({ error: 'A policy title and body are both required.' });
  }
  res.status(201).json({ policy: publishPolicy({ title, body }) });
});

// ── Maintenance ──────────────────────────────────────────────────────────────
router.post('/maintenance/purge', (req, res) => {
  const days = Number(req.body?.days) || config.retentionDays;
  if (!days || days <= 0) {
    return res.status(400).json({ error: 'Provide a positive number of days to retain.' });
  }
  const removed = purgeOlderThan(days);
  res.json({ removed, retainedDays: days });
});

export default router;
