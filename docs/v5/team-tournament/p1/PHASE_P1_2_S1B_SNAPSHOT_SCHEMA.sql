-- Phase P1.2 S1-B — Team Tournament setup snapshot schema (AUTHORING ONLY)
-- Idempotent migration script. DO NOT apply to Staging or Production in S1-B.
-- Prerequisite: docs/v5/PHASE_23C_TEAM_TOURNAMENT_CLOUD_SYNC.sql
--               docs/v5/PHASE_TT1B_TEAM_TOURNAMENT_SSOT.sql
--               S1-A canonical module (src/features/team-tournament/canonical/)
--
-- Scope: team_tournament_setup_snapshots table, hash helpers, immutability,
--        RLS, internal SECURITY DEFINER snapshot persistence helper.
-- NOT in scope: get_setup v7, domain RPCs, Staging/Production apply.
--
-- Hash parity note:
--   Full S1-A canonical JSON normalization (NFC, domain sorts, rating rounding)
--   is NOT replicated in SQL. Server verifies SHA-256 of client-supplied
--   canonical UTF-8 text. Golden-vector parity is enforced client-side (S1-A)
--   and via staging apply certification (S1-E), not via SQL jsonb::text.

create extension if not exists pgcrypto with schema extensions;

-- ═══════════════════════════════════════════════════════════════════
-- 1. Snapshot table
-- ═══════════════════════════════════════════════════════════════════
create table if not exists public.team_tournament_setup_snapshots (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  team_tournament_id uuid not null,
  tournament_version integer not null,
  schema_version integer not null default 7,
  command_name text not null,
  idempotency_key text not null,
  payload_hash text not null,
  engine_input_hash text not null,
  engine_output_hash text not null,
  snapshot_hash text not null,
  engine_version text not null,
  rules_version text null,
  snapshot_json jsonb not null,
  normalized_read_hash text not null,
  actor_id uuid null,
  retention_class text not null default 'active',
  archived_at timestamptz null,
  legal_hold boolean not null default false,
  created_at timestamptz not null default now(),

  constraint team_tournament_setup_snapshots_tournament_version_chk
    check (tournament_version >= 1),
  constraint team_tournament_setup_snapshots_schema_version_chk
    check (schema_version >= 7),
  constraint team_tournament_setup_snapshots_idempotency_key_len_chk
    check (char_length(btrim(idempotency_key)) >= 1 and char_length(idempotency_key) <= 128),
  constraint team_tournament_setup_snapshots_payload_hash_fmt_chk
    check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint team_tournament_setup_snapshots_engine_input_hash_fmt_chk
    check (engine_input_hash ~ '^[0-9a-f]{64}$'),
  constraint team_tournament_setup_snapshots_engine_output_hash_fmt_chk
    check (engine_output_hash ~ '^[0-9a-f]{64}$'),
  constraint team_tournament_setup_snapshots_snapshot_hash_fmt_chk
    check (snapshot_hash ~ '^[0-9a-f]{64}$'),
  constraint team_tournament_setup_snapshots_normalized_read_hash_fmt_chk
    check (normalized_read_hash ~ '^[0-9a-f]{64}$'),
  constraint team_tournament_setup_snapshots_retention_class_chk
    check (retention_class in ('active', 'archived', 'compacted')),
  constraint team_tournament_setup_snapshots_command_name_chk
    check (command_name in (
      'discipline.save',
      'discipline.remove',
      'discipline.reorder',
      'groups.replace',
      'groups.clear',
      'matchups.replace',
      'schedule.update',
      'schedule.batch',
      'schedule.publish',
      'schedule.lock',
      'deputies.set',
      'dreambreaker.order_submit',
      'dreambreaker.order_lock',
      'dreambreaker.point',
      'dreambreaker.sync',
      'awards.update',
      'awards.assign',
      'awards.auto_assign',
      'tournament.save_draft',
      'tournament.close',
      'snapshot.restore'
    )),
  constraint team_tournament_setup_snapshots_one_per_version_uidx
    unique (tenant_id, tournament_id, tournament_version),
  constraint team_tournament_setup_snapshots_idempotency_uidx
    unique (tenant_id, tournament_id, command_name, idempotency_key)
);

-- Foreign keys (idempotent)
do $fk$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'team_tournament_setup_snapshots_tenant_id_fkey'
  ) then
    alter table public.team_tournament_setup_snapshots
      add constraint team_tournament_setup_snapshots_tenant_id_fkey
      foreign key (tenant_id) references public.venues(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'team_tournament_setup_snapshots_team_tournament_id_fkey'
  ) then
    alter table public.team_tournament_setup_snapshots
      add constraint team_tournament_setup_snapshots_team_tournament_id_fkey
      foreign key (team_tournament_id) references public.team_tournaments(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'team_tournament_setup_snapshots_actor_id_fkey'
  ) then
    alter table public.team_tournament_setup_snapshots
      add constraint team_tournament_setup_snapshots_actor_id_fkey
      foreign key (actor_id) references auth.users(id) on delete set null;
  end if;
end
$fk$;

-- ═══════════════════════════════════════════════════════════════════
-- 2. Indexes (non-redundant with unique constraints)
-- ═══════════════════════════════════════════════════════════════════
create index if not exists idx_team_tournament_setup_snapshots_latest
  on public.team_tournament_setup_snapshots (tenant_id, tournament_id, tournament_version desc);

create index if not exists idx_team_tournament_setup_snapshots_timeline
  on public.team_tournament_setup_snapshots (tenant_id, tournament_id, created_at desc);

create index if not exists idx_team_tournament_setup_snapshots_command_history
  on public.team_tournament_setup_snapshots (tenant_id, tournament_id, command_name, created_at desc);

create index if not exists idx_team_tournament_setup_snapshots_retention
  on public.team_tournament_setup_snapshots (retention_class, archived_at)
  where retention_class <> 'active';

create index if not exists idx_team_tournament_setup_snapshots_team_tournament
  on public.team_tournament_setup_snapshots (team_tournament_id, tournament_version desc);

-- idempotency lookup covered by team_tournament_setup_snapshots_idempotency_uidx

-- ═══════════════════════════════════════════════════════════════════
-- 3. Hash helpers (parity verification boundary)
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.team_tournament_is_sha256_hex(p_hash text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select coalesce(p_hash, '') ~ '^[0-9a-f]{64}$';
$$;

comment on function public.team_tournament_is_sha256_hex(text) is
  'Validates lowercase 64-char SHA-256 hex. Matches S1-A isValidSha256Hex contract.';

create or replace function public.team_tournament_sha256_utf8(p_text text)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select encode(extensions.digest(coalesce(p_text, ''), 'sha256'), 'hex');
$$;

comment on function public.team_tournament_sha256_utf8(text) is
  'SHA-256 lowercase hex over UTF-8 text. Parity with S1-A hashUtf8Sha256Sync when p_text is the exact canonical UTF-8 string.';

create or replace function public.team_tournament_verify_canonical_text_hash(
  p_canonical_text text,
  p_expected_hash text
)
returns boolean
language sql
immutable
set search_path = public, extensions
as $$
  select public.team_tournament_is_sha256_hex(p_expected_hash)
    and public.team_tournament_sha256_utf8(p_canonical_text) = lower(p_expected_hash);
$$;

comment on function public.team_tournament_verify_canonical_text_hash(text, text) is
  'Verifies SHA-256 of client-supplied canonical UTF-8 text. Does NOT perform S1-A domain normalization in SQL.';

-- STUB: normalized read hash lands in S1-C get_setup v7. S1-B accepts caller-supplied read projection JSON.
create or replace function public.team_tournament_normalized_read_hash(p_read_model_json jsonb)
returns text
language sql
immutable
set search_path = public, extensions
as $$
  select public.team_tournament_sha256_utf8(coalesce(p_read_model_json::text, '{}'));
$$;

comment on function public.team_tournament_normalized_read_hash(jsonb) is
  'S1-B STUB: hashes jsonb::text of normalized read projection. NOT equivalent to S1-A snapshot canonicalization. Replaced/extended in S1-C.';

-- ═══════════════════════════════════════════════════════════════════
-- 4. Immutability guards
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.team_tournament_setup_snapshots_immutable_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'SNAPSHOT_DELETE_FORBIDDEN'
      using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' then
    if current_setting('team_tournament.snapshot_maintenance', true) = 'allow' then
      if new.id is distinct from old.id
        or new.tenant_id is distinct from old.tenant_id
        or new.tournament_id is distinct from old.tournament_id
        or new.team_tournament_id is distinct from old.team_tournament_id
        or new.tournament_version is distinct from old.tournament_version
        or new.schema_version is distinct from old.schema_version
        or new.command_name is distinct from old.command_name
        or new.idempotency_key is distinct from old.idempotency_key
        or new.payload_hash is distinct from old.payload_hash
        or new.engine_input_hash is distinct from old.engine_input_hash
        or new.engine_output_hash is distinct from old.engine_output_hash
        or new.snapshot_hash is distinct from old.snapshot_hash
        or new.engine_version is distinct from old.engine_version
        or new.rules_version is distinct from old.rules_version
        or new.snapshot_json is distinct from old.snapshot_json
        or new.normalized_read_hash is distinct from old.normalized_read_hash
        or new.actor_id is distinct from old.actor_id
        or new.created_at is distinct from old.created_at
      then
        raise exception 'SNAPSHOT_IMMUTABLE'
          using errcode = 'P0001';
      end if;
      return new;
    end if;

    raise exception 'SNAPSHOT_IMMUTABLE'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists team_tournament_setup_snapshots_immutable_trg
  on public.team_tournament_setup_snapshots;

create trigger team_tournament_setup_snapshots_immutable_trg
  before update or delete on public.team_tournament_setup_snapshots
  for each row execute function public.team_tournament_setup_snapshots_immutable_guard();

-- Platform maintenance pathway (archive metadata only)
create or replace function public.team_tournament_setup_snapshot_archive(
  p_snapshot_id uuid,
  p_retention_class text default 'archived'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_super_admin() then
    raise exception 'PERMISSION_DENIED'
      using errcode = 'P0001';
  end if;

  if p_retention_class not in ('archived', 'compacted') then
    raise exception 'INVALID_RETENTION_CLASS'
      using errcode = 'P0001';
  end if;

  perform set_config('team_tournament.snapshot_maintenance', 'allow', true);

  update public.team_tournament_setup_snapshots
  set retention_class = p_retention_class,
      archived_at = coalesce(archived_at, now())
  where id = p_snapshot_id
    and legal_hold = false;

  if not found then
    raise exception 'SNAPSHOT_NOT_FOUND_OR_LEGAL_HOLD'
      using errcode = 'P0001';
  end if;
end;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- 5. RLS — SELECT for managers; no direct writes
-- ═══════════════════════════════════════════════════════════════════
alter table public.team_tournament_setup_snapshots enable row level security;

revoke all on public.team_tournament_setup_snapshots from anon, authenticated;
grant select on public.team_tournament_setup_snapshots to authenticated;

drop policy if exists team_tournament_setup_snapshots_select on public.team_tournament_setup_snapshots;
create policy team_tournament_setup_snapshots_select on public.team_tournament_setup_snapshots
  for select to authenticated using (
    public.is_super_admin()
    or (
      tenant_id = (select venue_id from public.profiles where id = auth.uid())
      and public.team_tournament_can_manage()
    )
  );

-- No INSERT / UPDATE / DELETE policies for authenticated.
-- Snapshot rows are created only via SECURITY DEFINER helpers inside setup mutations.

-- ═══════════════════════════════════════════════════════════════════
-- 6. Internal snapshot persistence helper
-- ═══════════════════════════════════════════════════════════════════
create or replace function public.team_tournament_create_setup_snapshot(
  p_tenant_id text,
  p_tournament_id text,
  p_team_tournament_id uuid,
  p_tournament_version integer,
  p_schema_version integer,
  p_command_name text,
  p_idempotency_key text,
  p_payload_hash text,
  p_engine_input_hash text,
  p_engine_output_hash text,
  p_snapshot_hash text,
  p_snapshot_canonical_text text,
  p_engine_version text,
  p_rules_version text,
  p_snapshot_json jsonb,
  p_normalized_read_hash text,
  p_actor_id uuid default null
)
returns json
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_existing public.team_tournament_setup_snapshots;
  v_version_existing public.team_tournament_setup_snapshots;
  v_snapshot_id uuid;
  v_created_at timestamptz;
  v_pairing_commands text[] := array[
    'matchups.replace', 'groups.replace', 'groups.clear', 'schedule.batch', 'schedule.publish'
  ];
begin
  public.team_tournament_assert_tenant(p_tenant_id);

  if p_tournament_version is null or p_tournament_version < 1 then
    return json_build_object('ok', false, 'code', 'VALIDATION_ERROR', 'error', 'tournament_version phải >= 1.');
  end if;

  if p_schema_version is null or p_schema_version < 7 then
    return json_build_object('ok', false, 'code', 'VALIDATION_ERROR', 'error', 'schema_version phải >= 7.');
  end if;

  if not public.team_tournament_is_sha256_hex(p_payload_hash)
    or not public.team_tournament_is_sha256_hex(p_engine_input_hash)
    or not public.team_tournament_is_sha256_hex(p_engine_output_hash)
    or not public.team_tournament_is_sha256_hex(p_snapshot_hash)
    or not public.team_tournament_is_sha256_hex(p_normalized_read_hash)
  then
    return json_build_object('ok', false, 'code', 'INVALID_HASH_FORMAT', 'error', 'Hash không đúng định dạng SHA-256 hex.');
  end if;

  if p_idempotency_key is null or btrim(p_idempotency_key) = '' or char_length(p_idempotency_key) > 128 then
    return json_build_object('ok', false, 'code', 'VALIDATION_ERROR', 'error', 'idempotency_key không hợp lệ.');
  end if;

  if p_command_name = any (v_pairing_commands) and (p_rules_version is null or btrim(p_rules_version) = '') then
    return json_build_object('ok', false, 'code', 'VALIDATION_ERROR', 'error', 'rules_version bắt buộc cho lệnh pairing.');
  end if;

  if not public.team_tournament_verify_canonical_text_hash(p_snapshot_canonical_text, p_snapshot_hash) then
    return json_build_object(
      'ok', false,
      'code', 'SNAPSHOT_HASH_MISMATCH',
      'error', 'snapshot_hash không khớp canonical UTF-8 text.'
    );
  end if;

  if p_snapshot_json is null then
    return json_build_object('ok', false, 'code', 'VALIDATION_ERROR', 'error', 'snapshot_json bắt buộc.');
  end if;

  -- Idempotent replay: same command + idempotency key
  select * into v_existing
  from public.team_tournament_setup_snapshots
  where tenant_id = p_tenant_id
    and tournament_id = p_tournament_id
    and command_name = p_command_name
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.payload_hash <> p_payload_hash
      or v_existing.engine_input_hash <> p_engine_input_hash
      or v_existing.engine_output_hash <> p_engine_output_hash
      or v_existing.snapshot_hash <> p_snapshot_hash
    then
      return json_build_object(
        'ok', false,
        'code', 'IDEMPOTENCY_KEY_REUSED',
        'error', 'Idempotency key đã dùng với hash khác.'
      );
    end if;

    return json_build_object(
      'ok', true,
      'replay', true,
      'snapshotId', v_existing.id,
      'snapshotVersion', v_existing.tournament_version,
      'snapshotHash', v_existing.snapshot_hash,
      'normalizedReadHash', v_existing.normalized_read_hash,
      'engineVersion', v_existing.engine_version,
      'rulesVersion', v_existing.rules_version,
      'engineInputHash', v_existing.engine_input_hash,
      'engineOutputHash', v_existing.engine_output_hash,
      'createdAt', v_existing.created_at
    );
  end if;

  -- One snapshot per tournament version
  select * into v_version_existing
  from public.team_tournament_setup_snapshots
  where tenant_id = p_tenant_id
    and tournament_id = p_tournament_id
    and tournament_version = p_tournament_version;

  if found then
    return json_build_object(
      'ok', false,
      'code', 'SNAPSHOT_VERSION_CONFLICT',
      'error', 'Đã tồn tại snapshot cho tournament_version này.',
      'existingSnapshotId', v_version_existing.id
    );
  end if;

  insert into public.team_tournament_setup_snapshots (
    tenant_id,
    tournament_id,
    team_tournament_id,
    tournament_version,
    schema_version,
    command_name,
    idempotency_key,
    payload_hash,
    engine_input_hash,
    engine_output_hash,
    snapshot_hash,
    engine_version,
    rules_version,
    snapshot_json,
    normalized_read_hash,
    actor_id
  ) values (
    p_tenant_id,
    p_tournament_id,
    p_team_tournament_id,
    p_tournament_version,
    p_schema_version,
    p_command_name,
    p_idempotency_key,
    lower(p_payload_hash),
    lower(p_engine_input_hash),
    lower(p_engine_output_hash),
    lower(p_snapshot_hash),
    p_engine_version,
    nullif(btrim(p_rules_version), ''),
    p_snapshot_json,
    lower(p_normalized_read_hash),
    p_actor_id
  )
  returning id, created_at into v_snapshot_id, v_created_at;

  return json_build_object(
    'ok', true,
    'replay', false,
    'snapshotId', v_snapshot_id,
    'snapshotVersion', p_tournament_version,
    'snapshotHash', lower(p_snapshot_hash),
    'normalizedReadHash', lower(p_normalized_read_hash),
    'engineVersion', p_engine_version,
    'rulesVersion', nullif(btrim(p_rules_version), ''),
    'engineInputHash', lower(p_engine_input_hash),
    'engineOutputHash', lower(p_engine_output_hash),
    'createdAt', v_created_at
  );
end;
$$;

comment on function public.team_tournament_create_setup_snapshot(
  text, text, uuid, integer, integer, text, text, text, text, text, text, text, text, text, jsonb, text, uuid
) is
  'Internal helper — call only inside setup mutation transaction. Does not increment tournament version or write command_log.';

-- Not granted to authenticated — setup mutation RPCs call internally only.
revoke all on function public.team_tournament_create_setup_snapshot(
  text, text, uuid, integer, integer, text, text, text, text, text, text, text, text, text, jsonb, text, uuid
) from public, anon, authenticated;

-- Archive helper: super-admin only
revoke all on function public.team_tournament_setup_snapshot_archive(uuid, text) from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════
-- 7. Command-log integration contract (documentation in SQL comments)
-- ═══════════════════════════════════════════════════════════════════
-- Expected mutation transaction flow (S1-D+, not implemented in S1-B):
--   1. team_tournament_begin_command(...) — idempotency pre-check
--   2. domain writes + team_tournaments.version increment (exactly once)
--   3. team_tournament_create_setup_snapshot(...) — insert immutable snapshot
--   4. team_tournament_finish_command(..., result_json := snapshot metadata)
--
-- Replay rules:
--   - begin_command replay short-circuits before step 2; no second snapshot
--   - create_setup_snapshot idempotency_uidx returns existing metadata on replay
--   - hash mismatch => IDEMPOTENCY_KEY_REUSED
--   - one accepted command => one tournament_version => one snapshot row
--
-- result_json shape (stored in team_tournament_command_log):
--   { snapshotId, snapshotVersion, snapshotHash, normalizedReadHash,
--     engineVersion, rulesVersion, engineInputHash, engineOutputHash, createdAt }

-- ═══════════════════════════════════════════════════════════════════
-- 8. Rollback (Staging apply reference — DO NOT run in S1-B authoring)
-- ═══════════════════════════════════════════════════════════════════
-- Safe pre-data rollback (no snapshot rows):
--   drop function if exists public.team_tournament_create_setup_snapshot(
--     text, text, uuid, integer, integer, text, text, text, text, text, text, text, text, text, jsonb, text, uuid
--   );
--   drop function if exists public.team_tournament_setup_snapshot_archive(uuid, text);
--   drop trigger if exists team_tournament_setup_snapshots_immutable_trg on public.team_tournament_setup_snapshots;
--   drop function if exists public.team_tournament_setup_snapshots_immutable_guard();
--   drop function if exists public.team_tournament_normalized_read_hash(jsonb);
--   drop function if exists public.team_tournament_verify_canonical_text_hash(text, text);
--   -- team_tournament_sha256_utf8 / team_tournament_is_sha256_hex shared with future patches; drop only if unused
--   drop policy if exists team_tournament_setup_snapshots_select on public.team_tournament_setup_snapshots;
--   drop table if exists public.team_tournament_setup_snapshots;
--
-- Rollback after snapshots exist:
--   - DROP TABLE destroys immutable history — irreversible without backup
--   - Prefer revoke execute on create_setup_snapshot + leave table for audit
--   - legal_hold = true rows must not be archived/deleted
