import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { listActiveStaff, getActiveStaff } from '../services/staff.js';
import { getActivePolicy } from '../services/policy.js';
import {
  checkIn,
  findActiveByIdNumber,
  checkOut,
  updateReceiptStatus,
} from '../services/visits.js';
import { sendCheckInReceipt, sendCheckOutNotice } from '../services/email.js';
import { validateIdentity, formatIdNumber, idLabel } from '../util/identity.js';
import { validateFields, str } from '../util/validation.js';

const router = Router();

// Generous limit: a single kiosk/tablet shares one IP across many visitors.
const kioskLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'The kiosk is receiving a lot of requests. Please try again in a moment.' },
});
router.use(kioskLimiter);

/** Public view of a visit, safe to return to the kiosk. */
function visitSummary(visit) {
  return {
    id: visit.id,
    visitorName: visit.visitor_name,
    hostName: visit.host_name,
    purpose: visit.purpose,
    idType: visit.id_type,
    idLabel: idLabel(visit.id_type),
    idNumber: formatIdNumber(visit.id_type, visit.id_number),
    checkInAt: visit.check_in_at,
    checkOutAt: visit.check_out_at,
    status: visit.status,
    receiptStatus: visit.receipt_status,
  };
}

// Active safeguarding policy to display at check-in.
router.get('/policy', (req, res) => {
  const policy = getActivePolicy();
  if (!policy) return res.status(503).json({ error: 'No safeguarding policy is configured.' });
  res.json({
    policy: { id: policy.id, version: policy.version, title: policy.title, body: policy.body },
  });
});

// Staff the visitor can choose to see.
router.get('/staff', (req, res) => {
  res.json({ staff: listActiveStaff() });
});

// Check in: create a visit, then email the visitor their copy of the form.
router.post('/checkin', async (req, res) => {
  const body = req.body || {};

  const { valid, errors, values } = validateFields(body, {
    visitorName: { label: 'Full name', required: true, max: 120 },
    email: { label: 'Email', required: true, max: 160, email: true },
    phone: { label: 'Phone', required: false, max: 40 },
    purpose: { label: 'Purpose of visit', required: false, max: 300 },
  });

  const identity = validateIdentity({
    idType: body.idType,
    idNumber: body.idNumber,
    nationality: body.nationality,
  });
  if (!identity.valid) errors[identity.field || 'idNumber'] = identity.error;

  const hostStaffId = Number(body.hostStaffId);
  const host = Number.isInteger(hostStaffId) ? getActiveStaff(hostStaffId) : null;
  if (!host) errors.hostStaffId = 'Please choose who you are here to see.';

  if (body.acknowledged !== true) {
    errors.acknowledged = 'You must acknowledge the safeguarding policy to continue.';
  }

  const policy = getActivePolicy();
  if (!policy) return res.status(503).json({ error: 'No safeguarding policy is configured.' });
  if (Number(body.policyVersion) !== policy.version) {
    errors.policyVersion = 'The safeguarding policy has been updated. Please review it again.';
  }

  if (!valid || Object.keys(errors).length) {
    return res.status(400).json({ error: 'Please correct the highlighted fields.', errors });
  }

  let visit;
  try {
    visit = checkIn({
      visitorName: values.visitorName,
      idType: identity.normalized.idType,
      idNumber: identity.normalized.idNumber,
      nationality: identity.normalized.nationality,
      email: values.email.toLowerCase(),
      phone: values.phone,
      purpose: values.purpose,
      host,
      policy,
    });
  } catch (err) {
    if (err.code === 'ALREADY_CHECKED_IN') {
      return res.status(409).json({
        error: 'This visitor is already checked in. Please sign out before checking in again.',
        visit: visitSummary(err.visit),
      });
    }
    throw err;
  }

  // Email the receipt (the "copy of the form"). Never fail the check-in if email fails.
  const result = await sendCheckInReceipt(visit, policy);
  updateReceiptStatus(visit.id, result.status, result.detail);

  res.status(201).json({
    visit: { ...visitSummary(visit), receiptStatus: result.status },
    message:
      result.status === 'failed'
        ? 'You are checked in, but we could not email your receipt. Please see reception.'
        : 'You are checked in. A copy of your form has been sent to your email.',
  });
});

// Check-out step 1: look up the open visit by Emirates ID / passport number.
router.post('/checkout/lookup', (req, res) => {
  const idNumber = str(req.body?.idNumber);
  if (!idNumber) return res.status(400).json({ error: 'Please enter your Emirates ID or passport number.' });

  const visit = findActiveByIdNumber(idNumber);
  if (!visit) {
    return res.status(404).json({ error: 'No active visit found for that ID number.' });
  }
  res.json({ visit: visitSummary(visit) });
});

// Check-out step 2: confirm and sign out.
router.post('/checkout/confirm', async (req, res) => {
  const idNumber = str(req.body?.idNumber);
  if (!idNumber) return res.status(400).json({ error: 'Please enter your Emirates ID or passport number.' });

  const active = findActiveByIdNumber(idNumber);
  if (!active) {
    return res.status(404).json({ error: 'No active visit found for that ID number.' });
  }

  const visit = checkOut(active.id);
  if (!visit) {
    return res.status(409).json({ error: 'That visit has already been signed out.' });
  }

  // Best-effort checkout email — does not affect the stored check-in receipt status.
  await sendCheckOutNotice(visit);

  res.json({ visit: visitSummary(visit), message: 'You have signed out. Thank you for visiting.' });
});

export default router;
