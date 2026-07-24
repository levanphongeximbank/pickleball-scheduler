# 05 — CI/CD And Release Authority

**Snapshot timestamp:** `2026-07-24T17:11:17+07:00`
**Fresh `origin/main`:** `f599f7e81ad938ea7f16b3c8b4eaa685e763bbc4`
**PGO-01 rule:** **Không thay CI** (không sửa `.github/**`, `scripts/ci/**`, package/lockfiles).

## A. GitHub Actions = verification gate

Repository evidence: `.github/workflows/deploy.yml` (`Production CI Gate`).

| Fact | Evidence |
|------|----------|
| Role | Verification / quality gate — **not** Production deployer |
| Triggers | `push` + `pull_request` to `main` / `master` |
| Checks | `npm ci` → Foundation Lock → lint no-new → unit tests → `npm run build` |
| Explicit non-action | Workflow **does not** run `vercel --prod` |

Same Foundation Lock + lint no-new also run via `prebuild` inside `npm run build` (workflow commentary) — so Vercel Production build is also blocked by those gates when build runs there.

## B. Vercel Git Integration = deployment authority

| Fact | Evidence |
|------|----------|
| Production deployment authority | **Vercel Git Integration** auto-deploy on push to `main` (stated in workflow header comments) |
| Why CI does not deploy | Avoid dual unclear Production deployers |
| Repo deploy config present | `vercel.json` (buildCommand `npm run build`, `outputDirectory` `dist`, rewrites) |
| Also present | `netlify.toml` on tip — treat as additional deploy-surface collision zone; do not assume which host is active for every environment without Owner confirmation |

PGO **does not** claim live Vercel project/dashboard settings beyond what the repository states.

## C. External branch protection — do not assume

- Repository docs/workflows do **not** prove GitHub branch-protection rules, required reviewers, or status checks configuration in the GitHub UI.
- PGO-01 records: **external branch protection must not be assumed**.
- Release discipline still requires Owner GO + green verification gate before merge to `main`.

## D. Release, approval, rollback, evidence ownership

| Concern | Owner | Notes |
|---------|--------|-------|
| PR merge to `main` | Owner GO / designated releaser | Triggers verification + Vercel Production path |
| CI green proof | CI/Foundation owners | Actions logs + local `npm run` equivalents |
| Production rollback | Deployment authority + Owner GO | Procedure lives with release/module owners — not invented here |
| Staging apply evidence | Track owner + Owner GO | Register in [03](./03_ROLLOUT_AND_DEFERRED_TRACK_REGISTER.md) |
| Secret rotation evidence | Secret authority + Owner GO | Names only in PGO |
| Deferred track reopen | **Owner only** | Notification 2C remains `DEFERRED_BY_OWNER` |

## E. PGO-01 non-modification statement

PGO-01 **does not**:

- Edit `.github/workflows/**` or any Actions YAML
- Edit `scripts/ci/**`
- Edit `package.json` / lockfiles
- Run or request Production deploy
- Change Vercel/Netlify configuration files
