-- team-tournament-post-lineup-complete-lifecycle-01 / 04_ROLLBACK
-- Drops close/readiness/search RPCs introduced by this package.
-- Restores setup config whitelist to pre-package:
-- re-apply team-tournament-stage-tiebreak-policy-01 update_setup_config body.

drop function if exists public.team_tournament_close_tournament(text, jsonb, integer, text);
drop function if exists public.team_tournament_assert_close_readiness(uuid);
drop function if exists public.team_tournament_search_referee_candidates(text, text, integer);

do $$
begin
  raise notice 'ROLLBACK_NOTE: close/readiness/search RPCs dropped. Re-apply stage-tiebreak-policy-01 02_APPLY update_setup_config segment to restore prior whitelist without qualifiersPerGroup/stageScoringPolicy hardenings.';
end $$;
