-- ═══════════════════════════════════════════════════════════════════
-- 04_ROLLBACK.sql
-- Package: team-tournament-captain-access-control-01
-- DO NOT APPLY without Owner GO.
--
-- Removes NEW captain-access helpers/RPCs introduced by 02_APPLY.
-- Does NOT restore pre-gate bodies of:
--   team_tournament_save_lineup_draft_legacy
--   team_tournament_get_visible_lineups
--   team_tournament_submit_dreambreaker_order
-- Those require re-applying the prior owning phase SQL if full rollback is needed.
-- Does NOT strip captainAccessEnabled keys from settings (safe leave-in-place).
-- ═══════════════════════════════════════════════════════════════════

drop function if exists public.team_tournament_get_captain_portal(text, integer);
drop function if exists public.team_tournament_set_captain_access(text, boolean, integer, text);
drop function if exists public.team_tournament_assert_captain_portal_access(text, text);
drop function if exists public.team_tournament_guard_captain_portal_write(public.team_tournaments, text);
drop function if exists public.team_tournament_captain_access_enabled(jsonb);

-- Optional: leave settings.captainAccessEnabled in place (idempotent / non-destructive).
-- To strip keys (Owner-only, destructive):
-- update public.team_tournaments
-- set settings = settings - 'captainAccessEnabled' - 'captainAccess'
-- where settings ? 'captainAccessEnabled' or settings ? 'captainAccess';

notify pgrst, 'reload schema';

select 'ROLLBACK_PARTIAL_OK' as status,
  'Re-apply prior TT2C/TT1B/dreambreaker SQL to restore gated write function bodies if required.' as note;
