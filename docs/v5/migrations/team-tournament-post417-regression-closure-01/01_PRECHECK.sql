-- ═══════════════════════════════════════════════════════════════════
-- 01_PRECHECK.sql
-- Package: team-tournament-post417-regression-closure-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
-- STAGING_MUTATIONS=0 in first turn.
-- ═══════════════════════════════════════════════════════════════════

do $$
declare
  v_missing text[] := '{}';
begin
  if to_regclass('public.team_tournaments') is null then
    raise exception 'PRECHECK_FAIL: public.team_tournaments missing';
  end if;
  if to_regclass('public.canonical_tournaments') is null then
    raise exception 'PRECHECK_FAIL: public.canonical_tournaments missing';
  end if;
  if to_regclass('public.team_tournament_disciplines') is null then
    v_missing := array_append(v_missing, 'team_tournament_disciplines');
  end if;
  if to_regclass('public.team_tournament_teams') is null then
    v_missing := array_append(v_missing, 'team_tournament_teams');
  end if;
  if to_regclass('public.team_tournament_team_members') is null then
    v_missing := array_append(v_missing, 'team_tournament_team_members');
  end if;
  if to_regclass('public.team_tournament_groups') is null then
    v_missing := array_append(v_missing, 'team_tournament_groups');
  end if;
  if to_regprocedure('public.team_tournament_create(text,text,text,text,text,text,jsonb)') is null then
    v_missing := array_append(v_missing, 'team_tournament_create');
  end if;
  if to_regprocedure('public.team_tournament_resolve_header(text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_resolve_header');
  end if;
  if to_regprocedure('public.team_tournament_can_manage()') is null then
    v_missing := array_append(v_missing, 'team_tournament_can_manage');
  end if;
  if to_regprocedure('public.team_tournament_assert_tenant(text)') is null then
    v_missing := array_append(v_missing, 'team_tournament_assert_tenant');
  end if;

  if array_length(v_missing, 1) is not null then
    raise exception 'PRECHECK_FAIL: missing %', array_to_string(v_missing, ', ');
  end if;
end;
$$;
