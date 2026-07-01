-- Pickleball Scheduler Pro v4.0 — RBAC schema (restored)
-- File: docs/supabase-rbac-v4.sql
-- KHÔNG ghi đè docs/supabase-rbac.sql (multi-tenant venue/payment).
--
-- Nguồn khôi phục:
--   - Git history: docs/supabase-rbac.sql KHÔNG BAO GIỜ chứa bảng RBAC catalog
--     (commit 26a7582, e16a0ff — chỉ venues/profiles/subscriptions/payment_events).
--   - RBAC catalog gốc: docs/supabase-identity-v40-sprint1.sql (roles/permissions/role_permissions).
--   - user_roles: generate mới (không có trong git) — mirror profiles.role + hỗ trợ multi-role.
--   - Seed matrix: src/features/identity/matrix/rolePermissions.js (v4.0 GA).
--
-- Điều kiện tiên quyết:
--   - public.profiles đã tồn tại (chạy docs/supabase-rbac.sql trước).
--   - auth.users + Supabase Auth đã bật.
--
-- Thứ tự deploy khuyến nghị:
--   1. docs/supabase-rbac.sql
--   2. docs/supabase-rbac-v4.sql  (file này)
--   3. docs/supabase-identity-v40-phaseB.sql (nếu cần password_reset_tokens)
--   4. docs/supabase-identity-v40-phaseC.sql (RPC user/audit — dùng user_has_permission)

-- ─── profiles: mở rộng role check (additive) ───────────────────────
alter table public.profiles
  add column if not exists phone text default '',
  add column if not exists avatar_url text default '';

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

-- ─── Prerequisite helpers (từ supabase-rbac.sql — idempotent) ───────
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'SUPER_ADMIN'
      and p.status = 'active'
  );
$$;

create or replace function public.user_venue_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.venue_id from public.profiles p
  where p.id = auth.uid() and p.status = 'active'
  limit 1;
$$;

create or replace function public.user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p
  where p.id = auth.uid() and p.status = 'active'
  limit 1;
$$;

-- ─── roles (catalog) ───────────────────────────────────────────────
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
  ('VENUE_OWNER', 'Chủ sân (legacy)', 'DB legacy — không xóa'),
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

create index if not exists permissions_module_idx on public.permissions (module);

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
  ('subscription.update', 'subscription', 'update', 'Nâng cấp gói'),
  ('integration.view', 'integration', 'view', 'Xem tích hợp'),
  ('integration.manage', 'integration', 'manage', 'Quản lý tích hợp'),
  ('marketplace.view', 'marketplace', 'view', 'Xem marketplace'),
  ('marketplace.manage', 'marketplace', 'manage', 'Quản lý marketplace'),
  ('api.manage', 'api', 'manage', 'Quản lý API keys')
on conflict (id) do update set
  module = excluded.module,
  action = excluded.action,
  description = excluded.description;

-- ─── role_permissions (seed — mirror rolePermissions.js) ────────────
create table if not exists public.role_permissions (
  role_id text not null references public.roles (id) on delete cascade,
  permission_id text not null references public.permissions (id) on delete cascade,
  primary key (role_id, permission_id)
);

create index if not exists role_permissions_permission_id_idx
  on public.role_permissions (permission_id);

insert into public.role_permissions (role_id, permission_id)
select 'SUPER_ADMIN', p.id from public.permissions p
where p.id in (
  'player.view', 'player.create', 'player.update', 'player.delete', 'court.view', 'court.create', 'court.update', 'court.delete', 'tournament.view', 'tournament.create', 'tournament.update', 'tournament.delete', 'match.update', 'director.use', 'finance.view', 'finance.edit', 'user.manage', 'role.manage', 'system.setting', 'club.view', 'club.create', 'club.update', 'club.delete', 'season.update', 'league.update', 'booking.view', 'booking.create', 'booking.update', 'booking.delete', 'customer.view', 'customer.create', 'customer.update', 'customer.delete', 'scheduling.view', 'scheduling.run', 'statistics.view', 'statistics.export', 'settings.view', 'venue.view', 'venue.update', 'subscription.view', 'subscription.update', 'integration.view', 'integration.manage', 'marketplace.view', 'marketplace.manage', 'api.manage'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'COURT_OWNER', p.id from public.permissions p
where p.id in (
  'venue.view', 'court.view', 'court.create', 'court.update', 'booking.view', 'booking.create', 'booking.update', 'customer.view', 'finance.view', 'club.view', 'player.view', 'tournament.view', 'tournament.create', 'tournament.update', 'director.use', 'match.update', 'scheduling.view', 'scheduling.run', 'statistics.view', 'settings.view', 'venue.update', 'user.manage', 'subscription.view', 'finance.edit', 'club.create', 'club.update', 'club.delete', 'season.update', 'league.update', 'player.create', 'player.update', 'player.delete', 'court.delete', 'booking.delete', 'customer.create', 'customer.update', 'customer.delete', 'tournament.delete', 'statistics.export', 'system.setting', 'integration.view', 'integration.manage', 'marketplace.view', 'marketplace.manage', 'api.manage'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'COURT_MANAGER', p.id from public.permissions p
where p.id in (
  'venue.view', 'court.view', 'court.create', 'court.update', 'booking.view', 'booking.create', 'booking.update', 'customer.view', 'finance.view', 'club.view', 'player.view', 'tournament.view', 'tournament.create', 'tournament.update', 'director.use', 'match.update', 'scheduling.view', 'scheduling.run', 'statistics.view', 'settings.view', 'player.create', 'player.update', 'player.delete', 'court.update', 'court.delete', 'booking.update', 'booking.delete', 'customer.update'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'CASHIER', p.id from public.permissions p
where p.id in (
  'court.view', 'booking.view', 'booking.create', 'customer.view', 'finance.view', 'finance.edit'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'ACCOUNTANT', p.id from public.permissions p
where p.id in (
  'booking.view', 'customer.view', 'finance.view', 'finance.edit', 'statistics.view', 'statistics.export'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'REFEREE', p.id from public.permissions p
where p.id in (
  'tournament.view', 'match.update'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'CLUB_OWNER', p.id from public.permissions p
where p.id in (
  'club.view', 'club.update', 'season.update', 'league.update', 'player.view', 'player.create', 'player.update', 'player.delete', 'tournament.view', 'tournament.create', 'tournament.update', 'tournament.delete', 'director.use', 'match.update', 'scheduling.view', 'scheduling.run', 'statistics.view', 'statistics.export', 'settings.view', 'marketplace.view', 'integration.view'
)
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'PLAYER', p.id from public.permissions p
where p.id in (
  'tournament.view', 'tournament.create', 'statistics.view', 'player.view', 'player.update'
)
on conflict do nothing;

-- Mirror legacy role strings
insert into public.role_permissions (role_id, permission_id)
select 'VENUE_OWNER', rp.permission_id from public.role_permissions rp where rp.role_id = 'COURT_OWNER'
on conflict do nothing;

insert into public.role_permissions (role_id, permission_id)
select 'VENUE_MANAGER', rp.permission_id from public.role_permissions rp where rp.role_id = 'COURT_MANAGER'
on conflict do nothing;

-- ─── user_roles (gán role cho user — mirror + mở rộng profiles.role) ─
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  role_id text not null references public.roles (id) on delete restrict,
  venue_id text,
  club_id text,
  is_primary boolean not null default false,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users (id) on delete set null,
  constraint user_roles_user_role_venue_club_unique
    unique (user_id, role_id, venue_id, club_id)
);

create index if not exists user_roles_user_id_idx on public.user_roles (user_id);
create index if not exists user_roles_role_id_idx on public.user_roles (role_id);
create index if not exists user_roles_venue_id_idx on public.user_roles (venue_id)
  where venue_id is not null;
create index if not exists user_roles_primary_idx on public.user_roles (user_id)
  where is_primary = true;

-- Backfill từ profiles.role hiện có
insert into public.user_roles (user_id, role_id, venue_id, club_id, is_primary)
select p.id, p.role, p.venue_id, p.club_id, true
from public.profiles p
where p.role is not null and trim(p.role) <> ''
on conflict (user_id, role_id, venue_id, club_id) do update set
  is_primary = excluded.is_primary,
  venue_id = coalesce(excluded.venue_id, public.user_roles.venue_id),
  club_id = coalesce(excluded.club_id, public.user_roles.club_id);

-- ─── SQL helpers ───────────────────────────────────────────────────
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

create or replace function public.user_role_ids()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_agg(distinct ur.role_id) filter (where ur.role_id is not null),
    array[]::text[]
  )
  from public.user_roles ur
  where ur.user_id = auth.uid();
$$;

create or replace function public.user_has_permission(p_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_super_admin()
    or exists (
      select 1
      from public.user_roles ur
      join public.role_permissions rp on rp.role_id = ur.role_id
      where ur.user_id = auth.uid()
        and rp.permission_id = p_permission
    )
    or exists (
      select 1
      from public.role_permissions rp
      where rp.permission_id = p_permission
        and rp.role_id in (
          public.normalize_profile_role(public.user_role()),
          public.user_role()
        )
    );
$$;

-- Đồng bộ user_roles khi profiles.role / venue / club thay đổi
create or replace function public.sync_user_roles_from_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.user_roles
  set is_primary = false
  where user_id = new.id and is_primary = true
    and role_id is distinct from new.role;

  insert into public.user_roles (user_id, role_id, venue_id, club_id, is_primary)
  values (new.id, new.role, new.venue_id, new.club_id, true)
  on conflict (user_id, role_id, venue_id, club_id) do update set
    is_primary = true,
    venue_id = excluded.venue_id,
    club_id = excluded.club_id;

  return new;
end;
$$;

drop trigger if exists profiles_sync_user_roles_trg on public.profiles;
create trigger profiles_sync_user_roles_trg
  after insert or update of role, venue_id, club_id on public.profiles
  for each row execute function public.sync_user_roles_from_profile();

-- Cập nhật is_venue_staff / can_read_payment_events (v4 canonical + legacy)
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

-- ─── RLS ───────────────────────────────────────────────────────────
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;

drop policy if exists "roles_read_authenticated" on public.roles;
create policy "roles_read_authenticated"
  on public.roles for select to authenticated using (true);

drop policy if exists "permissions_read_authenticated" on public.permissions;
create policy "permissions_read_authenticated"
  on public.permissions for select to authenticated using (true);

drop policy if exists "role_permissions_read_authenticated" on public.role_permissions;
create policy "role_permissions_read_authenticated"
  on public.role_permissions for select to authenticated using (true);

drop policy if exists "user_roles_self_select" on public.user_roles;
create policy "user_roles_self_select"
  on public.user_roles for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_roles_super_admin_all" on public.user_roles;
create policy "user_roles_super_admin_all"
  on public.user_roles for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists "user_roles_venue_manager_select" on public.user_roles;
create policy "user_roles_venue_manager_select"
  on public.user_roles for select to authenticated
  using (
    public.user_has_permission('user.manage')
    and venue_id is not null
    and venue_id = public.user_venue_id()
  );

drop policy if exists "user_roles_venue_manager_insert" on public.user_roles;
create policy "user_roles_venue_manager_insert"
  on public.user_roles for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      public.user_has_permission('user.manage')
      and venue_id = public.user_venue_id()
      and role_id not in ('SUPER_ADMIN')
    )
  );

drop policy if exists "user_roles_venue_manager_update" on public.user_roles;
create policy "user_roles_venue_manager_update"
  on public.user_roles for update to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('user.manage')
      and venue_id = public.user_venue_id()
    )
  )
  with check (
    public.is_super_admin()
    or (
      public.user_has_permission('user.manage')
      and venue_id = public.user_venue_id()
      and role_id not in ('SUPER_ADMIN')
    )
  );

drop policy if exists "user_roles_venue_manager_delete" on public.user_roles;
create policy "user_roles_venue_manager_delete"
  on public.user_roles for delete to authenticated
  using (
    public.is_super_admin()
    or (
      public.user_has_permission('user.manage')
      and venue_id = public.user_venue_id()
      and role_id not in ('SUPER_ADMIN')
    )
  );

-- Mời staff: mở rộng REFEREE + canonical roles (nếu policy cũ tồn tại)
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

-- ─── Grants ────────────────────────────────────────────────────────
grant select on public.roles to authenticated;
grant select on public.permissions to authenticated;
grant select on public.role_permissions to authenticated;
grant select, insert, update, delete on public.user_roles to authenticated;

grant execute on function public.normalize_profile_role(text) to authenticated;
grant execute on function public.user_role_ids() to authenticated;
grant execute on function public.user_has_permission(text) to authenticated;
