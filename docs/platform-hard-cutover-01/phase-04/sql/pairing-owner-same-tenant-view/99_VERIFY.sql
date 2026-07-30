-- Read-only verify for pairing-owner-same-tenant-view.
-- TARGET ONLY: qyewbxjsiiyufanzcjcq
-- After apply, all expectation columns below must be TRUE / counts match.

-- 1) Role mappings: Owner-like view only (no edit/manage/admin/audit/simulate)
select
  exists (
    select 1 from public.role_permissions
    where role_id = 'TENANT_OWNER' and permission_id = 'pairing.private_rules.view'
  ) as tenant_owner_view,
  exists (
    select 1 from public.role_permissions
    where role_id = 'COURT_OWNER' and permission_id = 'pairing.private_rules.view'
  ) as court_owner_view,
  exists (
    select 1 from public.role_permissions
    where role_id = 'VENUE_OWNER' and permission_id = 'pairing.private_rules.view'
  ) as venue_owner_view,
  not exists (
    select 1 from public.role_permissions
    where role_id in ('TENANT_OWNER', 'COURT_OWNER', 'VENUE_OWNER')
      and permission_id in (
        'pairing.private_rules.edit',
        'pairing.private_rules.manage',
        'pairing.private_rules.admin',
        'pairing.private_rules.audit',
        'pairing.private_rules.simulate'
      )
  ) as owners_lack_elevated_pairing_perms;

-- 2) Helper + can/tenant_visible defs must include owner-like same-tenant path
--    and must NOT be the pre-remediation is_super_admin-only bodies.
with defs as (
  select
    max(case when p.proname = 'private_pairing_can' then pg_get_functiondef(p.oid) end) as def_can,
    max(case when p.proname = 'private_pairing_tenant_visible' then pg_get_functiondef(p.oid) end) as def_vis,
    max(case when p.proname = 'private_pairing_actor_is_owner_like' then pg_get_functiondef(p.oid) end) as def_owner
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'private_pairing_can',
      'private_pairing_tenant_visible',
      'private_pairing_actor_is_owner_like'
    )
)
select
  def_owner is not null as owner_like_helper_exists,
  position('TENANT_OWNER' in coalesce(def_owner, '')) > 0 as owner_like_lists_tenant_owner,
  position('pairing.private_rules.view' in coalesce(def_can, '')) > 0 as can_has_view_owner_branch,
  position('private_pairing_actor_is_owner_like' in coalesce(def_can, '')) > 0 as can_uses_owner_like,
  position('is_super_admin' in coalesce(def_can, '')) > 0 as can_keeps_super_admin_path,
  -- Fail if can() is still the exclusive SA triple-AND without owner branch
  not (
    coalesce(def_can, '') ~* 'auth\.uid\(\) is not null[[:space:]]+and public\.is_super_admin\(\)[[:space:]]+and public\.user_has_permission'
    and position('private_pairing_actor_is_owner_like' in coalesce(def_can, '')) = 0
  ) as can_not_sa_only_gate,
  position('private_pairing_actor_is_owner_like' in coalesce(def_vis, '')) > 0 as vis_uses_owner_like,
  position('is_super_admin' in coalesce(def_vis, '')) > 0 as vis_keeps_super_admin_path,
  -- Owner same-tenant: equality required; Owner must not inherit SA null/empty OR open access
  position('private_pairing_current_tenant_id() = p_tenant_id' in coalesce(def_vis, '')) > 0
    as vis_requires_tenant_equality,
  -- Fail if tenant_visible is still SA-only AND (null OR equal OR '')
  not (
    coalesce(def_vis, '') ~* 'select public\.is_super_admin\(\)[[:space:]]+and \('
    and position('private_pairing_actor_is_owner_like' in coalesce(def_vis, '')) = 0
  ) as vis_not_sa_only_gate
from defs;

-- 3) Platform elevated grants unchanged (SUPER_ADMIN / PLATFORM_ADMIN still hold manage/audit/simulate/view)
select role_id, permission_id
from public.role_permissions
where permission_id like 'pairing.private_rules.%'
  and role_id in ('SUPER_ADMIN', 'PLATFORM_ADMIN')
order by role_id, permission_id;

-- 4) Runtime matrix contract (post-apply, authenticated Owner JWT — manual / session):
--    Expectation (document; execute under Owner session after apply):
--      private_pairing_can('pairing.private_rules.view')                         → true
--      private_pairing_can('pairing.private_rules.manage')                       → false
--      private_pairing_can('pairing.private_rules.edit')                         → false
--      private_pairing_can('pairing.private_rules.admin')                        → false
--      private_pairing_can('pairing.private_rules.audit')                        → false
--      private_pairing_can('pairing.private_rules.simulate')                     → false
--      private_pairing_tenant_visible(public.user_venue_id())                    → true   (same-tenant PASS)
--      private_pairing_tenant_visible('venue-staging-b-other')                   → false  (cross-tenant FAIL)
--    SUPER_ADMIN session: prior can/tenant_visible behavior retained via is_super_admin path.
