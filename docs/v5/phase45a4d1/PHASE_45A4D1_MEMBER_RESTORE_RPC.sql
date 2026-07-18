-- =====================================================================
-- PHASE 45A.4D.1 — CANONICAL club_restore_member RPC
-- =====================================================================
--
-- Purpose:
--   Author the missing Membership SSOT command that restores an
--   admin-removed member (status='removed' → 'active') without inventing
--   a general status RPC or roster-title (captain/coach/manager) feature.
--
-- Owner locks (Phase 45A.4D.0B — OPTION A):
--   - membership_type remains participation classification (canonical: regular)
--   - club_owner / president / vice_president remain governance-only
--   - captain / coach / manager roster titles are deferred (no column / RPC)
--   - no club_update_member_role / club_update_member_status
--   - inactive is legacy/blob-only and must never be written here
--
-- Lifecycle commands (locked):
--   active → left     : club_leave_membership
--   active → removed  : club_remove_member
--   left   → active   : club_add_member
--   removed → active  : club_restore_member  (THIS FILE)
--
-- Confidence: EXACT (approved 45A.4D.0 / 45A.4D.0B contracts +
--   docs/v5/PHASE_42B_SCHEMA.sql status domain +
--   docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql conventions)
--
-- Deployment status: NOT DEPLOYED to Production (Phase 1B Staging-ready).
--   Runtime client wires rpcV2ClubRestoreMember / restoreMemberToClub.
--   Applying on Staging: (1) extends audit_logs_action_check with 'club.member.restore',
--   and (2) creates public.club_restore_member. No blob writes. No
--   profiles.club_id authority. No hard DELETE.
--
-- Out of scope (intentionally NOT authored here):
--   club_update_member_role, club_update_member_status,
--   captain/coach/manager schema, deferred roster-title column,
--   runtime wiring, UI enablement, feature flags, migrations.
--
-- Prerequisites (already deployed; NOT (re)defined here):
--   Tables:  public.clubs, public.club_members, public.athletes,
--            public.profiles, public.audit_logs, public.idempotency_requests
--   Helpers: public.phase42_err(text, text)
--            public.phase42_idempotency_get(uuid, text)
--            public.phase42_idempotency_put(uuid, text, text, text, jsonb)
--            public.phase42_write_audit(text, text, text, text, text, jsonb)
--            public.phase42_is_platform_super_admin()
--            public.phase42_can_review_membership(text)
--            public.phase42n_ensure_athlete_for_user(uuid, text, text)
--   Trigger: trg_club_members_updated (BEFORE UPDATE → set_updated_at())
--
-- Server tokens → registered API_ERROR_CODES (client map already owns these):
--   NOT_AUTHENTICATED  → UNAUTHORIZED
--   REQUEST_ID_REQUIRED→ VALIDATION_ERROR
--   NOT_FOUND          → NOT_FOUND
--   FORBIDDEN          → FORBIDDEN
--   VALIDATION         → VALIDATION_ERROR
--   ALREADY_MEMBER     → CONFLICT
--   CONFLICT           → CONFLICT
--   VERSION_CONFLICT   → CONFLICT
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Audit action whitelist — add club.member.restore
--    Preserves the full existing action set (including Phase 45A.4C.1
--    club.member.add / club.member.remove).
-- ---------------------------------------------------------------------
alter table public.audit_logs drop constraint if exists audit_logs_action_check;

alter table public.audit_logs
  add constraint audit_logs_action_check
  check (action in (
    -- Identity / admin
    'login', 'login_failed', 'logout',
    'create', 'update', 'delete',
    'assign_role', 'permission_change',
    'password_change', 'reset_password',
    -- Phase 42 club lifecycle (RPC + client)
    'club.create',
    'club.update',
    'club.leave_membership',
    'club.delete',
    -- Membership requests
    'club.membership_request.submit',
    'club.membership_request.review',
    'club.membership_request.correction',
    -- Membership member commands (Phase 45A.4C.1 + 45A.4D.1)
    'club.member.add',
    'club.member.remove',
    'club.member.restore',
    -- Governance (RPC canonical)
    'club.assign_owner',
    'club.clear_owner',
    'club.transfer_president',
    -- Governance (client audit bridge — legacy V1 paths)
    'club.owner.transfer',
    'club.president.transfer',
    'club.vice_president.assign'
  ));

-- ---------------------------------------------------------------------
-- 2. public.club_restore_member — restore admin-removed member to active
--    Writes ONLY public.club_members (+ athlete ensure helper when needed).
--    Authorization mirrors club_add_member (SA / phase42_can_review_membership).
--    No blob. No profiles.club_id authority. No governance role changes.
-- ---------------------------------------------------------------------
create or replace function public.club_restore_member(
  p_request_id uuid,
  p_club_id text,
  p_target_user_id uuid,
  p_expected_version integer default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cached jsonb;
  v_club public.clubs%rowtype;
  v_active public.club_members%rowtype;
  v_removed public.club_members%rowtype;
  v_member public.club_members%rowtype;
  v_from_version integer;
  v_athlete_id uuid;
  v_display_name text;
  v_resp jsonb;
begin
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;

  if p_request_id is null then
    return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.');
  end if;

  if p_target_user_id is null then
    return public.phase42_err('VALIDATION', 'Thiếu target user_id.');
  end if;

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_restore_member');
  if v_cached is not null then
    return v_cached::json;
  end if;

  select * into v_club
  from public.clubs
  where id = trim(coalesce(p_club_id, ''))
    and deleted_at is null
  for update;
  if not found then
    return public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.');
  end if;

  -- Authorization mirrors club_add_member (admit / re-admit class).
  -- phase42_can_review_membership covers owner/president/VP + tenant staff
  -- with membership.review — same as add; restore is not admin-remove.
  if not (
    public.phase42_is_platform_super_admin()
    or public.phase42_can_review_membership(v_club.id)
  ) then
    return public.phase42_err('FORBIDDEN', 'Không có quyền khôi phục thành viên.');
  end if;

  if not exists (select 1 from auth.users u where u.id = p_target_user_id) then
    return public.phase42_err('NOT_FOUND', 'Không tìm thấy người dùng đích.');
  end if;

  -- Active duplicate prevention (club_members_active_uniq)
  select * into v_active
  from public.club_members
  where club_id = v_club.id
    and user_id = p_target_user_id
    and status = 'active'
  for update;
  if found then
    return public.phase42_err('ALREADY_MEMBER', 'Người dùng đã là thành viên active.');
  end if;

  -- Eligible target: most recent removed history for this club/user
  select * into v_removed
  from public.club_members
  where club_id = v_club.id
    and user_id = p_target_user_id
    and status = 'removed'
  order by left_at desc nulls last, updated_at desc, created_at desc
  limit 1
  for update;

  if found then
    if p_expected_version is not null and v_removed.version is distinct from p_expected_version then
      return public.phase42_err('VERSION_CONFLICT', 'Phiên bản thành viên đã thay đổi.');
    end if;

    v_from_version := v_removed.version;

    select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), p_target_user_id::text)
      into v_display_name
    from public.profiles p
    where p.id = p_target_user_id;

    v_athlete_id := coalesce(
      v_removed.athlete_id,
      public.phase42n_ensure_athlete_for_user(
        p_target_user_id,
        v_club.tenant_id,
        v_display_name
      )
    );

    -- Preserve membership_type / row identity. Never write inactive.
    -- Never invent a second membership row. Do not touch governance.
    update public.club_members
    set status = 'active',
        left_at = null,
        athlete_id = v_athlete_id,
        version = version + 1,
        updated_at = now()
    where id = v_removed.id
    returning * into v_member;

    perform public.phase42_write_audit(
      'club.member.restore',
      'club_member',
      v_member.id::text,
      v_club.tenant_id,
      v_club.id,
      jsonb_build_object(
        'request_id', p_request_id,
        'target_user_id', p_target_user_id,
        'member_id', v_member.id,
        'from_version', v_from_version,
        'prior_status', 'removed',
        'target_status', 'active',
        'membership_type', v_member.membership_type
      )
    );

    v_resp := jsonb_build_object(
      'ok', true,
      'data', jsonb_build_object(
        'id', v_member.id,
        'club_id', v_club.id,
        'user_id', v_member.user_id,
        'athlete_id', v_member.athlete_id,
        'status', v_member.status,
        'membership_type', v_member.membership_type,
        'restored', true,
        'from_version', v_from_version
      ),
      'version', v_member.version
    );

    perform public.phase42_idempotency_put(
      p_request_id,
      v_club.tenant_id,
      'club_restore_member',
      v_member.id::text,
      v_resp
    );

    return v_resp::json;
  end if;

  -- No removed row — discriminate left history vs never-seen.
  if exists (
    select 1
    from public.club_members
    where club_id = v_club.id
      and user_id = p_target_user_id
      and status = 'left'
  ) then
    return public.phase42_err(
      'CONFLICT',
      'Thành viên đang ở trạng thái left. Dùng club_add_member để tái kích hoạt.'
    );
  end if;

  return public.phase42_err(
    'NOT_FOUND',
    'Không có lịch sử removed. Dùng club_add_member để thêm thành viên mới.'
  );
exception
  when unique_violation then
    return public.phase42_err('ALREADY_MEMBER', 'Người dùng đã là thành viên active.');
end;
$$;

grant execute on function public.club_restore_member(uuid, text, uuid, integer) to authenticated;

-- =====================================================================
-- END — PHASE 45A.4D.1 (audit whitelist + club_restore_member, NOT applied)
-- =====================================================================
