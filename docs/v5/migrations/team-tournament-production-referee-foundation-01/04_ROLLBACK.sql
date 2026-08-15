-- ═══════════════════════════════════════════════════════════════════
-- 04_ROLLBACK.sql
-- Package: team-tournament-production-referee-foundation-01
-- Emergency only. LOCAL / Owner GO. Do NOT apply on Production without Owner GO.
--
-- Drops only objects created by this foundation package.
-- Restores no pre-existing business data (none was changed).
-- Does not restore replaced functions (foundation created them; did not replace
-- confirm/save/start).
-- Fails closed on live operational rows or if final continuation is present.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_live text[] := '{}';
begin
  if to_regprocedure(
    'public.team_tournament_resolve_effective_referee_assignment(team_tournaments,team_tournament_matchups,team_tournament_sub_matches)'
  ) is not null then
    raise exception 'ROLLBACK_REFUSED final_continuation_present';
  end if;
  if to_regprocedure(
    'public.team_tournament_ensure_referee_runtime_for_matchup(team_tournaments,team_tournament_matchups,text)'
  ) is not null then
    raise exception 'ROLLBACK_REFUSED final_continuation_ensure_present';
  end if;

  if to_regclass('public.referee_assignments') is not null then
    if exists (select 1 from public.referee_assignments limit 1) then
      v_live := array_append(v_live, 'referee_assignments');
    end if;
  end if;
  if to_regclass('public.match_live_states') is not null then
    if exists (select 1 from public.match_live_states limit 1) then
      v_live := array_append(v_live, 'match_live_states');
    end if;
  end if;
  if to_regclass('public.team_sub_match_referee_links') is not null then
    if exists (select 1 from public.team_sub_match_referee_links limit 1) then
      v_live := array_append(v_live, 'team_sub_match_referee_links');
    end if;
  end if;

  if array_length(v_live, 1) is not null then
    raise exception 'ROLLBACK_REFUSED live_data=%', array_to_string(v_live, ',');
  end if;
end;
$$;

drop table if exists public.team_sub_match_referee_links;
drop table if exists public.match_live_states;
drop table if exists public.referee_assignments;

drop function if exists public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text);
drop function if exists public.team_tournament_provision_eligibility(team_tournaments, team_tournament_matchups, team_tournament_sub_matches, uuid);
drop function if exists public.team_tournament_build_v5_state_shell(text, text, text, text[], text[], text, jsonb);
drop function if exists public.team_tournament_sub_match_is_dreambreaker(team_tournament_sub_matches, team_tournament_matchups);
drop function if exists public.referee_v5_current_user_has_assignment(text, text, text, text[]);
drop function if exists public.referee_v5_match_state_id(text, text, text);
drop function if exists public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz);

select 'ROLLBACK_COMPLETE foundation objects dropped; prestate restored' as status;
