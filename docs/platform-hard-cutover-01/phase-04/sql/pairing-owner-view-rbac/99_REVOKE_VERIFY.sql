-- Read-only verify after Owner GO applies pairing-owner-view-rbac/90_ROLLBACK.sql
-- TARGET ONLY: qyewbxjsiiyufanzcjcq
-- Production forbidden: expuvcohlcjzvrrauvud
-- Does NOT mutate. Does NOT rewrite private_pairing_* helpers.
--
-- Expectation after revoke:
-- 1) TENANT_OWNER / COURT_OWNER / VENUE_OWNER have 0 pairing.private_rules.* mappings
-- 2) private_pairing_can still requires is_super_admin()
-- 3) private_pairing_tenant_visible still requires is_super_admin()
-- 4) SUPER_ADMIN / PLATFORM_ADMIN pairing grants unchanged

-- Owner-like mappings must be zero for all pairing.private_rules.*
select
  (
    select count(*)
    from public.role_permissions
    where role_id in ('TENANT_OWNER', 'COURT_OWNER', 'VENUE_OWNER')
      and permission_id like 'pairing.private_rules.%'
  ) as owner_like_pairing_mappings,
  (
    select count(*)
    from public.role_permissions
    where role_id in ('TENANT_OWNER', 'COURT_OWNER', 'VENUE_OWNER')
      and permission_id = 'pairing.private_rules.view'
  ) as owner_like_view_mappings;

-- Canonical platform grants remain present
select role_id, permission_id
from public.role_permissions
where permission_id like 'pairing.private_rules.%'
  and role_id in ('SUPER_ADMIN', 'PLATFORM_ADMIN')
order by role_id, permission_id;

-- Helper bodies must remain is_super_admin()-gated (no owner-like branch)
with defs as (
  select
    max(case when p.proname = 'private_pairing_can' then pg_get_functiondef(p.oid) end) as def_can,
    max(case when p.proname = 'private_pairing_tenant_visible' then pg_get_functiondef(p.oid) end) as def_vis
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('private_pairing_can', 'private_pairing_tenant_visible')
)
select
  position('is_super_admin' in coalesce(def_can, '')) > 0 as can_requires_is_super_admin,
  position('private_pairing_actor_is_owner_like' in coalesce(def_can, '')) = 0 as can_has_no_owner_like_branch,
  position('is_super_admin' in coalesce(def_vis, '')) > 0 as vis_requires_is_super_admin,
  position('private_pairing_actor_is_owner_like' in coalesce(def_vis, '')) = 0 as vis_has_no_owner_like_branch,
  coalesce(def_can, '') ~* 'auth\.uid\(\) is not null[[:space:]]+and public\.is_super_admin\(\)[[:space:]]+and public\.user_has_permission'
    as can_matches_sa_only_contract,
  coalesce(def_vis, '') ~* 'select public\.is_super_admin\(\)'
    as vis_matches_sa_only_contract
from defs;
