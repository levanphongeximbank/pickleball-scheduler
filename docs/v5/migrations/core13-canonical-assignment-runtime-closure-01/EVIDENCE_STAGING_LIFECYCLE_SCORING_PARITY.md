# Evidence — Staging lifecycle / scoring parity (PR #444)

Captured 2026-08-20. Read-only Staging audit before surgical apply.

## Target

- `STAGING_PROJECT=qyewbxjsiiyufanzcjcq`
- `PRODUCTION_PROJECT=expuvcohlcjzvrrauvud` (forbidden)
- MCP server `supabase-staging` contains staging ref only
- MCP server `supabase-production` contains production ref only

## Pre-apply function

| Field | Value |
|---|---|
| Signature | `competition_assignment_assert_mutation_boundary(p_tenant_id text, p_tournament_id text, p_match_id text, p_actor_id uuid, p_operation text, p_emergency_replacement boolean DEFAULT false)` |
| Result | `jsonb` |
| Owner | `postgres` |
| Volatility | `STABLE` |
| Security definer | `YES` |
| search_path | `public` |
| ACL | postgres EXECUTE; service_role EXECUTE (anon/authenticated/public revoked) |
| Definition SHA256 (`pg_get_functiondef`, UTF-8) | `d0b889c963a73b9c1eefeebed2857e8b05060bff145634006fa3caad944f2345` |

Root cause in that definition: `coalesce(v_live.last_event_sequence, 0) > 0` classified `SCORING_ACTIVE`.

## match_events schema audited

Physical columns include: `tenant_id`, `tournament_id`, `match_id`, `match_state_id`, `event_sequence`, `command_type`, `event_type`, `generated_events` (jsonb), `payload`.

`MATCH_EVENTS_SCHEMA_AUDITED=YES`

## Exact J SQL (`run-cli-1787196995547`)

- tenant `venue-staging-a`
- tournament `78e33362-59e8-4485-9b8e-a70242623949`
- match `992a6be9-9188-474b-9f06-00b89a9fc2ef`
- live: `status=in_progress`, `last_event_sequence=1`, `team_a_score=0`, `team_b_score=0`
- events: sequence `1`, `command_type=START_MATCH`, `event_type=START_MATCH`

`J_SQL_START_MATCH_PRESENT=YES`  
`J_SQL_SCORING_COMMAND_PRESENT=NO`

## Classifier

Canonical scoring activity (SQL must match JS):

- numeric canonical score > 0 (columns or `state_payload` team scores)
- OR Referee V5 history on the **same** live tenant+tournament+match:
  - `command_type` / `event_type` in `TEAM_A_WON_RALLY`, `TEAM_B_WON_RALLY`
  - and/or `generated_events` containing those or `POINT_AWARDED`

`START_MATCH` / timeout / pause / resume / `SWITCH_ENDS` / sequence>0 alone are not scoring.

Precedence: `COMPLETED > LOCKED > SCORING_ACTIVE > IN_PROGRESS > PRE_MATCH`.  
`SCORING_ACTIVE` refines `IN_PROGRESS` only.

## Artifacts

- Canonical source: `02_APPLY.sql`
- Surgical Staging patch: `06_STAGING_SURGICAL_LIFECYCLE_SCORING_PARITY.sql`
- Rollback (do not execute): `07_STAGING_SURGICAL_LIFECYCLE_SCORING_PARITY_ROLLBACK.sql`
