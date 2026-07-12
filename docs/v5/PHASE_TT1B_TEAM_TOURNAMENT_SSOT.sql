-- Phase TT-1B — Team Tournament SSOT foundation
-- Idempotent migration. Apply STAGING/PREVIEW ONLY — NOT Production without owner GO.
-- Prerequisite: PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql
--
-- Rollback note (staging):
--   1. Set VITE_TEAM_TOURNAMENT_DATA_MODE=legacy
--   2. Optional: DROP new tables if empty (command_log, revisions, dreambreaker, forfeit, sync_mismatch)
--   3. Version columns may remain (harmless default 1)
--   4. Re-apply PHASE_23C RLS block for lineup SELECT if full rollback needed

create extension if not exists pgcrypto with schema extensions;

-- ═══════════════════════════════════════════════════════════════════
-- 1. Version columns (optimistic locking)
-- ═══════════════════════════════════════════════════════════════════
alter table public.team_tournaments
  add column if not exists version integer not null default 1 check (version >= 1);

alter table public.team_tournament_matchups
  add column if not exists version integer not null default 1 check (version >= 1);

alter table public.team_tournament_lineups
  add column if not exists version integer not null default 1 check (version >= 1);

alter table public.team_tournament_sub_matches
  add column if not exists version integer not null default 1 check (version >= 1);

alter table public.team_tournament_standings
  add column if not exists version integer not null default 1 check (version >= 1);

-- Schedule / court metadata (blob fields: groupId, roundNumber, courtLabel)
alter table public.team_tournament_matchups
  add column if not exists schedule_meta jsonb not null default '{}'::jsonb;

alter table public.team_tournament_matchups
  add column if not exists result_type text not null default 'normal'
    check (result_type in ('normal','forfeit','technical','cancelled','withdrawn'));

-- ═══════════════════════════════════════════════════════════════════
-- 2. Idempotency command log
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.team_tournament_command_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  command_name text not null,
  idempotency_key text not null,
  payload_hash text not null,
  result_json jsonb not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, tournament_id, command_name, idempotency_key)
);

create index if not exists idx_team_tournament_command_log_tenant
  on public.team_tournament_command_log (tenant_id, tournament_id, created_at desc);

-- ═══════════════════════════════════════════════════════════════════
-- 3. Lineup revision history (override audit)
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.team_tournament_lineup_revisions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  lineup_id uuid not null references public.team_tournament_lineups(id) on delete cascade,
  revision_no integer not null check (revision_no >= 1),
  action_type text not null
    check (action_type in ('draft','submit','lock','publish','randomize','btc_override','withdraw')),
  status_before text,
  status_after text,
  selections_before jsonb not null default '{}'::jsonb,
  selections_after jsonb not null default '{}'::jsonb,
  version_before integer,
  version_after integer,
  reason text,
  request_id text,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role text,
  created_at timestamptz not null default now(),
  unique (lineup_id, revision_no)
);

create index if not exists idx_team_tournament_lineup_revisions_lineup
  on public.team_tournament_lineup_revisions (lineup_id, revision_no desc);

-- ═══════════════════════════════════════════════════════════════════
-- 4. DreamBreaker cloud state
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.team_tournament_dreambreaker_states (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  matchup_id uuid not null unique references public.team_tournament_matchups(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending','lineup_open','ready','in_progress','completed')),
  team_a_order jsonb not null default '[]'::jsonb,
  team_b_order jsonb not null default '[]'::jsonb,
  team_a_score integer not null default 0,
  team_b_score integer not null default 0,
  winner_team_id text,
  order_lock_at timestamptz,
  orders_locked_at timestamptz,
  order_source_a text,
  order_source_b text,
  rotation jsonb not null default '{}'::jsonb,
  sub_match_external_id text,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- ═══════════════════════════════════════════════════════════════════
-- 5. Forfeit / technical result events
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.team_tournament_forfeit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  matchup_id uuid references public.team_tournament_matchups(id) on delete cascade,
  sub_match_id uuid references public.team_tournament_sub_matches(id) on delete cascade,
  scope text not null check (scope in ('sub_match','matchup','team_withdrawal')),
  result_type text not null default 'forfeit'
    check (result_type in ('forfeit','technical','withdrawn','no_show','injury')),
  forfeit_reason text not null default '',
  forfeiting_team_id text,
  awarded_winner_team_id text,
  technical_score jsonb not null default '{}'::jsonb,
  affects_standings boolean not null default true,
  affects_point_difference boolean not null default true,
  affects_elo boolean not null default false,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  idempotency_key text,
  version integer not null default 1 check (version >= 1),
  created_at timestamptz not null default now(),
  unique (tenant_id, tournament_id, idempotency_key)
);

-- ═══════════════════════════════════════════════════════════════════
-- 6. Shadow compare mismatch log
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.team_tournament_sync_mismatch (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  entity_type text not null,
  entity_key text not null,
  blob_hash text,
  cloud_hash text,
  blob_snapshot jsonb,
  cloud_snapshot jsonb,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolution_note text
);

create index if not exists idx_team_tournament_sync_mismatch_open
  on public.team_tournament_sync_mismatch (tenant_id, tournament_id, detected_at desc)
  where resolved_at is null;

-- ═══════════════════════════════════════════════════════════════════
-- 7. RLS — block direct SELECT on sensitive lineup tables
-- ═══════════════════════════════════════════════════════════════════
alter table public.team_tournament_command_log enable row level security;
alter table public.team_tournament_lineup_revisions enable row level security;
alter table public.team_tournament_dreambreaker_states enable row level security;
alter table public.team_tournament_forfeit_events enable row level security;
alter table public.team_tournament_sync_mismatch enable row level security;

drop policy if exists team_tournament_lineups_tenant_select on public.team_tournament_lineups;
drop policy if exists team_tournament_lineup_entries_tenant_select on public.team_tournament_lineup_entries;

-- No SELECT policy => authenticated cannot read lineups directly (RPC security definer only)

drop policy if exists team_tournament_command_log_manage on public.team_tournament_command_log;
create policy team_tournament_command_log_manage on public.team_tournament_command_log
  for all to authenticated using (
    public.is_super_admin() or public.team_tournament_can_manage()
  ) with check (
    public.is_super_admin() or public.team_tournament_can_manage()
  );

drop policy if exists team_tournament_lineup_revisions_manage on public.team_tournament_lineup_revisions;
create policy team_tournament_lineup_revisions_manage on public.team_tournament_lineup_revisions
  for all to authenticated using (
    public.is_super_admin() or public.team_tournament_can_manage()
  ) with check (
    public.is_super_admin() or public.team_tournament_can_manage()
  );

drop policy if exists team_tournament_dreambreaker_manage on public.team_tournament_dreambreaker_states;
create policy team_tournament_dreambreaker_manage on public.team_tournament_dreambreaker_states
  for all to authenticated using (
    public.is_super_admin()
    or tenant_id = (select venue_id from public.profiles where id = auth.uid())
  ) with check (
    public.is_super_admin()
    or (
      tenant_id = (select venue_id from public.profiles where id = auth.uid())
      and (public.team_tournament_can_manage() or public.team_tournament_can_manage_results())
    )
  );

drop policy if exists team_tournament_forfeit_manage on public.team_tournament_forfeit_events;
create policy team_tournament_forfeit_manage on public.team_tournament_forfeit_events
  for all to authenticated using (
    public.is_super_admin()
    or tenant_id = (select venue_id from public.profiles where id = auth.uid())
  ) with check (
    public.is_super_admin()
    or (
      tenant_id = (select venue_id from public.profiles where id = auth.uid())
      and public.team_tournament_can_manage()
    )
  );

drop policy if exists team_tournament_sync_mismatch_manage on public.team_tournament_sync_mismatch;
create policy team_tournament_sync_mismatch_manage on public.team_tournament_sync_mismatch
  for all to authenticated using (
    public.is_super_admin() or public.team_tournament_can_manage()
  ) with check (
    public.is_super_admin() or public.team_tournament_can_manage()
  );

-- ═══════════════════════════════════════════════════════════════════
-- 8. Helpers — idempotency + version + lineup revision
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_payload_hash(p_payload jsonb)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(coalesce(p_payload::text, ''), 'sha256'), 'hex');
$$;

create or replace function public.team_tournament_begin_command(
  p_tenant_id text,
  p_tournament_id text,
  p_command_name text,
  p_idempotency_key text,
  p_payload jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hash text;
  v_existing public.team_tournament_command_log;
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    return json_build_object('ok', true, 'replay', false);
  end if;

  v_hash := public.team_tournament_payload_hash(p_payload);

  select * into v_existing
  from public.team_tournament_command_log
  where tenant_id = p_tenant_id
    and tournament_id = p_tournament_id
    and command_name = p_command_name
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.payload_hash <> v_hash then
      return json_build_object(
        'ok', false,
        'code', 'idempotency_payload_mismatch',
        'error', 'Idempotency key đã dùng với payload khác.'
      );
    end if;
    return json_build_object(
      'ok', true,
      'replay', true,
      'result', v_existing.result_json
    );
  end if;

  return json_build_object('ok', true, 'replay', false, 'payload_hash', v_hash);
end;
$$;

create or replace function public.team_tournament_finish_command(
  p_tenant_id text,
  p_tournament_id text,
  p_command_name text,
  p_idempotency_key text,
  p_payload_hash text,
  p_result jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_idempotency_key is null or btrim(p_idempotency_key) = '' then
    return;
  end if;

  insert into public.team_tournament_command_log (
    tenant_id, tournament_id, command_name, idempotency_key, payload_hash, result_json
  ) values (
    p_tenant_id, p_tournament_id, p_command_name, p_idempotency_key, p_payload_hash, p_result
  )
  on conflict (tenant_id, tournament_id, command_name, idempotency_key) do nothing;
end;
$$;

create or replace function public.team_tournament_version_conflict(
  p_entity text,
  p_expected integer,
  p_actual integer
)
returns json
language sql
immutable
as $$
  select json_build_object(
    'ok', false,
    'code', 'version_conflict',
    'entity', p_entity,
    'expected_version', p_expected,
    'actual_version', p_actual,
    'error', 'Dữ liệu đã thay đổi — tải lại và thử lại.'
  );
$$;

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
  p_request_id text default null
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
    version_before, version_after, reason, request_id, actor_id
  ) values (
    p_tenant_id, p_tournament_id, p_lineup_id, v_next, p_action_type,
    p_status_before, p_status_after,
    coalesce(p_selections_before, '{}'::jsonb),
    coalesce(p_selections_after, '{}'::jsonb),
    p_version_before, p_version_after, p_reason, p_request_id, auth.uid()
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 9. RPC: visible lineups (security B)
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
  v_player_id text;
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
  v_player_id := public.team_tournament_user_player_id();

  select coalesce(json_object_agg(
    l.team_external_id,
    json_build_object(
      'matchupId', p_matchup_id,
      'teamId', l.team_external_id,
      'status', l.status,
      'selections', case
        when v_is_manage then l.selections
        when l.team_external_id = coalesce(p_viewer_team_id, '') then l.selections
        when v_can_results and v_matchup.status in ('published','in_progress','completed') then l.selections
        when v_matchup.status in ('published','in_progress','completed') then l.selections
        when l.published_at is not null then l.selections
        else null
      end,
      'submittedAt', l.submitted_at,
      'lockedAt', l.locked_at,
      'publishedAt', l.published_at,
      'source', l.source,
      'version', l.version
    )
  ), '{}'::json)
  into v_lineups
  from public.team_tournament_lineups l
  where l.matchup_id = v_matchup.id
    and (
      v_is_manage
      or l.team_external_id = coalesce(p_viewer_team_id, '')
      or (
        v_can_results
        and v_matchup.status in ('published','in_progress','completed')
      )
      or v_matchup.status in ('published','in_progress','completed')
      or l.published_at is not null
    );

  return json_build_object(
    'ok', true,
    'matchupId', p_matchup_id,
    'matchupStatus', v_matchup.status,
    'serverTime', now(),
    'lineups', v_lineups
  );
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 10. RPC: submit lineup with version + idempotency (extends 23C)
-- ═══════════════════════════════════════════════════════════════════
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

  v_result := public.team_tournament_save_lineup_draft(
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
    select version into v_lineup.version from public.team_tournament_lineups where id = v_lineup.id;
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

-- Lock matchup with version + idempotency
create or replace function public.team_tournament_lock_matchup(
  p_tournament_id text,
  p_matchup_id text,
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
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_lock_time timestamptz := now();
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not (public.team_tournament_can_manage() or public.user_has_permission('team.lineup.lock')) then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'lock_matchup', p_idempotency_key,
    jsonb_build_object('matchupId', p_matchup_id, 'expectedVersion', p_expected_version)
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  if v_matchup.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;

  if p_expected_version is not null and v_matchup.version <> p_expected_version then
    return public.team_tournament_version_conflict(
      'team_tournament_matchups', p_expected_version, v_matchup.version
    );
  end if;

  update public.team_tournament_lineups set
    status = 'locked', locked_at = v_lock_time, version = version + 1, updated_at = v_lock_time
  where matchup_id = v_matchup.id and status in ('submitted','draft','not_submitted');

  update public.team_tournament_matchups set
    status = 'locked', version = version + 1, updated_at = v_lock_time, updated_by = auth.uid()
  where id = v_matchup.id
    and (p_expected_version is null or version = p_expected_version);

  if not found then
    select version into v_matchup.version from public.team_tournament_matchups where id = v_matchup.id;
    return public.team_tournament_version_conflict(
      'team_tournament_matchups', p_expected_version, v_matchup.version
    );
  end if;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, p_tournament_id, 'team.lineup.lock', p_matchup_id, '{}'::jsonb
  );

  v_result := jsonb_build_object('ok', true, 'version', v_matchup.version + 0);
  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'lock_matchup', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

-- Publish matchup
create or replace function public.team_tournament_publish_matchup(
  p_tournament_id text,
  p_matchup_id text,
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
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_pub timestamptz := now();
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not (public.team_tournament_can_manage() or public.user_has_permission('team.lineup.publish')) then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'publish_matchup', p_idempotency_key,
    jsonb_build_object('matchupId', p_matchup_id, 'expectedVersion', p_expected_version)
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  if p_expected_version is not null and v_matchup.version <> p_expected_version then
    return public.team_tournament_version_conflict(
      'team_tournament_matchups', p_expected_version, v_matchup.version
    );
  end if;

  update public.team_tournament_lineups set
    status = 'published', published_at = v_pub, version = version + 1, updated_at = v_pub
  where matchup_id = v_matchup.id;

  update public.team_tournament_matchups set
    status = 'published', version = version + 1, updated_at = v_pub, updated_by = auth.uid()
  where id = v_matchup.id
    and (p_expected_version is null or version = p_expected_version);

  if not found then
    return public.team_tournament_version_conflict(
      'team_tournament_matchups', p_expected_version, v_matchup.version
    );
  end if;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, p_tournament_id, 'team.lineup.publish', p_matchup_id, '{}'::jsonb
  );

  v_result := jsonb_build_object('ok', true, 'version', v_matchup.version);
  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'publish_matchup', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

-- Confirm sub-match with version + idempotency
create or replace function public.team_tournament_confirm_sub_match(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text,
  p_score jsonb,
  p_winner_team_id text default null,
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
  v_sub_match public.team_tournament_sub_matches;
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_confirm_time timestamptz := now();
  v_team_a_wins int := 0;
  v_team_b_wins int := 0;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;
  if not public.team_tournament_can_manage_results() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_header := public.team_tournament_resolve_header(p_tournament_id);
  if v_header.id is null then
    return json_build_object('ok', false, 'code', 'NOT_FOUND');
  end if;
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'confirm_sub_match', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id, 'subMatchId', p_sub_match_id,
      'score', p_score, 'winnerTeamId', p_winner_team_id,
      'expectedVersion', p_expected_version
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  if v_matchup.status not in ('published','in_progress','completed') then
    return json_build_object('ok', false, 'code', 'VALIDATION', 'error', 'Matchup chưa công bố.');
  end if;

  select * into v_sub_match
  from public.team_tournament_sub_matches sm
  where sm.matchup_id = v_matchup.id and sm.external_sub_match_id = p_sub_match_id;

  if v_sub_match.result_confirmed_at is not null and not public.team_tournament_can_manage() then
    return json_build_object('ok', false, 'code', 'LOCKED', 'error', 'Kết quả đã xác nhận.');
  end if;

  if p_expected_version is not null and v_sub_match.version <> p_expected_version then
    return public.team_tournament_version_conflict(
      'team_tournament_sub_matches', p_expected_version, v_sub_match.version
    );
  end if;

  update public.team_tournament_sub_matches set
    score = coalesce(p_score, score),
    status = 'completed',
    winner_team_id = coalesce(p_winner_team_id, winner_team_id),
    result_confirmed_at = v_confirm_time,
    updated_at = v_confirm_time,
    updated_by = auth.uid(),
    version = version + 1
  where id = v_sub_match.id
    and (p_expected_version is null or version = p_expected_version);

  if not found then
    select version into v_sub_match.version from public.team_tournament_sub_matches where id = v_sub_match.id;
    return public.team_tournament_version_conflict(
      'team_tournament_sub_matches', p_expected_version, v_sub_match.version
    );
  end if;

  update public.team_tournament_matchups set status = 'in_progress', updated_at = v_confirm_time
  where id = v_matchup.id and status = 'published';

  select
    count(*) filter (where winner_team_id = v_matchup.team_a_id),
    count(*) filter (where winner_team_id = v_matchup.team_b_id)
  into v_team_a_wins, v_team_b_wins
  from public.team_tournament_sub_matches
  where matchup_id = v_matchup.id and status = 'completed';

  update public.team_tournament_matchups set
    result = jsonb_build_object(
      'teamAWins', v_team_a_wins, 'teamBWins', v_team_b_wins,
      'winnerTeamId', case
        when v_team_a_wins > v_team_b_wins then v_matchup.team_a_id
        when v_team_b_wins > v_team_a_wins then v_matchup.team_b_id
        else null end
    ),
    updated_at = v_confirm_time
  where id = v_matchup.id;

  perform public.team_tournament_write_audit(
    v_header.tenant_id, p_tournament_id, 'team.match.result.confirm', p_sub_match_id,
    jsonb_build_object('matchupId', p_matchup_id, 'score', p_score)
  );

  v_result := jsonb_build_object(
    'ok', true,
    'version', v_sub_match.version + 1,
    'subMatchId', v_sub_match.id
  );
  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'confirm_sub_match', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

-- Apply forfeit (TT-1B foundation)
create or replace function public.team_tournament_apply_forfeit(
  p_tournament_id text,
  p_matchup_id text,
  p_sub_match_id text default null,
  p_forfeiting_team_id text default null,
  p_scope text default 'sub_match',
  p_result_type text default 'forfeit',
  p_forfeit_reason text default '',
  p_technical_score jsonb default '{}'::jsonb,
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
  v_sub_match public.team_tournament_sub_matches;
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_winner text;
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
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'apply_forfeit', p_idempotency_key,
    jsonb_build_object(
      'matchupId', p_matchup_id, 'subMatchId', p_sub_match_id,
      'forfeitingTeamId', p_forfeiting_team_id, 'scope', p_scope,
      'resultType', p_result_type, 'reason', p_forfeit_reason
    )
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  select * into v_matchup
  from public.team_tournament_matchups m
  where m.team_tournament_id = v_header.id and m.external_matchup_id = p_matchup_id;

  if p_sub_match_id is not null then
    select * into v_sub_match
    from public.team_tournament_sub_matches sm
    where sm.matchup_id = v_matchup.id and sm.external_sub_match_id = p_sub_match_id;

    if p_expected_version is not null and v_sub_match.version <> p_expected_version then
      return public.team_tournament_version_conflict(
        'team_tournament_sub_matches', p_expected_version, v_sub_match.version
      );
    end if;

    v_winner := case
      when p_forfeiting_team_id = v_matchup.team_a_id then v_matchup.team_b_id
      else v_matchup.team_a_id end;

    update public.team_tournament_sub_matches set
      status = 'forfeit',
      winner_team_id = v_winner,
      score = coalesce(nullif(p_technical_score, '{}'::jsonb), score),
      result_confirmed_at = now(),
      version = version + 1,
      updated_at = now(),
      updated_by = auth.uid()
    where id = v_sub_match.id;
  end if;

  insert into public.team_tournament_forfeit_events (
    tenant_id, tournament_id, matchup_id, sub_match_id, scope,
    result_type, forfeit_reason, forfeiting_team_id, awarded_winner_team_id,
    technical_score, approved_by, approved_at, idempotency_key
  ) values (
    v_header.tenant_id, p_tournament_id, v_matchup.id, v_sub_match.id, p_scope,
    p_result_type, coalesce(p_forfeit_reason, ''), p_forfeiting_team_id, v_winner,
    coalesce(p_technical_score, '{}'::jsonb), auth.uid(), now(), p_idempotency_key
  );

  perform public.team_tournament_write_audit(
    v_header.tenant_id, p_tournament_id, 'team.match.forfeit', coalesce(p_sub_match_id, p_matchup_id),
    jsonb_build_object('reason', p_forfeit_reason, 'scope', p_scope)
  );

  v_result := jsonb_build_object('ok', true, 'winnerTeamId', v_winner);
  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'apply_forfeit', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 11. RPC guards: save_lineup_draft + upsert_standings (TT-1B)
-- Renames Phase 23C implementations to *_legacy, then installs TT-1B wrappers.
-- Repository cloud mutations stay fail-fast until this section is applied on staging.
-- ═══════════════════════════════════════════════════════════════════

do $rename_legacy$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_save_lineup_draft'
      and pg_get_function_identity_arguments(p.oid) = 'p_tournament_id text, p_matchup_id text, p_team_id text, p_selections jsonb'
  ) and not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_save_lineup_draft_legacy'
  ) then
    execute 'alter function public.team_tournament_save_lineup_draft(text, text, text, jsonb) rename to team_tournament_save_lineup_draft_legacy';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'team_tournament_upsert_standings'
      and pg_get_function_identity_arguments(p.oid) = 'p_tournament_id text, p_standings jsonb'
  ) and not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'team_tournament_upsert_standings_legacy'
  ) then
    execute 'alter function public.team_tournament_upsert_standings(text, jsonb) rename to team_tournament_upsert_standings_legacy';
  end if;
end $rename_legacy$;

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
begin
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
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

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
  v_after := coalesce(p_selections, '{}'::jsonb);

  update public.team_tournament_lineups l
  set version = l.version + 1,
      updated_at = now(),
      updated_by = auth.uid()
  where l.id = v_lineup.id
    and (p_expected_version is null or l.version = p_expected_version)
  returning l.version, l.id into v_lineup.version, v_lineup_id;

  if not found then
    select version into v_lineup.version from public.team_tournament_lineups where id = v_lineup.id;
    return public.team_tournament_version_conflict(
      'team_tournament_lineups', p_expected_version, v_lineup.version
    );
  end if;

  perform public.team_tournament_write_lineup_revision(
    v_header.tenant_id, p_tournament_id, v_lineup_id, 'draft',
    v_lineup.status, v_lineup.status, v_before, v_after,
    case when p_expected_version is null then v_lineup.version - 1 else p_expected_version end,
    v_lineup.version, null, p_idempotency_key
  );

  v_result := jsonb_build_object(
    'ok', true,
    'lineupId', v_lineup_id,
    'version', v_lineup.version
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'save_lineup_draft', p_idempotency_key, v_hash, v_result
  );
  return v_result;
end;
$$;

create or replace function public.team_tournament_upsert_standings(
  p_tournament_id text,
  p_standings jsonb,
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
  v_cmd json;
  v_hash text;
  v_result jsonb;
  v_current_version integer;
begin
  if p_idempotency_key is null then
    return public.team_tournament_upsert_standings_legacy(p_tournament_id, p_standings);
  end if;

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
  perform public.team_tournament_assert_tenant(v_header.tenant_id);

  v_cmd := public.team_tournament_begin_command(
    v_header.tenant_id, p_tournament_id, 'recalculate_standings', p_idempotency_key,
    jsonb_build_object('standings', p_standings, 'expectedVersion', p_expected_version)
  );
  if not (v_cmd->>'ok')::boolean then return v_cmd; end if;
  if (v_cmd->>'replay')::boolean then return v_cmd->'result'; end if;
  v_hash := v_cmd->>'payload_hash';

  select coalesce(max(s.version), 1) into v_current_version
  from public.team_tournament_standings s
  where s.team_tournament_id = v_header.id;

  if p_expected_version is not null and v_current_version is distinct from p_expected_version then
    return public.team_tournament_version_conflict(
      'team_tournament_standings', p_expected_version, v_current_version
    );
  end if;

  v_result := public.team_tournament_upsert_standings_legacy(p_tournament_id, p_standings)::jsonb;

  if not (v_result->>'ok')::boolean then
    return v_result;
  end if;

  update public.team_tournament_standings
  set version = coalesce(v_current_version, 1) + 1
  where team_tournament_id = v_header.id;

  v_result := jsonb_build_object(
    'ok', true,
    'version', coalesce(v_current_version, 1) + 1,
    'calculationVersion', md5(coalesce(p_standings, '[]'::jsonb)::text)
  );

  perform public.team_tournament_finish_command(
    v_header.tenant_id, p_tournament_id, 'recalculate_standings', p_idempotency_key, v_hash, v_result
  );

  return v_result;
end;
$$;

-- Grants
grant execute on function public.team_tournament_save_lineup_draft(text, text, text, jsonb, integer, text) to authenticated;
grant execute on function public.team_tournament_upsert_standings(text, jsonb, integer, text) to authenticated;
revoke all on function public.team_tournament_save_lineup_draft(text, text, text, jsonb, integer, text) from public, anon;
revoke all on function public.team_tournament_upsert_standings(text, jsonb, integer, text) from public, anon;
revoke all on function public.team_tournament_save_lineup_draft_legacy(text, text, text, jsonb) from public, anon;
revoke all on function public.team_tournament_upsert_standings_legacy(text, jsonb) from public, anon;
grant execute on function public.team_tournament_get_visible_lineups(text, text, text) to authenticated;
grant execute on function public.team_tournament_begin_command(text, text, text, text, jsonb) to authenticated;
grant execute on function public.team_tournament_apply_forfeit(text, text, text, text, text, text, text, jsonb, integer, text) to authenticated;

comment on table public.team_tournament_command_log is 'TT-1B idempotency store for team tournament commands';
comment on table public.team_tournament_lineup_revisions is 'TT-1B immutable lineup change history';
comment on table public.team_tournament_dreambreaker_states is 'TT-1B cloud state for dreambreaker tie-break';
comment on table public.team_tournament_forfeit_events is 'TT-1B forfeit/technical result audit trail';
comment on table public.team_tournament_sync_mismatch is 'TT-1B shadow mode blob vs cloud mismatch log';
