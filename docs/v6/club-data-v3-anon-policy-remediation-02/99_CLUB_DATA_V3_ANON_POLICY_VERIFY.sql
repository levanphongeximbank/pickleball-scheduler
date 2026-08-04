-- Phase 6 / CLUB_DATA_V3_ANON_POLICY_REMEDIATION_02 verification
-- READ-ONLY. Run only after an approved Staging apply.

select
  'club_data_v3_rls_enabled' as check_name,
  case when c.relrowsecurity then 'PASS' else 'FAIL' end as status,
  jsonb_build_object('rls_enabled', c.relrowsecurity, 'rls_forced', c.relforcerowsecurity) as evidence
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'club_data_v3'
  and c.relkind = 'r'

union all

select
  'legacy_anon_policies_absent' as check_name,
  case when count(*) = 0 then 'PASS' else 'FAIL' end as status,
  jsonb_build_object(
    'remaining_count', count(*),
    'remaining_names', coalesce(jsonb_agg(policyname order by policyname) filter (where policyname is not null), '[]'::jsonb)
  ) as evidence
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename = 'club_data_v3'
  and policyname in (
    'club_data_v3_anon_select',
    'club_data_v3_anon_insert',
    'club_data_v3_anon_update'
  );

-- Runtime negative read check. Expected counts: 0 and 0.
-- A controlled fixture must be present to make this a meaningful exposure test.
begin read only;
set local role anon;
select
  (select count(*) from public.club_data_v3) as base_table_rows_visible_to_anon,
  (select count(*) from public.club_data_v3_safe) as safe_view_rows_visible_to_anon;
rollback;

-- Mandatory post-apply certification:
-- 1. Create non-sensitive Tenant A/B fixtures with fixed cleanup IDs.
-- 2. anon sees 0 rows through public.club_data_v3 and public.club_data_v3_safe.
-- 3. Owner A sees only A; Owner B sees only B using real authenticated JWTs.
-- 4. anon INSERT and UPDATE attempts are denied by RLS/privilege enforcement.
-- 5. Delete fixtures and prove both cleanup counts are 0.
