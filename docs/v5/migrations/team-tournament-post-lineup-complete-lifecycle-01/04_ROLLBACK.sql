-- team-tournament-post-lineup-complete-lifecycle-01 / 04_ROLLBACK
-- Drops close RPC. Restores setup config whitelist to pre-package
-- (re-apply team-tournament-stage-tiebreak-policy-01 update_setup_config body).
-- Owner must re-apply stage-tiebreak package setup_config if full restore needed.

drop function if exists public.team_tournament_close_tournament(text, jsonb, integer, text);

do $$
begin
  raise notice 'ROLLBACK_NOTE: close RPC dropped. Re-apply stage-tiebreak-policy-01 02_APPLY update_setup_config segment to restore prior whitelist without qualifiersPerGroup/stageScoringPolicy.';
end $$;
