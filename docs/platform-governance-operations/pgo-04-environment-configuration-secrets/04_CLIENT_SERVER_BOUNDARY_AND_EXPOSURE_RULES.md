# 04 — Client / Server Boundary And Exposure Rules

**Workstream:** PGO-04
**Fresh `origin/main`:** `ec3c534d93eb36e3514791ea6550228c3bc75ea3`
**Snapshot timestamp:** `2026-07-25T23:47:21+07:00`
**Rule:** Browser-visible ≠ safe. Fail closed on privileged exposure. Names only.

## Boundary model

```text
┌─────────────────────────────────────────────────────────┐
│ Browser bundle (Vite client)                            │
│  - import.meta.env.VITE_* only                          │
│  - public URLs, public identifiers, browser-safe flags  │
│  - NEVER service-role, signing secrets, provider secrets│
└─────────────────────────────────────────────────────────┘
                         │
                         │ HTTPS / RPC / trusted backend
                         ▼
┌─────────────────────────────────────────────────────────┐
│ Server / Edge / trusted backend / ops scripts           │
│  - process.env (non-VITE privileged names)              │
│  - service-role, DB URLs, provider credentials          │
│  - webhook signing, platform tokens                     │
└─────────────────────────────────────────────────────────┘
```

## `VITE_*` boundary

| Rule | Requirement |
|------|-------------|
| Prefix meaning | Vite embeds `VITE_*` into the **client bundle** at build time |
| Allowed content | Client-safe public configuration only |
| Forbidden content | Service-role keys, provider secret keys, webhook secrets, SMTP passwords, OA access/refresh tokens, private keys, DB URLs |
| Template debt | `.env.example` on `origin/main` still lists secret-shaped `VITE_*` names (e.g. `VITE_STRIPE_SECRET_KEY`, `VITE_MOMO_SECRET_KEY`, `VITE_VNPAY_HASH_SECRET`, `VITE_SMTP_PASS`, `VITE_ZALO_OA_ACCESS_TOKEN`, …). Presence of **names** in templates is governance debt — **not** certification that Production ships those values to browsers, and **not** proof of live leak |
| Cutover evidence | ECO-02 / ECO-02b docs + contracts under `src/features/ecosystem-integrations/**` and `src/features/integrations/config/legacyViteSecretCutover.js` (read-only) |

## Public identifiers

| Identifier class | Example names | Exposure rule |
|------------------|---------------|---------------|
| Public API URL | `VITE_SUPABASE_URL`, `VITE_APP_URL`, edge base URLs | Allowed in client when intentional |
| Public anon key | `VITE_SUPABASE_ANON_KEY` | Allowed as **anon** only; RLS must protect data; never treat as admin |
| Public payment links / return URLs | `VITE_STRIPE_LINK_*`, `*_RETURN_URL`, `*_CALLBACK_URL` | Allowed when non-secret |
| Public app / feature flags | `VITE_*_ENABLED`, `VITE_PAYMENT_MODE`, `VITE_RBAC_ENABLED` | Allowed; must not bypass authorization alone |

## Server-only secrets and service-role credentials

| Class | Example names | Hard rule |
|-------|---------------|-----------|
| Service role | `SUPABASE_SERVICE_ROLE_KEY`, `*_SERVICE_ROLE_KEY` | Never `VITE_*`; never client; GA checklist: service role **not** in Vercel client env |
| DB connection | `DATABASE_URL`, `SUPABASE_DB_URL`, `*_DB_URL` | Server/ops only |
| Provider signing / secret keys | Stripe/MoMo/VNPay/Zalo/SMS/SMTP secret-shaped names | Server-only after cutover; do not ship in browser |
| Platform tokens | `GITHUB_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `VERCEL_*BYPASS*` | CI/ops only |

## Fail-closed exposure rules

1. If classification is unknown → treat as **server-only / secret** until Owner/Security classifies.
2. If a client projection receives a secret-shaped key → **reject** (ECO-02 client-safe projection model).
3. If Production requires a privileged credential and it is missing → **fail readiness / fail operation**, do not silently degrade to insecure defaults (see [05](./05_ENVIRONMENT_VARIABLE_VALIDATION_AND_FAIL_CLOSED.md)).
4. Feature flags must not disable authz, RLS, or secret boundary checks (see [07](./07_FEATURE_FLAG_AND_KILL_SWITCH_GOVERNANCE.md)).
5. Logging must redact secret-shaped fields (PGO-03).
6. Naming a variable `SECRET` in a template is **not** automatic proof of exposure; runtime/bundle evidence is required for incident classification (PGO-02).

## Evidence sources (read-only)

| Evidence | Path |
|----------|------|
| Env templates | `.env.example`, `.env.production.example`, `.env.staging-qa.local.example`, `.env.test` |
| GA production env checklist | `docs/GA-PRODUCTION-ENV-CHECKLIST.md` |
| ECO secret boundary | `docs/ecosystem-integrations/eco-02/01_SECRET_ENVIRONMENT_BOUNDARY.md` |
| Legacy Vite secret cutover | `docs/ecosystem-integrations/eco-02b/01_LEGACY_VITE_SECRET_CUTOVER.md` |
| Contracts | `clientSafePublicConfigProjection.js`, `serverOnlyCredentialBoundary.js`, `secretReference.js` |
| Comms server-only boundary | `docs/communication-foundation/activation/comms-act-05/05_SERVER_ONLY_SECRET_BOUNDARY.md` |

## PGO-04 non-actions

- Do not rewrite templates or cutover code in this workstream.
- Do not claim browser exposure is cleared without Owner-reviewed runtime evidence.
- Do not open Notification Production Phase 2C to “fix” messaging secrets.
