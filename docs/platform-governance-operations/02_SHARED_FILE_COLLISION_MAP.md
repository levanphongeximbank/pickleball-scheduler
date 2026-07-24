# 02 — Shared File Collision Map

**Snapshot timestamp:** `2026-07-24T17:11:17+07:00`
**Fresh `origin/main`:** `f599f7e81ad938ea7f16b3c8b4eaa685e763bbc4`
**Purpose:** Ngăn workstream song song sửa cùng shared surface mà không có Owner coordination.

## A. Shared collision zones

| Zone | Sensitivity | Default collision level |
|------|-------------|-------------------------|
| `.github/**` | CI/CD contract mọi PR | **HIGH** |
| `scripts/ci/**` | Foundation lock, lint baseline, unit-test manifest, ownership lock | **HIGH** |
| `package.json` / `package-lock.json` (và lockfiles khác) | Dependency graph / install reproducibility | **HIGH** |
| `vercel.json` / `netlify.toml` | Deploy routing / build contract | **HIGH** |
| `supabase/**` | Shared server/edge surface | **HIGH** |
| Root env templates (`.env*.example`) | Secret-boundary education — **names only** | **MEDIUM** |
| Platform Core shared providers / contracts | Cross-module runtime | **HIGH** |
| Competition Engine shared contracts | Parallel CE workstreams | **MEDIUM** → **HIGH** khi đụng `scripts/ci` hoặc package |

## B. Active exposures (snapshot evidence)

### HIGH

| Worktree / branch | Shared path(s) | Evidence type | Ownership / approval gate |
|-------------------|----------------|---------------|---------------------------|
| ECO-01 `ecosystem-integrations-foundation` | `scripts/ci/unit-test-files.json` | vs `origin/main` (CLEAN WT, ahead) | CI/Foundation owner + serialize merge; Owner GO nếu đụng baseline |
| Experience Channels 00 | `scripts/ci/unit-test-files.json` | vs `origin/main` | Same gate |
| TT V6 `pickleball-team-tournament` | `scripts/ci/unit-test-files.json` | vs `origin/main` + DIRTY WT (untracked module/SQL) | Same gate; không merge CI từ PGO |
| phase42l-preview (DETACHED) | `package.json` (+ working-tree lockfile dirty observed) | vs main + DIRTY | Package owner; không chỉnh từ PGO |
| RC `release/team-tournament-pilot-v5.3.34` | `package.json` | vs main + DIRTY | Release owner |
| CC10 readiness / stage1, CC08 standardization, TT10, TT11 | `package.json` | vs main | Historical package drift — coordinate before revive |
| referee-v5-rally / rally-merge | `.env.example`, `package.json`, `supabase/functions/_shared/refereeV5Server.mjs` | vs main | Env template + Supabase shared + package — **triple HIGH/MEDIUM** |

### MEDIUM

| Worktree | Surface | Notes | Gate |
|----------|---------|-------|------|
| `comms-act-02-staging-apply` | Communication activation docs | Staging ops track | Owner GO trước remote apply |
| `athlete-hotfix` Phase 42N untracked | Production rollout plans/scripts/evidence | Production track | Owner GO Production riêng |
| `club-hotfix` | Prod smoke + local `.vercel.*` dir | Tránh nhầm với PGO | Owner GO |
| Env templates (any branch touching `.env.example`) | Variable **names** only | Không commit secret values | Secret authority |

### LOW

| Pattern | Example | Gate |
|---------|---------|------|
| New docs path không đụng shared CI | PGO-01 `docs/platform-governance-operations/**` | Path-only review |
| Module-local `src/features/<module>/` + dedicated tests | CE E2E-02 dirty under competition-engine feature tree | Module owner |
| Module-local rollback/SQL **docs** (không apply) | TT evidence folders | Owner GO trước apply thật |

## C. Ownership và approval gate (tóm tắt)

| Action | Required |
|--------|----------|
| Sửa `scripts/ci/unit-test-files.json` | **Một writer** tại một thời điểm; serialize ECO / Experience / TT / Customer-class merges |
| Sửa lint baseline / Foundation Lock | Owner + CI owner — **cấm** từ parallel foundation nếu chưa freeze collision |
| Sửa `package.json` / lockfiles | Package owner; full install repro proof |
| Sửa `.github/workflows/**` | CI owner; PGO-01 **không** thay CI |
| Sửa `supabase/**` | Supabase / server owner + migration gate riêng |
| Sửa `.env.example` | Names only; Secret authority review |
| Deploy Production / apply SQL | Owner GO + environment authority (xem 03, 04, 05) |

## D. PGO-01 self-check

Allowed:

```text
docs/platform-governance-operations/**
```

Disallowed examples: `src/**`, `scripts/**`, `package*.json`, lockfiles, `.github/**`, `supabase/**`, deployment config, secrets.

**Policy:** PGO-01 chỉ **ghi nhận** collision — không sửa shared files.

## E. Notification Phase 2C

Notification Production Phase 2C = **`DEFERRED_BY_OWNER`**.
Không đưa vào kế hoạch “fix collision / reopen” từ PGO-01.
