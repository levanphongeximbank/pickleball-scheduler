-- =====================================================================
-- PHASE 45A.3C — CANONICAL public.club_update RPC (NEW COMMAND)
-- =====================================================================
--
-- Purpose:
--   Author the missing canonical Club UPDATE command so that Club entity
--   metadata edits (name / code / description / status / registered_cluster_id)
--   are written to the Club SSOT `public.clubs` through a single
--   SECURITY DEFINER RPC — matching the architecture already established by
--   `club_create`, `club_assign_owner`, `club_clear_owner`,
--   `club_transfer_president`.
--
--   Before this RPC, Club UPDATE had NO canonical path: the runtime wrote to
--   the legacy blob (`updateClubMeta`) + legacy registry
--   (`club_upsert_registry` → `public.club_governance`), never to
--   `public.clubs`. This file closes that gap. It does NOT cut over runtime
--   (that is Phase 45A.3D).
--
-- Confidence: EXACT (design proven from committed schema + conventions)
--   - clubs columns / status domain / unique indexes / updated_at trigger:
--       docs/v5/PHASE_42B_SCHEMA.sql
--   - command conventions (auth, request_id, idempotency, version, audit,
--       canonical response, phase42_err, row lock, authorization helpers):
--       docs/v5/PHASE_42C_RLS_RPC.sql
--       docs/v5/PHASE_42G_CLUB_CREATE_OWNER.sql
--       docs/v5/phase45a3a/PHASE_45A3A_CLUB_GOVERNANCE_RPC_RECONCILIATION.sql
--   - audit action whitelist convention:
--       docs/v5/PHASE_42KA_GOVERNANCE_AUDIT_PATCH.sql
--
-- Deployment status: NOT DEPLOYED to Production (Phase 1B Staging-ready).
--   Runtime client already wires rpcV2ClubUpdate via clubTenantService.
--   Applying on Staging: creates public.club_update only (no audit DROP/ADD here).
--   Audit prerequisite (must apply first):
--     docs/v5/phase1b/PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql
--   Adds NO new API error codes, writes ONLY to public.clubs, and performs NO
--   club_governance / club_governance_assignments / blob writes.
--
-- Prerequisites (already deployed; NOT (re)defined here):
--   Tables:  public.clubs, public.audit_logs, public.idempotency_requests
--   Helpers: public.phase42_err(text, text)
--            public.phase42_idempotency_get(uuid, text)
--            public.phase42_idempotency_put(uuid, text, text, text, jsonb)
--            public.phase42_write_audit(text, text, text, text, text, jsonb)
--            public.phase42_club_canonical(text)
--            public.phase42_is_platform_super_admin()
--            public.phase42_is_tenant_member(text)
--            public.phase42_has_gov_role(text, text[])
--   Trigger: trg_clubs_updated (BEFORE UPDATE → public.set_updated_at())
--            maintains public.clubs.updated_at automatically.
--
-- Field ownership (canonical public.clubs columns only):
--   name, code, description, status, registered_cluster_id
--   NOT migrated here (not modeled on public.clubs — remain blob/extension):
--   logo, address, phone, note, slug, timezone, registeredCourtIds
--
-- Server tokens → registered API_ERROR_CODES (mapping owned by the client
--   wrapper added in 45A.3D; NO new API error codes are introduced):
--   NOT_AUTHENTICATED  → UNAUTHORIZED
--   REQUEST_ID_REQUIRED→ VALIDATION_ERROR
--   NOT_FOUND          → NOT_FOUND
--   VERSION_CONFLICT   → CONFLICT
--   FORBIDDEN          → FORBIDDEN
--   NAME_REQUIRED      → VALIDATION_ERROR
--   INVALID_STATUS     → VALIDATION_ERROR
--   DUPLICATE_NAME     → CONFLICT
--   DUPLICATE_CODE     → CONFLICT
--   DUPLICATE_CLUB     → CONFLICT
--   UPDATE_FAILED      → INTERNAL_ERROR
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Audit whitelist prerequisite
--    DO NOT drop/recreate audit_logs_action_check here.
--    A fixed IN-list previously failed Staging with 23514 when historical
--    audit_logs.action values were outside that list.
--    Apply first: docs/v5/phase1b/PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 2. public.club_update — canonical Club metadata command
--    Writes ONLY public.clubs. No blob. No club_governance writes.
-- ---------------------------------------------------------------------
create or replace function public.club_update(
  p_request_id uuid,
  p_club_id text,
  p_expected_club_version integer,
  p_name text default null,
  p_code text default null,
  p_description text default null,
  p_status text default null,
  p_registered_cluster_id text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cached jsonb;
  v_club public.clubs%rowtype;
  v_name text;
  v_code text;
  v_description text;
  v_status text;
  v_cluster text;
  v_resp jsonb;
begin
  -- Authentication
  if auth.uid() is null then
    return public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  end if;

  -- Request id (idempotency key)
  if p_request_id is null then
    return public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.');
  end if;

  -- Idempotency replay
  v_cached := public.phase42_idempotency_get(p_request_id, 'club_update');
  if v_cached is not null then
    return v_cached::json;
  end if;

  -- Load + lock the canonical row (soft-deleted excluded)
  select * into v_club
  from public.clubs
  where id = trim(coalesce(p_club_id, '')) and deleted_at is null
  for update;
  if not found then
    return public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.');
  end if;

  -- Optimistic concurrency
  if v_club.version <> coalesce(p_expected_club_version, v_club.version) then
    return public.phase42_err('VERSION_CONFLICT', 'Xung đột phiên bản CLB.');
  end if;

  -- Authorization: platform super admin, club_owner/president, or tenant owner/staff
  if not (
    public.phase42_is_platform_super_admin()
    or public.phase42_has_gov_role(v_club.id, array['club_owner', 'president'])
    or public.phase42_is_tenant_member(v_club.tenant_id)
  ) then
    return public.phase42_err('FORBIDDEN', 'Không có quyền cập nhật CLB.');
  end if;

  -- Field ownership — canonical columns only.
  -- NULL argument = leave unchanged. Empty string clears nullable fields
  -- (code, registered_cluster_id) to NULL; description empty string is kept.
  v_name := case when p_name is null then v_club.name else trim(p_name) end;
  if coalesce(v_name, '') = '' then
    return public.phase42_err('NAME_REQUIRED', 'Thiếu tên CLB.');
  end if;

  v_code := case when p_code is null then v_club.code else nullif(trim(p_code), '') end;
  v_description := case when p_description is null then v_club.description else p_description end;
  v_status := case when p_status is null then v_club.status else trim(p_status) end;
  v_cluster := case
    when p_registered_cluster_id is null then v_club.registered_cluster_id
    else nullif(trim(p_registered_cluster_id), '')
  end;

  -- Status domain validation (matches clubs status check in PHASE_42B_SCHEMA)
  if v_status not in ('pending_setup', 'pending_approval', 'active', 'inactive') then
    return public.phase42_err('INVALID_STATUS', 'Trạng thái CLB không hợp lệ.');
  end if;

  -- Duplicate name within tenant (exclude self; mirrors clubs_tenant_name_uniq)
  if exists (
    select 1 from public.clubs c
    where c.tenant_id = v_club.tenant_id
      and c.deleted_at is null
      and c.id <> v_club.id
      and lower(c.name) = lower(v_name)
  ) then
    return public.phase42_err('DUPLICATE_NAME', 'Tên CLB đã tồn tại trong tenant này.');
  end if;

  -- Duplicate code within tenant (exclude self; mirrors clubs_tenant_code_uniq)
  if v_code is not null and exists (
    select 1 from public.clubs c
    where c.tenant_id = v_club.tenant_id
      and c.deleted_at is null
      and c.id <> v_club.id
      and c.code = v_code
  ) then
    return public.phase42_err('DUPLICATE_CODE', 'Mã CLB đã tồn tại trong tenant này.');
  end if;

  -- Canonical write — public.clubs ONLY. updated_at maintained by trg_clubs_updated.
  update public.clubs
  set name = v_name,
      code = v_code,
      description = coalesce(v_description, ''),
      status = v_status,
      registered_cluster_id = v_cluster,
      version = version + 1
  where id = v_club.id;

  -- Audit — canonical action club.update
  perform public.phase42_write_audit(
    'club.update', 'club', v_club.id, v_club.tenant_id, v_club.id,
    jsonb_build_object(
      'request_id', p_request_id,
      'from_version', v_club.version,
      'fields', jsonb_build_object(
        'name', (p_name is not null),
        'code', (p_code is not null),
        'description', (p_description is not null),
        'status', (p_status is not null),
        'registered_cluster_id', (p_registered_cluster_id is not null)
      )
    )
  );

  -- Canonical response
  v_resp := jsonb_build_object(
    'ok', true,
    'data', public.phase42_club_canonical(v_club.id),
    'version', v_club.version + 1
  );
  perform public.phase42_idempotency_put(p_request_id, v_club.tenant_id, 'club_update', v_club.id, v_resp);
  return v_resp::json;

exception
  when unique_violation then
    return public.phase42_err('DUPLICATE_CLUB', 'CLB trùng tên hoặc mã trong tenant.');
  when others then
    return public.phase42_err('UPDATE_FAILED', coalesce(sqlerrm, 'Không cập nhật được CLB.'));
end;
$$;

grant execute on function public.club_update(uuid, text, integer, text, text, text, text, text) to authenticated;

-- =====================================================================
-- END — PHASE 45A.3C (1 new RPC + 1 audit-whitelist constraint patch)
-- =====================================================================
