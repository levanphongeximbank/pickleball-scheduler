-- =====================================================================
-- PHASE 2D — ROLLBACK club_transfer_president AUTHORIZATION GATE
-- =====================================================================
-- Restores pre-2D authz (includes bare phase42_is_tenant_member).
-- Prefer re-applying docs/v5/phase45a3a/PHASE_45A3A_CLUB_GOVERNANCE_RPC_RECONCILIATION.sql
-- club_transfer_president section instead of this file when possible.
--
-- Drops the narrow helper introduced in Phase 2D.
-- =====================================================================

drop function if exists public.phase42_can_transfer_president(text);

-- Restore broad authz body (45A.3A verbatim shape).
CREATE OR REPLACE FUNCTION public.club_transfer_president(
  p_request_id uuid,
  p_club_id text,
  p_next_user_id uuid,
  p_expected_club_version integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare v_cached jsonb; v_club public.clubs%rowtype; v_member public.club_members%rowtype; v_resp jsonb;
begin
  if auth.uid() is null then return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.'); end if;
  if p_request_id is null then return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.'); end if;
  v_cached := public.phase42_idempotency_get(p_request_id, 'club_transfer_president');
  if v_cached is not null then return v_cached::json; end if;
  select * into v_club from public.clubs where id = trim(coalesce(p_club_id,'')) and deleted_at is null for update;
  if not found then return public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.'); end if;
  if v_club.version <> coalesce(p_expected_club_version, v_club.version) then
    return public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản CLB.');
  end if;
  if not (public.phase42_is_platform_super_admin() or public.phase42_has_gov_role(v_club.id, array['club_owner','president'])
          or public.phase42_is_tenant_member(v_club.tenant_id)) then
    return public.phase42_err('FORBIDDEN', 'Không có quyền chuyển Chủ tịch.');
  end if;
  select * into v_member from public.club_members where club_id = v_club.id and user_id = p_next_user_id and status = 'active';
  if not found then return public.phase42_err('MEMBER_REQUIRED', 'Chủ tịch mới phải là thành viên active.'); end if;
  update public.club_governance_assignments set status = 'ended', effective_to = now(), version = version + 1
  where club_id = v_club.id and role_code = 'president' and status = 'active';
  insert into public.club_governance_assignments (tenant_id, club_id, club_member_id, role_code, status, version)
  values (v_club.tenant_id, v_club.id, v_member.id, 'president', 'active', 1);
  update public.clubs set version = version + 1 where id = v_club.id;
  perform public.phase42_write_audit('club.transfer_president','club', v_club.id, v_club.tenant_id, v_club.id,
    jsonb_build_object('next_user_id', p_next_user_id, 'request_id', p_request_id));
  v_resp := jsonb_build_object('ok', true, 'data', public.phase42_club_canonical(v_club.id), 'version', v_club.version + 1);
  perform public.phase42_idempotency_put(p_request_id, v_club.tenant_id, 'club_transfer_president', v_club.id, v_resp);
  return v_resp::json;
end;
$function$;

grant execute on function public.club_transfer_president(uuid, text, uuid, integer) to authenticated;
