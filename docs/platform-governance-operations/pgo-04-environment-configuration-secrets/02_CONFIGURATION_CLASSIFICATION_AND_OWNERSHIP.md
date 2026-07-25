# 02 — Configuration Classification And Ownership

**Workstream:** PGO-04
**Fresh `origin/main`:** `ec3c534d93eb36e3514791ea6550228c3bc75ea3`
**Snapshot timestamp:** `2026-07-25T23:47:21+07:00`
**Rule:** Classify by **intended exposure and ownership**, not by string coincidence. Names only.

## Classification model

| Class | Definition | May appear in browser bundle? | Typical owners |
|-------|------------|-------------------------------|----------------|
| **Client-safe public configuration** | Public URL, public identifier, browser-safe feature flag — **not** a secret | Yes (if intentionally `VITE_*` public) | Module owner + Platform ops |
| **Server-only configuration** | Backend runtime setting; privileged service configuration | **No** | API/backend owner + Platform ops |
| **Secret** | Token, password, private key, signing secret, provider credential, service-role credential | **No** | Security Owner + env authority + Owner GO for Production |
| **Environment-specific configuration** | Differs across Local / Development / Test / Staging / Production | Depends on subclass | Env owner for that tier |
| **Tenant-level configuration** | Per-tenant or per-club settings (not global platform env) | Usually app data, not env | Business Module / tenant admin under product rules |
| **External-platform setting** | Stored in GitHub / Vercel / Netlify / Supabase consoles | N/A (platform store) | Platform ops + Owner; **not** default repository-owned |
| **Module-owned configuration** | Flags/config owned by a Business Module or Competition Engine | Per subclass rules | Module owner (pending rollout ≠ Platform Core defect) |

## Client-safe public configuration (evidence examples)

Tracked template / docs names that are **candidates** for public config (still must not embed secrets):

| Name | Evidence path | Notes |
|------|---------------|-------|
| `VITE_SUPABASE_URL` | `.env.example`, CI `secrets.*` name, `docs/GA-PRODUCTION-ENV-CHECKLIST.md` | Public project URL pattern |
| `VITE_SUPABASE_ANON_KEY` | same | Public anon key — **not** service-role; still treat carefully; RLS is the control |
| `VITE_RBAC_ENABLED` | `.env.example`, CI `vars.*` | Feature / security posture flag |
| `VITE_PAYMENT_MODE` | `.env.example`, CI `vars.*` | Mode switch |
| `VITE_*_ENABLED` product flags | `.env.example`, GA checklist | Release control — defaults OFF in GA docs |
| `VITE_STRIPE_LINK_*`, return/callback URLs | `.env.example` | Public URLs / links |
| `VITE_APP_URL`, `VITE_APP_ENV` | code usage on `origin/main` | Public app identity when set |

Ownership: PR to `main` for template/docs; Production console values owned by Platform ops + Owner GO.

## Server-only configuration (evidence examples)

| Name / group | Evidence path | Notes |
|--------------|---------------|-------|
| `SUPABASE_SERVICE_ROLE_KEY`, `PRODUCTION_SUPABASE_SERVICE_ROLE_KEY`, `STAGING_SUPABASE_SERVICE_ROLE_KEY` | scripts / ops usage names on `origin/main` | **Never** `VITE_*`; never browser |
| `SUPABASE_DB_URL`, `DATABASE_URL`, `STAGING_SUPABASE_DB_URL` | scripts | Server/ops only |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_MANAGEMENT_ACCESS_TOKEN` | scripts | Ops tooling |
| `VERCEL_AUTOMATION_BYPASS_SECRET`, `VERCEL_PROTECTION_BYPASS` | scripts | Deploy/preview protection |
| `GH_TOKEN`, `GITHUB_TOKEN` | CI/runtime names | Platform CI authority |
| API/runtime stores (`API_KEY_STORE`, `AUDIT_STORE`, …) | server-side process.env usage | Backend configuration |

Module contracts (read-only evidence, not edited by PGO-04):

- `src/features/ecosystem-integrations/contracts/serverOnlyCredentialBoundary.js`
- `src/features/ecosystem-integrations/contracts/clientSafePublicConfigProjection.js`
- `docs/ecosystem-integrations/eco-02/01_SECRET_ENVIRONMENT_BOUNDARY.md`
- `docs/communication-foundation/activation/comms-act-05/05_SERVER_ONLY_SECRET_BOUNDARY.md`

## Environment-specific configuration

| Tier | Example name groups (names only) | Template / doc evidence |
|------|----------------------------------|-------------------------|
| Local | Developer `.env*` (gitignored) | Templates only in repo |
| Test | `VITE_RBAC_ENABLED`, `VITE_SEED_DEMO`, `VITE_SUPABASE_*` | `.env.test` |
| Staging | `STAGING_*`, staging Supabase refs | `.env.staging-qa.local.example`, staging scripts |
| Production | Production checklist vars | `docs/GA-PRODUCTION-ENV-CHECKLIST.md`, `.env.production.example` |

## Tenant-level vs module-owned

| Kind | Ownership | PGO-04 rule |
|------|-----------|-------------|
| Tenant / club runtime settings in app data | Business Module | Not platform env SSOT |
| Competition Engine feature flags | Competition Engine owner | Documented under CE docs; PGO governs **platform** flag policy only |
| Notification env isolation constants | Notification module | `src/features/notifications/constants/notificationEnvironments.js` — Phase 2C remains **`DEFERRED_BY_OWNER`** |
| Ecosystem environment classification | Ecosystem Integrations | `environmentClassification.js` — fail-closed eligibility model |

## External-platform configuration

Settings that live outside the repository by default:

| Platform | Examples of setting classes | Repo-owned? |
|----------|-----------------------------|-------------|
| GitHub | Actions secrets/vars, branch protection, environment protection | Names referenced in workflows; console state **not assumed** |
| Vercel | Project env vars, Production/Preview scopes, Git Integration | `vercel.json` tracked; console env **not assumed verified** |
| Netlify | Site env / redirects | `netlify.toml` tracked; console **not assumed** |
| Supabase | Project keys, Auth providers, PITR, RLS | SQL/docs evidence only; dashboard **not assumed** |

## Ownership assignment rules

1. Every tracked env **name** in templates must have a named owner class (Platform / Module / Security / Env tier).
2. Every secret-shaped name must have a **server-only** or **secret** class — never “accidentally public.”
3. Module-owned config changes do not require Platform Core code ownership transfer.
4. External-platform settings require Platform ops + Owner GO for Production; PGO docs cannot invent verification.
5. PGO-04 documents ownership; it does **not** reassign code ownership in `src/**` or `api/**`.

## Inventory snapshot (tracked templates on fresh main)

| Template | Ownership class | Mutation by PGO-04 |
|----------|-----------------|--------------------|
| `.env.example` | Platform + Module (shared template) | **Forbidden** |
| `.env.production.example` | Production config owners | **Forbidden** |
| `.env.staging-qa.local.example` | Staging QA owners | **Forbidden** |
| `.env.test` | Test / CI owners | **Forbidden** |
