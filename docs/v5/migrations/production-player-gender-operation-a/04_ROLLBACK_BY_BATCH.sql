-- ============================================================================
-- OPERATION A — ROLLBACK BY BATCH (DETERMINISTIC, FAIL-CLOSED)
-- Package: docs/v5/migrations/production-player-gender-operation-a/
-- NOT APPLIED. Production GO = NO.
-- Requires explicit batch ID. Refuses post-operation drift.
-- OPERATOR: replace __OPERATOR_BATCH_ID__ with the batch UUID to roll back.
-- ============================================================================

begin;

do $op_a_rollback$
declare
  v_batch_id uuid;
  v_operation_id text := 'OPERATION_A_GENDER_NAM_TO_MALE';
  v_expected int := 4;
  v_lock_key integer := hashtext('OPERATION_A_GENDER_NAM_TO_MALE');
  v_status text;
  v_applied_at timestamptz;
  v_ledger_count int := 0;
  v_restored int := 0;
  v_drift int := 0;
begin
  begin
    v_batch_id := '__OPERATOR_BATCH_ID__'::uuid;
  exception
    when invalid_text_representation then
      raise exception 'op_a_rollback_blocked: batch_id placeholder not replaced with a valid UUID';
  end;

  if v_batch_id is null then
    raise exception 'op_a_rollback_blocked: batch_id is null';
  end if;

  perform pg_advisory_xact_lock(v_lock_key);

  select b.status, b.applied_at, b.expected_count
  into v_status, v_applied_at, v_expected
  from public._ppdr_op_a_batch b
  where b.batch_id = v_batch_id
    and b.operation_id = v_operation_id
  for update;

  if v_status is null then
    raise exception 'op_a_rollback_blocked: batch not found: %', v_batch_id;
  end if;

  if v_status = 'rolled_back' then
    raise exception 'op_a_rollback_blocked: batch already rolled back: %', v_batch_id;
  end if;

  if v_status <> 'applied' then
    raise exception 'op_a_rollback_blocked: batch status=% (expected applied)', v_status;
  end if;

  select count(*)::int
  into v_ledger_count
  from public._ppdr_op_a_ledger
  where batch_id = v_batch_id;

  if v_ledger_count <> v_expected then
    raise exception
      'op_a_rollback_blocked: ledger_count=% expected=%',
      v_ledger_count, v_expected;
  end if;

  -- Every target must still be exact post-operation state; otherwise STOP with no writes.
  select count(*)::int
  into v_drift
  from public._ppdr_op_a_ledger l
  join public._ppdr_op_a_batch b on b.batch_id = l.batch_id
  left join public.profiles p on p.id = l.profile_id
  where l.batch_id = v_batch_id
    and (
      p.id is null
      or p.gender is distinct from 'male'
      or p.updated_at is distinct from b.applied_at
    );

  if v_drift <> 0 then
    raise exception
      'op_a_rollback_blocked: post-operation drift on % row(s); refusing overwrite of later changes',
      v_drift;
  end if;

  update public.profiles p
  set
    gender = l.original_gender,
    updated_at = l.original_updated_at
  from public._ppdr_op_a_ledger l
  join public._ppdr_op_a_batch b on b.batch_id = l.batch_id
  where l.batch_id = v_batch_id
    and p.id = l.profile_id
    and p.gender = 'male'
    and p.updated_at is not distinct from b.applied_at
    and l.original_gender = 'Nam';

  get diagnostics v_restored = row_count;

  if v_restored <> v_ledger_count then
    raise exception
      'op_a_rollback_blocked: restored_count=% ledger_count=%',
      v_restored, v_ledger_count;
  end if;

  update public._ppdr_op_a_batch
  set
    status = 'rolled_back',
    rolled_back_at = clock_timestamp()
  where batch_id = v_batch_id
    and status = 'applied';

  if not found then
    raise exception 'op_a_rollback_blocked: failed to mark batch rolled_back: %', v_batch_id;
  end if;

  raise notice 'op_a_rollback_ok batch_id=% restored=%', v_batch_id, v_restored;
end;
$op_a_rollback$;

commit;
