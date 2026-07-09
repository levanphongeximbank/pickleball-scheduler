-- Phase 37 — identity_list_users trả gender + birth_year
-- Chạy SAU: docs/supabase-identity-v40-phaseC.sql

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
      coalesce(p.gender, '') as gender,
      p.birth_year,
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

grant execute on function public.identity_list_users(text, text, text, int) to authenticated;
