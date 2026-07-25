# 01 — Environment Taxonomy And Authority

**Workstream:** PGO-04
**Fresh `origin/main`:** `ec3c534d93eb36e3514791ea6550228c3bc75ea3`
**Snapshot timestamp:** `2026-07-25T23:47:21+07:00`
**Baselines:** PGO-01 `04_ENVIRONMENT_AND_AUTHORITY_MATRIX.md` (authority); PGO-02 (incident); PGO-03 (redaction).
**Rule:** Không ghi secret value. Không tuyên bố đã verify setting trên GitHub/Vercel/Netlify/Supabase console nếu repository không có evidence.

## Environment taxonomy

| Environment | Mục đích | Typical binding (repo evidence) | Data risk |
|-------------|----------|----------------------------------|-----------|
| **Local** | Dev máy cá nhân | Local `.env*` (gitignored); templates `.env.example` | Low shared impact; high leak risk if committed |
| **Development** | Shared non-prod (nếu dùng) | Shared non-prod project refs (not assumed unless documented) | Shared secrets need rotation discipline |
| **Test** | Automated / QA harness | `.env.test`; CI `secrets.*` / `vars.*` (names in workflows) | Credentials must be non-prod fixtures |
| **Staging** | Pre-prod validation | Staging templates (e.g. `.env.staging-qa.local.example`); staging scripts | Near-prod; Owner GO before remote apply |
| **Production** | Live | Production checklists / deploy path evidence | Highest; Owner GO bắt buộc |

## Authority matrix by environment

| Environment | Configuration authority | Deployment authority | Secret authority | Owner GO |
|-------------|-------------------------|----------------------|------------------|----------|
| **Local** | Developer (local only) | Developer local run | Developer holds local secrets; **never commit** | Not required for local-only edits; required if changing shared templates/CI |
| **Development** | Env owner / Platform ops | Non-prod deployer designated by Owner | Platform secrets store (names only in docs) | Required to create/change shared Dev project or rotate shared secrets |
| **Test** | CI vars/secrets owners + QA owner | CI runners / test harness only | GitHub Actions `secrets.*` / `vars.*` (names in workflow evidence) | Required when adding new secret **names** to workflows |
| **Staging** | Staging env owner | Staging / Preview deploy path — **not assumed** beyond repo docs/scripts | Staging secret authority | **Required** before staging SQL apply / remote staging mutation |
| **Production** | Production configuration authority | **Vercel Git Integration** (repo evidence: `.github/workflows/deploy.yml` states Production deploy on push to `main`; workflow does **not** run `vercel --prod` as primary authority claim beyond that contract) | Production secret authority only | **Required** before Production deploy-affecting change, SQL/RLS apply, secret rotate, or reopening deferred tracks |

## Configuration authority (summary)

| Class | Who may change | Gate |
|-------|----------------|------|
| Tracked env **templates** (`.env.example`, `.env.production.example`, …) | Module + Platform owners via PR | CI verify + Owner review for secret-shaped template additions |
| App feature flags / public Vite config **names** | Module + Platform owners via PR to `main` | CI verify |
| Deploy routing files (`vercel.json`, `netlify.toml`) | Deployment/config owners | **HIGH collision** — PGO-04 does not edit |
| Supabase project binding | Environment owners | PGO-04 does not apply |
| External console env vars (Vercel/Supabase/GitHub) | Platform ops + Owner | Owner GO for Production; evidence required for certification |

## Deployment authority (summary)

| Path | Authority (repo evidence) | PGO-04 |
|------|---------------------------|--------|
| Push/merge to `main` | Triggers Production deploy via **Vercel Git Integration** (workflow comment/contract) | Không merge/deploy |
| GitHub Actions Production CI Gate | **Verification only** | Không sửa workflow |
| Manual `vercel --prod` | **Not** the default CI workflow authority | Cấm từ PGO-04 |
| Netlify | Tracked `netlify.toml` exists; live Netlify project settings **not assumed** | Không cấu hình |

## Secret authority (names only — examples from repo evidence)

From `.github/workflows/deploy.yml` build env references (names only):

- `secrets.VITE_SUPABASE_URL`
- `secrets.VITE_SUPABASE_ANON_KEY`
- `vars.VITE_RBAC_ENABLED`
- `vars.VITE_PAYMENT_MODE`

From tracked templates on `origin/main` (variable **names** only; groups):

| Group | Example names (not values) | Template path |
|-------|----------------------------|---------------|
| Supabase client | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | `.env.example`, `.env.production.example`, `.env.test` |
| Auth / RBAC / flags | `VITE_RBAC_ENABLED`, `VITE_AUTH_SIGNUP_ENABLED`, `VITE_SEED_DEMO`, `VITE_ENABLE_AI_ENGINE` | `.env.example`, `.env.production.example` |
| Payments | `VITE_PAYMENT_*`, `VITE_STRIPE_*`, `VITE_VNPAY_*`, `VITE_MOMO_*` | `.env.example` |
| Messaging | `VITE_EMAIL_*`, `VITE_SMTP_*`, `VITE_SMS_*`, `VITE_ZALO_OA_*` | `.env.example` |
| Staging QA fixtures | `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_ANON_KEY`, `STAGING_*_PASSWORD` | `.env.staging-qa.local.example` |

**Never** paste values into PGO docs.

## Owner GO requirement (hard)

| Change class | Owner GO |
|--------------|----------|
| Docs-only under `docs/platform-governance-operations/pgo-04-environment-configuration-secrets/**` | Owner review for merge; implementation may proceed under granted PGO-04 GO |
| Shared CI / package / lockfile / workflows / templates | Owner GO + domain owner |
| Staging remote apply | Owner GO |
| Production deploy / SQL / RLS / secret rotate / revoke | Owner GO |
| Notification Production Phase 2C | **Blocked** — `DEFERRED_BY_OWNER` |

## Honesty constraints

- Branch-protection UI, Vercel Production env console, Supabase dashboard settings: **không giả định** đã bật/đúng trừ khi có evidence ngoài repo hoặc Owner attestation.
- PGO-01 environment matrix remains the registry baseline; this document **extends** taxonomy for PGO-04 without mutating PGO-01 files.
