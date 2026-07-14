# V5-P1C.6 — Database Rollout Enable Results

**Gate:** P1-C.6 — ENABLE DATABASE ROLLOUT ONLY  
**Date:** 2026-07-14  
**Owner GO:** `PRODUCTION_P1C_DB_ROLLOUT_GO=YES`  
**Command:** `node scripts/enable-v5p1c-db-rollout.mjs`  
**Production project:** `expuvcohlcjzvrrauvud`  

Evidence: `docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/2026-07-14T00-44-28-012Z-db-rollout/`  
Latest pointer: `docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/LATEST_DB_ROLLOUT_REPORT.json`

## Scope executed

Enable **database** Rating V5 rollout for existing Wave A enrollments only.

**Not done:** Vercel env change · frontend redeploy · assessment start · new enrollments · Edge deploy · V2 writes · tournament/VPR/seeding/matchmaking

## Prechecks

| Check | Result |
|-------|--------|
| Production ref | `expuvcohlcjzvrrauvud` PASS |
| Active Wave A enrollments | **5 / 5** |
| Duplicate Wave A enrollments | **0** |
| Player links present | PASS (5/5) |
| Club memberships active | PASS (5/5) |
| Frontend flag (local) | unset/false |
| Vercel `VITE_PICK_VN_RATING_V5_ENABLED` | present (Encrypted); **not modified** this gate |
| V2 rows | **0** |
| Rating events | **0** |
| Rollout snapshot | `PRE_DB_ROLLOUT_SNAPSHOT.json` |

### Rollout before

| Field | Value |
|-------|-------|
| `allow_v5_assessment` | `false` |
| `shadow_mode_enabled` | `true` |
| `compare_v2_enabled` | `true` |
| `pilot_cohort_label` | `club-rating-v5-production-pilot` |
| `max_completed_assessments` | `1` |
| `cooldown_days` | `7` |
| `reassessment_requires_approval` | `true` |

## Config update applied

| Field | After |
|-------|-------|
| `allow_v5_assessment` | **`true`** |
| `shadow_mode_enabled` | **`true`** |
| `compare_v2_enabled` | **`true`** |
| `pilot_cohort_label` | **`club-rating-v5-production-wave-a`** |
| `max_completed_assessments` | `1` (unchanged) |
| `cooldown_days` | `7` (unchanged) |
| `reassessment_requires_approval` | `true` (unchanged) |

## Server verification

| Check | Result |
|-------|--------|
| Enrolled Wave A `assert_pilot_gate(start)` | **PASS** (`ok: true`) |
| Non-enrolled control (`lephong.eximbank@gmail.com`) | **PASS** → `PILOT_NOT_ENROLLED` |
| Cross-tenant (wrong tenant) | **PASS** → `PILOT_NOT_ENROLLED` |
| Temporary pause → blocked | **PASS** → `PILOT_NOT_ENROLLED` |
| Restore active after pause | **PASS** (5 active again; gate ok) |
| Frontend route / flag OFF | **PASS** (flag not enabled; no Vercel change) |
| Edge `rating-v5-complete-assessment` | **PASS** (HTTP &lt; 500 on OPTIONS/POST probe) |
| V2 unchanged | **PASS** (`0 → 0`) |
| Rating events created | **0** PASS |

## Kill-switch

Documented restore / emergency SQL (also in Production Disable Runbook):

```sql
UPDATE public.rating_v5_rollout_config
SET
  allow_v5_assessment = false,
  updated_at = now()
WHERE id = 'default';
```

Verification during this gate:

1. Temporarily set `allow_v5_assessment=false`
2. Enrolled Wave A gate → `ROLLOUT_BLOCKED`
3. Restored `allow_v5_assessment=true` **only after all checks PASS**

Final live config is **enabled** (`allow_v5_assessment=true`). No test toggle left off.

---

## Final verdict

```text
DB ROLLOUT ENABLED: PASS
ALLOW_V5_ASSESSMENT: true
SHADOW MODE: true
COMPARE_V2: true
ENROLLED SERVER GATE: PASS
NON-ENROLLED BLOCK: PASS
CROSS-TENANT BLOCK: PASS
FRONTEND FLAG: false
RATING EVENTS: 0
V2 ISOLATION: PASS
READY TO ENABLE PRODUCTION FRONTEND: YES
READY TO ACTIVATE WAVE A: NO
```

**Stop after P1-C.6 for owner review.**
