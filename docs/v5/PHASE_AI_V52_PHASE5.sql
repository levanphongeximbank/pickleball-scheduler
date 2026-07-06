-- Phase AI V5.2 — Giai đoạn 5: Realtime, checklist cloud, club version conflict
-- Chạy SAU: PHASE_AI_COURT_ENGINE_CLOUD.sql, supabase-rbac.sql

-- 1) Club blob optimistic version
alter table public.club_data_v3
  add column if not exists version integer not null default 1;

-- 2) AI workflow checklist (multi-device, scoped theo giải)
create table if not exists public.ai_workflow_checklists (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  tournament_id text not null,
  item_key text not null,
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text,
  unique (tenant_id, tournament_id, item_key)
);

create index if not exists ai_workflow_checklists_tenant_tournament_idx
  on public.ai_workflow_checklists (tenant_id, tournament_id);

alter table public.ai_workflow_checklists enable row level security;

drop policy if exists ai_workflow_checklists_select on public.ai_workflow_checklists;
drop policy if exists ai_workflow_checklists_insert on public.ai_workflow_checklists;
drop policy if exists ai_workflow_checklists_update on public.ai_workflow_checklists;

create policy ai_workflow_checklists_select on public.ai_workflow_checklists
  for select to authenticated
  using (
    public.is_super_admin()
    or tenant_id = public.user_venue_id()
  );

create policy ai_workflow_checklists_insert on public.ai_workflow_checklists
  for insert to authenticated
  with check (
    public.is_super_admin()
    or tenant_id = public.user_venue_id()
  );

create policy ai_workflow_checklists_update on public.ai_workflow_checklists
  for update to authenticated
  using (
    public.is_super_admin()
    or tenant_id = public.user_venue_id()
  )
  with check (
    public.is_super_admin()
    or tenant_id = public.user_venue_id()
  );

-- 3) Realtime (best-effort — bỏ qua nếu table đã trong publication)
do $$
begin
  alter publication supabase_realtime add table public.court_engine_stores;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.court_engine_active_sessions;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.ai_workflow_checklists;
exception
  when duplicate_object then null;
end $$;
