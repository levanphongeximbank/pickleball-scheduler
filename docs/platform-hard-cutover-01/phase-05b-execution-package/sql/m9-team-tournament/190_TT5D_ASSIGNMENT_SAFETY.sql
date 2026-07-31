-- Phase TT-5D — Assignment scope, expiry, revoke (Staging only)
-- Production impact: NONE
-- Depends on: TT5-B bridge, V5-A referee_assignments

-- ═══════════════════════════════════════════════════════════════════
-- 1. Extend referee_assignments with TT scope + optimistic version
-- ═══════════════════════════════════════════════════════════════════
alter table public.referee_assignments
  add column if not exists external_matchup_id text,
  add column if not exists external_sub_match_id text,
  add column if not exists matchup_id uuid references public.team_tournament_matchups (id) on delete set null,
  add column if not exists sub_match_id uuid references public.team_tournament_sub_matches (id) on delete set null,
  add column if not exists revoke_reason text,
  add column if not exists version integer not null default 1;

alter table public.referee_assignments
  drop constraint if exists referee_assignments_status_check;

alter table public.referee_assignments
  add constraint referee_assignments_status_check
  check (status in ('pending', 'active', 'expired', 'revoked', 'completed'));

create index if not exists referee_assignments_sub_match_idx
  on public.referee_assignments (sub_match_id, status)
  where sub_match_id is not null;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Effective assignment status (server time)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.referee_v5_assignment_effective_status(
  p_status text,
  p_expires_at timestamptz,
  p_revoked_at timestamptz
)
returns text
language sql
immutable
as $$
  select case
    when p_revoked_at is not null or lower(coalesce(p_status, '')) = 'revoked' then 'revoked'
    when lower(coalesce(p_status, '')) = 'completed' then 'completed'
    when lower(coalesce(p_status, '')) = 'expired' then 'expired'
    when lower(coalesce(p_status, '')) = 'pending' then 'pending'
    when p_expires_at is not null and p_expires_at <= now() then 'expired'
    when lower(coalesce(p_status, '')) = 'active' then 'active'
    else coalesce(lower(p_status), 'pending')
  end;
$$;

create or replace function public.referee_v5_mark_assignment_expired_if_needed(
  p_assignment_id uuid
)
returns public.referee_assignments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.referee_assignments;
begin
  select * into v_row
  from public.referee_assignments
  where id = p_assignment_id
  for update;

  if v_row.id is null then
    return v_row;
  end if;

  if v_row.status = 'active'
     and v_row.expires_at is not null
     and v_row.expires_at <= now()
     and v_row.revoked_at is null then
    update public.referee_assignments set
      status = 'expired',
      version = version + 1,
      updated_at = now()
    where id = v_row.id
    returning * into v_row;
  end if;

  return v_row;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 3. BTC: create scoped assignment
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_create_referee_assignment(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text,
  p_referee_user_id uuid,
  p_expires_at timestamptz default null,
  p_activate boolean default true,
  p_idempotency_key text default null,
  p_reason text default 'tt5d_assign'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_matchup public.team_tournament_matchups;
  v_sub_match public.team_tournament_sub_matches;
  v_profile public.profiles;
  v_existing public.referee_assignments;
  v_row public.referee_assignments;
  v_status text;
  v_cmd json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'cross_tenant_denied');
  end;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'create_referee_assignment', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id,
      'subMatchId', p_sub_match_id,
      'refereeUserId', p_referee_user_id,
      'expiresAt', p_expires_at,
      'reason', p_reason
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id
    and m.external_matchup_id = p_matchup_id;

  select * into v_sub_match
  from public.team_tournament_sub_matches sm
  where sm.matchup_id = v_matchup.id
    and sm.external_sub_match_id = p_sub_match_id;

  if v_sub_match.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select * into v_profile from public.profiles where id = p_referee_user_id;
  if v_profile.id is null then
    return json_build_object('ok', false, 'code', 'REFEREE_NOT_FOUND');
  end if;

  select * into v_existing
  from public.referee_assignments ra
  where ra.tenant_id = v_header.tenant_id
    and ra.tournament_id = v_header.tournament_id
    and ra.match_id = v_sub_match.external_sub_match_id
    and ra.referee_user_id = p_referee_user_id
    and ra.role = 'REFEREE'
    and public.referee_v5_assignment_effective_status(ra.status, ra.expires_at, ra.revoked_at)
      in ('pending', 'active');

  if v_existing.id is not null then
    return json_build_object(
      'ok', true,
      'replayed', true,
      'assignmentId', v_existing.id,
      'status', public.referee_v5_assignment_effective_status(
        v_existing.status, v_existing.expires_at, v_existing.revoked_at
      ),
      'version', v_existing.version
    );
  end if;

  v_status := case when coalesce(p_activate, true) then 'active' else 'pending' end;

  insert into public.referee_assignments (
    tenant_id, tournament_id, match_id,
    external_matchup_id, external_sub_match_id,
    matchup_id, sub_match_id,
    referee_user_id, referee_display_name,
    role, status, assigned_by, assigned_at, expires_at, version
  ) values (
    v_header.tenant_id, v_header.tournament_id, v_sub_match.external_sub_match_id,
    v_matchup.external_matchup_id, v_sub_match.external_sub_match_id,
    v_matchup.id, v_sub_match.id,
    p_referee_user_id, coalesce(v_profile.display_name, v_profile.email, 'Referee'),
    'REFEREE', v_status, auth.uid(), now(), p_expires_at, 1
  )
  returning * into v_row;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.referee_v5.assignment_created', v_sub_match.external_sub_match_id,
    jsonb_build_object(
      'assignmentId', v_row.id,
      'refereeUserId', p_referee_user_id,
      'status', v_status,
      'expiresAt', p_expires_at,
      'matchupId', p_matchup_id,
      'subMatchId', p_sub_match_id,
      'version', v_row.version
    )
  );

  return json_build_object(
    'ok', true,
    'assignmentId', v_row.id,
    'refereeMatchId', v_row.match_id,
    'status', v_status,
    'version', v_row.version,
    'expiresAt', v_row.expires_at
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 4. BTC: revoke assignment (does not reassign)
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_revoke_referee_assignment(
  p_tournament_id text,
  p_assignment_id uuid,
  p_expected_version integer,
  p_reason text,
  p_idempotency_key text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_row public.referee_assignments;
  v_effective text;
  v_cmd json;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    return json_build_object('ok', false, 'code', 'REVOKE_REASON_REQUIRED');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  begin
    perform public.team_tournament_assert_tenant(v_header.tenant_id);
  exception when others then
    return json_build_object('ok', false, 'code', 'cross_tenant_denied');
  end;

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'revoke_referee_assignment', p_idempotency_key,
    jsonb_build_object('assignmentId', p_assignment_id, 'expectedVersion', p_expected_version, 'reason', p_reason)
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;

  select * into v_row
  from public.referee_assignments
  where id = p_assignment_id
    and tenant_id = v_header.tenant_id
    and tournament_id = v_header.tournament_id
  for update;

  if v_row.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if p_expected_version is not null and v_row.version <> p_expected_version then
    return public.team_tournament_version_conflict(
      'referee_assignments', p_expected_version, v_row.version
    );
  end if;

  v_effective := public.referee_v5_assignment_effective_status(
    v_row.status, v_row.expires_at, v_row.revoked_at
  );

  if v_effective = 'revoked' then
    return json_build_object(
      'ok', true,
      'replayed', true,
      'assignmentId', v_row.id,
      'status', 'revoked'
    );
  end if;

  update public.referee_assignments set
    status = 'revoked',
    revoked_at = now(),
    revoked_by = auth.uid(),
    revoke_reason = p_reason,
    version = version + 1,
    updated_at = now()
  where id = v_row.id
  returning * into v_row;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, v_header.tournament_id,
    'team.referee_v5.assignment_revoked', v_row.match_id,
    jsonb_build_object(
      'assignmentId', v_row.id,
      'reason', p_reason,
      'beforeStatus', v_effective,
      'afterStatus', 'revoked',
      'version', v_row.version
    )
  );

  return json_build_object(
    'ok', true,
    'assignmentId', v_row.id,
    'status', 'revoked',
    'version', v_row.version,
    'revokedAt', v_row.revoked_at
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 5. List assignments for BTC UI
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_list_referee_assignments(
  p_tournament_id text,
  p_sub_match_id text default null
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_header public.team_tournaments;
  v_items jsonb;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'assignmentId', ra.id,
    'refereeUserId', ra.referee_user_id,
    'refereeDisplayName', ra.referee_display_name,
    'matchId', ra.match_id,
    'externalSubMatchId', ra.external_sub_match_id,
    'externalMatchupId', ra.external_matchup_id,
    'status', public.referee_v5_assignment_effective_status(ra.status, ra.expires_at, ra.revoked_at),
    'rawStatus', ra.status,
    'assignedAt', ra.assigned_at,
    'expiresAt', ra.expires_at,
    'revokedAt', ra.revoked_at,
    'revokeReason', ra.revoke_reason,
    'version', ra.version
  ) order by ra.assigned_at desc), '[]'::jsonb)
  into v_items
  from public.referee_assignments ra
  where ra.tenant_id = v_header.tenant_id
    and ra.tournament_id = v_header.tournament_id
    and (p_sub_match_id is null or ra.external_sub_match_id = p_sub_match_id);

  return json_build_object('ok', true, 'assignments', v_items);
end;
$$;

revoke all on function public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) from public;
grant execute on function public.referee_v5_assignment_effective_status(text, timestamptz, timestamptz) to authenticated, service_role;

revoke all on function public.referee_v5_mark_assignment_expired_if_needed(uuid) from public, anon;
grant execute on function public.referee_v5_mark_assignment_expired_if_needed(uuid) to authenticated, service_role;

revoke all on function public.team_tournament_create_referee_assignment(
  text, text, text, uuid, timestamptz, boolean, text, text
) from public, anon;
grant execute on function public.team_tournament_create_referee_assignment(
  text, text, text, uuid, timestamptz, boolean, text, text
) to authenticated;

revoke all on function public.team_tournament_revoke_referee_assignment(
  text, uuid, integer, text, text
) from public, anon;
grant execute on function public.team_tournament_revoke_referee_assignment(
  text, uuid, integer, text, text
) to authenticated;

revoke all on function public.team_tournament_list_referee_assignments(text, text) from public, anon;
grant execute on function public.team_tournament_list_referee_assignments(text, text) to authenticated;
