-- Rollback for pairing-owner-same-tenant-view (Staging only).
-- TARGET ONLY: qyewbxjsiiyufanzcjcq
-- Restores PR4 helper bodies. Does NOT delete COURT_OWNER/VENUE_OWNER view
-- mappings from pairing-owner-view-rbac (separate package). Removes TENANT_OWNER
-- view mapping added by this package and drops owner-like helper.

delete from public.role_permissions
where role_id = 'TENANT_OWNER'
  and permission_id = 'pairing.private_rules.view';

drop function if exists public.private_pairing_actor_is_owner_like();

create or replace function public.private_pairing_can(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select auth.uid() is not null
    and public.is_super_admin()
    and public.user_has_permission(p_permission);
$$;

create or replace function public.private_pairing_tenant_visible(p_tenant_id text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_super_admin()
    and (
      public.private_pairing_current_tenant_id() is null
      or public.private_pairing_current_tenant_id() = p_tenant_id
      or public.private_pairing_current_tenant_id() = ''
    );
$$;

revoke all on function public.private_pairing_can(text) from public, anon;
grant execute on function public.private_pairing_can(text) to authenticated;

revoke all on function public.private_pairing_tenant_visible(text) from public, anon;
grant execute on function public.private_pairing_tenant_visible(text) to authenticated;
