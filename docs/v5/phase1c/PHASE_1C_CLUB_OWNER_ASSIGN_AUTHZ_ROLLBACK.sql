-- =====================================================================
-- PHASE 1C — ROLLBACK club_assign_owner / club_clear_owner authz gate
-- =====================================================================
-- Restores the pre-gate bodies from
--   docs/v5/phase45a3a/PHASE_45A3A_CLUB_GOVERNANCE_RPC_RECONCILIATION.sql
-- (bare phase42_is_tenant_member). Use only if Staging gate must be reverted.
-- Production: DO NOT APPLY unless Owner explicitly requests rollback.
-- =====================================================================

-- Drop narrow helper (safe if unused after restore)
drop function if exists public.phase42_can_assign_club_owner(text);

CREATE OR REPLACE FUNCTION public.club_assign_owner(p_request_id uuid, p_club_id text, p_member_user_id uuid, p_expected_club_version integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_cached jsonb; v_club public.clubs%rowtype; v_member public.club_members%rowtype; v_resp jsonb;
begin
  if auth.uid() is null then return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.'); end if;
  if p_request_id is null then return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.'); end if;
  v_cached := public.phase42_idempotency_get(p_request_id, 'club_assign_owner');
  if v_cached is not null then return v_cached::json; end if;
  select * into v_club from public.clubs where id = trim(coalesce(p_club_id,'')) and deleted_at is null for update;
  if not found then return public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.'); end if;
  if v_club.version <> coalesce(p_expected_club_version, v_club.version) then
    return public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản CLB.');
  end if;
  if not (public.phase42_is_platform_super_admin() or public.phase42_is_tenant_member(v_club.tenant_id)) then
    return public.phase42_err('FORBIDDEN', 'Chỉ tenant owner/staff hoặc Super Admin gán Chủ sở hữu.');
  end if;
  select * into v_member from public.club_members where club_id = v_club.id and user_id = p_member_user_id and status = 'active';
  if not found then return public.phase42_err('MEMBER_REQUIRED', 'Chủ sở hữu phải là thành viên active.'); end if;
  update public.club_governance_assignments set status = 'ended', effective_to = now(), version = version + 1
  where club_id = v_club.id and role_code = 'club_owner' and status = 'active';
  insert into public.club_governance_assignments (tenant_id, club_id, club_member_id, role_code, status, version)
  values (v_club.tenant_id, v_club.id, v_member.id, 'club_owner', 'active', 1);
  update public.clubs set version = version + 1 where id = v_club.id;
  perform public.phase42_write_audit('club.assign_owner','club', v_club.id, v_club.tenant_id, v_club.id,
    jsonb_build_object('owner_user_id', p_member_user_id, 'request_id', p_request_id));
  v_resp := jsonb_build_object('ok', true, 'data', public.phase42_club_canonical(v_club.id), 'version', v_club.version + 1);
  perform public.phase42_idempotency_put(p_request_id, v_club.tenant_id, 'club_assign_owner', v_club.id, v_resp);
  return v_resp::json;
end;
$function$;

grant execute on function public.club_assign_owner(uuid, text, uuid, integer) to authenticated;

CREATE OR REPLACE FUNCTION public.club_clear_owner(p_request_id uuid, p_club_id text, p_expected_club_version integer)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_cached jsonb; v_club public.clubs%rowtype; v_resp jsonb;
begin
  if auth.uid() is null then return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.'); end if;
  if p_request_id is null then return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.'); end if;
  v_cached := public.phase42_idempotency_get(p_request_id, 'club_clear_owner');
  if v_cached is not null then return v_cached::json; end if;
  select * into v_club from public.clubs where id = trim(coalesce(p_club_id,'')) and deleted_at is null for update;
  if not found then return public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.'); end if;
  if v_club.version <> coalesce(p_expected_club_version, v_club.version) then
    return public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản CLB.');
  end if;
  if not (public.phase42_is_platform_super_admin() or public.phase42_is_tenant_member(v_club.tenant_id)) then
    return public.phase42_err('FORBIDDEN', 'Không có quyền clear owner.');
  end if;
  update public.club_governance_assignments set status = 'ended', effective_to = now(), version = version + 1
  where club_id = v_club.id and role_code = 'club_owner' and status = 'active';
  update public.clubs set version = version + 1 where id = v_club.id;
  perform public.phase42_write_audit('club.clear_owner','club', v_club.id, v_club.tenant_id, v_club.id,
    jsonb_build_object('request_id', p_request_id));
  v_resp := jsonb_build_object('ok', true, 'data', public.phase42_club_canonical(v_club.id), 'version', v_club.version + 1);
  perform public.phase42_idempotency_put(p_request_id, v_club.tenant_id, 'club_clear_owner', v_club.id, v_resp);
  return v_resp::json;
end;
$function$;

grant execute on function public.club_clear_owner(uuid, text, integer) to authenticated;
