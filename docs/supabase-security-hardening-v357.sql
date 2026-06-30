-- Security hardening patch — Pickleball Scheduler Pro v3.5.7
-- Chạy trên staging đã có supabase-rbac.sql (v3.5.5/3.5.6).

-- 1. Đăng ký: luôn tạo role PLAYER (không đọc raw_user_meta_data.role)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role, status)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(coalesce(new.email, 'user'), '@', 1)
    ),
    'PLAYER',
    'active'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

-- 2. Khóa cập nhật profile: role chỉ SUPER_ADMIN; user tự sửa không đổi venue/club/status
-- Bypass cho bootstrap (SQL Editor / service_role); authenticated vẫn bị chặn.
create or replace function public.profiles_guard_privileged_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user = 'postgres' or auth.role() = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role then
    if not public.is_super_admin() then
      raise exception 'Only SUPER_ADMIN can change profile role';
    end if;
  end if;

  if auth.uid() = old.id and not public.is_super_admin() then
    if new.venue_id is distinct from old.venue_id
       or new.club_id is distinct from old.club_id
       or new.status is distinct from old.status then
      raise exception 'Cannot modify protected profile fields';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_update_trg on public.profiles;
create trigger profiles_guard_privileged_update_trg
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged_update();
