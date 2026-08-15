# Rollback contract

ROLLBACK_COMPLETE=YES  
ROLLBACK_FAILS_CLOSED_ON_LIVE_DATA=YES  
ROLLBACK_RESTORES_PRESTATE=YES

`04_ROLLBACK.sql`:

1. REFUSE if final continuation functions exist (`resolve_effective`, `ensure_runtime`).
2. REFUSE if `referee_assignments`, `match_live_states`, or
   `team_sub_match_referee_links` contain any row.
3. DROP only functions created by this package.
4. DROP the three foundation tables.
5. Do not drop pre-existing `start_dreambreaker` / `confirm_sub_match`.

No pre-existing business data was changed, so none is restored.
