-- Phase AI V5.2 — Court Engine cloud persistence
-- Chạy SAU: supabase-rbac.sql (cần public.user_venue_id, public.is_super_admin)
-- Rollback: drop tables court_engine_active_sessions, court_engine_stores

create table if not exists public.court_engine_stores (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  club_id text not null,
  payload jsonb not null default '{}'::jsonb,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null,
  unique (tenant_id, club_id)
);

create index if not exists court_engine_stores_tenant_club_idx
  on public.court_engine_stores (tenant_id, club_id);

create table if not exists public.court_engine_active_sessions (
  tenant_id text not null,
  club_id text not null,
  session_id text not null,
  updated_at timestamptz not null default now(),
  primary key (tenant_id, club_id)
);

alter table public.court_engine_stores enable row level security;
alter table public.court_engine_active_sessions enable row level security;

drop policy if exists court_engine_stores_select on public.court_engine_stores;
drop policy if exists court_engine_stores_insert on public.court_engine_stores;
drop policy if exists court_engine_stores_update on public.court_engine_stores;
drop policy if exists court_engine_active_sessions_select on public.court_engine_active_sessions;
drop policy if exists court_engine_active_sessions_upsert on public.court_engine_active_sessions;
drop policy if exists court_engine_active_sessions_update on public.court_engine_active_sessions;

create policy court_engine_stores_select on public.court_engine_stores
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = public.user_venue_id()
  );

create policy court_engine_stores_insert on public.court_engine_stores
  for insert to authenticated
  with check (
    public.is_super_admin()
    or tenant_id = public.user_venue_id()
  );

create policy court_engine_stores_update on public.court_engine_stores
  for update to authenticated
  using (
    public.is_super_admin()
    or tenant_id = public.user_venue_id()
  )
  with check (
    public.is_super_admin()
    or tenant_id = public.user_venue_id()
  );

create policy court_engine_active_sessions_select on public.court_engine_active_sessions
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = public.user_venue_id()
  );

create policy court_engine_active_sessions_insert on public.court_engine_active_sessions
  for insert to authenticated
  with check (
    public.is_super_admin()
    or tenant_id = public.user_venue_id()
  );

create policy court_engine_active_sessions_update on public.court_engine_active_sessions
  for update to authenticated
  using (
    public.is_super_admin()
    or tenant_id = public.user_venue_id()
  )
  with check (
    public.is_super_admin()
    or tenant_id = public.user_venue_id()
  );
