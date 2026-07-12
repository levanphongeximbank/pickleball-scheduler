-- TT-2C — submit_lineup full validation before persist
create or replace function public.team_tournament_submit_lineup(
  p_tournament_id text,
  p_matchup_id text,
  p_team_id text,
  p_selections jsonb,
  p_expected_version integer default null,
  p_idempotency_key text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_lineup public.team_tournament_lineups;
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_before jsonb;
  v_after jsonb;
  v_validation jsonb;
begin
  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'submit_lineup', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id, 'teamId', p_team_id, 'selections', p_selections,
      'expectedVersion', p_expected_version
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  v_validation := public.team_tournament_validate_lineup_selections(
    v_header, p_team_id, p_matchup_id, coalesce(p_selections, '{}'::jsonb), true
  );
  if not (v_validation->>'ok')::boolean then
    return v_validation;
  end if;

  v_result := public.team_tournament_save_lineup_draft_legacy(
    p_tournament_id, p_matchup_id, p_team_id, p_selections
  )::jsonb;

  if not (v_result->>'ok')::boolean then
    return v_result;
  end if;

  select m.* into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  select l.* into v_lineup
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id and l.team_external_id = p_team_id;

  if p_expected_version is not null and v_lineup.version is distinct from p_expected_version then
    return public.team_tournament_version_conflict(
      'team_tournament_lineups', p_expected_version, v_lineup.version
    );
  end if;

  v_before := v_lineup.selections;

  update public.team_tournament_lineups l
  set status = 'submitted',
      submitted_at = now(),
      updated_at = now(),
      updated_by = auth.uid(),
      version = l.version + 1
  where l.id = v_lineup.id
    and (p_expected_version is null or l.version = p_expected_version)
  returning l.selections, l.version into v_after, v_lineup.version;

  if not found then
    select version into v_lineup.version from public.team_tournament_lineups l where l.id = v_lineup.id;
    return public.team_tournament_version_conflict(
      'team_tournament_lineups', p_expected_version, v_lineup.version
    );
  end if;

  perform public.team_tournament_write_lineup_revision(
    v_header.tenant_id, p_tournament_id, v_lineup.id, 'submit',
    v_lineup.status, 'submitted', v_before, v_after,
    case when p_expected_version is null then v_lineup.version - 1 else p_expected_version end,
    v_lineup.version, null, p_idempotency_key
  );

  perform public.team_tournament_write_audit(
    v_header.tenant_id, p_tournament_id, 'team.lineup.submit', p_matchup_id,
    jsonb_build_object('teamId', p_team_id, 'version', v_lineup.version)
  );

  v_result := jsonb_build_object('ok', true, 'version', v_lineup.version, 'lineupId', v_lineup.id);
  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'submit_lineup', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;
