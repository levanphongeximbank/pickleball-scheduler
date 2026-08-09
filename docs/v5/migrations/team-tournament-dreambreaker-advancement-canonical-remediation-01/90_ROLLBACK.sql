-- Rollback NEW Dreambreaker command RPCs only.
-- Does NOT drop forfeit/withdraw/randomize (may pre-exist on Staging).
-- Does NOT drop recompute/confirm/maybe_activate (shared runtime).

drop function if exists public.team_tournament_submit_dreambreaker_order(text, text, text, jsonb, integer, text);
drop function if exists public.team_tournament_lock_dreambreaker_order(text, text, integer, text);
drop function if exists public.team_tournament_start_dreambreaker(text, text, integer, text);
drop function if exists public.team_tournament_record_dreambreaker_point(text, text, text, integer, text);
drop function if exists public.team_tournament_undo_dreambreaker_point(text, text, integer, text);
drop function if exists public.team_tournament_dreambreaker_injury(text, text, text, text, integer, text);
drop function if exists public.team_tournament_sync_dreambreaker(text, integer, text);
