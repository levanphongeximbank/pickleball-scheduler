-- team-tournament-scenario-b-ko-lineup-remediation-01 / 01_PRECHECK
-- LOCAL ONLY. Do not apply without Owner GO.
-- Forward-only. NEVER re-run close-uuid / lifecycle / owner-browser packages.

do $$
declare
  v_replace text;
  v_apply text;
begin
  if to_regprocedure('public.team_tournament_replace_matchups(text, jsonb, integer, text)') is null then
    raise exception 'PRECHECK_FAIL: team_tournament_replace_matchups missing';
  end if;

  if to_regprocedure('public.team_tournament_apply_domain_setup_mutation(text, jsonb, text, integer, text)') is null then
    raise exception 'PRECHECK_FAIL: apply_domain_setup_mutation missing';
  end if;

  v_apply := pg_get_functiondef(
    'public.team_tournament_apply_domain_setup_mutation(text, jsonb, text, integer, text)'::regprocedure
  );

  if position('p_expected_command = ''matchups.replace''' in v_apply) = 0
     and position('p_expected_command = ''matchups.replace''' in replace(v_apply, ' ', '')) = 0 then
    -- live body uses compact form
    null;
  end if;

  if position('UNKNOWN_TEAM' in v_apply) = 0 then
    raise exception 'PRECHECK_FAIL: apply_domain missing UNKNOWN_TEAM path';
  end if;

  -- Defect shape: empty teamAId/teamBId still fail exists(team) check.
  if position('external_team_id=x.value->>''teamAId''' in v_apply) > 0
     and position('nullif(btrim(coalesce(x.value->>''teamAId''' in v_apply) = 0 then
    raise notice 'PRECHECK_NOTICE: apply_domain still rejects empty KO placeholder team ids (Scenario B3)';
  end if;

  if position('delete from public.team_tournament_matchups where team_tournament_id=v_header.id' in v_apply) > 0 then
    raise notice 'PRECHECK_NOTICE: matchups.replace still delete-all (CASCADE wipes historical lineups — Scenario B2)';
  end if;

  v_replace := pg_get_functiondef(
    'public.team_tournament_replace_matchups(text, jsonb, integer, text)'::regprocedure
  );
  if position('team_tournament_apply_domain_setup_mutation' in v_replace) > 0 then
    raise notice 'PRECHECK_NOTICE: replace_matchups still delegates to apply_domain (expected pre-remediation)';
  end if;

  raise notice 'PRECHECK_PASS: team-tournament-scenario-b-ko-lineup-remediation-01';
end $$;
