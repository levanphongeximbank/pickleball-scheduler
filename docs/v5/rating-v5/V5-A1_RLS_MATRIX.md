# V5-A.1 — RLS Matrix

**SQL source:** `PHASE_V5A_RATING_FOUNDATION.sql` | **Runtime:** JWT verified — see [`V5-A3_JWT_RLS_RUNTIME_RESULTS.md`](./V5-A3_JWT_RLS_RUNTIME_RESULTS.md)

**Tables (9/9):** [`V5-FOUNDATION_9_TABLES.md`](./V5-FOUNDATION_9_TABLES.md)

Legend: ✅ allowed | ❌ denied | RPC = only via SECURITY DEFINER function | — = N/A

## player_rating_profiles

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| PLAYER | ✅ own tenant | ❌ | ❌ | ❌ |
| CLUB_MANAGER | ✅ view_any same tenant | ❌ | ❌ | ❌ |
| VENUE_MANAGER | ✅ view_any same tenant | ❌ | ❌ | ❌ |
| REFEREE | — | ❌ | ❌ | ❌ |
| COACH | — | ❌ | ❌ | ❌ |
| SYSTEM_TECHNICIAN | ✅ view_any | ❌ | ❌ | ❌ |
| SUPER_ADMIN | ✅ view_any | ❌ | ❌ | ❌ |
| Service RPC | ✅ | RPC | RPC | ❌ |

Public read: `player_rating_profiles_public_v5` (display_rating, status, reliability — no deviation internals).

## player_skill_assessments

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| PLAYER | ✅ own | ✅ draft only, no computed fields | ✅ draft only, no computed | ❌ |
| CLUB_MANAGER | ✅ view_any | ❌ | ❌ | ❌ |
| VENUE_MANAGER | ✅ view_any | ❌ | ❌ | ❌ |
| REFEREE | — | ❌ | ❌ | ❌ |
| COACH | — | ❌ | ❌ | ❌ |
| SYSTEM_TECHNICIAN | ✅ view_any | RPC | RPC | ❌ |
| SUPER_ADMIN | ✅ view_any | RPC | RPC | ❌ |
| Service RPC | ✅ | RPC complete | RPC complete | ❌ |

Draft rules: `provisional_rating`, `initial_mean`, `skill_vector` must be null/`{}` on insert/update.

## player_rating_events

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| PLAYER | ✅ own | ❌ | ❌ | ❌ |
| CLUB_MANAGER | ✅ view_any | ❌ | ❌ | ❌ |
| VENUE_MANAGER | ✅ view_any | ❌ | ❌ | ❌ |
| REFEREE | — | ❌ | ❌ | ❌ |
| COACH | — | ❌ | ❌ | ❌ |
| SYSTEM_TECHNICIAN | ✅ view_any | RPC | ❌ trigger | ❌ trigger |
| SUPER_ADMIN | ✅ view_any | RPC | ❌ trigger | ❌ trigger |
| Service RPC | ✅ | ✅ engine | ❌ | ❌ |

Corrections: compensating event only — never UPDATE/DELETE (trigger).

## rating_evidence

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| PLAYER | ✅ own | ✅ pending, level ≤3, self | ❌ | ❌ |
| CLUB_MANAGER | — | ✅ submit | RPC review | ❌ |
| VENUE_MANAGER | — | ✅ submit | RPC review | ❌ |
| REFEREE | — | — | RPC review | ❌ |
| COACH | — | ✅ submit | RPC review | ❌ |
| SYSTEM_TECHNICIAN | ✅ | RPC | RPC | ❌ |
| SUPER_ADMIN | ✅ | RPC | RPC | ❌ |
| Service RPC | ✅ | ✅ | ✅ verify | ❌ |

## rating_snapshots

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| PLAYER | ❌ | ❌ | ❌ | ❌ |
| CLUB_MANAGER | ❌ | ❌ | ❌ | ❌ |
| VENUE_MANAGER | ❌ | ❌ | ❌ | ❌ |
| REFEREE | ❌ | ❌ | ❌ | ❌ |
| COACH | ❌ | ❌ | ❌ | ❌ |
| SYSTEM_TECHNICIAN | RPC | RPC | ❌ | ❌ |
| SUPER_ADMIN | RPC | RPC | ❌ | ❌ |
| Service RPC | ✅ | ✅ | ❌ | ❌ |

## rating_review_cases

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| PLAYER | ✅ own case | ❌ | ❌ | ❌ |
| CLUB_MANAGER | ✅ review_evidence | ❌ | RPC | ❌ |
| VENUE_MANAGER | ✅ review_evidence | ❌ | RPC | ❌ |
| REFEREE | — | ❌ | RPC | ❌ |
| COACH | ✅ review_evidence | ❌ | RPC | ❌ |
| SYSTEM_TECHNICIAN | ✅ | RPC | RPC | ❌ |
| SUPER_ADMIN | ✅ | RPC | RPC | ❌ |
| Service RPC | ✅ | ✅ | ✅ | ❌ |

## rating_calibration_versions

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| PLAYER | ✅ pilot/approved only | ❌ | ❌ | ❌ |
| CLUB_MANAGER | ✅ pilot/approved | ❌ | ❌ | ❌ |
| VENUE_MANAGER | ✅ pilot/approved | ❌ | ❌ | ❌ |
| REFEREE | ✅ pilot/approved | ❌ | ❌ | ❌ |
| COACH | ✅ pilot/approved | ❌ | ❌ | ❌ |
| SYSTEM_TECHNICIAN | ✅ all | ✅ calibration_manage | ✅ | ❌ |
| SUPER_ADMIN | ✅ all | ✅ | ✅ | ❌ |
| Service RPC | ✅ | ✅ | ✅ | ❌ |

Unique index `rating_calibration_one_active_per_scope` prevents multiple active versions per engine scope.

## rating_v5_rollout_config

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| authenticated | ✅ read | ❌ | ❌ | ❌ |
| SYSTEM_TECHNICIAN | ✅ | ✅ calibration_manage | ✅ | ❌ |
| SUPER_ADMIN | ✅ | ✅ | ✅ | ❌ |

## rating_v5_idempotency

| All client roles | ❌ | ❌ | ❌ | ❌ |
| Service RPC | RPC | RPC | ❌ | ❌ |
