# Visitor Hub

A school **visitor management** web app, modelled on the reception-desk flow used
by UAE schools: a tablet at the front desk where visitors **check in**, read and
**acknowledge the child-protection / safeguarding policy**, receive a copy of
their form **by email**, and **check out** on their way out — backed by a full
server, database, and a staff/admin dashboard.

> Built around the real-world flow: *"I was stopped at reception and logged in on
> a tablet — name, Emirates ID, email, and who I was there to see. The next page
> was a child-protection safeguarding acknowledgment. I clicked submit and a copy
> of the form was emailed to me. On the way out I used the tablet again to log
> out before leaving."*

---

## What it does

### Visitor kiosk (`/`) — tablet friendly
1. **Check in** — full name, **Emirates ID** *(or passport for overseas
   visitors)*, email, optional phone, and **the staff member they are visiting**.
2. **Safeguarding acknowledgment** — the current child-protection policy is shown
   in full; the visitor must tick an explicit (un-pre-ticked) box to continue.
3. **Submit** — the visit is recorded and a **copy of the form + acknowledged
   policy is emailed** to the visitor.
4. **Check out** — on the way out, the visitor enters their ID number, confirms,
   and is signed out (with a confirmation email).

The kiosk only ever shows the *current* visitor's own details — never a list of
previous visitors — and auto-returns to the welcome screen when idle.

### Admin dashboard (`/admin/`)
- **On site now** — a live "who is in the building" view (essential for fire
  roll-call), with one-tap sign-out.
- **History** — searchable, filterable visit log; **CSV export**.
- **Staff** — add / edit / deactivate the people visitors can ask to see.
- **Policy** — edit the safeguarding text and **publish new versions**; every
  visit records exactly which version was acknowledged.
- **Settings** — data-retention purge of old records.

---

## Tech stack

| Layer     | Choice                                                            |
|-----------|-------------------------------------------------------------------|
| Runtime   | Node.js ≥ 20, ES modules                                          |
| Server    | Express 4, Helmet (CSP/security headers), rate limiting           |
| Database  | SQLite via `better-sqlite3` (file-based, no external service)      |
| Auth      | bcrypt password hashing + signed JWT in an httpOnly cookie         |
| Email     | Nodemailer — real SMTP, or a file-based **preview** mode for dev   |
| Frontend  | Dependency-free HTML/CSS/JS (no build step), tablet-optimised      |
| Tests     | Node's built-in test runner (`node --test`)                       |

No bundler, no framework lock-in, no cloud dependency — `npm install && npm start`.

---

## Live demo (GitHub Pages)

The `docs/` folder is a **static, browser-only preview** of the app for GitHub
Pages. It reuses the real UI (same HTML/CSS/JS) but swaps the backend for an
in-browser mock (`docs/js/mock-api.js`), so the whole flow is clickable with no
server. **The real backend in `src/` is untouched** — `docs/` is purely additive.

To publish it: repo **Settings → Pages → Build and deployment → Deploy from a
branch →** pick this branch and the **`/docs`** folder → Save. The site appears at
`https://<owner>.github.io/visitor-hub/` (admin at `/visitor-hub/admin/`, sign in
with `admin@example.com` / `changeme123`).

> The demo stores data only in your browser (it resets with the "Reset demo"
> link), sends no email, and must not be used with real visitor data. It is a
> visual/UX preview only — the production app needs the Node server below.

---

## Quick start

```bash
npm install
cp .env.example .env      # optional — sensible defaults work out of the box
npm start
```

Then open:
- **Kiosk:** http://localhost:3000/
- **Admin:** http://localhost:3000/admin/

On first run the app creates the SQLite database, seeds the default safeguarding
policy, a few sample staff, and an initial admin account:

```
email:    admin@example.com         (ADMIN_EMAIL)
password: changeme123               (ADMIN_PASSWORD)
```

> Change `ADMIN_PASSWORD` and `SESSION_SECRET` before any real deployment.

In the default `preview` email mode, nothing is actually sent — each email is
written as an HTML file to `./sent-emails/` so you can see exactly what the
visitor would receive. Set `EMAIL_TRANSPORT=smtp` (plus the `SMTP_*` variables)
to send real mail.

### Useful scripts
```bash
npm start     # run the server
npm run dev   # run with --watch (auto-restart on change)
npm run seed  # (re)seed admin / policy / sample staff (idempotent)
npm test      # run the test suite
```

---

## Configuration

All configuration is via environment variables (see `.env.example`). Highlights:

| Variable           | Default                       | Purpose                                            |
|--------------------|-------------------------------|----------------------------------------------------|
| `PORT` / `HOST`    | `3000` / `0.0.0.0`            | Where the server listens                           |
| `SCHOOL_NAME`      | `American International School in Abu Dhabi` | Branding on the kiosk and in emails |
| `SCHOOL_LOGO_URL`  | —                            | Optional logo shown in the top bar                 |
| `SUPPORT_EMAIL`    | `reception@example.com`      | Contact shown in email footers                     |
| `DATABASE_PATH`    | `./data/visitor-hub.db`      | SQLite file location                               |
| `SESSION_SECRET`   | *(dev placeholder)*          | Signs admin session cookies — **set in prod**      |
| `ADMIN_EMAIL/PASSWORD/NAME` | …                   | Initial admin, created on first run                |
| `EMAIL_TRANSPORT`  | `preview`                    | `preview` (write to disk) or `smtp` (send)         |
| `EMAIL_FROM`       | …                            | From address on receipts                           |
| `SMTP_*`           | —                            | SMTP host/port/secure/user/pass (when `smtp`)      |
| `RETENTION_DAYS`   | `365`                        | Auto-purge visits older than this (0 = never)      |

---

## Data model

```
admins   (id, name, email, password_hash, created_at)
staff    (id, name, email, department, active, created_at)
policies (id, version, title, body, active, created_at)        — versioned policy
visits   (id, visitor_name, id_type, id_number, nationality, email, phone,
          host_staff_id, host_name, purpose, policy_id, policy_version,
          acknowledged_at, check_in_at, check_out_at, status,
          receipt_status, receipt_detail, created_at)
```

- `host_name` is **snapshotted** on the visit, so the record stays intact even if
  the staff member is later edited or removed.
- `policy_version` + `acknowledged_at` give an **audit trail** of exactly what
  each visitor agreed to and when.
- `id_type` supports both `emirates_id` (validated as 15 digits beginning `784`)
  and `passport` (lenient, with nationality) for non-resident visitors.

---

## API (brief)

Public (kiosk):
```
GET  /api/config                 branding
GET  /api/policy                 active safeguarding policy
GET  /api/staff                  active staff to choose from
POST /api/checkin                create visit + email receipt
POST /api/checkout/lookup        find an open visit by ID number
POST /api/checkout/confirm       sign out
```

Admin (require auth cookie):
```
POST /api/auth/login | /logout | GET /api/auth/me
GET  /api/admin/stats
GET  /api/admin/visits/current
GET  /api/admin/visits           (?q,&status,&from,&to,&limit,&offset)
GET  /api/admin/visits.csv
GET  /api/admin/visits/:id
POST /api/admin/visits/:id/checkout | /resend-receipt
GET/POST/PUT/DELETE /api/admin/staff[/:id]
GET/POST /api/admin/policies
POST /api/admin/maintenance/purge
```

---

## Security & data protection

This app is built with UAE schools in mind and follows several safeguarding /
data-protection conventions:

- **Data minimisation & masking** — Emirates ID / passport numbers are **masked
  in all list views** (only the full value appears in the single-visit detail and
  CSV export, which are explicit authenticated actions).
- **Explicit, versioned consent** — the acknowledgment checkbox is never
  pre-ticked, and each visit stores the exact policy version and timestamp.
- **Confidentiality** — the kiosk never reveals other visitors' details; the full
  log is behind admin authentication.
- **Retention** — old records are purged automatically each day and on demand,
  per a configurable window (data-minimisation under the UAE PDPL).
- **Hardening** — Helmet security headers + CSP, request rate limiting, bcrypt
  password hashing, httpOnly signed-cookie sessions, server-side validation.
  Admin sessions are re-checked against the database on every request, and the
  app **refuses to start in production without an explicit `SESSION_SECRET`**.
- **Policy HTML is sanitised** on publish (scripts, event handlers, iframes and
  `javascript:` URLs are stripped) as defense-in-depth on top of the CSP.
- **No-store** responses and **masked IDs** on the shared kiosk screen.

**Known trade-offs (by design for an internal kiosk):**
- The check-out lookup returns a visitor's name/host to anyone who enters their
  (15-digit) ID number. This is inherent to self-service sign-out at a staffed
  reception and is rate-limited; enable an extra verification step (email/PIN)
  if your threat model needs it.
- State-changing admin requests rely on the `SameSite=lax` session cookie +
  JSON-only/no-CORS rather than CSRF tokens. Authenticated admins can view full
  ID numbers in the detail view and CSV export. For a public-facing deployment,
  add CSRF tokens, audit logging, and shorter session TTLs.

> ⚠️ **Legal references are a starting point, not legal advice.** The seeded
> safeguarding text references Wadeema's Law (Federal Law No. 3 of 2016) and the
> UAE PDPL (Federal Decree-Law No. 45 of 2021). These citations were drafted from
> secondary sources and should be **reviewed against official KHDA / ADEK / MoE
> guidance and the school's own policy** (and edited via the admin Policy editor)
> before relying on them for compliance. Schools in DIFC/ADGM free zones fall
> under those zones' separate data-protection regimes.

---

## Recommended next steps

Researched enhancements that fit naturally on top of this foundation:

- **Visitor badges** — numbered, time-stamped, colour-coded (e.g. red = must be
  escorted), surrendered/scanned at check-out.
- **Escort policy** — `escort_required` flag + assigned escort, defaulted by
  visitor category.
- **Overstay alerts** — flag visitors still on site after a cut-off time.
- **Pre-registration & QR** — pre-register expected visitors; let them read the
  policy on their own device before arrival.
- **Blocklist screening** — route matches against a school-maintained list to
  reception for human review.
- **Bilingual (English + Arabic)** acknowledgment text.
- **Multi-regulator config** — per-school regulator (KHDA / ADEK) selecting the
  correct policy name and Designated Safeguarding Lead contact.

---

## Project structure

```
src/
  config.js            env-driven configuration
  app.js               Express app (middleware, routes, static, errors)
  server.js            boot: db init, seed, daily purge, listen
  db/                  schema.sql, connection, seed, default policy
  services/            visits, staff, policy, email, auth (business logic)
  routes/              auth, public (kiosk), admin
  middleware/          requireAdmin
  util/                emiratesId, identity, validation, html
public/                kiosk (index.html) + admin (admin/) + css/js
test/                  utils, services, and API integration tests
```

## License

MIT
