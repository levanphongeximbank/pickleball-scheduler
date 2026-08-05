-- ============================================================================
-- OPERATION A — POSTCHECK (SELECT ONLY)
-- Package: docs/v5/migrations/production-player-gender-operation-a/
-- NOT APPLIED. Production GO = NO.
-- OPERATOR: replace __OPERATOR_BATCH_ID__ with the applied batch UUID.
-- ============================================================================

-- Remaining exact Nam / Nữ / non-canonical
select count(*)::int as remaining_nam
from public.profiles
where gender = 'Nam';

select count(*)::int as remaining_nu
from public.profiles
where gender = 'Nữ';

select count(*)::int as non_canonical_count
from public.profiles
where gender is not null
  and btrim(gender::text) <> ''
  and gender not in ('male', 'female', 'other');

-- Totals and gender distribution
select count(*)::int as total_profiles
from public.profiles;

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

-- Batch ledger verification
select
  b.batch_id,
  b.operation_id,
  b.status,
  b.applied_at,
  b.expected_count,
  count(l.profile_id)::int as ledger_row_count
from public._ppdr_op_a_batch b
join public._ppdr_op_a_ledger l on l.batch_id = b.batch_id
where b.batch_id = '__OPERATOR_BATCH_ID__'::uuid
group by b.batch_id, b.operation_id, b.status, b.applied_at, b.expected_count;

-- Each target profile matches its batch ledger (post-op state)
select
  l.profile_id,
  l.original_gender,
  l.original_updated_at,
  p.gender as current_gender,
  p.updated_at as current_updated_at,
  b.applied_at,
  case
    when p.gender = 'male'
     and p.updated_at is not distinct from b.applied_at
     and l.original_gender = 'Nam'
      then 'MATCH'
    else 'DRIFT'
  end as match_state
from public._ppdr_op_a_ledger l
join public._ppdr_op_a_batch b on b.batch_id = l.batch_id
join public.profiles p on p.id = l.profile_id
where l.batch_id = '__OPERATOR_BATCH_ID__'::uuid
order by l.profile_id;

-- Unrelated profile IDs must not appear in this batch (informational empty set)
select l.profile_id
from public._ppdr_op_a_ledger l
where l.batch_id = '__OPERATOR_BATCH_ID__'::uuid
  and l.original_gender <> 'Nam';

-- Confirm Operation A did not add a profiles gender CHECK constraint
select
  con.conname,
  pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class rel on rel.oid = con.conrelid
join pg_namespace nsp on nsp.oid = rel.relnamespace
where nsp.nspname = 'public'
  and rel.relname = 'profiles'
  and con.conname = 'profiles_gender_canonical_chk';
-- Expected: 0 rows.

-- QA identity / account state unchanged by Operation A (spot check: certified QA still active or prior status)
select
  count(*)::int as certified_qa_profiles,
  count(*) filter (where status = 'quarantined')::int as certified_qa_quarantined
from public.profiles p
where p.email is not null
  and (
    (
      lower(btrim(p.email)) like '%@pickleball-scheduler.qa'
      and split_part(lower(btrim(p.email)), '@', 1) ~* '^(phase1b-|qa42l-prod)'
    )
    or (
      lower(btrim(p.email)) like '%@prod-qa.local'
      and split_part(lower(btrim(p.email)), '@', 1) ~* '^phase1c\.prod\.'
    )
  );
-- Operation A must not change these counts relative to precheck baseline.
