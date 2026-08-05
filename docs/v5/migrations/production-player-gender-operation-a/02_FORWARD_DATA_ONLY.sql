-- ============================================================================
-- OPERATION A — FORWARD DATA-ONLY (TRANSACTIONAL, FAIL-CLOSED)
-- Package: docs/v5/migrations/production-player-gender-operation-a/
-- NOT APPLIED. Production GO = NO.
-- DATA ONLY: no profiles CHECK, no ALTER TABLE public.profiles.
-- Target: exact rows where gender = 'Nam' -> male (expected count = 4).
--
-- OPERATOR REQUIREMENT BEFORE RUN:
--   Replace BOTH placeholders below with the same UUID recorded in the run log:
--     __OPERATOR_BATCH_ID__
--   Example: 11111111-2222-4333-8444-555555555555
-- ============================================================================

begin;

-- Remediation infrastructure only (not profiles schema / not CHECK on gender).
create table if not exists public._ppdr_op_a_batch (
  batch_id uuid primary key,
  operation_id text not null,
  status text not null,
  applied_at timestamptz not null,
  rolled_back_at timestamptz null,
  operator_ref text null,
  expected_count integer not null,
  created_at timestamptz not null default now()
);

create table if not exists public._ppdr_op_a_ledger (
  batch_id uuid not null references public._ppdr_op_a_batch (batch_id),
  profile_id uuid not null,
  original_gender text not null,
  original_updated_at timestamptz null,
  captured_at timestamptz not null,
  primary key (batch_id, profile_id)
);

create index if not exists _ppdr_op_a_ledger_profile_idx
  on public._ppdr_op_a_ledger (profile_id);

do $op_a_forward$
declare
  v_batch_id uuid;
  v_operation_id text := 'OPERATION_A_GENDER_NAM_TO_MALE';
  v_operator_ref text := 'operation-a-gender-nam-to-male';
  v_expected int := 4;
  v_applied_at timestamptz := clock_timestamp();
  v_captured_at timestamptz := v_applied_at;
  v_captured int := 0;
  v_updated int := 0;
  v_remaining_nam int := 0;
  v_incomplete int := 0;
  v_lock_key integer := hashtext('OPERATION_A_GENDER_NAM_TO_MALE');
begin
  -- Explicit batch ID (operator must replace placeholder; fail closed if left unset).
  begin
    v_batch_id := '__OPERATOR_BATCH_ID__'::uuid;
  exception
    when invalid_text_representation then
      raise exception 'op_a_forward_blocked: batch_id placeholder not replaced with a valid UUID';
  end;

  if v_batch_id is null then
    raise exception 'op_a_forward_blocked: batch_id is null';
  end if;

  -- Transaction-scoped concurrency guard.
  perform pg_advisory_xact_lock(v_lock_key);

  -- Reject incomplete / unknown-status batches.
  select count(*)::int
  into v_incomplete
  from public._ppdr_op_a_batch
  where operation_id = v_operation_id
    and status not in ('applied', 'rolled_back');

  if v_incomplete > 0 then
    raise exception 'op_a_forward_blocked: incomplete Operation A batch exists (count=%)', v_incomplete;
  end if;

  if exists (
    select 1 from public._ppdr_op_a_batch where batch_id = v_batch_id
  ) then
    raise exception 'op_a_forward_blocked: batch_id already exists: %', v_batch_id;
  end if;

  insert into public._ppdr_op_a_batch (
    batch_id,
    operation_id,
    status,
    applied_at,
    rolled_back_at,
    operator_ref,
    expected_count
  ) values (
    v_batch_id,
    v_operation_id,
    'applied',
    v_applied_at,
    null,
    v_operator_ref,
    v_expected
  );

  -- Capture ONLY exact gender = 'Nam' rows into the batch ledger.
  insert into public._ppdr_op_a_ledger (
    batch_id,
    profile_id,
    original_gender,
    original_updated_at,
    captured_at
  )
  select
    v_batch_id,
    p.id,
    p.gender,
    p.updated_at,
    v_captured_at
  from public.profiles p
  where p.gender = 'Nam';

  get diagnostics v_captured = row_count;

  if v_captured <> v_expected then
    raise exception
      'op_a_forward_blocked: captured_count=% expected=% (live drift)',
      v_captured, v_expected;
  end if;

  -- Update ONLY rows joined to this batch ledger, with drift guards.
  update public.profiles p
  set
    gender = 'male',
    updated_at = v_applied_at
  from public._ppdr_op_a_ledger l
  where l.batch_id = v_batch_id
    and l.profile_id = p.id
    and p.gender = 'Nam'
    and p.updated_at is not distinct from l.original_updated_at
    and l.original_gender = 'Nam';

  get diagnostics v_updated = row_count;

  if v_updated <> v_expected then
    raise exception
      'op_a_forward_blocked: updated_count=% expected=% (gender/updated_at drift or concurrent change)',
      v_updated, v_expected;
  end if;

  -- Verify no captured target remains Nam.
  select count(*)::int
  into v_remaining_nam
  from public.profiles p
  join public._ppdr_op_a_ledger l
    on l.profile_id = p.id
   and l.batch_id = v_batch_id
  where p.gender = 'Nam';

  if v_remaining_nam <> 0 then
    raise exception
      'op_a_forward_blocked: remaining_nam_on_ledger_targets=%',
      v_remaining_nam;
  end if;

  -- Verify all four ledger rows correspond to updated male rows at applied_at.
  if (
    select count(*)::int
    from public._ppdr_op_a_ledger l
    join public.profiles p on p.id = l.profile_id
    where l.batch_id = v_batch_id
      and p.gender = 'male'
      and p.updated_at is not distinct from v_applied_at
  ) <> v_expected then
    raise exception
      'op_a_forward_blocked: ledger/profile post-update mismatch for batch %',
      v_batch_id;
  end if;

  raise notice 'op_a_forward_ok batch_id=% applied_at=% updated=%',
    v_batch_id, v_applied_at, v_updated;
end;
$op_a_forward$;

commit;
