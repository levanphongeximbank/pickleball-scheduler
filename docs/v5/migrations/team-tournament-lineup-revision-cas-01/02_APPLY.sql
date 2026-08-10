-- ═══════════════════════════════════════════════════════════════════
-- 02_APPLY.sql
-- Package: team-tournament-lineup-revision-cas-01
-- Workstream: TEAM-TOURNAMENT-PR412-LINEUP-REVISION-CAS-REMEDIATION-01
-- DO NOT APPLY without Owner GO. LOCAL PACKAGE ONLY.
--
-- Remediate lineup revision CAS:
--   p_expected_version = team_tournament_lineups.version ONLY
--   first create expectedVersion = 0 → insert version=1
--   CAS check BEFORE any selections/status write
--   VERSION_CONFLICT_AFTER_WRITE=IMPOSSIBLE
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.team_tournament_save_lineup_draft(
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
  v_lineup_id uuid;
  v_gate json;
  v_validation jsonb;
  v_exists boolean := false;
  v_new_version integer;
begin
  -- Unversioned callers keep legacy path (no CAS). Captain Portal always sends key+version.
  if p_idempotency_key is null then
    return public.team_tournament_save_lineup_draft_legacy(
      p_tournament_id, p_matchup_id, p_team_id, p_selections
    );
  end if;

  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'cross_tenant_denied', 'error', 'Không có quyền tenant.');
  end;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'save_lineup_draft', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id, 'teamId', p_team_id, 'selections', p_selections,
      'expectedVersion', p_expected_version
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  v_gate := public.team_tournament_guard_captain_portal_write(v_header, p_team_id);
  if not coalesce((v_gate->>'ok')::boolean, false) then
    return v_gate;
  end if;

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy matchup.');
  end if;

  if v_matchup.lineup_lock_at is not null and now() >= v_matchup.lineup_lock_at then
    return json_build_object('ok', false, 'code', 'deadline_passed', 'error', 'Đã quá giờ khóa đội hình.');
  end if;

  select l.* into v_lineup
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id and l.team_external_id = p_team_id;

  v_exists := found;

  -- A/B/C/D: CAS BEFORE write. First-create expectedVersion = 0.
  if not v_exists then
    if p_expected_version is not null and p_expected_version is distinct from 0 then
      return public.team_tournament_version_conflict(
        'team_tournament_lineups', p_expected_version, 0
      );
    end if;
  else
    if v_lineup.locked_at is not null then
      return json_build_object('ok', false, 'code', 'lineup_locked', 'error', 'Đội hình đã khóa.');
    end if;
    if p_expected_version is not null and v_lineup.version is distinct from p_expected_version then
      return public.team_tournament_version_conflict(
        'team_tournament_lineups', p_expected_version, v_lineup.version
      );
    end if;
  end if;

  if to_regprocedure('public.team_tournament_validate_lineup_selections(public.team_tournaments,text,text,jsonb,boolean)') is not null then
    v_validation := public.team_tournament_validate_lineup_selections(
      v_header, p_team_id, p_matchup_id, coalesce(p_selections, '{}'::jsonb), false
    );
    if not (v_validation->>'ok')::boolean then
      return v_validation;
    end if;
  end if;

  v_after := coalesce(p_selections, '{}'::jsonb);

  if not v_exists then
    v_before := null;
    insert into public.team_tournament_lineups (
      tenant_id, tournament_id, matchup_id, team_external_id,
      status, selections, source, version, created_by, updated_by
    ) values (
      v_header.tenant_id, v_header.tournament_id, v_matchup.id, p_team_id,
      'draft', v_after, 'captain', 1, auth.uid(), auth.uid()
    )
    returning id, version, status into v_lineup_id, v_new_version, v_lineup.status;
  else
    v_before := v_lineup.selections;
    update public.team_tournament_lineups l
    set status = 'draft',
        selections = v_after,
        updated_at = now(),
        updated_by = auth.uid(),
        version = l.version + 1
    where l.id = v_lineup.id
      and (p_expected_version is null or l.version = p_expected_version)
    returning l.id, l.version, l.status into v_lineup_id, v_new_version, v_lineup.status;

    if not found then
      select version into v_lineup.version from public.team_tournament_lineups where id = v_lineup.id;
      return public.team_tournament_version_conflict(
        'team_tournament_lineups', p_expected_version, v_lineup.version
      );
    end if;
  end if;

  if to_regprocedure('public.team_tournament_sync_lineup_entries(uuid,text,text,jsonb)') is not null then
    perform public.team_tournament_sync_lineup_entries(
      v_lineup_id, v_header.tenant_id, v_header.tournament_id, p_selections
    );
  end if;

  if to_regprocedure('public.team_tournament_write_lineup_revision(text,text,uuid,text,text,text,jsonb,jsonb,integer,integer,text,text)') is not null
     or exists (
       select 1 from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and p.proname = 'team_tournament_write_lineup_revision'
     ) then
    perform public.team_tournament_write_lineup_revision(
      v_header.tenant_id, p_tournament_id, v_lineup_id, 'draft',
      coalesce(v_lineup.status, 'draft'), 'draft', v_before, v_after,
      case when p_expected_version is null then v_new_version - 1 else p_expected_version end,
      v_new_version, null, p_idempotency_key
    );
  end if;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id, 'team.lineup.draft', p_matchup_id,
    jsonb_build_object('teamId', p_team_id, 'selections', p_selections, 'version', v_new_version)
  );

  v_result := jsonb_build_object(
    'ok', true,
    'lineupId', v_lineup_id,
    'version', v_new_version,
    'status', 'draft'
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'save_lineup_draft', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

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
  v_lineup_id uuid;
  v_gate json;
  v_validation jsonb;
  v_exists boolean := false;
  v_new_version integer;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'cross_tenant_denied', 'error', 'Không có quyền tenant.');
  end;

  if p_idempotency_key is null then
    return json_build_object(
      'ok', false,
      'code', 'VALIDATION_ERROR',
      'error', 'submit_lineup yêu cầu idempotencyKey + lineup expectedVersion.'
    );
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

  v_gate := public.team_tournament_guard_captain_portal_write(v_header, p_team_id);
  if not coalesce((v_gate->>'ok')::boolean, false) then
    return v_gate;
  end if;

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy matchup.');
  end if;

  if v_matchup.lineup_lock_at is not null and now() >= v_matchup.lineup_lock_at then
    return json_build_object('ok', false, 'code', 'deadline_passed', 'error', 'Đã quá giờ khóa đội hình.');
  end if;

  select l.* into v_lineup
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id and l.team_external_id = p_team_id;

  v_exists := found;

  -- CAS BEFORE write (do NOT call save_lineup_draft first).
  if not v_exists then
    if p_expected_version is not null and p_expected_version is distinct from 0 then
      return public.team_tournament_version_conflict(
        'team_tournament_lineups', p_expected_version, 0
      );
    end if;
  else
    if v_lineup.locked_at is not null then
      return json_build_object('ok', false, 'code', 'lineup_locked', 'error', 'Đội hình đã khóa.');
    end if;
    if p_expected_version is not null and v_lineup.version is distinct from p_expected_version then
      return public.team_tournament_version_conflict(
        'team_tournament_lineups', p_expected_version, v_lineup.version
      );
    end if;
  end if;

  if to_regprocedure('public.team_tournament_validate_lineup_selections(public.team_tournaments,text,text,jsonb,boolean)') is not null then
    v_validation := public.team_tournament_validate_lineup_selections(
      v_header, p_team_id, p_matchup_id, coalesce(p_selections, '{}'::jsonb), true
    );
    if not (v_validation->>'ok')::boolean then
      return v_validation;
    end if;
  end if;

  v_after := coalesce(p_selections, '{}'::jsonb);

  if not v_exists then
    v_before := null;
    insert into public.team_tournament_lineups (
      tenant_id, tournament_id, matchup_id, team_external_id,
      status, selections, source, version, submitted_at, created_by, updated_by
    ) values (
      v_header.tenant_id, v_header.tournament_id, v_matchup.id, p_team_id,
      'submitted', v_after, 'captain', 1, now(), auth.uid(), auth.uid()
    )
    returning id, version into v_lineup_id, v_new_version;
  else
    v_before := v_lineup.selections;
    update public.team_tournament_lineups l
    set status = 'submitted',
        selections = v_after,
        submitted_at = now(),
        updated_at = now(),
        updated_by = auth.uid(),
        version = l.version + 1
    where l.id = v_lineup.id
      and (p_expected_version is null or l.version = p_expected_version)
    returning l.id, l.version into v_lineup_id, v_new_version;

    if not found then
      select version into v_lineup.version from public.team_tournament_lineups where id = v_lineup.id;
      return public.team_tournament_version_conflict(
        'team_tournament_lineups', p_expected_version, v_lineup.version
      );
    end if;
  end if;

  if to_regprocedure('public.team_tournament_sync_lineup_entries(uuid,text,text,jsonb)') is not null then
    perform public.team_tournament_sync_lineup_entries(
      v_lineup_id, v_header.tenant_id, v_header.tournament_id, p_selections
    );
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_write_lineup_revision'
  ) then
    perform public.team_tournament_write_lineup_revision(
      v_header.tenant_id, p_tournament_id, v_lineup_id, 'submit',
      coalesce(v_lineup.status, 'draft'), 'submitted', v_before, v_after,
      case when p_expected_version is null then v_new_version - 1 else p_expected_version end,
      v_new_version, null, p_idempotency_key
    );
  end if;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, p_tournament_id, 'team.lineup.submit', p_matchup_id,
    jsonb_build_object('teamId', p_team_id, 'version', v_new_version)
  );

  v_result := jsonb_build_object(
    'ok', true,
    'lineupId', v_lineup_id,
    'version', v_new_version,
    'status', 'submitted'
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'submit_lineup', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

revoke all on function public.team_tournament_save_lineup_draft(text, text, text, jsonb, integer, text) from public;
revoke all on function public.team_tournament_save_lineup_draft(text, text, text, jsonb, integer, text) from anon;
grant execute on function public.team_tournament_save_lineup_draft(text, text, text, jsonb, integer, text) to authenticated;

revoke all on function public.team_tournament_submit_lineup(text, text, text, jsonb, integer, text) from public;
revoke all on function public.team_tournament_submit_lineup(text, text, text, jsonb, integer, text) from anon;
grant execute on function public.team_tournament_submit_lineup(text, text, text, jsonb, integer, text) to authenticated;

comment on function public.team_tournament_save_lineup_draft(text, text, text, jsonb, integer, text) is
  'CAS-before-write lineup draft. p_expected_version=lineup.version; first create=0 → version 1.';

comment on function public.team_tournament_submit_lineup(text, text, text, jsonb, integer, text) is
  'CAS-before-write lineup submit. p_expected_version=lineup.version; does not write then conflict.';
