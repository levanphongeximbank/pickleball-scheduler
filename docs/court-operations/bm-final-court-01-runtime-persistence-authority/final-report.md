# BM-FINAL-COURT-01 — Final Report

## A. PHÁN QUYẾT

**BM_FINAL_COURT_01_PASS_PR_OPEN**

## B. SAFETY BASELINE

| Check | Result |
|-------|--------|
| Worktree | `bm-final-court-01` only |
| Branch | `feature/bm-final-court-01-runtime-persistence-authority` |
| Starting HEAD | `7971a260c325a723f78671a9754f17d2bcde14b5` |
| package.json SHA256 | `CF0361BF8FC7F4AE6AA39587AB8489F4C1D3489C04B2E980EEC8E6EB396AFE0E` (unchanged) |
| package-lock.json SHA256 | `844840CA58B3EADCC4A1D090ABDCFCD057B7562F48BB1450D4A8AD1A1763B448` (unchanged) |
| SQL Staging/Production apply | Not performed |
| Force-push / rebase / reset | Not performed |
| Worktree cleanup | Not performed |
| PR merge | Not performed |

## C. COURT OWNERSHIP MATRIX

Venue Management owns inventory/availability. Court Operations owns runtime session/queue/courtStates/claims lifecycle. Competition owns demand/assignment/schedule. No inventory ownership moved into Court Engine.

## D. CURRENT RUNTIME WRITE INVENTORY

Canonical writer → durable / memory / explicit-local adapters. Demoted `saveCourtEngineStore` requires explicit local authority. Dual-write fire-and-forget cloud push removed. Claim local writes gated by the same authority.

## E. CANONICAL PERSISTENCE AUTHORITY

`src/features/court-engine/runtime/**`

- Production/Staging/Preview → `durable`
- Development default → `durable` (fail-closed)
- Local only via explicit `VITE_COURT_RUNTIME_AUTHORITY` (or legacy `VITE_COURT_ENGINE_STORE=local` outside secure deploy)
- Existing tables `court_engine_stores` + `court_engine_active_sessions` cover full session blob without new SQL

## F. LOCALSTORAGE DEMOTION

localStorage is non-canonical. Writes blocked under durable authority (`COURT_RUNTIME_LOCAL_MODE_NOT_EXPLICIT`). Legacy keys retained for read/migration; not deleted.

## G. VENUE / CLUB / COMPETITION INTEGRATION

Venue availability guard unchanged (read-only). Competition internals untouched. Scope requires tenantId+clubId; mismatch fail-closed. Claim path fail-closed on `NO_SUPABASE` / `RPC_NOT_DEPLOYED` / `RPC_FAILED` under durable.

## H. FILES CHANGED

- `src/features/court-engine/runtime/**` (new)
- `src/features/court-engine/storage/**` (demotion + durable path)
- `src/features/court-engine/services/courtSessionService.js`
- `src/features/court-engine/hooks/useCourtEngine.js`
- `src/features/court-engine/index.js`
- `src/features/court-cluster/services/courtClaimRequestService.js`
- `src/features/court-cluster/storage/courtClaimRequestStorage.js`
- `src/domain/repositories/repositoryFactory.js` (Court runtime composition adoption only)
- `tests/court-engine-*.test.js`, `tests/court-cluster-claim-authority.test.js`
- `tests/coaching-ai-phase28-29.test.js` — **scope remediation:** removed misplaced Phase 30 Court store factory tests (Court coverage moved to `tests/court-engine-runtime-authority.test.js`); Phase 28–29 Coaching assertions unchanged
- `scripts/ci/unit-test-files.json`
- `docs/court-operations/**`

## Scope remediation note (pre-merge)

Independent review flagged `tests/coaching-ai-phase28-29.test.js` as outside Court test allowlist. Remediation:

1. Restored file from `origin/main`, then removed only Phase 30 Court Engine store factory tests (not Coaching behavior).
2. Relocated equivalent platform-adoption assertions into `tests/court-engine-runtime-authority.test.js`.
3. Kept `repositoryFactory.js` because it is the Court runtime composition root (authority resolved once).

## I. TEST VÀ CERTIFICATION

| Gate | Result |
|------|--------|
| Focused Court/Venue/Competition tests | PASS (131) |
| foundation-lock | PASS |
| lint:no-new | PASS |
| build | PASS |
| package/lock hashes | PASS (unchanged) |
| secret scan | PASS |
| SQL untouched | PASS |

## J. MOCK / FALLBACK / SCOPE VERIFICATION

- Cloud failure does not flip authority
- `RPC_NOT_DEPLOYED` does not activate local under durable
- Missing Supabase in durable write → `COURT_RUNTIME_DURABLE_STORE_UNAVAILABLE`
- No first-club/first-venue fallback in writer
- Unauthorized mutation produces zero writes

## K. GIT VÀ PR

- Branch: `feature/bm-final-court-01-runtime-persistence-authority`
- Commit: `a809d97f`
- PR: https://github.com/levanphongeximbank/pickleball-scheduler/pull/304
- Merge: **not performed**

## L. MỨC ĐỘ HOÀN THÀNH

- BM-FINAL-COURT-01: **95%** (architecture + tests + PR; env SQL deploy remains Owner ops, not this WS)
- Court Operations module: **~90%** closure for runtime persistence authority
- Business Modules final closure: unblocks Court runtime authority workstream
- Gap: target environments must already have Court Engine cloud SQL / claim RPCs deployed; this WS does not apply SQL
- Post-merge: set durable env in Preview/Staging/Production; use explicit local only for development offline

## M. OWNER ACTION

**Review and merge PR https://github.com/levanphongeximbank/pickleball-scheduler/pull/304 into `main` (do not apply SQL in this workstream).**

## MARKERS

- `COURT_OPERATIONS_RUNTIME_AUTHORITY_CERTIFIED`
- `COURT_ENGINE_LOCALSTORAGE_DEMOTED`
- `BM_FINAL_COURT_01_READY_FOR_OWNER_MERGE`
