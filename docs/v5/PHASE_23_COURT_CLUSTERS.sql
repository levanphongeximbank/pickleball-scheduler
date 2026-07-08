-- Phase 23 — Court clusters (V5.2 SaaS)
-- Chạy SAU: supabase-rbac.sql, PHASE_22_CLOUD_PERSISTENCE.sql
-- Staging: qyewbxjsiiyufanzcjcq | Production: expuvcohlcjzvrrauvud

-- ─── 1) Court clusters (tài sản vận hành) ───────────────────────────────────

create table if not exists public.court_clusters (
  id text primary key,
  venue_id text not null references public.venues (id) on delete cascade,
  name text not null,
  slug text not null,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  court_count integer not null default 0,
  owner_user_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, slug)
);

create index if not exists court_clusters_venue_id_idx
  on public.court_clusters (venue_id);

-- ─── 2) User ↔ cluster assignments (multi-cluster owner) ────────────────────

create table if not exists public.user_cluster_assignments (
  user_id uuid not null references public.profiles (id) on delete cascade,
  cluster_id text not null references public.court_clusters (id) on delete cascade,
  role text not null default 'CLUSTER_OWNER'
    check (role in ('CLUSTER_OWNER', 'CLUSTER_MANAGER')),
  created_at timestamptz not null default now(),
  primary key (user_id, cluster_id)
);

create index if not exists user_cluster_assignments_cluster_id_idx
  on public.user_cluster_assignments (cluster_id);

-- ─── 3) Court engine — optional cluster scope ───────────────────────────────

alter table public.court_engine_stores
  add column if not exists cluster_id text references public.court_clusters (id) on delete set null;

create index if not exists court_engine_stores_cluster_id_idx
  on public.court_engine_stores (cluster_id)
  where cluster_id is not null;

-- ─── 4) RLS helpers ─────────────────────────────────────────────────────────

create or replace function public.is_org_wide_venue_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('VENUE_OWNER', 'COURT_OWNER', 'VENUE_MANAGER', 'COURT_MANAGER')
  );
$$;

create or replace function public.user_cluster_ids()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select uca.cluster_id
  from public.user_cluster_assignments uca
  where uca.user_id = auth.uid();
$$;

create or replace function public.can_access_cluster(p_cluster_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.court_clusters cc
      where cc.id = p_cluster_id
        and (
          (public.is_org_wide_venue_role() and cc.venue_id = public.user_venue_id())
          or cc.id in (select public.user_cluster_ids())
        )
    );
$$;

-- ─── 5) RLS policies ────────────────────────────────────────────────────────

alter table public.court_clusters enable row level security;
alter table public.user_cluster_assignments enable row level security;

drop policy if exists court_clusters_select on public.court_clusters;
drop policy if exists court_clusters_insert on public.court_clusters;
drop policy if exists court_clusters_update on public.court_clusters;
drop policy if exists court_clusters_delete on public.court_clusters;

create policy court_clusters_select on public.court_clusters
  for select to authenticated
  using (
    public.is_super_admin()
    or (public.is_org_wide_venue_role() and venue_id = public.user_venue_id())
    or id in (select public.user_cluster_ids())
  );

create policy court_clusters_insert on public.court_clusters
  for insert to authenticated
  with check (
    public.is_super_admin()
    or (public.is_org_wide_venue_role() and venue_id = public.user_venue_id())
  );

create policy court_clusters_update on public.court_clusters
  for update to authenticated
  using (
    public.is_super_admin()
    or (public.is_org_wide_venue_role() and venue_id = public.user_venue_id())
    or id in (select public.user_cluster_ids())
  )
  with check (
    public.is_super_admin()
    or (public.is_org_wide_venue_role() and venue_id = public.user_venue_id())
    or id in (select public.user_cluster_ids())
  );

create policy court_clusters_delete on public.court_clusters
  for delete to authenticated
  using (
    public.is_super_admin()
    or (public.is_org_wide_venue_role() and venue_id = public.user_venue_id())
  );

drop policy if exists user_cluster_assignments_select on public.user_cluster_assignments;
drop policy if exists user_cluster_assignments_insert on public.user_cluster_assignments;
drop policy if exists user_cluster_assignments_delete on public.user_cluster_assignments;

create policy user_cluster_assignments_select on public.user_cluster_assignments
  for select to authenticated
  using (
    public.is_super_admin()
    or user_id = auth.uid()
    or exists (
      select 1 from public.court_clusters cc
      where cc.id = cluster_id
        and public.is_org_wide_venue_role()
        and cc.venue_id = public.user_venue_id()
    )
  );

create policy user_cluster_assignments_insert on public.user_cluster_assignments
  for insert to authenticated
  with check (
    public.is_super_admin()
    or exists (
      select 1 from public.court_clusters cc
      where cc.id = cluster_id
        and public.is_org_wide_venue_role()
        and cc.venue_id = public.user_venue_id()
    )
  );

create policy user_cluster_assignments_delete on public.user_cluster_assignments
  for delete to authenticated
  using (
    public.is_super_admin()
    or exists (
      select 1 from public.court_clusters cc
      where cc.id = cluster_id
        and public.is_org_wide_venue_role()
        and cc.venue_id = public.user_venue_id()
    )
  );

-- ─── Verify ─────────────────────────────────────────────────────────────────

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('court_clusters', 'user_cluster_assignments')
order by tablename;

-- Rollback (khẩn cấp):
-- drop table if exists public.user_cluster_assignments;
-- drop table if exists public.court_clusters;
-- alter table public.court_engine_stores drop column if exists cluster_id;
