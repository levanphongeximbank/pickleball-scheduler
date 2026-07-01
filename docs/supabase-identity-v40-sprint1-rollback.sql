-- Rollback v4.0 Sprint 1 Phase A (additive migration)
-- Chạy khi cần hoàn tác docs/supabase-identity-v40-sprint1.sql
-- KHÔNG xóa dữ liệu profiles/club_data_v3.

-- Policies
drop policy if exists "role_permissions_read_authenticated" on public.role_permissions;
drop policy if exists "permissions_read_authenticated" on public.permissions;
drop policy if exists "roles_read_authenticated" on public.roles;
drop policy if exists "audit_logs_insert_authenticated" on public.audit_logs;
drop policy if exists "audit_logs_self_select" on public.audit_logs;
drop policy if exists "audit_logs_super_admin_select" on public.audit_logs;

-- Restore profiles insert policy (v3.5.7)
drop policy if exists "profiles_venue_owner_insert" on public.profiles;
create policy "profiles_venue_owner_insert"
  on public.profiles for insert to authenticated
  with check (
    public.is_super_admin()
    or (
      venue_id = public.user_venue_id()
      and role in ('VENUE_MANAGER', 'CASHIER', 'ACCOUNTANT', 'CLUB_OWNER', 'PLAYER')
    )
  );

-- Restore helpers (v3.5.7)
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
      and p.role in ('VENUE_OWNER', 'VENUE_MANAGER', 'CASHIER', 'ACCOUNTANT')
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
    or public.user_role() in ('VENUE_OWNER', 'ACCOUNTANT', 'CASHIER');
$$;

drop function if exists public.normalize_profile_role(text);

-- Drop new tables (audit_logs data will be lost)
drop table if exists public.role_permissions;
drop table if exists public.permissions;
drop table if exists public.roles;
drop table if exists public.audit_logs;

-- Restore profiles.role check (v3.5.7)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    'SUPER_ADMIN', 'VENUE_OWNER', 'VENUE_MANAGER', 'CASHIER',
    'ACCOUNTANT', 'CLUB_OWNER', 'PLAYER'
  ));

-- Optional: remove added columns (comment out nếu muốn giữ phone/avatar)
-- alter table public.profiles drop column if exists phone;
-- alter table public.profiles drop column if exists avatar_url;
