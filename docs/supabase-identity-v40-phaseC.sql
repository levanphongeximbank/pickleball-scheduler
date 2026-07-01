-- Pickleball Scheduler Pro v4.0 — Phase C (additive)
-- Chạy SAU docs/supabase-identity-v40-phaseB.sql
-- Rollback: docs/supabase-identity-v40-phaseC-rollback.sql
--
-- Mục tiêu: RLS/RPC server-side cho user management + audit read

-- ─── Permission helper (mirror role_permissions seed) ─────────────
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
      from public.role_permissions rp
      where rp.permission_id = p_permission
        and rp.role_id in (
          public.normalize_profile_role(public.user_role()),
          public.user_role()
        )
    );
$$;

-- ─── Profile trigger: venue admin (user.manage) được khóa/mở user cùng venue ─
create or replace function public.profiles_guard_privileged_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_can_manage boolean;
begin
  if current_user = 'postgres' or auth.role() = 'service_role' then
    return new;
  end if;

  if new.role is distinct from old.role then
    if not public.is_super_admin() and not public.user_has_permission('role.manage') then
      raise exception 'Only SUPER_ADMIN can change profile role';
    end if;
  end if;

  if auth.uid() = old.id and not public.is_super_admin() then
    if new.venue_id is distinct from old.venue_id
       or new.club_id is distinct from old.club_id
       or new.status is distinct from old.status
       or new.role is distinct from old.role then
      raise exception 'Cannot modify protected profile fields';
    end if;
  end if;

  if auth.uid() is distinct from old.id
     and not public.is_super_admin()
     and (
       new.status is distinct from old.status
       or new.venue_id is distinct from old.venue_id
       or new.club_id is distinct from old.club_id
       or new.display_name is distinct from old.display_name
       or coalesce(new.phone, '') is distinct from coalesce(old.phone, '')
       or coalesce(new.avatar_url, '') is distinct from coalesce(old.avatar_url, '')
     ) then
    v_can_manage := public.user_has_permission('user.manage')
      and old.venue_id is not null
      and old.venue_id = public.user_venue_id();

    if not v_can_manage then
      raise exception 'Cannot modify another user profile';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_guard_privileged_update_trg on public.profiles;
create trigger profiles_guard_privileged_update_trg
  before update on public.profiles
  for each row execute function public.profiles_guard_privileged_update();

-- ─── Audit logs: venue admin đọc log cùng venue ───────────────────
drop policy if exists "audit_logs_venue_manager_select" on public.audit_logs;
create policy "audit_logs_venue_manager_select"
  on public.audit_logs for select to authenticated
  using (
    public.user_has_permission('user.manage')
    and venue_id is not null
    and venue_id = public.user_venue_id()
  );

-- ─── RPC: list users (user.manage, scope venue) ───────────────────
create or replace function public.identity_list_users(
  p_search text default '',
  p_role text default '',
  p_status text default '',
  p_limit int default 100
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 100), 1), 200);
  v_rows json;
  v_venue text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED', 'error', 'Chưa đăng nhập');
  end if;

  if not public.user_has_permission('user.manage') then
    return json_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'Không có quyền user.manage');
  end if;

  v_venue := public.user_venue_id();

  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_rows
  from (
    select
      p.id,
      p.email,
      p.display_name,
      p.role,
      p.venue_id,
      p.club_id,
      p.player_id,
      coalesce(p.phone, '') as phone,
      coalesce(p.avatar_url, '') as avatar_url,
      p.status,
      p.created_at,
      p.updated_at
    from public.profiles p
    where (public.is_super_admin() or p.venue_id = v_venue)
      and (
        coalesce(p_role, '') = ''
        or p.role = p_role
        or public.normalize_profile_role(p.role) = public.normalize_profile_role(p_role)
      )
      and (coalesce(p_status, '') = '' or p.status = p_status)
      and (
        coalesce(p_search, '') = ''
        or p.email ilike '%' || p_search || '%'
        or p.display_name ilike '%' || p_search || '%'
        or coalesce(p.phone, '') ilike '%' || p_search || '%'
      )
    order by p.created_at desc
    limit v_limit
  ) t;

  return json_build_object('ok', true, 'users', coalesce(v_rows, '[]'::json));
end;
$$;

-- ─── RPC: admin update user ───────────────────────────────────────
create or replace function public.identity_admin_update_user(
  p_user_id uuid,
  p_patch jsonb default '{}'::jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old public.profiles%rowtype;
  v_new_role text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not public.user_has_permission('user.manage') then
    return json_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'Không có quyền user.manage');
  end if;

  select * into v_old from public.profiles where id = p_user_id;
  if not found then
    return json_build_object('ok', false, 'code', 'USER_NOT_FOUND');
  end if;

  if not public.is_super_admin() and v_old.venue_id is distinct from public.user_venue_id() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'Không cùng venue');
  end if;

  if auth.uid() = p_user_id and p_patch ? 'role' then
    return json_build_object('ok', false, 'code', 'SELF_ROLE_FORBIDDEN');
  end if;

  if p_patch ? 'role' then
    v_new_role := nullif(trim(p_patch->>'role'), '');
    if v_new_role is not null and v_new_role is distinct from v_old.role then
      if not public.is_super_admin() and not public.user_has_permission('role.manage') then
        return json_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'Không có quyền role.manage');
      end if;
      if v_new_role = 'SUPER_ADMIN' and not public.is_super_admin() then
        return json_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'Không thể gán SUPER_ADMIN');
      end if;
    end if;
  end if;

  update public.profiles
  set
    display_name = coalesce(nullif(trim(p_patch->>'display_name'), ''), display_name),
    phone = case when p_patch ? 'phone' then coalesce(p_patch->>'phone', '') else phone end,
    avatar_url = case when p_patch ? 'avatar_url' then coalesce(p_patch->>'avatar_url', '') else avatar_url end,
    role = case when p_patch ? 'role' then coalesce(nullif(trim(p_patch->>'role'), ''), role) else role end,
    status = case when p_patch ? 'status' then coalesce(nullif(trim(p_patch->>'status'), ''), status) else status end,
    club_id = case when p_patch ? 'club_id' then nullif(trim(p_patch->>'club_id'), '') else club_id end,
    updated_at = now()
  where id = p_user_id
  returning * into v_old;

  return json_build_object(
    'ok', true,
    'user', row_to_json(v_old)
  );
exception
  when others then
    return json_build_object('ok', false, 'code', 'UPDATE_FAILED', 'error', sqlerrm);
end;
$$;

-- ─── RPC: list audit logs ─────────────────────────────────────────
create or replace function public.identity_list_audit_logs(
  p_limit int default 50,
  p_action text default '',
  p_venue_id text default ''
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_rows json;
  v_venue text;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if not (public.is_super_admin() or public.user_has_permission('user.manage')) then
    return json_build_object('ok', false, 'code', 'FORBIDDEN');
  end if;

  v_venue := coalesce(nullif(trim(p_venue_id), ''), public.user_venue_id());

  select coalesce(json_agg(row_to_json(t)), '[]'::json) into v_rows
  from (
    select
      a.id,
      a.actor_id,
      a.actor_email,
      a.action,
      a.resource_type,
      a.resource_id,
      a.venue_id,
      a.club_id,
      a.metadata,
      a.ip_address,
      a.user_agent,
      a.created_at
    from public.audit_logs a
    where (
      public.is_super_admin()
      or (a.venue_id is not null and a.venue_id = v_venue)
    )
      and (coalesce(p_action, '') = '' or a.action = p_action)
    order by a.created_at desc
    limit v_limit
  ) t;

  return json_build_object('ok', true, 'logs', coalesce(v_rows, '[]'::json));
end;
$$;

grant execute on function public.user_has_permission(text) to authenticated;
grant execute on function public.identity_list_users(text, text, text, int) to authenticated;
grant execute on function public.identity_admin_update_user(uuid, jsonb) to authenticated;
grant execute on function public.identity_list_audit_logs(int, text, text) to authenticated;
