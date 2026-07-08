-- Pickleball Scheduler Pro — Admin create user (additive)
-- Chạy SAU docs/supabase-identity-v40-phaseC.sql
--
-- Lưu ý: Tạo auth user qua Admin API (email_confirm=true) được thực hiện bởi
-- server route `api/identity/create-user.js` (SUPABASE_SERVICE_ROLE_KEY).
-- RPC dưới đây chỉ dùng khi cần đồng bộ profile sau khi auth user đã tồn tại.

create or replace function public.identity_admin_upsert_profile(
  p_user_id uuid,
  p_email text,
  p_display_name text default '',
  p_role text default 'PLAYER',
  p_venue_id text default null,
  p_club_id text default null,
  p_phone text default '',
  p_status text default 'active'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.profiles%rowtype;
  v_role text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.user_has_permission('user.manage') then
    return json_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'Không có quyền user.manage');
  end if;

  if p_user_id is null then
    return json_build_object('ok', false, 'code', 'USER_ID_REQUIRED');
  end if;

  if not exists (select 1 from auth.users u where u.id = p_user_id) then
    return json_build_object('ok', false, 'code', 'AUTH_USER_NOT_FOUND', 'error', 'auth.users không tồn tại');
  end if;

  v_role := coalesce(nullif(trim(p_role), ''), 'PLAYER');

  if v_role = 'SUPER_ADMIN' and not public.is_super_admin() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'Không thể gán SUPER_ADMIN');
  end if;

  if v_role <> 'PLAYER' and not (public.is_super_admin() or public.user_has_permission('role.manage')) then
    return json_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'Không có quyền role.manage');
  end if;

  insert into public.profiles (
    id,
    email,
    display_name,
    role,
    venue_id,
    club_id,
    phone,
    status,
    updated_at
  ) values (
    p_user_id,
    lower(trim(p_email)),
    coalesce(nullif(trim(p_display_name), ''), split_part(lower(trim(p_email)), '@', 1)),
    v_role,
    nullif(trim(p_venue_id), ''),
    nullif(trim(p_club_id), ''),
    coalesce(p_phone, ''),
    coalesce(nullif(trim(p_status), ''), 'active'),
    now()
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = excluded.display_name,
    role = excluded.role,
    venue_id = excluded.venue_id,
    club_id = excluded.club_id,
    phone = excluded.phone,
    status = excluded.status,
    updated_at = now()
  returning * into v_row;

  return json_build_object('ok', true, 'user', row_to_json(v_row));
exception
  when others then
    return json_build_object('ok', false, 'code', 'PROFILE_UPSERT_FAILED', 'error', sqlerrm);
end;
$$;

grant execute on function public.identity_admin_upsert_profile(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

comment on function public.identity_admin_upsert_profile(uuid, text, text, text, text, text, text, text) is
  'Admin upsert profile theo auth.users.id sau khi tạo user qua Admin API (email_confirm=true).';
