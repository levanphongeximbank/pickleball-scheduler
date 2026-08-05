-- ============================================================================
-- OPERATION A — PRECHECK (SELECT ONLY)
-- Package: docs/v5/migrations/production-player-gender-operation-a/
-- NOT APPLIED. Production GO = NO.
-- Expected project: expuvcohlcjzvrrauvud
-- Expected target count: exactly 4 rows where gender = 'Nam'
-- ============================================================================

-- 1) Project identity (where configured)
select
  'expuvcohlcjzvrrauvud'::text as expected_project_ref,
  (
    select value
    from public.notification_runtime_config
    where key = 'project_ref'
    limit 1
  ) as config_project_ref,
  current_database() as database_name,
  current_user as db_user;

-- 2) Total profiles
select count(*)::int as total_profiles
from public.profiles;

-- 3) Exact gender distribution
select
  case
    when gender is null then '__NULL__'
    when btrim(gender::text) = '' then '__BLANK__'
    else gender::text
  end as gender_raw,
  count(*)::int as n
from public.profiles
group by 1
order by n desc, gender_raw;

-- 4) Exact Nam count (must be 4 or STOP)
select count(*)::int as nam_target_count
from public.profiles
where gender = 'Nam';

-- 5–8) Target IDs / gender / updated_at / status (minimum identifiers)
select
  p.id as profile_id,
  p.gender as current_gender,
  p.status as current_status,
  p.updated_at as current_updated_at
from public.profiles p
where p.gender = 'Nam'
order by p.id;

-- 9–10) Backup ledger existence + incomplete/active batch detection
select
  to_regclass('public._ppdr_op_a_batch') as batch_table,
  to_regclass('public._ppdr_op_a_ledger') as ledger_table,
  case
    when to_regclass('public._ppdr_op_a_batch') is null
      or to_regclass('public._ppdr_op_a_ledger') is null
      then 'NO_PRIOR_LEDGER_OK'
    else 'LEDGER_PRESENT_RUN_FOLLOWUP_QUERIES'
  end as ledger_gate;

-- FOLLOWUP (run only when ledger_gate = LEDGER_PRESENT_RUN_FOLLOWUP_QUERIES):
-- Incomplete batch detection — expected 0 rows; any row => STOP
-- select
--   b.batch_id,
--   b.status,
--   b.applied_at,
--   b.rolled_back_at,
--   b.operator_ref,
--   count(l.profile_id)::int as ledger_rows
-- from public._ppdr_op_a_batch b
-- left join public._ppdr_op_a_ledger l on l.batch_id = b.batch_id
-- where b.operation_id = 'OPERATION_A_GENDER_NAM_TO_MALE'
--   and b.status not in ('applied', 'rolled_back')
-- group by b.batch_id, b.status, b.applied_at, b.rolled_back_at, b.operator_ref
-- order by b.applied_at desc nulls last;
--
-- Prior applied (not rolled back) batches — informational
-- select
--   b.batch_id,
--   b.status,
--   b.applied_at,
--   count(l.profile_id)::int as ledger_rows
-- from public._ppdr_op_a_batch b
-- join public._ppdr_op_a_ledger l on l.batch_id = b.batch_id
-- where b.operation_id = 'OPERATION_A_GENDER_NAM_TO_MALE'
--   and b.status = 'applied'
-- group by b.batch_id, b.status, b.applied_at
-- order by b.applied_at desc;

-- 11) Gender column type
select
  c.data_type,
  c.udt_name,
  c.is_nullable,
  c.character_maximum_length
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name = 'profiles'
  and c.column_name = 'gender';

-- 12) Existing constraints mentioning gender (profiles)
select
  con.conname,
  pg_get_constraintdef(con.oid) as definition,
  con.convalidated
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname = 'profiles'
  and pg_get_constraintdef(con.oid) ilike '%gender%'
order by con.conname;

-- 13) Non-canonical count
select count(*)::int as non_canonical_count
from public.profiles
where gender is not null
  and btrim(gender::text) <> ''
  and gender not in ('male', 'female', 'other');

-- 14) Expected target count gate (operator must see 4)
select
  4::int as expected_target_count,
  (select count(*)::int from public.profiles where gender = 'Nam') as live_target_count,
  case
    when (select count(*)::int from public.profiles where gender = 'Nam') = 4
      then 'PASS_COUNT'
    else 'STOP_COUNT_DRIFT'
  end as count_gate;
