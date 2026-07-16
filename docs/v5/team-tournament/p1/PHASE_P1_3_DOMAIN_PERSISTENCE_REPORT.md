# P1.3 Domain Persistence

Scope: adds persisted discipline activation metadata and group storage, then supplies setup mutation RPCs for disciplines, groups, matchups, and schedules. Client engines remain responsible for generating every submitted payload; SQL only validates and persists it.

RPC inventory:
- `team_tournament_save_discipline`, `team_tournament_remove_discipline`, `team_tournament_reorder_disciplines`
- `team_tournament_replace_groups`, `team_tournament_clear_groups`
- `team_tournament_replace_matchups`
- `team_tournament_update_matchup_schedule`, `team_tournament_apply_schedule_batch`
- `team_tournament_publish_schedule`, `team_tournament_lock_schedule`

Each accepted command uses command idempotency, writes the domain change, increments the tournament version once, creates one setup snapshot, finishes the command, and writes an audit record. The shared helper rejects closed/cancelled tournaments and schedule writes reject court double-booking.

Staging-only note: review and apply schema, RPC, then get-setup patch in that order on Staging. This package does not apply migrations.

Rollback notes: revoke public RPC execution first to stop new writes. The added group table and new discipline columns can be removed only after confirming no dependent data or snapshots require them. Do not delete setup snapshots as part of a normal rollback; they are immutable audit history.
