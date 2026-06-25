import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import config from '../config.js';
import { escapeHtml } from '../util/html.js';
import { formatIdNumber, idLabel } from '../util/identity.js';
import { categoryLabel } from '../util/categories.js';

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  const { smtp } = config.email;
  transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
  });
  return transporter;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  // Render in Gulf Standard Time for a UAE audience.
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Dubai',
    dateStyle: 'full',
    timeStyle: 'short',
  });
}

function layout({ title, intro, rowsHtml, policyHtml, footerNote }) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f4f6fb;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1f2937;">
  <div style="max-width:640px;margin:0 auto;padding:24px;">
    <div style="background:#0f766e;color:#fff;padding:20px 24px;border-radius:12px 12px 0 0;">
      <div style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;opacity:.85;">${escapeHtml(config.school.name)}</div>
      <h1 style="margin:6px 0 0;font-size:22px;">${escapeHtml(title)}</h1>
    </div>
    <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;">
      <p style="margin-top:0;">${intro}</p>
      <table style="width:100%;border-collapse:collapse;font-size:15px;">${rowsHtml}</table>
      ${policyHtml || ''}
      <p style="color:#6b7280;font-size:13px;margin-bottom:0;">${footerNote || ''}</p>
    </div>
    <div style="padding:16px 24px;color:#9ca3af;font-size:12px;text-align:center;">
      This is an automated message from ${escapeHtml(config.school.name)} Visitor Hub.${config.school.supportEmail
        ? ` For assistance contact <a style="color:#0f766e;" href="mailto:${escapeHtml(config.school.supportEmail)}">${escapeHtml(config.school.supportEmail)}</a>.`
        : ''}
    </div>
  </div>
</body>
</html>`;
}

function row(label, value) {
  return `<tr>
    <td style="padding:8px 0;color:#6b7280;width:42%;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;font-weight:600;">${escapeHtml(value)}</td>
  </tr>`;
}

/** Build the HTML body for the check-in receipt (the "copy of the form"). */
export function buildReceiptHtml(visit, policy) {
  const rowsHtml = [
    row('Visitor', visit.visitor_name),
    row(idLabel(visit.id_type), formatIdNumber(visit.id_type, visit.id_number)),
    visit.nationality ? row('Nationality', visit.nationality) : '',
    visit.visitor_category ? row('Visitor type', categoryLabel(visit.visitor_category)) : '',
    row('Email', visit.email),
    visit.phone ? row('Phone', visit.phone) : '',
    row('Visiting', visit.host_name),
    visit.purpose ? row('Purpose of visit', visit.purpose) : '',
    row('Checked in', fmtDateTime(visit.check_in_at)),
  ].join('');

  const policyHtml = `
    <div style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:16px;">
      <h2 style="font-size:16px;margin:0 0 8px;">${escapeHtml(policy.title)}</h2>
      <div style="font-size:14px;line-height:1.55;color:#374151;">${policy.body}</div>
      <p style="font-size:13px;color:#0f766e;margin-top:12px;">
        ✓ Acknowledged on ${escapeHtml(fmtDateTime(visit.acknowledged_at))} (policy v${escapeHtml(visit.policy_version)})
      </p>
    </div>`;

  return layout({
    title: 'Visit confirmation & safeguarding acknowledgment',
    intro: `Dear ${escapeHtml(visit.visitor_name)}, thank you for visiting. This email is your copy of the visitor form and the safeguarding policy you acknowledged on arrival.`,
    rowsHtml,
    policyHtml,
    footerNote: 'Please remember to sign out at reception before you leave the school.',
  });
}

export function buildCheckoutHtml(visit) {
  const rowsHtml = [
    row('Visitor', visit.visitor_name),
    row('Visiting', visit.host_name),
    row('Checked in', fmtDateTime(visit.check_in_at)),
    row('Checked out', fmtDateTime(visit.check_out_at)),
  ].join('');
  return layout({
    title: 'You have signed out',
    intro: `Dear ${escapeHtml(visit.visitor_name)}, you have successfully signed out. Thank you for visiting ${escapeHtml(config.school.name)}.`,
    rowsHtml,
    footerNote: 'We hope to see you again.',
  });
}

async function deliver({ to, subject, html }, tag) {
  // Preview transport: write the message to disk instead of sending. Files
  // contain PII, so they are owner-only (0600) and the dir is owner-only (0700).
  // Preview mode is for development; use EMAIL_TRANSPORT=smtp in production.
  if (config.email.transport !== 'smtp') {
    try {
      fs.mkdirSync(config.email.previewDir, { recursive: true, mode: 0o700 });
      const safe = String(to).replace(/[^a-z0-9@._-]/gi, '_');
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const file = path.join(config.email.previewDir, `${stamp}_${tag}_${safe}.html`);
      const header = `<!-- To: ${to} | Subject: ${subject} | ${new Date().toISOString()} -->\n`;
      fs.writeFileSync(file, header + html, { encoding: 'utf8', mode: 0o600 });
      return { status: 'preview', detail: file };
    } catch (err) {
      // Never let an email/preview failure crash a check-in or check-out.
      return { status: 'failed', detail: err.message };
    }
  }

  // Real SMTP send.
  try {
    const info = await getTransporter().sendMail({ from: config.email.from, to, subject, html });
    return { status: 'sent', detail: info.messageId || 'sent' };
  } catch (err) {
    return { status: 'failed', detail: err.message };
  }
}

export function sendCheckInReceipt(visit, policy) {
  return deliver(
    {
      to: visit.email,
      subject: `Visit confirmation — ${config.school.name}`,
      html: buildReceiptHtml(visit, policy),
    },
    'checkin',
  );
}

export function sendCheckOutNotice(visit) {
  return deliver(
    {
      to: visit.email,
      subject: `Signed out — ${config.school.name}`,
      html: buildCheckoutHtml(visit),
    },
    'checkout',
  );
}
