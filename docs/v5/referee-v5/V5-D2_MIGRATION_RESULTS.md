# V5-D.2 — Migration Results

**Staging ref:** `qyewbxjsiiyufanzcjcq`  
**Applied:** 2026-07-12 (UTC+7 session)

---

## Summary

| Migration | Start | End | Result |
|-----------|-------|-----|--------|
| `phase_v5a_referee_foundation` | 2026-07-12 | 2026-07-12 | **PASS** |
| `phase_v5d_referee_persistence` | 2026-07-12 | 2026-07-12 | **PASS** |
| `phase_v5d1_referee_hardening` | 2026-07-12 | 2026-07-12 | **PASS** |
| `phase_v5d1_referee_hardening_rpcs` | 2026-07-12 | 2026-07-12 | **PASS** |

Method: Supabase MCP `apply_migration` on staging project.

---

## Objects created (V5A)

- Tables: `referee_assignments`, `match_live_states`, `match_events`, `match_game_states`, `match_result_revisions`, `match_incidents`, `match_disputes`, `referee_device_sessions`, `match_sync_mutations`, `match_participant_positions`
- Permissions: `referee_v5.*` (6 rows)
- RLS enabled (policies deferred to V5D)

---

## Objects created / altered (V5D)

- Columns: `match_live_states.state_payload`, `state_version`, `updated_by`
- Columns: `match_events.command_*`, hash columns
- Partial unique index: `match_events_idempotency_partial_idx`
- Replay index: `match_events_replay_idx`
- Helpers: `referee_v5_match_state_id`, `referee_v5_current_user_has_assignment`, `referee_v5_is_super_admin`
- RPCs: `referee_v5_get_match_state`, `referee_v5_apply_match_command` (shell), `referee_v5_finalize_match_result` (shell)
- RLS policies: referee select + client write deny

---

## Objects created / altered (V5D1)

- Table: `match_integration_outbox`
- Columns: `match_sync_mutations.request_hash`, `match_live_states.state_hash`, `referee_assignments.expires_at`
- Triggers: `trg_match_events_deny_update`, `trg_match_events_deny_delete`
- Internal RPCs: `referee_v5_commit_match_transition`, `referee_v5_commit_match_finalization`
- Revoked: `referee_v5_apply_match_command`, `referee_v5_finalize_match_result` from `authenticated`
- Grants: internal commit RPCs → `service_role` only

---

## Warnings

- V5D1 applied in two MCP steps (schema/triggers, then RPCs) — functionally equivalent to single file apply.
- No production apply performed.

---

## Evidence

- `docs/v5/qa-evidence/phase-v5d2/VERIFY_REPORT.json`
- `scripts/apply-phase-v5d2-staging.mjs`
