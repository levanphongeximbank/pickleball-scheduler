# 04 — Environment And Authority Matrix

**Snapshot timestamp:** `2026-07-24T17:11:17+07:00`
**Fresh `origin/main`:** `f599f7e81ad938ea7f16b3c8b4eaa685e763bbc4`
**Rule:** **Không ghi secret value.** Chỉ tên biến / nhóm biến khi cần. Không tuyên bố đã verify setting trên GitHub/Vercel/Supabase console nếu repository không có evidence.

## Environments

| Environment | Mục đích | Configuration authority | Deployment authority | Secret authority | Owner GO requirement |
|-------------|----------|-------------------------|----------------------|------------------|----------------------|
| **Local** | Dev máy cá nhân | Developer (local `.env*` gitignored) | Developer local run only | Developer holds local secrets; **never commit** | Không cần Owner GO cho edit local; cần Owner GO nếu đụng shared template/CI |
| **Development** | Shared non-prod (nếu dùng) | Env owner / Platform ops | Non-prod deployer designated by Owner | Secret authority (platform secrets store) | Owner GO khi tạo/đổi shared Dev project hoặc rotate shared secrets |
| **Test** | Automated / QA harness | CI vars/secrets owners + QA owner | CI runners / test harness only | GitHub Actions `secrets.*` / `vars.*` (names in workflow evidence) | Owner GO khi thêm secret name mới vào workflow |
| **Staging** | Pre-prod validation | Staging env owner | Staging deploy path (Preview/staging project — **not assumed** beyond repo docs/scripts) | Staging secret authority; scripts often expect staging-only refs | **Owner GO** trước staging SQL apply / remote staging mutation |
| **Production** | Live | Production configuration authority | **Vercel Git Integration** (repo evidence: `.github/workflows/deploy.yml` states Production deploy on push to `main`; workflow does **not** run `vercel --prod`) | Production secret authority only | **Owner GO bắt buộc** trước Production deploy-affecting change, SQL/RLS apply, secret rotate, hoặc mở track đã deferred |

## Configuration authority (summary)

- App feature flags / public Vite config names: module + Platform owners via PR to `main` after CI verify.
- Deploy routing files (`vercel.json`, `netlify.toml`): deployment/config owners — **HIGH collision**; PGO-01 không sửa.
- Supabase project binding: environment owners; PGO-01 không apply.

## Deployment authority (summary)

| Path | Authority (repo evidence) | PGO-01 |
|------|---------------------------|--------|
| Push/merge to `main` | Triggers Production deploy via **Vercel Git Integration** (workflow comment/contract) | Không merge/deploy |
| GitHub Actions `Production CI Gate` | **Verification only** | Không sửa workflow |
| Manual `vercel --prod` | **Not** the CI workflow authority | Cấm từ PGO |

External branch-protection UI settings: **không giả định** đã bật trừ khi có evidence ngoài repo (PGO không claim).

## Secret authority (names only — examples from repo evidence)

From `.github/workflows/deploy.yml` (build env references):

- `secrets.VITE_SUPABASE_URL`
- `secrets.VITE_SUPABASE_ANON_KEY`
- `vars.VITE_RBAC_ENABLED`
- `vars.VITE_PAYMENT_MODE`

From `.env.example` on `origin/main` (variable **names** only; groups):

- Supabase client: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Auth/RBAC/flags: `VITE_RBAC_ENABLED`, `VITE_AUTH_SIGNUP_ENABLED`, `VITE_SEED_DEMO`, `VITE_ENABLE_AI_ENGINE`, …
- Payments: `VITE_PAYMENT_*`, `VITE_STRIPE_*`, `VITE_VNPAY_*`, `VITE_MOMO_*`
- Messaging: `VITE_EMAIL_*`, `VITE_SMTP_*`, `VITE_SMS_*`, `VITE_ZALO_OA_*`
- Product flags: `VITE_API_ENABLED`, `VITE_MARKETPLACE_ENABLED`, `VITE_PRIVATE_PAIRING_*`, …

**Never** paste values into PGO docs.

## Owner GO requirement (hard)

| Change class | Owner GO |
|--------------|----------|
| Docs-only under `docs/platform-governance-operations/**` | Owner review for merge; implementation may proceed under granted PGO-01 GO |
| Shared CI / package / lockfile / workflows | Owner GO + domain owner |
| Staging remote apply | Owner GO |
| Production deploy / SQL / RLS / secret rotate | Owner GO |
| Notification Production Phase 2C | **Blocked** — `DEFERRED_BY_OWNER` |
