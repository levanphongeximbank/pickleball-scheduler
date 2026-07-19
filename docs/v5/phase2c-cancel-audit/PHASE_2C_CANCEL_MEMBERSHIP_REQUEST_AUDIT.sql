-- =====================================================================
-- PHASE 2C POST-MERGE — club_cancel_membership_request AUDIT PATCH
-- =====================================================================
--
-- Purpose:
--   Close the MEDIUM compliance gap: successful cancel mutates
--   club_membership_requests_v42 (pending → cancelled) without writing
--   phase42_write_audit('club.membership_request.cancel', ...).
--
-- Ordering (MUST be applied as one script / one Staging session):
--   1) Additive audit_logs_action_check union including the new action
--   2) CREATE OR REPLACE club_cancel_membership_request with audit write
--
-- Do NOT apply step 2 alone — fail-loud phase42_write_audit would reject
-- the new action and roll back the cancellation.
--
-- Preserves:
--   - signature (uuid, uuid, integer) → json
--   - SECURITY DEFINER + search_path = public
--   - own-request authz, pending-only, OCC, version+1, idempotency, grants
--
-- Production: NOT APPLIED from this branch. Staging first.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Additive audit whitelist (data-preserving UNION)
--    Same safe pattern as PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql
-- ---------------------------------------------------------------------
do $$
declare
  v_list text;
  v_sql text;
begin
  select string_agg(quote_literal(a), ', ' order by a)
    into v_list
  from (
    select distinct action as a
    from public.audit_logs
    where action is not null
      and length(trim(action)) > 0

    union

    select unnest(array[
      -- Identity / admin
      'login',
      'login_failed',
      'logout',
      'create',
      'update',
      'delete',
      'assign_role',
      'permission_change',
      'password_change',
      'reset_password',
      'pairing_override',
      'group_override',
      -- Club lifecycle
      'club.create',
      'club.update',
      'club.leave_membership',
      'club.delete',
      -- Membership requests (existing + NEW cancel)
      'club.membership_request.submit',
      'club.membership_request.review',
      'club.membership_request.correction',
      'club.membership_request.cancel',
      -- Member commands
      'club.member.add',
      'club.member.remove',
      'club.member.restore',
      -- Governance RPC
      'club.assign_owner',
      'club.clear_owner',
      'club.transfer_president',
      'club.assign_vice_president',
      'club.clear_vice_president',
      -- Governance client bridge
      'club.owner.transfer',
      'club.president.transfer',
      'club.vice_president.assign',
      -- Defensive client strings
      'rating.verify',
      'rating.propose',
      'audit.view',
      'workflow.notification',
      'user.manage.denied',
      'user.manage.status-change',
      'payment_success',
      'approve'
    ]::text[])
  ) s;

  if v_list is null or v_list = '' then
    raise exception 'PHASE_2C_CANCEL_AUDIT: empty action set — aborting';
  end if;

  alter table public.audit_logs drop constraint if exists audit_logs_action_check;

  v_sql := format(
    'alter table public.audit_logs add constraint audit_logs_action_check check (action in (%s))',
    v_list
  );
  execute v_sql;
end
$$;

-- ---------------------------------------------------------------------
-- 2. club_cancel_membership_request — cancel + mandatory audit
--    Prerequisites: phase42_err, phase42_idempotency_*, phase42_write_audit
-- ---------------------------------------------------------------------
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
declare
  v_cached jsonb;
  v_row public.club_membership_requests_v42%rowtype;
  v_resp jsonb;
  v_to_version integer;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;

  if p_request_id is null then
    return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.');
  end if;

  -- Idempotent replay: return cached success WITHOUT a second audit write.
  v_cached := public.phase42_idempotency_get(p_request_id, 'club_cancel_membership_request');
  if v_cached is not null then
    return v_cached::json;
  end if;

  select * into v_row
  from public.club_membership_requests_v42
  where id = p_membership_request_id;

  if not found then
    return public.phase42_err('NOT_FOUND', 'Không tìm thấy yêu cầu.');
  end if;

  if v_row.user_id <> auth.uid() then
    return public.phase42_err('FORBIDDEN', 'Không hủy được yêu cầu của người khác.');
  end if;

  if v_row.status <> 'pending' then
    return public.phase42_err('INVALID_STATUS', 'Yêu cầu không còn pending.');
  end if;

  if v_row.version <> coalesce(p_expected_version, v_row.version) then
    return public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản.');
  end if;

  update public.club_membership_requests_v42
  set status = 'cancelled',
      version = version + 1
  where id = v_row.id;

  v_to_version := v_row.version + 1;

  -- Same transaction as the UPDATE: audit failure rolls back the cancel.
  perform public.phase42_write_audit(
    'club.membership_request.cancel',
    'club_membership_request',
    v_row.id::text,
    v_row.tenant_id,
    v_row.club_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'membership_request_id', v_row.id,
      'user_id', v_row.user_id,
      'actor_id', auth.uid(),
      'club_id', v_row.club_id,
      'tenant_id', v_row.tenant_id,
      'from_status', 'pending',
      'to_status', 'cancelled',
      'from_version', v_row.version,
      'to_version', v_to_version
    )
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'id', v_row.id,
      'status', 'cancelled',
      'club_id', v_row.club_id,
      'user_id', v_row.user_id
    ),
    'version', v_to_version
  );

  perform public.phase42_idempotency_put(
    p_request_id,
    v_row.tenant_id,
    'club_cancel_membership_request',
    v_row.id::text,
    v_resp
  );

  return v_resp::json;
end;
$function$
;

grant execute on function public.club_cancel_membership_request(uuid, uuid, integer) to authenticated;

-- =====================================================================
-- END — Phase 2C cancel audit patch (Staging first; Production NOT APPLIED)
-- =====================================================================
