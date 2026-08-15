# Live Staging read-only audit

**STAGING_PROJECT=qyewbxjsiiyufanzcjcq**
**STAGING_MUTATIONS=0**
**PRODUCTION_ACCESSED=NO**

Authority: live database (information_schema / pg_catalog). Repository docs are historical only.

## Canonical tables

| Table | EXISTS | RLS | tenant_id | match scope | version | idempotency | append-only |
|---|---|---|---|---|---|---|---|
| referee_assignments | YES | ON | YES | tournament_id + match_id | version | unique role/user | N/A (mutable status) |
| match_live_states | YES | ON | YES | tournament_id + match_id | version + state_version | PK id | snapshot row |
| match_events | YES | ON | YES | match_state_id | event_sequence | unique (match_state_id, idempotency_key) WHERE NOT NULL | YES (UPDATE/DELETE trigger) |
| match_result_revisions | YES | ON | YES | tournament_id + match_id | revision unique | unique (tenant, tournament, match, idempotency_key) | new row / supersedes_revision |
| match_sync_mutations | YES | ON | YES | match_state_id | resulting_state_version | unique (match_state_id, idempotency_key) | ledger |

Also present: match_game_states, match_incidents, match_disputes, referee_device_sessions, match_participant_positions, match_integration_outbox.

## Security (RLS is the write gate)

ANON_TABLE_WRITE=DENY (RLS: no anon policies; fail-closed). Table GRANTs still exist historically; RLS denies.

ANON_INTERNAL_RPC_EXECUTE=DENY for `referee_v5_commit_match_transition` and `referee_v5_commit_match_finalization`.

BROWSER_DIRECT_INTERNAL_MUTATION=DENY (`*_no_client_write` policies `USING false`).

AUTHENTICATED_READ_IS_ASSIGNMENT_SCOPED=YES for live states/events via `referee_v5_current_user_has_assignment` + `auth.uid()`.

TENANT_SCOPE_PRESENT=YES (`tenant_id` on all canonical tables).

SERVICE_ROLE_INTERNAL_COMMIT_ONLY=YES for V5 commit/finalize RPCs (`anon_exec=false`, `auth_exec=false`, `svc_exec=true`).

EVENT_UPDATE_DELETE_DENIED=YES (`trg_match_events_deny_update/delete`).

Canonical identity: `auth.uid()`. Name/email/phone is not write authority.

## RPCs reused

- `referee_v5_get_match_state` — assignment-scoped GET; returns `state_payload`
- `referee_v5_commit_match_transition` — generic assignment check (no Team bridge)
- `referee_v5_commit_match_finalization` — official revision insert + lock
- `referee_v5_match_state_id` — `tenant::tournament::match`
- `referee_v5_current_user_has_assignment` — `auth.uid()` scoped

## Compatibility-only (do not use as generic CE authority)

- `referee_v5_assert_assignment_write` — Team bridge required (`bridge_not_found`)
- `referee_v5_apply_match_command` — V5 scoring path
- `referee_v5_apply_admin_result_revision` — Team audit/outbox
- Token RPCs (`referee_get_match_by_token`, Internal/Official ensure/commit)

## Compatibility mapping (not destructive)

- `tournament_id` = competitionId
- CORE payloads live in `match_live_states.state_payload` with `stateSchemaVersion=1` envelope required by existing commit RPC
- CORE-17 ACTIVE = latest accepted revision; SUPERSEDED retained; live `status` confirmed/overridden
- `team_a_id` / `team_b_id` NOT NULL on insert (SIDE_A / SIDE_B placeholders allowed)

LIVE_DB_COMPATIBLE_WITH_END_A=YES
MIGRATION_DELTA_REQUIRED=NO
