-- Phase 6 / SECURITY_INVOKER_VIEW_REMEDIATION_01 verification
-- READ-ONLY. Run only after an approved Staging apply.
-- Expected: every status is PASS. Then rerun Supabase Security Advisor and
-- confirm security_definer_view is absent for both target views.

with target_views(view_name) as (
  values ('tenants'::text), ('club_data_v3_safe'::text)
), view_state as (
  select
    t.view_name,
    c.oid is not null as exists_as_view,
    coalesce(c.reloptions, array[]::text[]) @> array['security_invoker=true'] as security_invoker,
    pg_catalog.has_table_privilege('anon', c.oid, 'select') as anon_can_select,
    pg_catalog.has_table_privilege('authenticated', c.oid, 'select') as authenticated_can_select,
    pg_catalog.has_table_privilege('service_role', c.oid, 'select') as service_role_can_select
  from target_views t
  left join pg_catalog.pg_namespace n
    on n.nspname = 'public'
  left join pg_catalog.pg_class c
    on c.relnamespace = n.oid
   and c.relname = t.view_name
   and c.relkind = 'v'
)
select
  'view_security_invoker' as check_name,
  'public.' || view_name as object_name,
  case
    when exists_as_view and security_invoker then 'PASS'
    else 'FAIL'
  end as status,
  jsonb_build_object(
    'exists_as_view', exists_as_view,
    'security_invoker', security_invoker,
    'anon_can_select', anon_can_select,
    'authenticated_can_select', authenticated_can_select,
    'service_role_can_select', service_role_can_select
  ) as evidence
from view_state

union all

select
  'base_table_rls' as check_name,
  n.nspname || '.' || c.relname as object_name,
  case when c.relrowsecurity then 'PASS' else 'FAIL' end as status,
  jsonb_build_object(
    'rls_enabled', c.relrowsecurity,
    'rls_forced', c.relforcerowsecurity
  ) as evidence
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in ('venues', 'subscriptions', 'club_data_v3')

order by check_name, object_name;

-- Manual negative-runtime certification remains mandatory:
-- 1. anon cannot read either view unless explicitly intended and approved.
-- 2. authenticated Tenant A cannot observe Tenant B rows through either view.
-- 3. authenticated non-member cannot observe another club blob.
-- 4. SUPER_ADMIN retains the approved reporting behavior.
