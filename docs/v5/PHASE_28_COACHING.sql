-- Phase 28 — Coaching schema (v5 SaaS draft)
-- Idempotent migration. App hiện lưu coaching trong localStorage per club.
-- Chạy SAU supabase-multi-tenant-sprint2.sql + identity packs.

-- ─── Permissions (additive) ───────────────────────────────────────
insert into public.permissions (id, module, action, description)
values
  ('coaching.view', 'coaching', 'view', 'Xem module huấn luyện'),
  ('coaching.manage', 'coaching', 'manage', 'Quản lý HLV, lớp, lịch'),
  ('coaching.attendance', 'coaching', 'attendance', 'Điểm danh học viên'),
  ('coaching.evaluate', 'coaching', 'evaluate', 'Đánh giá học viên')
on conflict (id) do update set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

-- ─── Coaches ──────────────────────────────────────────────────────
create table if not exists public.coaching_coaches (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.venues(id) on delete cascade,
  club_id text not null,
  external_coach_id text not null,
  name text not null,
  phone text,
  email text,
  specialty text,
  status text not null default 'active'
    check (status in ('active','inactive')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, club_id, external_coach_id)
);

-- ─── Students ─────────────────────────────────────────────────────
create table if not exists public.coaching_students (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.venues(id) on delete cascade,
  club_id text not null,
  external_student_id text not null,
  name text not null,
  level text,
  phone text,
  package_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, club_id, external_student_id)
);

-- ─── Classes ──────────────────────────────────────────────────────
create table if not exists public.coaching_classes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.venues(id) on delete cascade,
  club_id text not null,
  external_class_id text not null,
  name text not null,
  level text,
  coach_name text,
  capacity int,
  schedule_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, club_id, external_class_id)
);

-- ─── Schedule entries ─────────────────────────────────────────────
create table if not exists public.coaching_schedule (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.venues(id) on delete cascade,
  club_id text not null,
  external_entry_id text not null,
  session_date date not null,
  start_time time not null,
  end_time time not null,
  class_name text,
  coach_name text,
  court_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, club_id, external_entry_id)
);

create index if not exists coaching_schedule_club_date_idx
  on public.coaching_schedule (tenant_id, club_id, session_date);

-- ─── Packages ─────────────────────────────────────────────────────
create table if not exists public.coaching_packages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.venues(id) on delete cascade,
  club_id text not null,
  external_package_id text not null,
  name text not null,
  sessions int,
  duration_days int,
  price numeric(12,2),
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, club_id, external_package_id)
);

-- ─── Attendance ───────────────────────────────────────────────────
create table if not exists public.coaching_attendance (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.venues(id) on delete cascade,
  club_id text not null,
  external_record_id text not null,
  session_date date not null,
  class_name text not null,
  student_name text not null,
  status text not null default 'present'
    check (status in ('present','absent','late')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, club_id, external_record_id)
);

-- ─── Evaluations ──────────────────────────────────────────────────
create table if not exists public.coaching_evaluations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.venues(id) on delete cascade,
  club_id text not null,
  external_evaluation_id text not null,
  session_date date not null,
  student_name text not null,
  coach_name text,
  rating numeric(4,1),
  summary text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, club_id, external_evaluation_id)
);

-- ─── RLS (draft — enable after app wiring) ────────────────────────
-- alter table public.coaching_coaches enable row level security;
-- create policy coaching_coaches_tenant on public.coaching_coaches
--   for all using (tenant_id = user_venue_id() or is_super_admin());
