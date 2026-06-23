# FaceGuard

A **consent-based "find my own face online"** monitoring service — web app + REST API + mobile app.

Users upload a photo of **themselves**, and FaceGuard reports where that image already
appears on the public web, with a confidence score per result. Pro users can set up
**continuous monitors** that re-scan on a schedule and raise **alerts** when the image
turns up somewhere new.

> ### Scope & ethics — read this first
> FaceGuard is deliberately built as a **self-monitoring** tool, not a face-identification
> engine. It does **not** let you search for other people, and it does **not** build or query
> a biometric database of strangers. Every scan requires an explicit, logged attestation that
> the photo is of the person running it. The default search backend (Google Cloud Vision
> *web detection*) finds **pages where your image already appears** rather than matching faces
> against an identity database — which keeps it on the right side of GDPR / EU AI Act rules on
> biometric processing. If you point it at a true face-recognition API, you take on the legal
> obligations (lawful basis, DPIA, etc.) that come with processing biometric data.

## Monorepo layout

```
faceguard/
├── packages/shared/      # Shared TypeScript types (User, Scan, Monitor, FaceMatch…)
├── apps/api/             # Express + TypeScript API (auth, scans, monitors, billing)
│   └── src/providers/    # Pluggable reverse-image-search adapters
└── apps/web/             # Next.js 14 web app (landing, auth, dashboard, monitors)
    apps/mobile/          # Expo React Native app (auth, camera capture, scan, results)
```

## Architecture

- **API** — Express + TypeScript, SQLite via Node's built-in `node:sqlite` for storage (no native
  build step), JWT auth (bcrypt-hashed passwords), `multer` for uploads (held in memory, normalized
  with the pure-JS `jimp`, never sent to a
  third-party biometric store). Background monitor sweeps run via `node-cron`.
- **Search providers** — a `ReverseImageSearchProvider` interface with three implementations:
  - `google_vision` — Google Cloud Vision `WEB_DETECTION` (recommended, most defensible).
  - `tineye` — TinEye commercial reverse-image API.
  - `mock` — deterministic fake results so the whole product runs with **no API key**.
  Selected via the `SEARCH_PROVIDER` env var. Adding a new provider is a single file.
- **Consent gate** — `POST /api/scans` and `POST /api/monitors` reject the request (403
  `CONSENT_REQUIRED`) unless `ownPhotoAttested` and `termsAccepted` are both true. Each consent
  is written to the `consents` table with timestamp and IP for auditability.
- **Plans** — `free` (3 scans/mo, no monitors) and `pro` (200 scans/mo, 10 monitors). Quotas
  enforced server-side in `PLAN_LIMITS`.
- **AI face verification** — `services/faceEngine.ts` + `services/faceVerification.ts`. After a
  reverse-image search returns candidates, the engine computes a 128-d face descriptor from the
  user's *own* consented photo, then for the top N candidates it fetches the image, detects a
  face, and measures similarity (euclidean distance, `<=0.6` = same person). Each result is
  annotated with `faceVerified` + `faceConfidence` and re-ranked so locations that genuinely show
  the user's face rise to the top. The engine loads lazily and degrades gracefully — no models,
  no problem, you just get image-match-only results.

  > **Scope, on purpose.** This compares only against the user's own reference, over a bounded set
  > of candidates from *their own* scan. It is deliberately **not** a web-wide face-identification
  > index (no searching the internet for an arbitrary person across different photos) — that would
  > mean processing strangers' biometrics without consent, which is what GDPR / the EU AI Act
  > restrict. Keep it scoped this way.

### Enabling the AI face engine

```bash
npm run fetch-models     # downloads face-api weights into apps/api/models/ (~ a few MB)
```

Then start the API as usual — it auto-detects the models and turns on face verification.
Tune via `FACE_MATCH_ENABLED`, `FACE_MATCH_THRESHOLD`, `FACE_VERIFY_MAX_CANDIDATES` in
`apps/api/.env`. Face confidence is shown per result in the web dashboard. (Note: face
verification only annotates candidates whose images are actually fetchable, so it activates with
a real provider like `google_vision` — the `mock` provider's placeholder URLs aren't downloadable.)

## Running locally

> The build was authored in an offline sandbox where the npm registry is blocked, so
> dependencies are **not** installed in this checkout. Run the install on your own machine.

Requires Node **22.5+** (uses the built-in `node:sqlite`). No C++/Python build tools needed —
all runtime dependencies are pure JavaScript, so `npm install` never compiles anything. You'll see
a one-line "SQLite is an experimental feature" notice at startup; that's expected and harmless.

```bash
# 1. Install (root installs all workspaces)
npm install

# 2. Build shared types
npm run build:shared

# 3. API
cp apps/api/.env.example apps/api/.env     # default SEARCH_PROVIDER=mock works with no keys
npm run dev:api                            # http://localhost:4000  (GET /health)

# 4. Web (new terminal)
cp apps/web/.env.example apps/web/.env.local
npm run dev:web                            # http://localhost:3000

# 5. Mobile (new terminal)
cd apps/mobile && npm install && npm start # Expo; set extra.apiUrl in app.json to your LAN IP
```

With the default `mock` provider you can sign up, run a scan, and see realistic (fake)
results immediately — the full auth → consent → scan → results → monitor flow works end to end.

### Run with Docker (one command)

```bash
npm run up          # docker compose up --build  →  web on :3000, api on :4000
```

The API data (SQLite + uploads) persists in the `faceguard_data` volume. Override any provider
or Stripe key via environment variables (see `docker-compose.yml`).

## Wiring a real search API

Edit `apps/api/.env`:

```bash
# Google Cloud Vision (recommended)
SEARCH_PROVIDER=google_vision
GOOGLE_VISION_API_KEY=your-key      # enable the Vision API in Google Cloud Console

# …or TinEye
SEARCH_PROVIDER=tineye
TINEYE_API_KEY=your-key
```

No code changes needed — the provider factory in `src/providers/index.ts` switches on
`SEARCH_PROVIDER`.

## Wiring payments (Stripe)

Billing is fully implemented (`src/routes/billing.ts`); it activates automatically when keys
are present and stays disabled otherwise. To go live:

1. In Stripe, create a recurring Price for the Pro plan and copy its id.
2. Set in `apps/api/.env`:
   ```bash
   STRIPE_SECRET_KEY=sk_live_or_test_...
   STRIPE_PRICE_PRO=price_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
3. Point a Stripe webhook at `POST /api/billing/webhook` for the events
   `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`. Locally: `stripe listen --forward-to localhost:4000/api/billing/webhook`.

Flow: the web "Upgrade" button calls `POST /api/billing/checkout` → redirects to Stripe Checkout →
on success the webhook flips the user to `pro`. Pro users get a "Manage billing" button that opens
the Stripe billing portal (`POST /api/billing/portal`). The webhook route receives the raw request
body (the global JSON parser is skipped for it) so signature verification works.

A dev-only `POST /api/billing/dev/upgrade` flips a user to Pro without Stripe; the web app uses it
as an automatic fallback when billing isn't configured.

## Privacy controls (GDPR)

- **Export (Art. 20)** — `GET /api/account/export` returns everything held for the user
  (profile, consents, scans, monitors, alerts) as a downloadable JSON file. Web: Settings → "Export my data".
- **Erasure (Art. 17)** — `DELETE /api/account` removes all of the user's DB rows in a single
  transaction and deletes their uploaded images from disk. Web: Settings → "Delete account"
  (requires typing `DELETE`). The cascade is covered by `apps/api/test/deletion.test.mjs`.

## API reference (summary)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/signup` / `login` | Returns `{ token, user }` |
| GET  | `/api/auth/me` | Current user (auth) |
| POST | `/api/scans` | multipart: `photo`, `ownPhotoAttested`, `termsAccepted` (consent-gated) |
| GET  | `/api/scans` / `/api/scans/:id` | List / fetch scans |
| POST | `/api/monitors` | Pro-only; creates a scheduled monitor + baseline |
| POST | `/api/monitors/:id/run` | Run a monitor now; returns new alerts |
| GET  | `/api/monitors/alerts/all` | List alerts |
| GET  | `/api/billing/plans` | Plan + price info, `billingEnabled` flag |
| POST | `/api/billing/checkout` | Create Stripe Checkout session (auth) |
| POST | `/api/billing/portal` | Open Stripe billing portal (Pro) |
| POST | `/api/billing/webhook` | Stripe webhook (raw body, signature-verified) |
| GET  | `/api/account/export` | GDPR data export (JSON) |
| DELETE | `/api/account` | GDPR account erasure |

## Tests

Both run with plain `node` (no dependencies needed):

```bash
node apps/api/test/logic.test.mjs      # provider parsing + match filter/sort
node apps/api/test/deletion.test.mjs   # GDPR erasure cascade (in-memory SQLite)
node apps/api/test/face.test.mjs       # face-match math + tiered result fusion
```

## Data & deletion

Query images are normalized and stored under `apps/api/uploads/` purely to power monitor
re-scans; they are referenced by opaque IDs and are not shared with third parties beyond the
chosen search provider at scan time. For production, add an account-deletion endpoint that
removes the user's rows in `users/consents/scans/monitors/alerts` and their files in `uploads/`.
