-- RLS cho club_data_v3 — chạy SAU supabase-club-v3.sql và supabase-rbac.sql
-- Thay policy anon mở bằng kiểm tra venue/club membership.

alter table public.club_data_v3 add column if not exists venue_id text;

alter table public.club_data_v3 enable row level security;

drop policy if exists "club_data_v3_anon_all" on public.club_data_v3;
drop policy if exists "club_data_v3_member_select" on public.club_data_v3;
drop policy if exists "club_data_v3_member_write" on public.club_data_v3;

create policy "club_data_v3_member_select"
  on public.club_data_v3 for select to authenticated
  using (
    public.is_super_admin()
    or venue_id = public.user_venue_id()
    or club_id in (
      select p.club_id from public.profiles p
      where p.id = auth.uid() and p.status = 'active' and p.club_id is not null
    )
  );

create policy "club_data_v3_member_write"
  on public.club_data_v3 for insert to authenticated
  with check (
    public.is_super_admin()
    or venue_id = public.user_venue_id()
    or club_id in (
      select p.club_id from public.profiles p
      where p.id = auth.uid()
        and p.status = 'active'
        and p.role in ('CLUB_OWNER', 'VENUE_OWNER', 'VENUE_MANAGER', 'SUPER_ADMIN')
    )
  );

create policy "club_data_v3_member_update"
  on public.club_data_v3 for update to authenticated
  using (
    public.is_super_admin()
    or venue_id = public.user_venue_id()
    or club_id in (
      select p.club_id from public.profiles p
      where p.id = auth.uid()
        and p.status = 'active'
        and p.role in ('CLUB_OWNER', 'VENUE_OWNER', 'VENUE_MANAGER', 'SUPER_ADMIN')
    )
  )
  with check (
    public.is_super_admin()
    or venue_id = public.user_venue_id()
    or club_id in (
      select p.club_id from public.profiles p
      where p.id = auth.uid()
        and p.status = 'active'
        and p.role in ('CLUB_OWNER', 'VENUE_OWNER', 'VENUE_MANAGER', 'SUPER_ADMIN')
    )
  );

create policy "club_data_v3_member_delete"
  on public.club_data_v3 for delete to authenticated
  using (public.is_super_admin());
