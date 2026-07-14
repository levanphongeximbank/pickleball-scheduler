# V5-P1C — Wave A Health Snapshot

**As of:** 2026-07-14 (post P1-C.7)  
**Production:** `expuvcohlcjzvrrauvud`  
**App:** `https://pickleball-scheduler-eight.vercel.app`

## Cohort

| Item | Value |
|------|-------|
| Cohort label | `club-rating-v5-production-wave-a` |
| Active enrollments | **5 / 5** |
| Pilot tenant | `venue-prod-main` |
| Pilot club | `club-219e4a7cbd73437eb6271f02a53314c3` |

## Rollout config

| Field | Value |
|-------|-------|
| `allow_v5_assessment` | `true` |
| `shadow_mode_enabled` | `true` |
| `compare_v2_enabled` | `true` |
| `pilot_cohort_label` | `club-rating-v5-production-wave-a` |
| `max_completed_assessments` | `1` |
| `cooldown_days` | `7` |
| `reassessment_requires_approval` | `true` |

## Frontend

| Field | Value |
|-------|-------|
| `VITE_PICK_VN_RATING_V5_ENABLED` | `true` (Production) |
| Deployment | `dpl_G7djdS9ay5YWeRzda6mmXS4BhkLW` @ `add6286` |

## Activity

| Metric | Value |
|--------|-------|
| Completed Wave A assessments | **1** (WA-03 smoke) |
| Canonical rating events | **1** |
| Duplicate complete events | **0** |
| V2 rows | **0** |
| Partial writes observed | **0** |

## Kill switch (document only — not armed)

1. `VITE_PICK_VN_RATING_V5_ENABLED=false` → redeploy Production  
2. `UPDATE rating_v5_rollout_config SET allow_v5_assessment=false WHERE id='default'`  
3. Pause Wave A enrollments (`status='paused'`)  
4. Preserve assessments/events/profiles (no DELETE)

## Remaining risks

- Only 1/5 users has completed assessment (smoke only).  
- `profiles.venue_id` must remain `venue-prod-main` for enrollment UI SOT.  
- Reassessment blocked until approval/cooldown policy satisfied (`max_completed_assessments=1`).
