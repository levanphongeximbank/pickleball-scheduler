-- team-tournament-final-nextslot-null-remediation-01 / 01_PRECHECK
-- LOCAL ONLY. Do not apply without Owner GO.
-- Forward-only. NEVER re-run final-progression-referee / scenario-b-ko / close-uuid.

do $$
declare
  v_advance text;
begin
  if to_regprocedure('public.team_tournament_advance_knockout_winner(uuid)') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_advance_knockout_winner missing — prior package required';
  end if;

  if to_regprocedure('public.team_tournament_replace_matchups(text, jsonb, integer, text)') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_replace_matchups missing';
  end if;

  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'public.team_tournament_matchups'::regclass
      and tgname = 'team_tournament_advance_knockout_winner_trg'
      and not tgisinternal
  ) then
    raise exception 'PRECHECK_FAIL: advance trigger missing';
  end if;

  v_advance := pg_get_functiondef(
    'public.team_tournament_advance_knockout_winner(uuid)'::regprocedure
  );
  if position('v_slot not in' in v_advance) > 0 then
    raise notice 'PRECHECK_NOTICE: NULL NOT IN nextSlot bug present (Owner B historical fallback)';
  end if;

  if to_regprocedure('public.team_tournament_resolve_knockout_next_slot(jsonb)') is not null then
    raise notice 'PRECHECK_NOTICE: resolve_knockout_next_slot already exists (re-apply will replace)';
  end if;

  raise notice 'PRECHECK_PASS: team-tournament-final-nextslot-null-remediation-01';
end $$;
