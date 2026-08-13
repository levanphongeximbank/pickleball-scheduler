# Provenance mapping

Historical sources were used as **reference semantics only**. They were not copied
as execution units.

| Foundation object | Semantics from | Notes |
|-------------------|----------------|-------|
| `referee_assignments` | `PHASE_V5A_REFEREE_FOUNDATION.sql` + `TT5-D_ASSIGNMENT_SAFETY.sql` + V5-D1 `expires_at` | Baked CREATE TABLE. No ALTER chain. |
| `match_live_states` | V5-A + V5-D `state_payload` / `state_version` | Baked. No V5-A UPDATE backfill. |
| `team_sub_match_referee_links` | `TT5-B_BRIDGE_SCHEMA.sql` | RLS rewritten: `user_venue_id()` + assignment helper. No `profiles.venue_id` inline. |
| `referee_v5_assignment_effective_status` | `TT5-D_ASSIGNMENT_SAFETY.sql` | STABLE (uses `now()`). |
| `referee_v5_match_state_id` | `PHASE_V5D_REFEREE_PERSISTENCE.sql` | Unchanged formula. |
| `build_v5_state_shell` | `TT5-B_PROVISION_RPC.sql` | Internal helper. No anon/authenticated EXECUTE. |
| `provision_eligibility` | `TT5-B_PROVISION_RPC.sql` | Pre-canonical body kept so final VERIFY can prove the upgrade. |
| `create_referee_assignment` | `team-tournament-scenario-b-final-progression-referee-01` | Child-only. No `v_parent`. Final continuation replaces. |

Explicitly not copied: V5-D3 fault injection, V5-D1 outbox, permission INSERTs,
Staging QA seeds, Rating V5, TT6, Daily/Internal/Official SQL.
