# COMMS-ACT-05 — Smoke fixture cleanup

**Recorded:** 2026-07-25  
**Target:** `qyewbxjsiiyufanzcjcq`  
**Marker:** `COMMS_ACT_05_SMOKE_FIXTURE_`  
**Also cleared:** `context_ref` like `system:comms_act_05_smoke%`  
**Owner GO:** consumed with Staging smoke only

## Method

Harness mode: smoke then automatic cleanup (same process as certification run).  
SQL reference (manual fallback): `docs/communication-foundation/activation/comms-act-05/sql/COMMS_ACT_05_SMOKE_FIXTURES_CLEANUP.sql`

## Counts

| Table / scan | Remaining markers |
|--------------|------------------:|
| `communication_conversations` | **0** |
| `communication_messages` | **0** |
| `communication_idempotency` | **0** |

## Non-touched

- `club_members` / `club_governance_assignments` / `clubs`
- `auth.users` / profiles (no create/update)
- ACT-04 backup directory
- Production `expuvcohlcjzvrrauvud`

## Verdict

`COMMS_ACT_05_SMOKE_FIXTURES_CLEANED_ZERO`
