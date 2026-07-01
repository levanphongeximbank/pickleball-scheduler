-- Pickleball Scheduler Pro v4.0 — Sprint 1 Phase A (additive only)
-- Chạy SAU docs/supabase-rbac.sql. Không xóa/đổi tên dữ liệu cũ.
-- Rollback: docs/supabase-identity-v40-sprint1-rollback.sql

-- ─── profiles: cột mở rộng ─────────────────────────────────────────
alter table public.profiles
  add column if not exists phone text default '',
  add column if not exists avatar_url text default '';

-- Mở rộng check role (giữ VENUE_* legacy + thêm canonical v4)
alter table public.profiles drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    'SUPER_ADMIN',
    'VENUE_OWNER', 'VENUE_MANAGER',
    'COURT_OWNER', 'COURT_MANAGER',
    'CASHIER', 'ACCOUNTANT', 'REFEREE',
    'CLUB_OWNER', 'PLAYER'
  ));

-- ─── roles (catalog — song song profiles.role string) ──────────────
create table if not exists public.roles (
  id text primary key,
  label text not null,
  description text default '',
  is_system boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.roles (id, label, description) values
  ('SUPER_ADMIN', 'Quản trị hệ thống', 'Toàn quyền'),
  ('COURT_OWNER', 'Chủ sân', 'Canonical v4 — alias VENUE_OWNER'),
  ('COURT_MANAGER', 'Quản lý sân', 'Canonical v4 — alias VENUE_MANAGER'),
  ('VENUE_OWNER', 'Chủ sân (legacy)', 'DB legacy — không xóa Sprint 1'),
  ('VENUE_MANAGER', 'Quản lý sân (legacy)', 'DB legacy'),
  ('CASHIER', 'Thu ngân', 'Thu ngân venue'),
  ('ACCOUNTANT', 'Kế toán', 'Kế toán venue'),
  ('REFEREE', 'Trọng tài', 'RBAC role chính thức v4'),
  ('CLUB_OWNER', 'Chủ CLB', 'Quản lý CLB'),
  ('PLAYER', 'Vận động viên', 'Self-service')
on conflict (id) do update set
  label = excluded.label,
  description = excluded.description;

-- ─── permissions (CRUD catalog) ───────────────────────────────────
create table if not exists public.permissions (
  id text primary key,
  module text not null,
  action text not null,
  description text default '',
  created_at timestamptz not null default now()
);

insert into public.permissions (id, module, action, description) values
  ('player.view', 'player', 'view', 'Xem danh sách người chơi'),
  ('player.create', 'player', 'create', 'Thêm người chơi'),
  ('player.update', 'player', 'update', 'Sửa người chơi'),
  ('player.delete', 'player', 'delete', 'Xóa người chơi'),
  ('court.view', 'court', 'view', 'Xem sân'),
  ('court.create', 'court', 'create', 'Thêm sân'),
  ('court.update', 'court', 'update', 'Sửa sân'),
  ('court.delete', 'court', 'delete', 'Xóa sân'),
  ('tournament.view', 'tournament', 'view', 'Xem giải'),
  ('tournament.create', 'tournament', 'create', 'Tạo giải'),
  ('tournament.update', 'tournament', 'update', 'Sửa giải'),
  ('tournament.delete', 'tournament', 'delete', 'Xóa giải'),
  ('match.update', 'match', 'update', 'Cập nhật điểm trận'),
  ('director.use', 'director', 'use', 'Director Mode'),
  ('finance.view', 'finance', 'view', 'Xem tài chính'),
  ('finance.edit', 'finance', 'edit', 'Sửa tài chính'),
  ('user.manage', 'user', 'manage', 'Quản lý user'),
  ('role.manage', 'role', 'manage', 'Quản lý role'),
  ('system.setting', 'system', 'setting', 'Cài đặt hệ thống'),
  ('club.view', 'club', 'view', 'Xem CLB'),
  ('club.create', 'club', 'create', 'Tạo CLB'),
  ('club.update', 'club', 'update', 'Sửa CLB'),
  ('club.delete', 'club', 'delete', 'Xóa CLB'),
  ('season.update', 'season', 'update', 'Quản lý mùa giải'),
  ('league.update', 'league', 'update', 'Quản lý giải nội bộ'),
  ('booking.view', 'booking', 'view', 'Xem đặt sân'),
  ('booking.create', 'booking', 'create', 'Tạo đặt sân'),
  ('booking.update', 'booking', 'update', 'Sửa đặt sân'),
  ('booking.delete', 'booking', 'delete', 'Xóa đặt sân'),
  ('customer.view', 'customer', 'view', 'Xem khách hàng'),
  ('customer.create', 'customer', 'create', 'Thêm khách'),
  ('customer.update', 'customer', 'update', 'Sửa khách'),
  ('customer.delete', 'customer', 'delete', 'Xóa khách'),
  ('scheduling.view', 'scheduling', 'view', 'Xem xếp sân'),
  ('scheduling.run', 'scheduling', 'run', 'Chạy xếp sân'),
  ('statistics.view', 'statistics', 'view', 'Xem thống kê'),
  ('statistics.export', 'statistics', 'export', 'Export thống kê'),
  ('settings.view', 'settings', 'view', 'Xem cài đặt'),
  ('venue.view', 'venue', 'view', 'Xem venue'),
  ('venue.update', 'venue', 'update', 'Sửa venue'),
  ('subscription.view', 'subscription', 'view', 'Xem gói'),
  ('subscription.update', 'subscription', 'update', 'Nâng cấp gói')
on conflict (id) do nothing;

-- ─── role_permissions (seed — mirror src/features/identity/matrix) ─
create table if not exists public.role_permissions (
  role_id text not null references public.roles (id) on delete cascade,
  permission_id text not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

-- SUPER_ADMIN: all permissions
insert into public.role_permissions (role_id, permission_id)
select 'SUPER_ADMIN', p.id from public.permissions p
on conflict do nothing;

-- COURT_OWNER (canonical) — tương đương VENUE_OWNER legacy
insert into public.role_permissions (role_id, permission_id)
select 'COURT_OWNER', p.id from public.permissions p
where p.id in (
  'venue.view', 'venue.update', 'user.manage', 'subscription.view',
  'court.view', 'court.create', 'court.update', 'court.delete',
  'booking.view', 'booking.create', 'booking.update', 'booking.delete',
  'customer.view', 'customer.create', 'customer.update', 'customer.delete',
  'finance.view', 'finance.edit', 'club.view', 'club.create', 'club.update', 'club.delete',
  'season.update', 'league.update',
  'player.view', 'player.create', 'player.update', 'player.delete',
  'tournament.view', 'tournament.create', 'tournament.update', 'tournament.delete',
  'director.use', 'match.update', 'scheduling.view', 'scheduling.run',
  'statistics.view', 'statistics.export', 'settings.view', 'system.setting'
)
on conflict do nothing;

-- Mirror legacy role strings (cùng quyền COURT_OWNER)
insert into public.role_permissions (role_id, permission_id)
select 'VENUE_OWNER', rp.permission_id
from public.role_permissions rp
where rp.role_id = 'COURT_OWNER'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'COURT_MANAGER', p.id from public.permissions p
where p.id in (
  'venue.view', 'court.view', 'court.create', 'court.update', 'court.delete',
  'booking.view', 'booking.create', 'booking.update', 'booking.delete',
  'customer.view', 'customer.update', 'finance.view',
  'club.view', 'player.view', 'player.create', 'player.update', 'player.delete',
  'tournament.view', 'tournament.create', 'tournament.update',
  'director.use', 'match.update', 'scheduling.view', 'scheduling.run',
  'statistics.view', 'settings.view'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'VENUE_MANAGER', rp.permission_id
from public.role_permissions rp
where rp.role_id = 'COURT_MANAGER'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'CASHIER', p.id from public.permissions p
where p.id in (
  'court.view', 'booking.view', 'booking.create', 'customer.view',
  'finance.view', 'finance.edit'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'ACCOUNTANT', p.id from public.permissions p
where p.id in (
  'booking.view', 'customer.view', 'finance.view', 'finance.edit',
  'statistics.view', 'statistics.export'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'REFEREE', p.id from public.permissions p
where p.id in ('tournament.view', 'match.update')
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'CLUB_OWNER', p.id from public.permissions p
where p.id in (
  'club.view', 'club.update', 'season.update', 'league.update',
  'player.view', 'player.create', 'player.update', 'player.delete',
  'tournament.view', 'tournament.create', 'tournament.update', 'tournament.delete',
  'director.use', 'match.update', 'scheduling.view', 'scheduling.run',
  'statistics.view', 'statistics.export', 'settings.view'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'PLAYER', p.id from public.permissions p
where p.id in (
  'tournament.view', 'tournament.create', 'statistics.view',
  'player.view', 'player.update'
)
on conflict do nothing;

-- ─── audit_logs ───────────────────────────────────────────────────
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  actor_email text default '',
  action text not null
    check (action in (
      'login', 'logout', 'create', 'update', 'delete',
      'assign_role', 'permission_change'
    )),
  resource_type text default '',
  resource_id text default '',
  venue_id text,
  club_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action);

alter table public.audit_logs enable row level security;

drop policy if exists "audit_logs_super_admin_select" on public.audit_logs;
create policy "audit_logs_super_admin_select"
  on public.audit_logs for select to authenticated
  using (public.is_super_admin());

drop policy if exists "audit_logs_self_select" on public.audit_logs;
create policy "audit_logs_self_select"
  on public.audit_logs for select to authenticated
  using (actor_id = auth.uid());

drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
create policy "audit_logs_insert_authenticated"
  on public.audit_logs for insert to authenticated
  with check (actor_id = auth.uid() or public.is_super_admin());

-- ─── SQL helpers: nhận cả legacy + canonical role ────────────────
create or replace function public.normalize_profile_role(p_role text)
returns text
language sql
immutable
as $$
  select case p_role
    when 'VENUE_OWNER' then 'COURT_OWNER'
    when 'VENUE_MANAGER' then 'COURT_MANAGER'
    else p_role
  end;
$$;

create or replace function public.is_venue_staff()
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
      and public.normalize_profile_role(p.role) in (
        'COURT_OWNER', 'COURT_MANAGER', 'CASHIER', 'ACCOUNTANT', 'REFEREE'
      )
  );
$$;

create or replace function public.can_read_payment_events()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or public.normalize_profile_role(public.user_role()) in (
      'COURT_OWNER', 'ACCOUNTANT', 'CASHIER'
    );
$$;

-- Mời REFEREE qua venue owner
drop policy if exists "profiles_venue_owner_insert" on public.profiles;
create policy "profiles_venue_owner_insert"
  on public.profiles for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      venue_id = public.user_venue_id()
      and role in (
        'VENUE_MANAGER', 'VENUE_OWNER', 'COURT_MANAGER', 'COURT_OWNER',
        'CASHIER', 'ACCOUNTANT', 'REFEREE', 'CLUB_OWNER', 'PLAYER'
      )
    )
  );

-- RLS read-only cho catalog (authenticated)
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;

drop policy if exists "roles_read_authenticated" on public.roles;
create policy "roles_read_authenticated"
  on public.roles for select to authenticated using (true);

drop policy if exists "permissions_read_authenticated" on public.permissions;
create policy "permissions_read_authenticated"
  on public.permissions for select to authenticated using (true);

drop policy if exists "role_permissions_read_authenticated" on public.role_permissions;
create policy "role_permissions_read_authenticated"
  on public.role_permissions for select to authenticated using (true);
