# Object inventory

Source of truth: `docs/v5/migrations/team-tournament-production-referee-foundation-01/FOUNDATION_OBJECT_MANIFEST.json`

## Included (10)

Tables: `referee_assignments`, `match_live_states`, `team_sub_match_referee_links`

Functions: `referee_v5_assignment_effective_status`, `referee_v5_match_state_id`,
`referee_v5_current_user_has_assignment`, `team_tournament_sub_match_is_dreambreaker`,
`team_tournament_build_v5_state_shell`, `team_tournament_provision_eligibility` (pre-canonical),
`team_tournament_create_referee_assignment` (pre-canonical)

## Excluded (historical)

Tables: `referee_device_sessions`, `team_tournament_referee_correction_requests`,
`team_tournament_referee_event_inbox`, `match_events`, `match_participant_positions`,
`match_game_states`, `match_result_revisions`, `match_incidents`, `match_disputes`,
`match_sync_mutations`, `match_integration_outbox`

Functions: `provision_referee_match` (SUPERSEDED), `revoke_referee_assignment`,
`list_referee_assignments`, `search_referee_candidates` (owned by post-lineup-complete),
`list_my_referee_assignments` / `resolve_effective` / `result_write_guard` /
`ensure_runtime` (FINAL CONTINUATION), `referee_v5_is_super_admin` (SUPERSEDED by
`is_super_admin`), `team_tournament_tenant_allowed` (STAGING_ONLY), fault injection.
