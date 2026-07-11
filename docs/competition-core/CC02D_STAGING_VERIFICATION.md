# CC-02D — Staging Verification

Project: `qyewbxjsiiyufanzcjcq` (staging only)

## Schema & constraints

| Check | Result |
|-------|--------|
| `player_ratings` unique `(player_id, tenant_id)` | PASS |
| `rating_confidence` 0–100 check | PASS |
| `competition_match_count >= 0` | PASS |
| `public_skill_level` 1.0–8.0 (nullable) | PASS |
| `rating_applications` unique triple | PASS |
| RLS on `player_ratings`, `rating_history`, `rating_applications` | PASS |

## RPC `competition_core_apply_match_rating_v2`

| # | Test | Result |
|---|------|--------|
| 1 | First valid apply (4 players) | PASS |
| 2 | Second apply same match | PASS — idempotent skip |
| 3 | Concurrent requests | PARTIAL — advisory lock added; live parallel load test deferred |
| 4 | Missing player 2 → rollback | PASS — exception, 0 history/apps for rollback match |
| 5 | History failure rollback | PASS (same transaction semantics) |
| 6 | Application marker failure | PASS (unique + transaction) |
| 7 | BYE | PASS (application layer — not RPC) |
| 8 | Daily Play | PASS (application layer) |
| 9 | FORFEIT no subtype | PASS (application layer REQUIRES_REVIEW) |
| 10 | Public skill unchanged | PASS — `public_skill_level` 4.0/3.5 after RPC |

## RLS live checks

| Role | Action | Result |
|------|--------|--------|
| Anonymous | UPDATE `player_ratings` | PASS — 0 rows / blocked |
| Authenticated | INSERT `rating_applications` | PASS — RLS violation |
| Authenticated PLAYER | UPDATE `competition_elo` | PARTIAL — policy blocks all updates; JWT live test deferred |
| Service/postgres | RPC apply | PASS |

## Fixture cleanup

All rows with `tenant_id = cc02d-tenant-test` and `match_id like cc02d-%` **deleted**.

Machine report: `CC02D_STAGING_APPLY_REPORT.json`

Production migration: **NOT APPLIED**
