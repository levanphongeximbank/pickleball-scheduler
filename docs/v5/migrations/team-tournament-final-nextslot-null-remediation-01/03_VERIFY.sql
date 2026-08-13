-- team-tournament-final-nextslot-null-remediation-01 / 03_VERIFY
-- LOCAL ONLY. Read-only after APPLY.

do $$
declare
  v_advance text;
  v_resolve text;
begin
  if to_regprocedure('public.team_tournament_resolve_knockout_next_slot(jsonb)') is null then
    raise exception 'VERIFY_FAIL: resolve_knockout_next_slot missing';
  end if;

  if to_regprocedure('public.team_tournament_reconcile_knockout_progression(uuid)') is null then
    raise exception 'VERIFY_FAIL: reconcile_knockout_progression missing';
  end if;

  v_resolve := pg_get_functiondef(
    'public.team_tournament_resolve_knockout_next_slot(jsonb)'::regprocedure
  );
  if position('is not distinct from' in v_resolve) = 0
     and position('IS NOT DISTINCT FROM' in v_resolve) = 0 then
    raise exception 'VERIFY_FAIL: resolver must use IS DISTINCT FROM (not NOT IN)';
  end if;
  if position('not in' in lower(v_resolve)) > 0 then
    raise exception 'VERIFY_FAIL: resolver still uses NOT IN';
  end if;

  v_advance := pg_get_functiondef(
    'public.team_tournament_advance_knockout_winner(uuid)'::regprocedure
  );
  if position('team_tournament_resolve_knockout_next_slot' in v_advance) = 0 then
    raise exception 'VERIFY_FAIL: advance does not call canonical slot resolver';
  end if;
  if position('v_slot not in' in v_advance) > 0 then
    raise exception 'VERIFY_FAIL: advance still has NULL NOT IN nextSlot bug';
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.referee_assignments'::regclass
      and conname = 'referee_assignments_tenant_id_tournament_id_match_id_role_r_key'
  ) then
    raise exception 'VERIFY_FAIL: referee unique constraint missing';
  end if;

  -- Resolver contract: NULL / blank / invalid → matchNumberInRound.
  if public.team_tournament_resolve_knockout_next_slot(jsonb_build_object('nextSlot', 'A')) is distinct from 'A' then
    raise exception 'VERIFY_FAIL: explicit A';
  end if;
  if public.team_tournament_resolve_knockout_next_slot(jsonb_build_object('nextSlot', 'B')) is distinct from 'B' then
    raise exception 'VERIFY_FAIL: explicit B';
  end if;
  if public.team_tournament_resolve_knockout_next_slot(jsonb_build_object('matchNumberInRound', 1)) is distinct from 'A' then
    raise exception 'VERIFY_FAIL: NULL nextSlot match 1 → A';
  end if;
  if public.team_tournament_resolve_knockout_next_slot(jsonb_build_object('matchNumberInRound', 2)) is distinct from 'B' then
    raise exception 'VERIFY_FAIL: NULL nextSlot match 2 → B';
  end if;
  if public.team_tournament_resolve_knockout_next_slot(jsonb_build_object('nextSlot', '', 'matchNumberInRound', 2)) is distinct from 'B' then
    raise exception 'VERIFY_FAIL: blank nextSlot fallback';
  end if;
  if public.team_tournament_resolve_knockout_next_slot(jsonb_build_object('nextSlot', 'Z', 'matchNumberInRound', 2)) is distinct from 'B' then
    raise exception 'VERIFY_FAIL: invalid nextSlot fallback';
  end if;

  -- Owner B Final after APPLY reconcile (skip if fixture absent).
  if exists (
    select 1 from public.team_tournaments
    where tournament_id = 'e3f37ef7-befe-4421-b694-8af57ba92a5d'
  ) then
    if exists (
      select 1
      from public.team_tournaments tt
      join public.team_tournament_matchups f
        on f.team_tournament_id = tt.id
       and f.external_matchup_id = 'ko-mugj641t'
      join public.team_tournament_matchups sf1
        on sf1.team_tournament_id = tt.id
       and sf1.external_matchup_id = 'ko-7ebydj8c'
      join public.team_tournament_matchups sf2
        on sf2.team_tournament_id = tt.id
       and sf2.external_matchup_id = 'ko-fttp83ax'
      where tt.tournament_id = 'e3f37ef7-befe-4421-b694-8af57ba92a5d'
        and (
          coalesce(f.team_a_id, '') is distinct from coalesce(sf1.result->>'winnerTeamId', '')
          or coalesce(f.team_b_id, '') is distinct from coalesce(sf2.result->>'winnerTeamId', '')
        )
    ) then
      raise exception 'VERIFY_FAIL: Owner B Final not reconciled from canonical SF winners';
    end if;
  end if;

  raise notice 'VERIFY_PASS: team-tournament-final-nextslot-null-remediation-01';
end $$;
