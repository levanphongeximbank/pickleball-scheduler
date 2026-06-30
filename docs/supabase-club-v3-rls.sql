-- RLS staging: club_data_v3 — Pickleball Scheduler Pro v3.5.5
-- Chạy SAU: supabase-club-v3.sql → supabase-rbac.sql
-- Rollback: docs/supabase-rls-rollback.sql

alter table public.club_data_v3 add column if not exists venue_id text;

-- Gỡ policy anon mở (từ supabase-club-v3.sql)
drop policy if exists "club_data_v3_anon_select" on public.club_data_v3;
drop policy if exists "club_data_v3_anon_insert" on public.club_data_v3;
drop policy if exists "club_data_v3_anon_update" on public.club_data_v3;
drop policy if exists "club_data_v3_anon_all" on public.club_data_v3;

alter table public.club_data_v3 enable row level security;

drop policy if exists "club_data_v3_member_select" on public.club_data_v3;
drop policy if exists "club_data_v3_member_write" on public.club_data_v3;
drop policy if exists "club_data_v3_member_update" on public.club_data_v3;
drop policy if exists "club_data_v3_member_delete" on public.club_data_v3;

-- Đọc: SUPER_ADMIN | venue staff (venue_id) | CLUB_OWNER/PLAYER (club_id)
create policy "club_data_v3_member_select"
  on public.club_data_v3 for select to authenticated
  using (
    public.is_super_admin()
    or venue_id = public.user_venue_id()
    or club_id = public.user_club_id()
  );

-- Ghi: SUPER_ADMIN | venue staff | CLUB_OWNER | VENUE_OWNER | VENUE_MANAGER
create policy "club_data_v3_member_write"
  on public.club_data_v3 for insert to authenticated
  with check (
    public.is_super_admin()
    or venue_id = public.user_venue_id()
    or (
      club_id = public.user_club_id()
      and public.user_role() in ('CLUB_OWNER', 'VENUE_OWNER', 'VENUE_MANAGER', 'SUPER_ADMIN')
    )
  );

create policy "club_data_v3_member_update"
  on public.club_data_v3 for update to authenticated
  using (
    public.is_super_admin()
    or venue_id = public.user_venue_id()
    or (
      club_id = public.user_club_id()
      and public.user_role() in ('CLUB_OWNER', 'VENUE_OWNER', 'VENUE_MANAGER', 'SUPER_ADMIN')
    )
  )
  with check (
    public.is_super_admin()
    or venue_id = public.user_venue_id()
    or (
      club_id = public.user_club_id()
      and public.user_role() in ('CLUB_OWNER', 'VENUE_OWNER', 'VENUE_MANAGER', 'SUPER_ADMIN')
    )
  );

create policy "club_data_v3_member_delete"
  on public.club_data_v3 for delete to authenticated
  using (public.is_super_admin() or public.user_role() = 'VENUE_OWNER');
