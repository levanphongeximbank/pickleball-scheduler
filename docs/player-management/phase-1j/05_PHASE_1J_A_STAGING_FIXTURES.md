# Phase 1J-A — Staging Directory Fixture Pack

**Owner decision:** `AUTHORIZE_PHASE_1J_A_STAGING_FIXTURE_DESIGN_AND_IMPLEMENTATION`  
**Branch:** `feature/player-phase-1j-a-staging-fixtures`  
**Staging project:** `qyewbxjsiiyufanzcjcq`  
**Production project:** `expuvcohlcjzvrrauvud` — **FORBIDDEN**  
**Classification:** Staging-only QA fixtures for authenticated Public Player Directory  
**Stop gate:** Owner pre-commit review — **no commit/push/deploy in this wave**

---

## 1. Objective

Create a narrowly scoped, reversible Staging fixture pack so the authenticated player directory can be tested with controlled eligible and ineligible rows.

The pack proves:

1. Eligible public athlete appears in browse/search/detail.
2. Hidden athlete (`publicProfileEnabled=false`) does not appear.
3. Suspended athlete does not appear.
4. Unverified athlete does not appear.
5. Masked fields return `null` where privacy flags require it.
6. Nonexistent detail returns indistinguishable `null`.
7. No total hidden count leaks in search meta.
8. Invalid cursor returns controlled `INVALID_CURSOR`.

---

## 2. Fixture namespace

| Item | Value |
|------|--------|
| Marker | `QA\|PM-1J-A\|DIR-FIXTURE` |
| Namespace | `pm1ja` |
| Player ID prefix | `qa-pm1ja-` |
| Tenant | `venue-staging-a` |
| Verifier account (read-only smoke) | `player@staging.local` |

Deterministic auth UUID prefix: `c7000000-*` (one row per role).

---

## 3. Fixture inventory

| Role | player_id | display_name | Expected directory behavior |
|------|-----------|--------------|----------------------------|
| eligible | `qa-pm1ja-eligible` | PM1JA Eligible Public Athlete | Visible; all public fields shown |
| hidden | `qa-pm1ja-hidden` | PM1JA Hidden Athlete | Excluded (`publicProfileEnabled=false`) |
| suspended | `qa-pm1ja-suspended` | PM1JA Suspended Athlete | Excluded (`status=suspended`) |
| unverified | `qa-pm1ja-unverified` | PM1JA Unverified Athlete | Excluded (`identity_verification_status=unverified`) |
| masked | `qa-pm1ja-masked` | PM1JA Masked Privacy Athlete | Visible; `gender`, `handedness`, `activity_region` null |

Emails: `pm1ja.<role>@staging.local` (Staging QA only).

---

## 4. Eligibility alignment (Phase 1I-B)

Each fixture row is authored against the locked directory predicate:

```text
player_id present
AND display_name non-empty
AND identity_verification_status = 'verified'   (except unverified fixture)
AND privacy_settings.publicProfileEnabled = 'true'   (except hidden fixture)
AND status IS DISTINCT FROM 'suspended'   (except suspended fixture)
AND authenticated caller
```

Directory DTO remains locked to seven fields:

`playerId`, `displayName`, `isVerified`, `avatarUrl`, `activityRegion`, `gender`, `handedness`

---

## 5. Package files

| File | Purpose |
|------|---------|
| `src/features/player/fixtures/phase1jAStagingFixture.js` | Deterministic fixture definitions |
| `scripts/player-management/phase-1j-a-staging-fixtures.mjs` | Staging seed (service role) |
| `scripts/player-management/phase-1j-a-staging-verify.mjs` | Read-only RPC verification |
| `scripts/player-management/phase-1j-a-staging-cleanup.mjs` | Scoped cleanup |
| `tests/player-management-phase-1j-a-staging-fixtures.test.js` | Deterministic package tests |
| `docs/player-management/phase-1j/evidence/` | Apply/verify/cleanup JSON reports |

---

## 6. Commands

```bash
# Deterministic unit tests (CI-safe)
node --test tests/player-management-phase-1j-a-staging-fixtures.test.js

# Staging apply (requires STAGING_SUPABASE_SERVICE_ROLE_KEY)
node scripts/player-management/phase-1j-a-staging-fixtures.mjs
node scripts/player-management/phase-1j-a-staging-fixtures.mjs --dry-run

# Read-only directory verification (requires verifier auth password)
node scripts/player-management/phase-1j-a-staging-verify.mjs

# Scoped cleanup (requires service role)
node scripts/player-management/phase-1j-a-staging-cleanup.mjs
node scripts/player-management/phase-1j-a-staging-cleanup.mjs --dry-run
```

Optional npm aliases:

```bash
npm run seed:pm1ja-staging
npm run verify:pm1ja-staging
npm run cleanup:pm1ja-staging
```

---

## 7. Safety rules

| Rule | Implementation |
|------|----------------|
| Staging ref guard | Scripts refuse any URL not matching `qyewbxjsiiyufanzcjcq`; Production ref throws |
| No Production writes | No Production scripts/SQL; static scans required before commit |
| Scoped cleanup | Deletes only deterministic `c7000000-*` users and `qa-pm1ja-*` player_ids |
| Pre-write snapshot | Seed script captures existing rows for fixture player_ids before upsert |
| No global settings | Does not alter unrelated profiles or global privacy defaults |
| Reversible | Cleanup removes auth users + profiles in namespace only |

Required env for apply/cleanup:

- `STAGING_SUPABASE_URL` (or `VITE_SUPABASE_URL` pointing to Staging)
- `STAGING_SUPABASE_SERVICE_ROLE_KEY`

Required env for verify:

- `STAGING_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_ANON_KEY`)
- Verifier password via `PHASE42L_QA_PASSWORD` or `STAGING_PLAYER_NEW_PASSWORD`

---

## 8. Evidence outputs

After Owner-authorized apply:

- `docs/player-management/phase-1j/evidence/STAGING_PM1JA_FIXTURE_SEED_REPORT.json`
- `docs/player-management/phase-1j/evidence/STAGING_PM1JA_FIXTURE_VERIFY_REPORT.json`
- `docs/player-management/phase-1j/evidence/STAGING_PM1JA_FIXTURE_CLEANUP_REPORT.json` (when cleanup run)

---

## 9. Out of scope

- Phase 1J-B privacy live evidence (separate sub-phase)
- Production fixture seeding
- SQL / migration changes
- DTO expansion
- Route / React RPC changes
- Deploy

---

## 10. Owner action next

1. Review this package and changed files (pre-commit).  
2. Provide `STAGING_SUPABASE_SERVICE_ROLE_KEY` in local `.env.staging-qa.local` (never commit).  
3. Reset/sync Staging verifier password if needed (`player@staging.local`).  
4. Authorize commit on branch `feature/player-phase-1j-a-staging-fixtures`.  
5. After merge, run Staging apply + verify; then proceed to **1J-B** only under its token.
