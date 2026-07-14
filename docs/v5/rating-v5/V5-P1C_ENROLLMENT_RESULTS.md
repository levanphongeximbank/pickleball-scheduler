# V5-P1C.5 — Wave A Enrollment Results

**Gate:** P1-C.5 — ENROLL WAVE A ONLY  
**Date:** 2026-07-14  
**Owner GO:** `PRODUCTION_P1C_ENROLL_GO=YES`  
**Command:** `node scripts/enroll-v5p1c-wave-a.mjs`  
**RPC:** `rating_v5_admin_upsert_pilot_enrollment`  
**Production project:** `expuvcohlcjzvrrauvud`  
**Cohort:** `club-rating-v5-production-wave-a`  
**Tenant:** `venue-prod-main`  
**Enrolled by:** `lephong.eximbank@gmail.com` (`6dd85e98-e493-4e04-9582-d904e27b3a44`)  

Evidence: `docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/2026-07-14T00-37-16-331Z-enroll/`  
Latest pointer: `docs/v5/rating-v5/qa-evidence/v5-p1c-wave-a/LATEST_ENROLLMENT_REPORT.json`

## Scope executed

Create **active** pilot enrollment rows for exactly the five approved Wave A users.

**Not done:** `allow_v5_assessment` · Vercel / `VITE_PICK_VN_RATING_V5_ENABLED` · deploy · assessment start · Rating V2 · `profiles.rollout_cohort`

## Prechecks

| Check | Result |
|-------|--------|
| Production ref | `expuvcohlcjzvrrauvud` PASS |
| 5 approved `profiles.player_id` exist | PASS |
| 5 club memberships active | PASS |
| No unexpected active enrollments before | PASS (0) |
| `allow_v5_assessment` | `false` |
| Local `VITE_PICK_VN_RATING_V5_ENABLED` | unset/false (no override; not changed) |
| V2 `pick_vn_player_ratings` | `0` |
| Rollout + enrollment snapshot | `PRE_ENROLL_SNAPSHOT.json` |

**Config note (unchanged):** `rating_v5_rollout_config.pilot_cohort_label` remains `club-rating-v5-production-pilot`. Wave A rows use cohort `club-rating-v5-production-wave-a` (owner-approved). Aligning config → Wave A is a later DB-rollout GO.

## Enrollment rows

| Slot | Email | enrollment `player_id` (profiles.id) | `profiles.player_id` text | tenant | cohort | status |
|------|-------|--------------------------------------|---------------------------|--------|--------|--------|
| WA-01 | tudotaichinhtuoi29@gmail.com | `c13392ab-…a69a9` | `player-auth-c13392ab-…a69a9` | `venue-prod-main` | `club-rating-v5-production-wave-a` | active |
| WA-02 | hoangmanhluong2405@gmail.com | `6e77321e-…833c7c` | `player-auth-6e77321e-…833c7c` | `venue-prod-main` | `club-rating-v5-production-wave-a` | active |
| WA-03 | lephong.banker@gmail.com | `42c8ad99-…9a302f` | `player-auth-42c8ad99-…9a302f` | `venue-prod-main` | `club-rating-v5-production-wave-a` | active |
| WA-04 | gionam76@gmail.com | `6ff822c6-…fc74a88` | `player-auth-6ff822c6-…fc74a88` | `venue-prod-main` | `club-rating-v5-production-wave-a` | active |
| WA-05 | huonganna120193@gmail.com | `f776d627-…cc923b` | `player-auth-f776d627-…cc923b` | `venue-prod-main` | `club-rating-v5-production-wave-a` | active |

Fields stored: `enrolled_by`, `enrolled_at`, `tenant_id`, `player_id`, `cohort_label`, `expires_at=null`, `notes`, `status=active`.

## Post-enrollment verification

| Check | Result |
|-------|--------|
| Active enrollments | **5 / 5** |
| Each row maps correct player + tenant | PASS |
| Duplicate active Wave A player_ids | **0** |
| Club memberships remain active | PASS (5/5) |
| `allow_v5_assessment` | **false** |
| Frontend flag changed | **NO** |
| V2 rows | **0 → 0** PASS |
| Production identity | confirmed |

### Non-enrolled control

Control: `lephong.eximbank@gmail.com` (SUPER_ADMIN, **not** Wave A)

- Active enrollments for control: **none**
- `rating_v5_assert_pilot_gate(..., start)` → `ROLLOUT_BLOCKED` (**blocked**)

### Cross-tenant check

- All 5 enrollment rows have `tenant_id = venue-prod-main` only.
- Gate probe with wrong tenant also returns `ROLLOUT_BLOCKED` while `allow_v5_assessment=false` (short-circuits before tenant match). Row-level tenant correctness = **PASS**.

### Idempotent retry

Second `rating_v5_admin_upsert_pilot_enrollment` per user:

- Still **5** active rows (no duplicates)
- `ok: true` for all 5
- Version `1 → 2` (upsert update; no second row)

**Idempotency:** PASS (unique `(player_id, cohort_label)`; active count stable)

## Explicit non-actions remaining

- Do **not** enable `allow_v5_assessment` yet  
- Do **not** flip Vercel / `VITE_PICK_VN_RATING_V5_ENABLED`  
- Do **not** start assessments  
- Do **not** activate Wave A UI publicly  

---

## Final verdict

```text
WAVE A ENROLLMENT: PASS
ACTIVE ENROLLMENTS: 5 / expected 5
IDEMPOTENCY: PASS
DUPLICATES: 0 / 0
CROSS-TENANT CHECK: PASS
NON-ENROLLED CONTROL BLOCK: PASS
ALLOW_V5_ASSESSMENT: false
FRONTEND FLAG: false
V2 ISOLATION: PASS
PRODUCTION CHANGED: YES — enrollment records only
READY TO ENABLE DB ROLLOUT: YES
READY TO ACTIVATE WAVE A: NO
```

**Stop after P1-C.5 for owner review.**
