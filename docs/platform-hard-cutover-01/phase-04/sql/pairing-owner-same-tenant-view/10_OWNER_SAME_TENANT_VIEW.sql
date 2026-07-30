-- PLATFORM-HARD-CUTOVER Staging remediation (forward package)
-- TARGET ONLY: qyewbxjsiiyufanzcjcq — Owner GO required. Do not apply to Production.
-- Production forbidden: expuvcohlcjzvrrauvud
--
-- Root cause (A-PAIR PERMISSION_DENIED after PR #347 role_permissions):
--   private_pairing_get_active_rules_for_scope → private_pairing_can('pairing.private_rules.view')
--   private_pairing_can / private_pairing_tenant_visible both require is_super_admin().
-- Owner role_permissions alone cannot pass.
--
-- Fix (fail-closed, minimal):
--   1) Grant pairing.private_rules.view to TENANT_OWNER / COURT_OWNER / VENUE_OWNER only.
--   2) Widen private_pairing_can for VIEW only when actor is owner-like.
--   3) Widen private_pairing_tenant_visible for owner-like to same-tenant
--      (private_pairing_current_tenant_id() = p_tenant_id) only — no cross-tenant.
--   4) manage / edit / admin / audit / simulate remain platform-admin path
--      (is_super_admin() + user_has_permission) — unchanged for SUPER_ADMIN.
-- Does NOT rewrite already-applied pairing-owner-view-rbac history.

insert into public.roles (id, label, description)
values (
  'TENANT_OWNER',
  'Chủ tenant',
  'App Owner alias — venue-scoped; pairing view same-tenant only'
)
on conflict (id) do nothing;

insert into public.permissions (id, module, action, description)
values (
  'pairing.private_rules.view',
  'pairing',
  'view',
  'Xem private pairing rules (read-only)'
)
on conflict (id) do update set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.id in ('TENANT_OWNER', 'COURT_OWNER', 'VENUE_OWNER')
  and p.id = 'pairing.private_rules.view'
on conflict do nothing;

create or replace function public.private_pairing_actor_is_owner_like()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    auth.uid() is not null
    and (
      coalesce(public.user_role(), '') in ('TENANT_OWNER', 'COURT_OWNER', 'VENUE_OWNER')
      or coalesce(public.normalize_profile_role(public.user_role()), '') = 'COURT_OWNER'
    );
$$;

comment on function public.private_pairing_actor_is_owner_like() is
  'HC-01 A-PAIR: owner-like actor (TENANT_OWNER/COURT_OWNER/VENUE_OWNER) for pairing.view same-tenant path only';

-- Platform path unchanged: is_super_admin() AND user_has_permission(any pairing perm).
-- Owner-like path: VIEW permission only + owner-like role (tenant scope enforced separately).
create or replace function public.private_pairing_can(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and public.user_has_permission(p_permission)
    and (
      public.is_super_admin()
      or (
        p_permission = 'pairing.private_rules.view'
        and public.private_pairing_actor_is_owner_like()
      )
    );
$$;

-- SUPER_ADMIN: keep prior visibility (null/empty current tenant may cross / see all).
-- Owner-like + view: ONLY when current venue tenant equals p_tenant_id (fail-closed).
create or replace function public.private_pairing_tenant_visible(p_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select
    case
      when public.is_super_admin() then (
        public.private_pairing_current_tenant_id() is null
        or public.private_pairing_current_tenant_id() = p_tenant_id
        or public.private_pairing_current_tenant_id() = ''
      )
      when public.private_pairing_actor_is_owner_like()
        and public.user_has_permission('pairing.private_rules.view')
      then (
        public.private_pairing_current_tenant_id() is not null
        and public.private_pairing_current_tenant_id() <> ''
        and public.private_pairing_current_tenant_id() = p_tenant_id
      )
      else false
    end;
$$;

revoke all on function public.private_pairing_actor_is_owner_like() from public, anon;
grant execute on function public.private_pairing_actor_is_owner_like() to authenticated;

revoke all on function public.private_pairing_can(text) from public, anon;
grant execute on function public.private_pairing_can(text) to authenticated;

revoke all on function public.private_pairing_tenant_visible(text) from public, anon;
grant execute on function public.private_pairing_tenant_visible(text) to authenticated;
