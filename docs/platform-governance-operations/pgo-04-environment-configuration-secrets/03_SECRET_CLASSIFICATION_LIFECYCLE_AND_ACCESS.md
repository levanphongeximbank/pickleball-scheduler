# 03 — Secret Classification, Lifecycle And Access

**Workstream:** PGO-04
**Fresh `origin/main`:** `ec3c534d93eb36e3514791ea6550228c3bc75ea3`
**Snapshot timestamp:** `2026-07-25T23:47:21+07:00`
**Baselines:** PGO-02 (incident / recovery); PGO-03 (redaction / log privacy).
**Rule:** **No secret values. No live secret operation commands.** Names, ownership, and evidence requirements only.

## Secret classification

| Class | Includes | Examples of **names** (not values) from repo evidence |
|-------|----------|--------------------------------------------------------|
| **Provider credential** | Payment / messaging / OA credentials | `VITE_STRIPE_SECRET_KEY`, `VITE_MOMO_SECRET_KEY`, `VITE_VNPAY_HASH_SECRET`, `VITE_ZALO_OA_*`, `VITE_SMS_API_*`, `VITE_SMTP_PASS` |
| **Signing / webhook secret** | Hash / webhook signing | `VITE_STRIPE_WEBHOOK_SECRET`, `VITE_PAYMENT_HASH_SECRET`, `VITE_NEW_PROVIDER_HASH_SECRET` |
| **Service-role / privileged DB** | Supabase service role, DB URLs | `SUPABASE_SERVICE_ROLE_KEY`, `*_SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `DATABASE_URL` |
| **Platform access token** | GitHub / Supabase management / Vercel bypass | `GH_TOKEN`, `GITHUB_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_MANAGEMENT_ACCESS_TOKEN`, `VERCEL_AUTOMATION_BYPASS_SECRET` |
| **Human / fixture password** | Staging/Production QA passwords | `STAGING_*_PASSWORD`, `PRODUCTION_QA_PASSWORD`, `PM_*_PASSWORD`, etc. |
| **Private key** | Asymmetric private material | `VITE_X_PRIVATE_KEY` (name observed in code usage — treat as secret-shaped) |

### Important honesty rules

- A name containing `SECRET` / `KEY` / `TOKEN` / `PASSWORD` is a **classification signal**, not proof of live exposure.
- Public identifiers (e.g. anon key name `VITE_SUPABASE_ANON_KEY`) are **not** service-role secrets but still must not be logged carelessly (PGO-03 redaction).
- Legacy `VITE_*` secret-shaped names in templates are **governance debt** — ECO-02 / ECO-02b documents cutover toward server-only references; live resolver cutover remains blocked without Owner GO.

## Lifecycle stages (policy only)

| Stage | Required control | Evidence expected for certification | PGO-04 status |
|-------|------------------|-------------------------------------|---------------|
| **Creation** | Owner GO for shared/Staging/Production; least privilege | Ticket / Owner GO record + store location (name only) | Model only |
| **Storage** | Platform secret store (GitHub Actions secrets, Vercel env, Supabase dashboard) — not git | Store name + scope; **no value** in repo | Model only |
| **Distribution** | Need-to-know; CI inject at build/runtime; never commit | Workflow/docs reference to secret **names** | Partial (CI names evidenced) |
| **Access** | Role-based; audit who can read Production secrets | Access roster / console ACL evidence | **Not verified** in this run |
| **Rotation** | Scheduled or event-driven; dual-run window if needed | Rotation evidence + Owner GO | **`PROVISIONAL_NOT_CERTIFIED`** |
| **Revocation** | Immediate on leak/compromise | Incident link (PGO-02) + revoke evidence | **`PROVISIONAL_NOT_CERTIFIED`** |
| **Expiration** | Explicit expiry or review date | Expiry policy approved by Owner/Security | **`PROVISIONAL_NOT_CERTIFIED`** |
| **Incident handling** | Map to PGO-02 severity; redact per PGO-03 | Incident ticket + postmortem | Model links only |
| **Evidence retention** | Keep attestation, not secret values | Retention of **metadata** evidence | **`PROVISIONAL_NOT_CERTIFIED`** |

## Access principles

1. Production secret access is **deny-by-default**.
2. Developers do not need Production service-role or provider signing secrets for routine UI work.
3. Staging fixtures must not reuse Production credentials.
4. CI may reference secret **names**; logs must not print values (PGO-03).
5. Browser code must not read server-only credentials (see [04](./04_CLIENT_SERVER_BOUNDARY_AND_EXPOSURE_RULES.md)).
6. Secret scanning scripts in repo (e.g. `scripts/crm/phase-1h-b-secret-scan.mjs`, `scripts/player-management/pm-id-01-activation-secret-scan.mjs`, referee secret scan docs) are **module/ops tools** — not a certified platform-wide secret-scanning program unless Owner attests coverage.

## Prohibited content in this document and PGO-04 edits

- Secret values, tokens, passwords, private keys
- Commands that create, rotate, revoke, or print live secrets
- Pasting contents of real `.env` files
- Claiming rotation/revocation is complete without Owner evidence

## Mapping to related baselines

| Concern | Baseline |
|---------|----------|
| Secret leak / credential compromise | PGO-02 incident classification & runbooks |
| Accidental log exposure | PGO-03 redaction & security audit logging |
| Registry / deferred tracks | PGO-01 deferred register — Notification 2C = `DEFERRED_BY_OWNER` |
| Integration secret boundary contracts | ECO-02 docs + `src/features/ecosystem-integrations/contracts/*` (read-only) |

## Provisional targets

Any proposed rotation cadence, retention window, or expiry target in future Owner packs must remain:

```text
PROVISIONAL_NOT_CERTIFIED
```

until Security Owner + Owner GO approve with evidence.
