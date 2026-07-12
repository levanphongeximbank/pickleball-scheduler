-- Phase TT-3 — BTC controlled lineup override
-- Prerequisite: PHASE_23C + TT-1B + TT-2B + TT-2C + TT-2D + TT-2E on staging
-- Staging only. Idempotent create/replace. Non-destructive.

-- ═══════════════════════════════════════════════════════════════════
-- 1. Schema extensions
-- ═══════════════════════════════════════════════════════════════════
alter table public.team_tournament_matchups
  add column if not exists requires_republish boolean not null default false;

alter table public.team_tournament_lineups
  add column if not exists overridden_at timestamptz,
  add column if not exists overridden_by uuid references auth.users(id) on delete set null,
  add column if not exists override_reason text,
  add column if not exists previous_lineup_version integer;

do $chk$ begin
  alter table public.team_tournament_lineups
    drop constraint if exists team_tournament_lineups_status_check;
  alter table public.team_tournament_lineups
    add constraint team_tournament_lineups_status_check
    check (status in (
      'not_submitted','draft','submitted','locked','published',
      'overridden','withdrawn','expired'
    ));
exception
  when others then null;
end $chk$;

create index if not exists idx_team_tournament_matchups_requires_republish
  on public.team_tournament_matchups (team_tournament_id, requires_republish)
  where requires_republish;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Revision writer (actor_role support)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_write_lineup_revision(
  p_tenant_id text,
  p_tournament_id text,
  p_lineup_id uuid,
  p_action_type text,
  p_status_before text,
  p_status_after text,
  p_selections_before jsonb,
  p_selections_after jsonb,
  p_version_before integer,
  p_version_after integer,
  p_reason text default null,
  p_request_id text default null,
  p_actor_role text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_next integer;
begin
  select coalesce(max(revision_no), 0) + 1 into v_next
  from public.team_tournament_lineup_revisions
  where lineup_id = p_lineup_id;

  insert into public.team_tournament_lineup_revisions (
    tenant_id, tournament_id, lineup_id, revision_no, action_type,
    status_before, status_after, selections_before, selections_after,
    version_before, version_after, reason, request_id, actor_id, actor_role
  ) values (
    p_tenant_id, p_tournament_id, p_lineup_id, v_next, p_action_type,
    p_status_before, p_status_after,
    coalesce(p_selections_before, '{}'::jsonb),
    coalesce(p_selections_after, '{}'::jsonb),
    p_version_before, p_version_after, p_reason, p_request_id, auth.uid(),
    coalesce(
      p_actor_role,
      case
        when public.is_super_admin() then 'super_admin'
        when public.team_tournament_can_manage() then 'btc'
        else 'organizer'
      end
    )
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. Helpers
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_matchup_has_confirmed_result(
  p_matchup_id uuid
)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.team_tournament_sub_matches sm
    where sm.matchup_id = p_matchup_id
      and sm.result_confirmed_at is not null
  );
$$;

create or replace function public.team_tournament_matchup_is_started(
  p_matchup public.team_tournament_matchups
)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_matchup.status in ('in_progress', 'completed')
    or exists (
      select 1 from public.team_tournament_sub_matches sm
      where sm.matchup_id = p_matchup.id
        and sm.status in ('playing', 'completed', 'forfeit')
    );
$$;

create or replace function public.team_tournament_lineup_override_ops(
  p_header public.team_tournaments,
  p_matchup public.team_tournament_matchups,
  p_lineup public.team_tournament_lineups,
  p_team_id text
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_can_override boolean := false;
  v_block_code text := null;
  v_block_message text := null;
  v_started boolean := false;
  v_elevated_required boolean := false;
  v_warning text := null;
begin
  if p_lineup.id is null then
    return jsonb_build_object(
      'canOverride', false,
      'blockCode', 'lineup_missing',
      'blockMessage', 'Chưa có đội hình cho đội này.'
    );
  end if;

  if public.team_tournament_matchup_has_confirmed_result(p_matchup.id) then
    return jsonb_build_object(
      'canOverride', false,
      'blockCode', 'lineup_override_blocked_confirmed_result',
      'blockMessage', 'Đã có kết quả trận được xác nhận — không thể override lineup trực tiếp.',
      'lineupStatus', p_lineup.status,
      'lineupVersion', p_lineup.version,
      'matchupStatus', p_matchup.status,
      'matchupVersion', p_matchup.version
    );
  end if;

  if p_lineup.status not in ('locked', 'published', 'overridden') then
    return jsonb_build_object(
      'canOverride', false,
      'blockCode', 'lineup_not_overridable',
      'blockMessage', 'Chỉ override lineup đã khóa hoặc đã công bố.',
      'lineupStatus', p_lineup.status,
      'lineupVersion', p_lineup.version
    );
  end if;

  if p_team_id not in (p_matchup.team_a_id, p_matchup.team_b_id) then
    return jsonb_build_object(
      'canOverride', false,
      'blockCode', 'NOT_FOUND',
      'blockMessage', 'Đội không thuộc matchup.'
    );
  end if;

  v_started := public.team_tournament_matchup_is_started(p_matchup);
  v_elevated_required := v_started;

  if v_started then
    v_warning := 'Matchup đã bắt đầu — chỉ Tournament Director/Super Admin được override và phải republish.';
    if not (public.is_super_admin() or public.user_has_permission('tournament.update')) then
      return jsonb_build_object(
        'canOverride', false,
        'blockCode', 'override_elevated_required',
        'blockMessage', v_warning,
        'matchupStarted', true,
        'elevatedReasonRequired', true,
        'lineupStatus', p_lineup.status,
        'lineupVersion', p_lineup.version,
        'matchupStatus', p_matchup.status,
        'matchupVersion', p_matchup.version
      );
    end if;
  elsif not (public.team_tournament_can_manage() or public.user_has_permission('team.lineup.override')) then
    return jsonb_build_object(
      'canOverride', false,
      'blockCode', 'override_forbidden',
      'blockMessage', 'Không có quyền thay đổi lineup.'
    );
  end if;

  v_can_override := true;

  return jsonb_build_object(
    'canOverride', v_can_override,
    'blockCode', v_block_code,
    'blockMessage', v_block_message,
    'matchupStarted', v_started,
    'elevatedReasonRequired', v_elevated_required,
    'operationalWarning', v_warning,
    'lineupStatus', p_lineup.status,
    'lineupVersion', p_lineup.version,
    'matchupStatus', p_matchup.status,
    'matchupVersion', p_matchup.version,
    'requiresRepublish', coalesce(p_matchup.requires_republish, false)
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. Override RPC (atomic)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_override_lineup(
  p_tournament_id text,
  p_matchup_id text,
  p_team_id text,
  p_selections jsonb,
  p_reason text,
  p_expected_matchup_version integer,
  p_expected_lineup_version integer,
  p_idempotency_key text
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
  v_ops jsonb;
  v_validation jsonb;
  v_now timestamptz := now();
  v_status_before text;
  v_version_before integer;
  v_selections_before jsonb;
  v_actor_role text;
  v_elevated boolean := false;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    return json_build_object(
      'ok', false,
      'code', 'override_reason_required',
      'message', 'Bắt buộc nhập lý do override.'
    );
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception
    when others then
      return json_build_object('ok', false, 'code', 'cross_tenant_denied', 'message', 'Không có quyền tenant.');
  end;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'override_lineup', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id,
      'teamId', p_team_id,
      'selections', coalesce(p_selections, '{}'::jsonb),
      'reason', p_reason,
      'expectedMatchupVersion', p_expected_matchup_version,
      'expectedLineupVersion', p_expected_lineup_version
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id
  for update;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if p_expected_matchup_version is not null and v_matchup.version <> p_expected_matchup_version then
    return public.team_tournament_version_conflict(
      'team_tournament_matchups', p_expected_matchup_version, v_matchup.version
    );
  end if;

  select * into v_lineup
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id
    and l.team_external_id = p_team_id
  for update;

  v_ops := public.team_tournament_lineup_override_ops(v_header, v_matchup, v_lineup, p_team_id);
  if not coalesce((v_ops->>'canOverride')::boolean, false) then
    return json_build_object(
      'ok', false,
      'code', coalesce(v_ops->>'blockCode', 'override_forbidden'),
      'message', coalesce(v_ops->>'blockMessage', 'Không thể override lineup.'),
      'overrideOps', v_ops
    );
  end if;

  v_elevated := coalesce((v_ops->>'elevatedReasonRequired')::boolean, false);
  if v_elevated and length(btrim(p_reason)) < 15 then
    return json_build_object(
      'ok', false,
      'code', 'override_elevated_reason_required',
      'message', 'Matchup đã bắt đầu — lý do phải có ít nhất 15 ký tự.',
      'overrideOps', v_ops
    );
  end if;

  if p_expected_lineup_version is not null and v_lineup.version <> p_expected_lineup_version then
    return public.team_tournament_version_conflict(
      'team_tournament_lineups', p_expected_lineup_version, v_lineup.version
    );
  end if;

  v_validation := public.team_tournament_validate_lineup_selections(
    v_header, p_team_id, p_matchup_id, coalesce(p_selections, '{}'::jsonb), true
  );
  if not (v_validation->>'ok')::boolean then
    return v_validation;
  end if;

  v_status_before := v_lineup.status;
  v_version_before := v_lineup.version;
  v_selections_before := coalesce(v_lineup.selections, '{}'::jsonb);

  v_actor_role := case
    when public.is_super_admin() then 'super_admin'
    when public.user_has_permission('tournament.update') then 'tournament_director'
    when public.team_tournament_can_manage() then 'btc'
    else 'organizer'
  end;

  update public.team_tournament_lineups l
  set status = 'overridden',
      selections = coalesce(p_selections, '{}'::jsonb),
      source = 'btc_override',
      previous_lineup_version = v_version_before,
      override_reason = btrim(p_reason),
      overridden_at = v_now,
      overridden_by = auth.uid(),
      published_at = null,
      locked_at = coalesce(l.locked_at, v_now),
      updated_at = v_now,
      updated_by = auth.uid(),
      version = l.version + 1,
      audit_note = format('tt3:override:%s', v_now)
  where l.id = v_lineup.id
    and (p_expected_lineup_version is null or l.version = p_expected_lineup_version)
  returning l.version, l.selections into v_lineup.version, v_lineup.selections;

  if not found then
    select version into v_lineup.version from public.team_tournament_lineups where id = v_lineup.id;
    return public.team_tournament_version_conflict(
      'team_tournament_lineups', p_expected_lineup_version, v_lineup.version
    );
  end if;

  perform public.team_tournament_sync_lineup_entries(
    v_lineup.id, v_header.tenant_id, p_tournament_id, v_lineup.selections
  );

  perform public.team_tournament_write_lineup_revision(
    v_header.tenant_id, p_tournament_id, v_lineup.id, 'btc_override',
    v_status_before, 'overridden',
    v_selections_before, v_lineup.selections,
    v_version_before, v_lineup.version,
    btrim(p_reason), p_idempotency_key, v_actor_role
  );

  update public.team_tournament_matchups m
  set requires_republish = true,
      version = m.version + 1,
      updated_at = v_now,
      updated_by = auth.uid()
  where m.id = v_matchup.id
    and (p_expected_matchup_version is null or m.version = p_expected_matchup_version)
  returning m.version into v_matchup.version;

  if not found then
    raise exception 'TT3 override partial matchup update blocked';
  end if;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, p_tournament_id, 'team.lineup.override', p_matchup_id,
    jsonb_build_object(
      'teamId', p_team_id,
      'actorUserId', auth.uid(),
      'actorRole', v_actor_role,
      'reason', btrim(p_reason),
      'statusBefore', v_status_before,
      'statusAfter', 'overridden',
      'lineupVersionBefore', v_version_before,
      'lineupVersionAfter', v_lineup.version,
      'matchupVersion', v_matchup.version,
      'requiresRepublish', true,
      'matchupStarted', v_elevated,
      'requestId', p_idempotency_key
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'matchupId', p_matchup_id,
    'teamId', p_team_id,
    'lineupId', v_lineup.id,
    'lineupVersion', v_lineup.version,
    'matchupVersion', v_matchup.version,
    'status', 'overridden',
    'requiresRepublish', true,
    'previousLineupVersion', v_version_before
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'override_lineup', p_idempotency_key, v_hash, v_result
  );

  return v_result;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 5. Republish-aware publish ops (extends TT-2E)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_matchup_publish_ops(
  p_header public.team_tournaments,
  p_matchup public.team_tournament_matchups,
  p_now timestamptz default now()
)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_lineup_a public.team_tournament_lineups;
  v_lineup_b public.team_tournament_lineups;
  v_can_publish boolean := false;
  v_block_code text := null;
  v_block_message text := null;
  v_lineup_ops jsonb;
  v_republishing boolean := coalesce(p_matchup.requires_republish, false);
begin
  select * into v_lineup_a
  from public.team_tournament_lineups l
  where l.matchup_id = p_matchup.id and l.team_external_id = p_matchup.team_a_id;

  select * into v_lineup_b
  from public.team_tournament_lineups l
  where l.matchup_id = p_matchup.id and l.team_external_id = p_matchup.team_b_id;

  if v_republishing then
    if v_lineup_a.id is null or v_lineup_b.id is null then
      return jsonb_build_object(
        'canPublish', false,
        'blockCode', 'lineup_missing',
        'blockMessage', 'Thiếu đội hình một hoặc cả hai đội.',
        'requiresRepublish', true,
        'matchupVersion', p_matchup.version,
        'lineupAVersion', v_lineup_a.version,
        'lineupBVersion', v_lineup_b.version
      );
    end if;

    if v_lineup_a.status not in ('locked', 'overridden', 'published')
       or v_lineup_b.status not in ('locked', 'overridden', 'published') then
      return jsonb_build_object(
        'canPublish', false,
        'blockCode', 'lineup_not_ready_republish',
        'blockMessage', 'Cả hai đội hình phải sẵn sàng trước khi công bố lại.',
        'requiresRepublish', true,
        'lineupAStatus', v_lineup_a.status,
        'lineupBStatus', v_lineup_b.status,
        'matchupVersion', p_matchup.version,
        'lineupAVersion', v_lineup_a.version,
        'lineupBVersion', v_lineup_b.version
      );
    end if;

    return jsonb_build_object(
      'canPublish', true,
      'blockCode', null,
      'blockMessage', null,
      'requiresRepublish', true,
      'republishMode', true,
      'matchupStatus', p_matchup.status,
      'matchupVersion', p_matchup.version,
      'lineupAVersion', v_lineup_a.version,
      'lineupBVersion', v_lineup_b.version,
      'lineupAStatus', v_lineup_a.status,
      'lineupBStatus', v_lineup_b.status,
      'teamAId', p_matchup.team_a_id,
      'teamBId', p_matchup.team_b_id
    );
  end if;

  if p_matchup.status in ('published', 'in_progress', 'completed') then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'already_published',
      'blockMessage', 'Matchup đã được công bố.',
      'matchupStatus', p_matchup.status,
      'matchupVersion', p_matchup.version
    );
  end if;

  if p_matchup.status <> 'locked' then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'matchup_not_locked',
      'blockMessage', 'Matchup chưa khóa — không thể công bố.',
      'matchupStatus', p_matchup.status,
      'matchupVersion', p_matchup.version
    );
  end if;

  if v_lineup_a.id is null or v_lineup_b.id is null then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'lineup_missing',
      'blockMessage', 'Thiếu đội hình một hoặc cả hai đội.',
      'matchupVersion', p_matchup.version,
      'lineupAVersion', v_lineup_a.version,
      'lineupBVersion', v_lineup_b.version
    );
  end if;

  if v_lineup_a.status <> 'locked' or v_lineup_b.status <> 'locked' then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'lineup_not_locked',
      'blockMessage', 'Cả hai đội hình phải ở trạng thái locked trước khi công bố.',
      'matchupVersion', p_matchup.version,
      'lineupAVersion', v_lineup_a.version,
      'lineupBVersion', v_lineup_b.version,
      'lineupAStatus', v_lineup_a.status,
      'lineupBStatus', v_lineup_b.status
    );
  end if;

  if coalesce(v_lineup_a.audit_note, '') like 'tt2d:manual_pending%'
     or coalesce(v_lineup_b.audit_note, '') like 'tt2d:manual_pending%' then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'manual_pending',
      'blockMessage', 'Còn đội hình chờ xử lý thủ công (manual_pending).',
      'matchupVersion', p_matchup.version,
      'lineupAVersion', v_lineup_a.version,
      'lineupBVersion', v_lineup_b.version
    );
  end if;

  v_lineup_ops := public.team_tournament_matchup_lineup_ops(p_header, p_matchup, p_now);

  if jsonb_array_length(coalesce(v_lineup_ops->'unhandledMissingTeamIds', '[]'::jsonb)) > 0 then
    return jsonb_build_object(
      'canPublish', false,
      'blockCode', 'missing_policy_unresolved',
      'blockMessage', 'Chính sách thiếu lineup chưa được xử lý.',
      'matchupVersion', p_matchup.version,
      'lineupAVersion', v_lineup_a.version,
      'lineupBVersion', v_lineup_b.version,
      'unhandledMissingTeamIds', v_lineup_ops->'unhandledMissingTeamIds'
    );
  end if;

  return jsonb_build_object(
    'canPublish', true,
    'blockCode', null,
    'blockMessage', null,
    'matchupStatus', p_matchup.status,
    'matchupVersion', p_matchup.version,
    'lineupAVersion', v_lineup_a.version,
    'lineupBVersion', v_lineup_b.version,
    'lineupAStatus', v_lineup_a.status,
    'lineupBStatus', v_lineup_b.status,
    'teamAId', p_matchup.team_a_id,
    'teamBId', p_matchup.team_b_id,
    'lineupOps', v_lineup_ops
  );
end;
$$;

-- Patch TT-2E publish core for republish
create or replace function public.team_tournament_publish_matchup(
  p_tournament_id text,
  p_matchup_id text,
  p_expected_matchup_version integer,
  p_expected_lineup_a_version integer,
  p_expected_lineup_b_version integer,
  p_idempotency_key text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_lineup_a public.team_tournament_lineups;
  v_lineup_b public.team_tournament_lineups;
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_ops jsonb;
  v_pub timestamptz := now();
  v_before jsonb;
  v_actor_role text;
  v_republish boolean := false;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not (public.team_tournament_can_manage() or public.user_has_permission('team.lineup.publish')) then
    return json_build_object('ok', false, 'code', 'publish_forbidden', 'message', 'Không có quyền công bố đội hình.');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception
    when others then
      return json_build_object('ok', false, 'code', 'cross_tenant_denied', 'message', 'Không có quyền tenant.');
  end;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'publish_matchup', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id,
      'expectedMatchupVersion', p_expected_matchup_version,
      'expectedLineupAVersion', p_expected_lineup_a_version,
      'expectedLineupBVersion', p_expected_lineup_b_version
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id
  for update;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  v_republish := coalesce(v_matchup.requires_republish, false);

  if not v_republish and v_matchup.status in ('published', 'in_progress', 'completed') then
    return json_build_object(
      'ok', false,
      'code', 'already_published',
      'message', 'Matchup đã được công bố.',
      'matchupVersion', v_matchup.version
    );
  end if;

  if p_expected_matchup_version is not null and v_matchup.version <> p_expected_matchup_version then
    return public.team_tournament_version_conflict(
      'team_tournament_matchups', p_expected_matchup_version, v_matchup.version
    );
  end if;

  if not v_republish and v_matchup.status <> 'locked' then
    return json_build_object(
      'ok', false,
      'code', 'matchup_not_locked',
      'message', 'Matchup chưa khóa.',
      'matchupVersion', v_matchup.version
    );
  end if;

  select * into v_lineup_a
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id and l.team_external_id = v_matchup.team_a_id
  for update;

  select * into v_lineup_b
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id and l.team_external_id = v_matchup.team_b_id
  for update;

  if v_lineup_a.id is null or v_lineup_b.id is null then
    return json_build_object('ok', false, 'code', 'lineup_missing', 'message', 'Thiếu đội hình.');
  end if;

  if p_expected_lineup_a_version is not null and v_lineup_a.version <> p_expected_lineup_a_version then
    return public.team_tournament_version_conflict(
      'team_tournament_lineups', p_expected_lineup_a_version, v_lineup_a.version
    );
  end if;

  if p_expected_lineup_b_version is not null and v_lineup_b.version <> p_expected_lineup_b_version then
    return public.team_tournament_version_conflict(
      'team_tournament_lineups', p_expected_lineup_b_version, v_lineup_b.version
    );
  end if;

  v_ops := public.team_tournament_matchup_publish_ops(v_header, v_matchup, v_pub);

  if not coalesce((v_ops->>'canPublish')::boolean, false) then
    return json_build_object(
      'ok', false,
      'code', coalesce(v_ops->>'blockCode', 'CANNOT_PUBLISH'),
      'message', coalesce(v_ops->>'blockMessage', 'Chưa đủ điều kiện công bố.'),
      'publishOps', v_ops
    );
  end if;

  if v_republish then
    update public.team_tournament_lineups l
    set status = 'published',
        published_at = v_pub,
        override_reason = null,
        version = l.version + 1,
        updated_at = v_pub,
        updated_by = auth.uid()
    where l.id in (v_lineup_a.id, v_lineup_b.id)
      and l.status in ('locked', 'overridden', 'published');

    if (
      select count(*)::int from public.team_tournament_lineups
      where id in (v_lineup_a.id, v_lineup_b.id) and status = 'published'
    ) <> 2 then
      raise exception 'TT2E/TT3 republish partial lineup update blocked';
    end if;

    update public.team_tournament_matchups m
    set status = case when m.status in ('lineup_open','locked') then 'published' else m.status end,
        requires_republish = false,
        version = m.version + 1,
        updated_at = v_pub,
        updated_by = auth.uid()
    where m.id = v_matchup.id;

    if not found then
      raise exception 'TT3 republish partial matchup update blocked';
    end if;
  else
    update public.team_tournament_lineups l
    set status = 'published',
        published_at = v_pub,
        version = l.version + 1,
        updated_at = v_pub,
        updated_by = auth.uid()
    where l.id in (v_lineup_a.id, v_lineup_b.id)
      and l.status = 'locked';

    if (
      select count(*)::int from public.team_tournament_lineups
      where id in (v_lineup_a.id, v_lineup_b.id) and status = 'published'
    ) <> 2 then
      raise exception 'TT2E publish partial lineup update blocked';
    end if;

    update public.team_tournament_matchups m
    set status = 'published',
        version = m.version + 1,
        updated_at = v_pub,
        updated_by = auth.uid()
    where m.id = v_matchup.id
      and m.status = 'locked'
      and (p_expected_matchup_version is null or m.version = p_expected_matchup_version);

    if not found then
      raise exception 'TT2E publish partial matchup update blocked';
    end if;
  end if;

  select l.version into v_lineup_a.version from public.team_tournament_lineups l where l.id = v_lineup_a.id;
  select l.version into v_lineup_b.version from public.team_tournament_lineups l where l.id = v_lineup_b.id;
  select m.version into v_matchup.version from public.team_tournament_matchups m where m.id = v_matchup.id;

  v_actor_role := case
    when public.team_tournament_can_manage() then 'btc'
    when public.user_has_permission('team.lineup.publish') then 'organizer'
    else 'unknown'
  end;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, p_tournament_id,
    case when v_republish then 'team.lineup.republish' else 'team.lineup.publish' end,
    p_matchup_id,
    jsonb_build_object(
      'actorUserId', auth.uid(),
      'actorRole', v_actor_role,
      'republish', v_republish,
      'matchupVersion', v_matchup.version,
      'lineupAVersion', v_lineup_a.version,
      'lineupBVersion', v_lineup_b.version
    )
  );

  v_result := jsonb_build_object(
    'ok', true,
    'republish', v_republish,
    'matchupVersion', v_matchup.version,
    'lineupAVersion', v_lineup_a.version,
    'lineupBVersion', v_lineup_b.version,
    'publishedAt', v_pub
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'publish_matchup', p_idempotency_key, v_hash, v_result
  );

  return v_result;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 6. Visibility (requires_republish hides opponent until republish)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_get_visible_lineups(
  p_tournament_id text,
  p_matchup_id text,
  p_viewer_team_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_is_manage boolean;
  v_can_results boolean;
  v_lineups json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND', 'error', 'Không tìm thấy matchup.');
  end if;

  v_is_manage := public.team_tournament_can_manage();
  v_can_results := public.team_tournament_can_manage_results();

  select coalesce(json_object_agg(
    l.team_external_id,
    json_build_object(
      'matchupId', p_matchup_id,
      'teamId', l.team_external_id,
      'status', l.status,
      'selections', case
        when v_is_manage then l.selections
        when l.team_external_id = coalesce(p_viewer_team_id, '') then l.selections
        when coalesce(v_matchup.requires_republish, false) then null
        when v_can_results and v_matchup.status in ('published','in_progress','completed') then l.selections
        when v_matchup.status in ('published','in_progress','completed') then l.selections
        else null
      end,
      'submittedAt', l.submitted_at,
      'lockedAt', l.locked_at,
      'publishedAt', l.published_at,
      'overriddenAt', l.overridden_at,
      'overrideReason', case
        when v_is_manage or l.team_external_id = coalesce(p_viewer_team_id, '') then l.override_reason
        else null
      end,
      'source', l.source,
      'version', l.version,
      'requiresRepublish', coalesce(v_matchup.requires_republish, false)
    )
  ), '{}'::json)
  into v_lineups
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id
    and (
      v_is_manage
      or l.team_external_id = coalesce(p_viewer_team_id, '')
      or (
        not coalesce(v_matchup.requires_republish, false)
        and (
          v_can_results and v_matchup.status in ('published','in_progress','completed')
          or v_matchup.status in ('published','in_progress','completed')
        )
      )
    );

  return json_build_object(
    'ok', true,
    'matchupId', p_matchup_id,
    'matchupStatus', v_matchup.status,
    'requiresRepublish', coalesce(v_matchup.requires_republish, false),
    'serverTime', now(),
    'lineups', v_lineups
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 7. Grants
-- ═══════════════════════════════════════════════════════════════════
revoke all on function public.team_tournament_override_lineup(
  text, text, text, jsonb, text, integer, integer, text
) from public;
grant execute on function public.team_tournament_override_lineup(
  text, text, text, jsonb, text, integer, integer, text
) to authenticated;

revoke all on function public.team_tournament_lineup_override_ops(
  public.team_tournaments, public.team_tournament_matchups, public.team_tournament_lineups, text
) from public;
grant execute on function public.team_tournament_lineup_override_ops(
  public.team_tournaments, public.team_tournament_matchups, public.team_tournament_lineups, text
) to authenticated;

revoke all on function public.team_tournament_matchup_has_confirmed_result(uuid) from public;
grant execute on function public.team_tournament_matchup_has_confirmed_result(uuid) to authenticated;

create or replace function public.team_tournament_get_lineup_override_ops(
  p_tournament_id text,
  p_matchup_id text,
  p_team_id text
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
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select * into v_lineup
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id
    and l.team_external_id = p_team_id;

  return json_build_object(
    'ok', true,
    'overrideOps', public.team_tournament_lineup_override_ops(v_header, v_matchup, v_lineup, p_team_id),
    'requiresRepublish', coalesce(v_matchup.requires_republish, false),
    'matchupStatus', v_matchup.status,
    'matchupVersion', v_matchup.version
  );
end;
$$;

revoke all on function public.team_tournament_get_lineup_override_ops(text, text, text) from public;
grant execute on function public.team_tournament_get_lineup_override_ops(text, text, text) to authenticated;
