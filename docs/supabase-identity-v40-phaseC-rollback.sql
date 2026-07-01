-- Rollback Phase C — khôi phục trigger v3.5.7, xóa RPC Phase C
-- Chạy TRƯỚC phaseB rollback nếu cần

revoke execute on function public.identity_list_audit_logs(int, text, text) from authenticated;
revoke execute on function public.identity_admin_update_user(uuid, jsonb) from authenticated;
revoke execute on function public.identity_list_users(text, text, text, int) from authenticated;
revoke execute on function public.user_has_permission(text) from authenticated;

drop function if exists public.identity_list_audit_logs(int, text, text);
drop function if exists public.identity_admin_update_user(uuid, jsonb);
drop function if exists public.identity_list_users(text, text, text, int);
drop function if exists public.user_has_permission(text);

drop policy if exists "audit_logs_venue_manager_select" on public.audit_logs;

-- Restore profiles trigger v3.5.7 (không user.manage cho admin venue)
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
