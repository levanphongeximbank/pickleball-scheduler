-- team-tournament-scenario-b-final-progression-referee-01 / 03_VERIFY
-- LOCAL ONLY. Read-only after APPLY.

do $$
declare
  v_replace text;
  v_create text;
  v_advance text;
  v_uniq int;
begin
  if to_regprocedure('public.team_tournament_advance_knockout_winner(uuid)') is null then
    raise exception 'VERIFY_FAIL: advance_knockout_winner missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.team_tournament_matchups'::regclass
      and tgname = 'team_tournament_advance_knockout_winner_trg'
      and not tgisinternal
  ) then
    raise exception 'VERIFY_FAIL: advance trigger missing';
  end if;

  v_advance := pg_get_functiondef('public.team_tournament_advance_knockout_winner(uuid)'::regprocedure);
  if position('winnerTeamId' in v_advance) = 0 then
    raise exception 'VERIFY_FAIL: advance does not read canonical winnerTeamId';
  end if;

  v_replace := pg_get_functiondef(
    'public.team_tournament_replace_matchups(text, jsonb, integer, text)'::regprocedure
  );
  if position('''nextSlot''' in v_replace) = 0 then
    raise exception 'VERIFY_FAIL: replace_matchups does not persist nextSlot';
  end if;

  v_create := pg_get_functiondef(
    'public.team_tournament_create_referee_assignment(text, text, text, uuid, timestamptz, boolean, text, text)'::regprocedure
  );
  if position('unique_violation' in v_create) = 0 then
    raise exception 'VERIFY_FAIL: create_referee_assignment missing unique_violation handler';
  end if;
  if position('MATCHUP_TEAMS_UNRESOLVED' in v_create) = 0 then
    raise exception 'VERIFY_FAIL: create_referee_assignment missing unresolved-placeholder guard';
  end if;
  if position('REFEREE_ASSIGNMENT_CONFLICT' in v_create) = 0 then
    raise exception 'VERIFY_FAIL: create_referee_assignment missing REFEREE_ASSIGNMENT_CONFLICT';
  end if;

  select count(*) into v_uniq
  from pg_constraint
  where conrelid = 'public.referee_assignments'::regclass
    and conname = 'referee_assignments_tenant_id_tournament_id_match_id_role_r_key';
  if v_uniq <> 1 then
    raise exception 'VERIFY_FAIL: referee unique constraint missing or duplicated';
  end if;

  raise notice 'VERIFY_PASS: team-tournament-scenario-b-final-progression-referee-01';
end $$;
