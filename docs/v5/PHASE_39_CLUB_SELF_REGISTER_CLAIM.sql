-- Phase 39 — Self-register club: claim profiles.club_id + elevate CLUB_MANAGER
-- Chạy SAU: PHASE_38_CLUB_REGISTRY_CLOUD_SYNC.sql
-- Production: expuvcohlcjzvrrauvud
--
-- Vấn đề: PLAYER tự tạo CLB chỉ lưu local; rpcAdminUpdateUser cần user.manage
-- nên profiles.club_id / venue_id không được cập nhật → máy khác không thấy CLB.

create or replace function public.club_claim_self_registration(p_club_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id text := nullif(trim(coalesce(p_club_id, '')), '');
  v_gov public.club_governance%rowtype;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'code', 'NOT_AUTHENTICATED');
  end if;

  if v_club_id is null then
    return json_build_object('ok', false, 'code', 'CLUB_ID_REQUIRED', 'error', 'Thiếu club_id.');
  end if;

  select * into v_gov
  from public.club_governance g
  where g.club_id = v_club_id;

  if not found then
    return json_build_object(
      'ok', false,
      'code', 'CLUB_NOT_FOUND',
      'error', 'CLB chưa có trên cloud. Đồng bộ registry trước.'
    );
  end if;

  if v_gov.president_user_id is distinct from auth.uid()
     and coalesce(v_gov.owner_user_id, '00000000-0000-0000-0000-000000000000'::uuid) is distinct from auth.uid()
     and not public.is_super_admin() then
    return json_build_object('ok', false, 'code', 'FORBIDDEN', 'error', 'Chỉ Chủ tịch / Chủ sở hữu CLB mới được nhận CLB này.');
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    return json_build_object('ok', false, 'code', 'PROFILE_NOT_FOUND');
  end if;

  if v_profile.club_id is not null
     and v_profile.club_id <> ''
     and v_profile.club_id is distinct from v_club_id then
    return json_build_object(
      'ok', false,
      'code', 'ALREADY_IN_CLUB',
      'error', 'Tài khoản đã gắn CLB khác: ' || v_profile.club_id
    );
  end if;

  update public.profiles
  set
    club_id = v_club_id,
    venue_id = coalesce(nullif(trim(venue_id), ''), v_gov.venue_id),
    role = case
      when role in ('SUPER_ADMIN', 'PLATFORM_ADMIN', 'SYSTEM_TECHNICIAN', 'VENUE_OWNER', 'COURT_OWNER', 'TENANT_OWNER', 'CLUB_OWNER')
        then role
      else 'CLUB_MANAGER'
    end,
    updated_at = now()
  where id = auth.uid()
  returning * into v_profile;

  return json_build_object(
    'ok', true,
    'club_id', v_club_id,
    'venue_id', v_profile.venue_id,
    'role', v_profile.role,
    'user', row_to_json(v_profile)
  );
exception
  when others then
    return json_build_object('ok', false, 'code', 'CLAIM_FAILED', 'error', sqlerrm);
end;
$$;

grant execute on function public.club_claim_self_registration(text) to authenticated;
