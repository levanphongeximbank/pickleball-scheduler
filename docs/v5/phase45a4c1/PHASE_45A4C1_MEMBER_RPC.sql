-- =====================================================================
-- PHASE 45A.4C.1 — CANONICAL club_add_member / club_remove_member RPCs
-- =====================================================================
--
-- Purpose:
--   Author the missing Membership SSOT write commands so Manage Members
--   add/remove (and later admin-link / bootstrap callers) write ONLY to
--   public.club_members through SECURITY DEFINER RPCs — matching the
--   architecture already established by club_leave_membership and
--   club_review_membership_request.
--
--   Before these RPCs, add/remove had NO canonical path: the runtime
--   wrote the legacy blob roster (addMemberToClub / removeMemberFromClub
--   → saveClubExtension). UI mutations are gated OFF under V2 until
--   Phase 45A.4C.4 runtime wiring.
--
-- Confidence: EXACT (design from approved Phase 45A.4C audit contracts +
--   committed schema + leave/review command conventions)
--   - club_members columns / status domain / unique active index:
--       docs/v5/PHASE_42B_SCHEMA.sql + Staging catalog
--   - leave semantics (left vs removed, GOVERNANCE_BLOCK, profile clear):
--       docs/v5/PHASE_42H_ORPHAN_PROFILE_LINKS.sql
--   - insert + athlete ensure on approve:
--       live club_review_membership_request / PHASE_42N
--   - auth / request_id / idempotency / version / audit / phase42_err:
--       docs/v5/phase45a3c/PHASE_45A3C_CLUB_UPDATE_RPC.sql
--       docs/v5/PHASE_42C_RLS_RPC.sql
--
-- Deployment status: NOT DEPLOYED to Production (Phase 1B Staging-ready).
--   Runtime client already wires rpcV2ClubAddMember / rpcV2ClubRemoveMember.
--   Applying on Staging: (1) extends audit_logs_action_check with 'club.member.add'
--   and 'club.member.remove', and (2) creates the two new functions. It adds
--   NO blob writes, NO profiles.club_id authority, and NO hard DELETE of
--   club_members rows. Prefer Phase 1B audit whitelist when bundling apply.
--
-- Out of scope (intentionally NOT authored here):
--   club_restore_member, club_set_member_role, club_set_member_status,
--   runtime wiring, UI enablement, feature flags, migrations.
--
-- Prerequisites (already deployed; NOT (re)defined here):
--   Tables:  public.clubs, public.club_members, public.athletes,
--            public.club_governance_assignments, public.profiles,
--            public.audit_logs, public.idempotency_requests
--   Helpers: public.phase42_err(text, text)
--            public.phase42_idempotency_get(uuid, text)
--            public.phase42_idempotency_put(uuid, text, text, text, jsonb)
--            public.phase42_write_audit(text, text, text, text, text, jsonb)
--            public.phase42_is_platform_super_admin()
--            public.phase42_is_tenant_member(text)
--            public.phase42_has_gov_role(text, text[])
--            public.phase42_can_review_membership(text)
--            public.phase42n_ensure_athlete_for_user(uuid, text, text)
--            public.phase42_clear_profile_club_links(uuid)
--            public.user_has_permission(text)
--   Trigger: trg_club_members_updated (BEFORE UPDATE → set_updated_at())
--
-- Add-vs-restore (Phase 45A.4C §8 — explicit):
--   - never-seen user     → INSERT active
--   - status = 'left'     → REACTIVATE (UPDATE → active)
--   - status = 'removed'  → REJECT CONFLICT (requires future club_restore_member)
--   - status = 'active'   → ALREADY_MEMBER
--
-- Server tokens → registered API_ERROR_CODES (client map owned by 45A.4C.4):
--   NOT_AUTHENTICATED  → UNAUTHORIZED
--   REQUEST_ID_REQUIRED→ VALIDATION_ERROR
--   NOT_FOUND          → NOT_FOUND
--   FORBIDDEN          → FORBIDDEN
--   VALIDATION         → VALIDATION_ERROR  (add mapping in 45A.4C.4 if missing)
--   ALREADY_MEMBER     → CONFLICT
--   NOT_MEMBER         → NOT_FOUND
--   GOVERNANCE_BLOCK   → FORBIDDEN
--   VERSION_CONFLICT   → CONFLICT
--   CONFLICT           → CONFLICT
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Audit action whitelist — add club.member.add / club.member.remove
--    Mirrors PHASE_45A3C / PHASE_42KA. Preserves the full existing action
--    set; adds only the two new membership-member actions.
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
    -- Membership member commands (Phase 45A.4C.1)
    'club.member.add',
    'club.member.remove',
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
-- 2. public.club_add_member — admin admit / re-admit after voluntary leave
--    Writes ONLY public.club_members (+ athlete ensure helper).
--    No blob. No profiles.club_id authority.
-- ---------------------------------------------------------------------
create or replace function public.club_add_member(
  p_request_id uuid,
  p_club_id text,
  p_target_user_id uuid,
  p_membership_type text default 'regular',
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
  v_member public.club_members%rowtype;
  v_left public.club_members%rowtype;
  v_membership_type text;
  v_athlete_id uuid;
  v_display_name text;
  v_reactivated boolean := false;
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

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_add_member');
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

  -- Authorization: SA, club governance (owner/president/VP), or tenant staff
  -- with club.membership.review (mirrors phase42_can_review_membership + SA).
  if not (
    public.phase42_is_platform_super_admin()
    or public.phase42_can_review_membership(v_club.id)
  ) then
    return public.phase42_err('FORBIDDEN', 'Không có quyền thêm thành viên.');
  end if;

  if not exists (select 1 from auth.users u where u.id = p_target_user_id) then
    return public.phase42_err('NOT_FOUND', 'Không tìm thấy người dùng đích.');
  end if;

  v_membership_type := nullif(trim(coalesce(p_membership_type, '')), '');
  if v_membership_type is null then
    v_membership_type := 'regular';
  end if;

  -- Active duplicate prevention (club_members_active_uniq)
  select * into v_member
  from public.club_members
  where club_id = v_club.id
    and user_id = p_target_user_id
    and status = 'active'
  for update;
  if found then
    return public.phase42_err('ALREADY_MEMBER', 'Người dùng đã là thành viên active.');
  end if;

  -- Prefer reactivate most recent voluntary leave (status='left')
  select * into v_left
  from public.club_members
  where club_id = v_club.id
    and user_id = p_target_user_id
    and status = 'left'
  order by left_at desc nulls last, updated_at desc, created_at desc
  limit 1
  for update;

  if found then
    if p_expected_version is not null and v_left.version is distinct from p_expected_version then
      return public.phase42_err('VERSION_CONFLICT', 'Phiên bản thành viên đã thay đổi.');
    end if;

    select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), p_target_user_id::text)
      into v_display_name
    from public.profiles p
    where p.id = p_target_user_id;

    v_athlete_id := coalesce(
      v_left.athlete_id,
      public.phase42n_ensure_athlete_for_user(
        p_target_user_id,
        v_club.tenant_id,
        v_display_name
      )
    );

    update public.club_members
    set status = 'active',
        left_at = null,
        membership_type = v_membership_type,
        athlete_id = v_athlete_id,
        joined_at = coalesce(joined_at, now()),
        version = version + 1,
        updated_at = now()
    where id = v_left.id
    returning * into v_member;

    v_reactivated := true;
  else
    -- Admin-removed history without a left row: do not silent-restore
    if exists (
      select 1
      from public.club_members
      where club_id = v_club.id
        and user_id = p_target_user_id
        and status = 'removed'
    ) then
      return public.phase42_err(
        'CONFLICT',
        'Thành viên đã bị gỡ (removed). Dùng quy trình restore riêng.'
      );
    end if;

    select coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), p_target_user_id::text)
      into v_display_name
    from public.profiles p
    where p.id = p_target_user_id;

    v_athlete_id := public.phase42n_ensure_athlete_for_user(
      p_target_user_id,
      v_club.tenant_id,
      v_display_name
    );

    insert into public.club_members (
      tenant_id, club_id, user_id, athlete_id, membership_type, status, version
    )
    values (
      v_club.tenant_id, v_club.id, p_target_user_id, v_athlete_id,
      v_membership_type, 'active', 1
    )
    returning * into v_member;
  end if;

  perform public.phase42_write_audit(
    'club.member.add',
    'club_member',
    v_member.id::text,
    v_club.tenant_id,
    v_club.id,
    jsonb_build_object(
      'request_id', p_request_id,
      'target_user_id', p_target_user_id,
      'member_id', v_member.id,
      'athlete_id', v_member.athlete_id,
      'reactivated', v_reactivated,
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
      'reactivated', v_reactivated
    ),
    'version', v_member.version
  );

  perform public.phase42_idempotency_put(
    p_request_id,
    v_club.tenant_id,
    'club_add_member',
    v_member.id::text,
    v_resp
  );

  return v_resp::json;
exception
  when unique_violation then
    return public.phase42_err('ALREADY_MEMBER', 'Người dùng đã là thành viên active.');
end;
$$;

grant execute on function public.club_add_member(uuid, text, uuid, text, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 3. public.club_remove_member — admin soft-remove (status='removed')
--    Distinct from self-leave (club_leave_membership → status='left').
--    Preserves history. No hard DELETE.
-- ---------------------------------------------------------------------
create or replace function public.club_remove_member(
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
  v_member public.club_members%rowtype;
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

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_remove_member');
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

  -- Authorization mirrors canDeleteClubMembers: SA / owner / president /
  -- tenant staff with membership.review. Vice-president alone is denied.
  if not (
    public.phase42_is_platform_super_admin()
    or public.phase42_has_gov_role(v_club.id, array['club_owner', 'president'])
    or (
      public.user_has_permission('club.membership.review')
      and public.phase42_is_tenant_member(v_club.tenant_id)
    )
  ) then
    return public.phase42_err('FORBIDDEN', 'Không có quyền gỡ thành viên.');
  end if;

  select * into v_member
  from public.club_members
  where club_id = v_club.id
    and user_id = p_target_user_id
    and status = 'active'
  for update;
  if not found then
    return public.phase42_err('NOT_MEMBER', 'Không phải thành viên active.');
  end if;

  if p_expected_version is not null and v_member.version is distinct from p_expected_version then
    return public.phase42_err('VERSION_CONFLICT', 'Phiên bản thành viên đã thay đổi.');
  end if;

  -- Protect active president / club_owner (must transfer first)
  if exists (
    select 1
    from public.club_governance_assignments g
    where g.club_member_id = v_member.id
      and g.status = 'active'
      and g.role_code in ('president', 'club_owner')
  ) then
    return public.phase42_err(
      'GOVERNANCE_BLOCK',
      'Chủ tịch/Chủ sở hữu phải chuyển quyền trước khi bị gỡ.'
    );
  end if;

  -- End non-protected gov roles (e.g. vice_president) for this member
  update public.club_governance_assignments
  set status = 'ended',
      effective_to = now(),
      version = version + 1
  where club_member_id = v_member.id
    and status = 'active';

  update public.club_members
  set status = 'removed',
      left_at = now(),
      version = version + 1,
      updated_at = now()
  where id = v_member.id
  returning * into v_member;

  perform public.phase42_clear_profile_club_links(p_target_user_id);

  perform public.phase42_write_audit(
    'club.member.remove',
    'club_member',
    v_member.id::text,
    v_club.tenant_id,
    v_club.id,
    jsonb_build_object(
      'request_id', p_request_id,
      'target_user_id', p_target_user_id,
      'member_id', v_member.id,
      'status', 'removed'
    )
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'id', v_member.id,
      'club_id', v_club.id,
      'user_id', v_member.user_id,
      'status', 'removed',
      'version', v_member.version
    ),
    'version', v_member.version
  );

  perform public.phase42_idempotency_put(
    p_request_id,
    v_club.tenant_id,
    'club_remove_member',
    v_member.id::text,
    v_resp
  );

  return v_resp::json;
end;
$$;

grant execute on function public.club_remove_member(uuid, text, uuid, integer) to authenticated;

-- =====================================================================
-- END — PHASE 45A.4C.1 (audit whitelist + 2 member RPCs, NOT applied)
-- =====================================================================
