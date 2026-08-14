-- ═══════════════════════════════════════════════════════════════════
-- 04_ROLLBACK.sql
-- Package: team-tournament-production-alignment-01
-- LOCAL / Owner GO only.
-- Restores exact pre-alignment bodies captured in
-- public.team_tournament_alignment_01_prestate.
--
-- Fail closed if post-alignment Team Tournament canonical rows exist
-- (fresh Owner creates after apply). Does not drop live business data.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_post int := 0;
  r record;
begin
  select count(*)::int into v_post
  from public.canonical_tournaments
  where mode = 'team_tournament';

  if v_post > 0 then
    raise exception 'ROLLBACK_COMPLETE=NO post_alignment_canonical_team_tournaments=%', v_post;
  end if;

  if to_regclass('public.team_tournament_alignment_01_prestate') is null then
    raise exception 'ROLLBACK_COMPLETE=NO missing_prestate_snapshot';
  end if;

  -- Drop alignment-owned RPCs (new + replacement overloads). Prestate restore follows.
  drop function if exists public.team_tournament_create(text, text, text, text, text, text, jsonb);
  drop function if exists public.team_tournament_ensure_canonical(text, text, text, text, text);
  drop function if exists public.team_tournament_merge_mlp_initial_settings(jsonb);
  drop function if exists public.team_tournament_seed_mlp_disciplines(public.team_tournaments);
  drop function if exists public.team_tournament_initial_setup_team_data(public.team_tournaments);
  drop function if exists public.team_tournament_status_is_athlete_visible(text);
  drop function if exists public.team_tournament_can_view_dashboard(text, boolean, boolean, boolean);
  drop function if exists public.team_tournament_get_dashboard(text);
  drop function if exists public.team_tournament_list_my_dashboards();
  drop function if exists public.team_tournament_commit_pairing(text, jsonb, jsonb, jsonb, integer);
  drop function if exists public.team_tournament_update_setup_config(text, jsonb, integer, text);
  drop function if exists public.team_tournament_set_captain_access(text, boolean, integer, text);
  drop function if exists public.team_tournament_get_captain_portal(text, integer);
  drop function if exists public.team_tournament_get_visible_lineups(text, text, text);
  drop function if exists public.team_tournament_captain_access_enabled(jsonb);
  drop function if exists public.team_tournament_assert_captain_portal_access(text, text);
  drop function if exists public.team_tournament_guard_captain_portal_write(public.team_tournaments, text);
  drop function if exists public.team_tournament_save_lineup_draft(text, text, text, jsonb, integer, text);
  drop function if exists public.team_tournament_submit_lineup(text, text, text, jsonb, integer, text);
  drop function if exists public.team_tournament_publish_matchup(text, text, integer, integer, integer, text);
  drop function if exists public.team_tournament_save_sub_match_draft(text, text, text, jsonb, integer, text);
  drop function if exists public.team_tournament_upsert_standings(text, jsonb, integer, text);
  drop function if exists public.team_tournament_override_lineup(text, text, text, jsonb, text, integer, integer, text);
  drop function if exists public.team_tournament_get_lineup_override_ops(text, text, text);
  drop function if exists public.team_tournament_lineup_override_ops(public.team_tournaments, public.team_tournament_matchups, public.team_tournament_lineups, text);
  drop function if exists public.team_tournament_close_tournament(text, jsonb, integer, text);
  drop function if exists public.team_tournament_assert_close_readiness(uuid);
  drop function if exists public.team_tournament_resolve_stage_tiebreak_policy(public.team_tournaments, public.team_tournament_matchups);
  drop function if exists public.team_tournament_resolve_competition_stage(public.team_tournament_matchups);
  drop function if exists public.team_tournament_stage_tiebreak_locked_stages(uuid);
  drop function if exists public.team_tournament_search_referee_candidates(text, text, integer);
  drop function if exists public.team_tournament_revoke_referee_assignment(text, uuid, integer, text, text);
  drop function if exists public.team_tournament_list_referee_assignments(text, text);
  drop function if exists public.team_tournament_referee_competition_athlete_directory(text);
  drop function if exists public.team_tournament_sub_match_score_ops(public.team_tournaments, public.team_tournament_matchups, public.team_tournament_sub_matches);
  drop function if exists public.team_tournament_referee_link_blocks_legacy(text);
  drop function if exists public.team_tournament_write_lineup_revision(
    text, text, uuid, text, text, text, jsonb, jsonb, integer, integer, text, text, text
  );
  drop function if exists public.team_tournament_user_player_id();

  -- Restore exact captured pre-alignment bodies/signatures.
  for r in
    select def from public.team_tournament_alignment_01_prestate order by proname, args
  loop
    execute r.def;
  end loop;

  delete from public.team_tournament_package_apply_ledger
  where package_id = 'team-tournament-production-alignment-01';

  drop table if exists public.team_tournament_alignment_01_prestate;

  raise notice 'ROLLBACK_COMPLETE=YES ROLLBACK_RESTORES_PRESTATE=YES';
end;
$$;
