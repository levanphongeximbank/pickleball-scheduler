-- team-tournament-close-uuid-type-remediation-01 / 01_PRECHECK
-- LOCAL ONLY. Do not apply without Owner GO.
-- Forward-only after lifecycle-01. Never re-run lifecycle or owner-browser-acceptance APPLY.

do $$
declare
  v_canon_id_type text;
  v_tt_tid_type text;
  v_close text;
begin
  if to_regprocedure('public.team_tournament_close_tournament(text, jsonb, integer, text)') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_close_tournament(text, jsonb, integer, text) missing';
  end if;

  if to_regprocedure('public.team_tournament_assert_close_readiness(uuid)') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_assert_close_readiness(uuid) missing';
  end if;

  if to_regclass('public.canonical_tournaments') is null then
    raise exception 'PRECHECK_FAIL: canonical_tournaments missing';
  end if;

  if to_regclass('public.team_tournaments') is null then
    raise exception 'PRECHECK_FAIL: team_tournaments missing';
  end if;

  select c.data_type
    into v_canon_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'canonical_tournaments'
    and c.column_name = 'id';

  if v_canon_id_type is distinct from 'uuid' then
    raise exception 'PRECHECK_FAIL: canonical_tournaments.id expected uuid (EXPECTED_CANONICAL_TYPE) got %',
      coalesce(v_canon_id_type, '<missing>');
  end if;

  select c.data_type
    into v_tt_tid_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'team_tournaments'
    and c.column_name = 'tournament_id';

  if v_tt_tid_type is distinct from 'text' then
    raise exception 'PRECHECK_FAIL: team_tournaments.tournament_id expected text got %',
      coalesce(v_tt_tid_type, '<missing>');
  end if;

  v_close := pg_get_functiondef(
    'public.team_tournament_close_tournament(text, jsonb, integer, text)'::regprocedure
  );

  if position('id = v_header.tournament_id' in v_close) > 0
     and position('id = nullif(btrim(coalesce(v_header.tournament_id' in v_close) = 0 then
    raise notice 'PRECHECK_NOTICE: live close body still has uncast id = v_header.tournament_id (uuid=text dual-write bug present)';
  end if;

  if position('id = p_tournament_id' in v_close) > 0
     and position('id = nullif(btrim(coalesce(p_tournament_id' in v_close) = 0 then
    raise notice 'PRECHECK_NOTICE: live close body still has uncast id = p_tournament_id (uuid=text dual-write bug present)';
  end if;

  raise notice 'PRECHECK_PASS: team-tournament-close-uuid-type-remediation-01';
end $$;
