-- team-tournament-scenario-b-final-progression-referee-01 / 01_PRECHECK
-- LOCAL ONLY. Do not apply without Owner GO.
-- Forward-only. NEVER re-run scenario-b-ko-lineup / close-uuid / lifecycle packages.

do $$
declare
  v_replace text;
  v_create text;
begin
  if to_regprocedure('public.team_tournament_replace_matchups(text, jsonb, integer, text)') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_replace_matchups missing';
  end if;

  if to_regprocedure('public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_create_referee_assignment missing';
  end if;

  if to_regclass('public.team_tournament_matchups') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_matchups missing';
  end if;

  if to_regclass('public.referee_assignments') is null then
    raise exception 'PRECHECK_FAIL: referee_assignments missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.referee_assignments'::regclass
      and conname = 'referee_assignments_tenant_id_tournament_id_match_id_role_r_key'
  ) then
    raise exception 'PRECHECK_FAIL: referee unique constraint missing — do not drop it';
  end if;

  v_replace := pg_get_functiondef(
    'public.team_tournament_replace_matchups(text, jsonb, integer, text)'::regprocedure
  );
  if position('nullif(btrim(coalesce(x.value->>''teamAId''' in v_replace) = 0 then
    raise notice 'PRECHECK_NOTICE: replace_matchups may not allow empty KO placeholders';
  end if;

  v_create := pg_get_functiondef(
    'public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'::regprocedure
  );
  if position('unique_violation' in v_create) = 0 then
    raise notice 'PRECHECK_NOTICE: create_referee_assignment does not catch unique_violation yet';
  end if;

  if to_regprocedure('public.team_tournament_advance_knockout_winner(uuid)') is not null then
    raise notice 'PRECHECK_NOTICE: advance_knockout_winner already exists (re-apply will replace)';
  end if;

  raise notice 'PRECHECK_PASS: team-tournament-scenario-b-final-progression-referee-01';
end $$;
