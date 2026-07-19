-- =====================================================================
-- ROLLBACK — Phase 2C cancel membership-request audit (Production/Staging)
-- =====================================================================
-- Restores pre-patch club_cancel_membership_request body (no audit write).
-- Source: docs/v5/phase45a4a/PHASE_45A4A_MEMBERSHIP_REQUEST_RPC_RECONCILIATION.sql
--
-- Does NOT remove 'club.membership_request.cancel' from audit_logs_action_check
-- (additive allow-list values are harmless; removing requires full constraint rebuild).
--
-- Use only if Owner authorizes rollback after the cancel-audit patch.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.club_cancel_membership_request(
  p_request_id uuid,
  p_membership_request_id uuid,
  p_expected_version integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare v_cached jsonb; v_row public.club_membership_requests_v42%rowtype; v_resp jsonb;
begin
  if auth.uid() is null then return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.'); end if;
  if p_request_id is null then return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.'); end if;
  v_cached := public.phase42_idempotency_get(p_request_id, 'club_cancel_membership_request');
  if v_cached is not null then return v_cached::json; end if;
  select * into v_row from public.club_membership_requests_v42 where id = p_membership_request_id;
  if not found then return public.phase42_err('NOT_FOUND', 'Không tìm thấy yêu cầu.'); end if;
  if v_row.user_id <> auth.uid() then return public.phase42_err('FORBIDDEN', 'Không hủy được yêu cầu của người khác.'); end if;
  if v_row.status <> 'pending' then return public.phase42_err('INVALID_STATUS', 'Yêu cầu không còn pending.'); end if;
  if v_row.version <> coalesce(p_expected_version, v_row.version) then
    return public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản.');
  end if;
  update public.club_membership_requests_v42 set status = 'cancelled', version = version + 1 where id = v_row.id;
  v_resp := jsonb_build_object('ok', true, 'data', jsonb_build_object('id', v_row.id, 'status', 'cancelled'), 'version', v_row.version + 1);
  perform public.phase42_idempotency_put(p_request_id, v_row.tenant_id, 'club_cancel_membership_request', v_row.id::text, v_resp);
  return v_resp::json;
end;
$function$
;

grant execute on function public.club_cancel_membership_request(uuid, uuid, integer) to authenticated;

-- =====================================================================
-- END ROLLBACK
-- =====================================================================
