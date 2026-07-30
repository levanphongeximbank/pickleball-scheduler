# A-RATE Staging rollout + Owner pilot activation

**Target only:** Staging `qyewbxjsiiyufanzcjcq`  
**Production forbidden:** `expuvcohlcjzvrrauvud`  
**Owner GO required before apply.**

## Why

After Owner RBAC grant (`rating_v5.assess_self`), `rating_v5_start_assessment` still fails pilot gate:

1. `ROLLOUT_BLOCKED` — `rating_v5_rollout_config` had **0** rows (`id='default'` missing)
2. `PILOT_NOT_ENROLLED` — `rating_v5_pilot_enrollments` had **0** rows

## Actor pin (no display name)

Exactly one Operator actor resolved from durable A-CLUB write provenance:

| Signal | Value |
|--------|--------|
| Club name | `HC Operator Seed Club venue-staging-a` |
| `tenant_id` | `venue-staging-a` |
| `created_by_user_id` (masked) | `13e0***af9c` |
| auth / profile / rating `player_id` | same UUID (Rating V5 uses `auth.uid()`) |
| Other `VENUE_OWNER` on venue | **not** enrolled (`0` HC Operator clubs) |

## Package

| File | Action |
|------|--------|
| `10_ROLLOUT_CONFIG.sql` | Upsert `id='default'` with only `shadow_mode_enabled`, `allow_v5_assessment`, `pilot_cohort_label` (other columns = table defaults) |
| `20_PILOT_ENROLLMENT.sql` | Upsert one active enrollment for pinned actor + `venue-staging-a` |
| `90_ROLLBACK.sql` | Delete exact enrollment key + default config if cohort matches (manual only) |
| `99_VERIFY.sql` | Read-only row + `rating_v5_assert_pilot_gate` check |

Does **not**: grant RBAC, create Auth users, enroll the second Owner, open Production, enable calibration/admin, run Operator Runner.
