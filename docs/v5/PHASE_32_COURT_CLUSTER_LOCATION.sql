-- Phase 32 — Court cluster location + platform-only management RLS
-- Chạy SAU: PHASE_23_COURT_CLUSTERS.sql

-- ─── 1) Location fields ─────────────────────────────────────────────────────

alter table public.court_clusters
  add column if not exists address text,
  add column if not exists google_maps_url text;

-- ─── 2) Platform cluster admin helper ───────────────────────────────────────

create or replace function public.is_platform_cluster_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.status = 'active'
        and p.role in ('SYSTEM_TECHNICIAN')
    );
$$;

-- ─── 3) Tighten mutate policies (platform admin only) ───────────────────────

drop policy if exists court_clusters_insert on public.court_clusters;
drop policy if exists court_clusters_update on public.court_clusters;
drop policy if exists court_clusters_delete on public.court_clusters;
drop policy if exists user_cluster_assignments_insert on public.user_cluster_assignments;
drop policy if exists user_cluster_assignments_delete on public.user_cluster_assignments;

create policy court_clusters_insert on public.court_clusters
  for insert to authenticated
  with check (public.is_platform_cluster_admin());

create policy court_clusters_update on public.court_clusters
  for update to authenticated
  using (public.is_platform_cluster_admin())
  with check (public.is_platform_cluster_admin());

create policy court_clusters_delete on public.court_clusters
  for delete to authenticated
  using (public.is_platform_cluster_admin());

create policy user_cluster_assignments_insert on public.user_cluster_assignments
  for insert to authenticated
  with check (public.is_platform_cluster_admin());

create policy user_cluster_assignments_delete on public.user_cluster_assignments
  for delete to authenticated
  using (public.is_platform_cluster_admin());

-- SELECT policies unchanged (assigned users + org-wide read)

-- ─── 4) RBAC permissions (cluster.view / cluster.manage) ────────────────────

insert into public.permissions (id, module, action, description) values
  ('cluster.view', 'cluster', 'view', 'Xem cụm sân'),
  ('cluster.manage', 'cluster', 'manage', 'Quản lý cụm sân — tạo/sửa/gán chủ')
on conflict (id) do update set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

insert into public.roles (id, label, description) values
  ('PLATFORM_ADMIN', 'Quản trị nền tảng', 'Alias SUPER_ADMIN'),
  ('SYSTEM_TECHNICIAN', 'Kỹ thuật viên hệ thống', 'V5.2 platform scope')
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description;

insert into public.role_permissions (role_id, permission_id)
select r.role_id, p.id
from (values ('SYSTEM_TECHNICIAN'), ('PLATFORM_ADMIN'), ('SUPER_ADMIN')) as r(role_id)
join public.roles roles on roles.id = r.role_id
cross join public.permissions p
where p.id in ('cluster.view', 'cluster.manage')
on conflict do nothing;

-- Rollback (khẩn cấp):
-- alter table public.court_clusters drop column if exists address;
-- alter table public.court_clusters drop column if exists google_maps_url;
-- drop function if exists public.is_platform_cluster_admin();
