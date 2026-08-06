-- =============================================================================
-- OPERATION B1B — WP2 RLS and Controlled Writer Authority
-- Object: public.qa_identity_quarantines (authority extension; WP1 table required)
-- Status: AUTHORED ONLY — NOT APPLIED.
-- Do not apply to Staging or Production without a separate Owner GO (WP6+).
--
-- Scope (WP2 only):
--   - RLS enable (deny-by-default; no permissive table policies)
--   - Table privilege lockdown (including service_role direct DML revoke)
--   - SECURITY DEFINER lifecycle writers + state/list read RPCs
--   - Canonical SUPER_ADMIN / service-role authorization
--   - Optimistic concurrency + structured results + audit events
--
-- Does NOT:
--   - redefine or weaken WP1 table/constraints/indexes/triggers
--   - alter public.profiles / profiles_status_check
--   - mutate auth.users / Auth ban/unban
--   - create qa_quarantine_list_active_batched alias
--   - grant tenant-owner product access
--
-- Preservation:
--   PROFILES_STATUS_CHANGE_REQUIRED=NO
--   PROFILES_STATUS_CHECK_CHANGE_REQUIRED=NO
--   PROFILE_STATUS_RUNTIME_SEMANTICS_PRESERVED=YES
--   AUTH_BAN_APPLIED_BOOLEAN_ALLOWED=NO
--   OLD_OWNER_GO_REUSABLE=NO
--   OLD_BATCH_REUSABLE=NO
--   EXECUTION_AUTHORIZED=NO
--   STAGING_APPLY_GO=NO
--   PRODUCTION_GO=NO
--
-- Retired authority (non-reusable):
--   OWNER_GO=APPROVE_OPERATION_B1_EXACT_EIGHT_ONLY
--   BATCH_ID=b37186cf-e620-4f27-aba3-d7e8750ae7df
-- =============================================================================

SET search_path = public, auth, pg_temp;

-- -----------------------------------------------------------------------------
-- Fail-closed preflight: WP1 authority must already exist exactly
-- -----------------------------------------------------------------------------
DO $preflight$
DECLARE
  v_missing_cols text;
  v_missing_constraints text;
  v_missing_indexes text;
  v_has_auth_ban_applied boolean;
BEGIN
  IF to_regclass('public.qa_identity_quarantines') IS NULL THEN
    RAISE EXCEPTION
      'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: public.qa_identity_quarantines missing (WP1 required)'
      USING ERRCODE = 'P0001';
  END IF;

  IF to_regclass('public.audit_logs') IS NULL THEN
    RAISE EXCEPTION
      'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: public.audit_logs missing'
      USING ERRCODE = 'P0001';
  END IF;

  IF to_regprocedure('public.is_super_admin()') IS NULL THEN
    RAISE EXCEPTION
      'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: public.is_super_admin() missing'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'qa_identity_quarantines'
      AND c.column_name = 'auth_ban_applied'
  )
  INTO v_has_auth_ban_applied;

  IF v_has_auth_ban_applied THEN
    RAISE EXCEPTION
      'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: auth_ban_applied column is forbidden'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT string_agg(required.col, ', ' ORDER BY required.col)
  INTO v_missing_cols
  FROM (
    VALUES
      ('id'),
      ('profile_id'),
      ('auth_user_id'),
      ('venue_id'),
      ('batch_id'),
      ('source_operation'),
      ('allowlist_sha256'),
      ('snapshot_sha256'),
      ('lifecycle_state'),
      ('auth_ban_state'),
      ('reason'),
      ('created_at'),
      ('created_by'),
      ('activated_at'),
      ('released_at'),
      ('released_by'),
      ('release_reason'),
      ('failure_classification'),
      ('lifecycle_version'),
      ('original_profile_status'),
      ('original_auth_banned'),
      ('expected_email'),
      ('allowlist_label'),
      ('metadata'),
      ('updated_at')
  ) AS required(col)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'qa_identity_quarantines'
      AND c.column_name = required.col
  );

  IF v_missing_cols IS NOT NULL THEN
    RAISE EXCEPTION
      'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: missing WP1 columns: %',
      v_missing_cols
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'qa_identity_quarantines_immutable_fields_trg'
      AND tgrelid = 'public.qa_identity_quarantines'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: immutable-fields trigger missing'
      USING ERRCODE = 'P0001';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'qa_identity_quarantines_deny_hard_delete_trg'
      AND tgrelid = 'public.qa_identity_quarantines'::regclass
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION
      'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: hard-delete-deny trigger missing'
      USING ERRCODE = 'P0001';
  END IF;

  SELECT string_agg(required.con, ', ' ORDER BY required.con)
  INTO v_missing_constraints
  FROM (
    VALUES
      ('qa_identity_quarantines_lifecycle_state_check'),
      ('qa_identity_quarantines_auth_ban_state_check'),
      ('qa_identity_quarantines_identity_bind_check'),
      ('qa_identity_quarantines_active_success_check'),
      ('qa_identity_quarantines_pending_auth_check'),
      ('qa_identity_quarantines_release_consistency_check'),
      ('qa_identity_quarantines_reverted_failure_check'),
      ('qa_identity_quarantines_failed_auth_not_active_check')
  ) AS required(con)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = required.con
      AND conrelid = 'public.qa_identity_quarantines'::regclass
  );

  IF v_missing_constraints IS NOT NULL THEN
    RAISE EXCEPTION
      'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: missing WP1 constraints: %',
      v_missing_constraints
      USING ERRCODE = 'P0001';
  END IF;

  SELECT string_agg(required.idx, ', ' ORDER BY required.idx)
  INTO v_missing_indexes
  FROM (
    VALUES
      ('qa_identity_quarantines_active_profile_uidx'),
      ('qa_identity_quarantines_active_auth_uidx'),
      ('qa_identity_quarantines_pending_profile_batch_uidx')
  ) AS required(idx)
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'i'
      AND c.relname = required.idx
  );

  IF v_missing_indexes IS NOT NULL THEN
    RAISE EXCEPTION
      'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: missing WP1 indexes: %',
      v_missing_indexes
      USING ERRCODE = 'P0001';
  END IF;

  -- Fail closed on unexpected permissive policies already present
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'qa_identity_quarantines'
      AND (
        cmd IN ('SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL')
        OR roles && ARRAY['anon', 'authenticated', 'PUBLIC']::name[]
        OR permissive = 'PERMISSIVE'
      )
  ) THEN
    RAISE EXCEPTION
      'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: unexpected permissive policy on qa_identity_quarantines'
      USING ERRCODE = 'P0001';
  END IF;

  -- Fail closed on banned alias name
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'qa_quarantine_list_active_batched'
  ) THEN
    RAISE EXCEPTION
      'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: forbidden alias qa_quarantine_list_active_batched exists'
      USING ERRCODE = 'P0001';
  END IF;
END
$preflight$;

-- -----------------------------------------------------------------------------
-- Fail-closed: refuse incompatible pre-existing RPC signatures / overloads
-- -----------------------------------------------------------------------------
DO $sigguard$
DECLARE
  r record;
  v_expected text;
BEGIN
  FOR r IN
    SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'qa_quarantine_is_service_role',
        'qa_quarantine_is_authorized_caller',
        'qa_quarantine_actor_text',
        'qa_quarantine_write_audit',
        'qa_quarantine_prepare',
        'qa_quarantine_activate_after_auth_ban',
        'qa_quarantine_activate_preexisting_ban',
        'qa_quarantine_record_compensated_failure',
        'qa_quarantine_release',
        'qa_quarantine_get_state',
        'qa_quarantine_list_active'
      )
  LOOP
    v_expected := CASE r.proname
      WHEN 'qa_quarantine_is_service_role' THEN ''
      WHEN 'qa_quarantine_is_authorized_caller' THEN ''
      WHEN 'qa_quarantine_actor_text' THEN ''
      WHEN 'qa_quarantine_write_audit' THEN
        'p_action text, p_quarantine_id uuid, p_profile_id uuid, p_batch_id uuid, p_prev_lifecycle_state text, p_prev_auth_ban_state text, p_new_lifecycle_state text, p_new_auth_ban_state text, p_lifecycle_version integer, p_result_code text, p_extra jsonb'
      WHEN 'qa_quarantine_prepare' THEN
        'p_profile_id uuid, p_auth_user_id uuid, p_batch_id uuid, p_allowlist_sha256 text, p_snapshot_sha256 text, p_reason text, p_original_profile_status text, p_original_auth_banned boolean, p_expected_email text, p_allowlist_label text, p_metadata jsonb'
      WHEN 'qa_quarantine_activate_after_auth_ban' THEN
        'p_quarantine_id uuid, p_expected_lifecycle_version integer, p_auth_ban_readback_confirmed boolean'
      WHEN 'qa_quarantine_activate_preexisting_ban' THEN
        'p_quarantine_id uuid, p_expected_lifecycle_version integer'
      WHEN 'qa_quarantine_record_compensated_failure' THEN
        'p_quarantine_id uuid, p_expected_lifecycle_version integer, p_target_auth_ban_state text, p_failure_classification text'
      WHEN 'qa_quarantine_release' THEN
        'p_quarantine_id uuid, p_expected_lifecycle_version integer, p_release_reason text'
      WHEN 'qa_quarantine_get_state' THEN
        'p_quarantine_id uuid'
      WHEN 'qa_quarantine_list_active' THEN
        'p_profile_ids uuid[]'
      ELSE NULL
    END;

    IF v_expected IS NULL OR r.args IS DISTINCT FROM v_expected THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINE_AUTHORITY_INCOMPATIBLE: function %.%(%) conflicts with WP2 signature',
        'public', r.proname, r.args
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
END
$sigguard$;

-- -----------------------------------------------------------------------------
-- Additive audit_logs_action_check whitelist (union existing + WP2 actions)
-- Matches repository PHASE_1B additive pattern (no fixed exclusive IN-list).
-- -----------------------------------------------------------------------------
DO $audit_whitelist$
DECLARE
  v_list text;
  v_sql text;
BEGIN
  SELECT string_agg(quote_literal(a), ', ' ORDER BY a)
  INTO v_list
  FROM (
    SELECT DISTINCT action AS a
    FROM public.audit_logs
    WHERE action IS NOT NULL
      AND length(trim(action)) > 0

    UNION

    SELECT unnest(ARRAY[
      'qa_quarantine.prepare',
      'qa_quarantine.activate_after_auth_ban',
      'qa_quarantine.activate_preexisting_ban',
      'qa_quarantine.compensated_failure',
      'qa_quarantine.release'
    ]::text[])
  ) s;

  IF v_list IS NULL OR v_list = '' THEN
    RAISE EXCEPTION
      'QA_IDENTITY_QUARANTINE_AUTHORITY_AUDIT: empty action set — aborting'
      USING ERRCODE = 'P0001';
  END IF;

  ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

  v_sql := format(
    'ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action IN (%s))',
    v_list
  );
  EXECUTE v_sql;
END
$audit_whitelist$;

-- -----------------------------------------------------------------------------
-- Internal authorization / actor / audit helpers (not client-callable)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_quarantine_is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    auth.jwt() ->> 'role'
  ) = 'service_role';
$$;

COMMENT ON FUNCTION public.qa_quarantine_is_service_role() IS
  'OPERATION_B1B WP2: canonical service-role claim detection for quarantine RPCs.';

CREATE OR REPLACE FUNCTION public.qa_quarantine_is_authorized_caller()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT public.is_super_admin() OR public.qa_quarantine_is_service_role();
$$;

COMMENT ON FUNCTION public.qa_quarantine_is_authorized_caller() IS
  'OPERATION_B1B WP2: SUPER_ADMIN (is_super_admin) or service-role claim only.';

CREATE OR REPLACE FUNCTION public.qa_quarantine_actor_text()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
BEGIN
  IF public.qa_quarantine_is_service_role() THEN
    RETURN 'service_role';
  END IF;
  IF auth.uid() IS NOT NULL THEN
    RETURN auth.uid()::text;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.qa_quarantine_write_audit(
  p_action text,
  p_quarantine_id uuid,
  p_profile_id uuid,
  p_batch_id uuid,
  p_prev_lifecycle_state text,
  p_prev_auth_ban_state text,
  p_new_lifecycle_state text,
  p_new_auth_ban_state text,
  p_lifecycle_version integer,
  p_result_code text,
  p_extra jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_email text := '';
  v_venue_id text;
BEGIN
  -- Fail closed: audit insert errors must abort the lifecycle transaction.
  IF p_action IS NULL OR length(trim(p_action)) = 0 THEN
    RAISE EXCEPTION 'QA_QUARANTINE_AUDIT_ACTION_REQUIRED'
      USING ERRCODE = 'P0001';
  END IF;

  IF v_actor_id IS NOT NULL THEN
    SELECT coalesce(nullif(trim(p.email), ''), '')
    INTO v_actor_email
    FROM public.profiles p
    WHERE p.id = v_actor_id;
  END IF;

  SELECT q.venue_id
  INTO v_venue_id
  FROM public.qa_identity_quarantines q
  WHERE q.id = p_quarantine_id;

  INSERT INTO public.audit_logs (
    actor_id,
    actor_email,
    action,
    resource_type,
    resource_id,
    venue_id,
    club_id,
    metadata
  ) VALUES (
    v_actor_id,
    coalesce(v_actor_email, ''),
    p_action,
    'qa_identity_quarantine',
    p_quarantine_id::text,
    v_venue_id,
    NULL,
    jsonb_strip_nulls(
      jsonb_build_object(
        'quarantine_id', p_quarantine_id,
        'profile_id', p_profile_id,
        'batch_id', p_batch_id,
        'previous_lifecycle_state', p_prev_lifecycle_state,
        'previous_auth_ban_state', p_prev_auth_ban_state,
        'new_lifecycle_state', p_new_lifecycle_state,
        'new_auth_ban_state', p_new_auth_ban_state,
        'lifecycle_version', p_lifecycle_version,
        'result_code', p_result_code,
        'actor', public.qa_quarantine_actor_text(),
        'extra', coalesce(p_extra, '{}'::jsonb)
      )
      -- Never persist expected_email / artifact hashes / tokens in audit metadata.
      - 'expected_email'
      - 'allowlist_sha256'
      - 'snapshot_sha256'
      - 'jwt'
      - 'access_token'
      - 'service_role_key'
    )
  );
END;
$$;

COMMENT ON FUNCTION public.qa_quarantine_write_audit(text, uuid, uuid, uuid, text, text, text, text, integer, text, jsonb) IS
  'OPERATION_B1B WP2: transactional audit writer for quarantine lifecycle transitions. Fail-closed.';

REVOKE ALL ON FUNCTION public.qa_quarantine_is_service_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_quarantine_is_service_role() FROM anon;
REVOKE ALL ON FUNCTION public.qa_quarantine_is_service_role() FROM authenticated;

REVOKE ALL ON FUNCTION public.qa_quarantine_is_authorized_caller() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_quarantine_is_authorized_caller() FROM anon;
REVOKE ALL ON FUNCTION public.qa_quarantine_is_authorized_caller() FROM authenticated;

REVOKE ALL ON FUNCTION public.qa_quarantine_actor_text() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_quarantine_actor_text() FROM anon;
REVOKE ALL ON FUNCTION public.qa_quarantine_actor_text() FROM authenticated;

REVOKE ALL ON FUNCTION public.qa_quarantine_write_audit(text, uuid, uuid, uuid, text, text, text, text, integer, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_quarantine_write_audit(text, uuid, uuid, uuid, text, text, text, text, integer, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.qa_quarantine_write_audit(text, uuid, uuid, uuid, text, text, text, text, integer, text, jsonb) FROM authenticated;

-- -----------------------------------------------------------------------------
-- RLS deny-by-default (no permissive table policies)
-- Do not FORCE RLS — SECURITY DEFINER owner path must remain valid.
-- -----------------------------------------------------------------------------
ALTER TABLE public.qa_identity_quarantines ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.qa_identity_quarantines FROM PUBLIC;
REVOKE ALL ON TABLE public.qa_identity_quarantines FROM anon;
REVOKE ALL ON TABLE public.qa_identity_quarantines FROM authenticated;
REVOKE ALL ON TABLE public.qa_identity_quarantines FROM service_role;

-- -----------------------------------------------------------------------------
-- 1) qa_quarantine_prepare
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_quarantine_prepare(
  p_profile_id uuid,
  p_auth_user_id uuid,
  p_batch_id uuid,
  p_allowlist_sha256 text,
  p_snapshot_sha256 text,
  p_reason text,
  p_original_profile_status text,
  p_original_auth_banned boolean,
  p_expected_email text,
  p_allowlist_label text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_auth_email text;
  v_label text;
  v_reason text;
  v_hash_allow text;
  v_hash_snap text;
  v_email_norm text;
  v_meta jsonb;
  v_actor text;
  v_active public.qa_identity_quarantines%ROWTYPE;
  v_pending public.qa_identity_quarantines%ROWTYPE;
  v_new public.qa_identity_quarantines%ROWTYPE;
BEGIN
  IF NOT public.qa_quarantine_is_authorized_caller() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  v_actor := public.qa_quarantine_actor_text();
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ambiguous_actor');
  END IF;

  IF p_profile_id IS NULL OR p_auth_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'identity_required');
  END IF;

  IF p_profile_id IS DISTINCT FROM p_auth_user_id THEN
    RETURN jsonb_build_object('ok', false, 'code', 'identity_bind_mismatch');
  END IF;

  IF p_batch_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'batch_required');
  END IF;

  IF p_original_auth_banned IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'original_auth_banned_required');
  END IF;

  v_reason := trim(coalesce(p_reason, ''));
  IF length(v_reason) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'reason_required');
  END IF;

  v_hash_allow := lower(trim(coalesce(p_allowlist_sha256, '')));
  v_hash_snap := lower(trim(coalesce(p_snapshot_sha256, '')));
  IF v_hash_allow !~ '^[a-f0-9]{64}$' OR v_hash_snap !~ '^[a-f0-9]{64}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_artifact_hash');
  END IF;

  v_label := upper(trim(coalesce(p_allowlist_label, '')));
  IF v_label NOT IN (
    'QA-04', 'QA-05', 'QA-06', 'QA-07',
    'QA-08', 'QA-09', 'QA-10', 'QA-11'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_allowlist_label');
  END IF;

  v_email_norm := lower(trim(coalesce(p_expected_email, '')));
  IF length(v_email_norm) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'expected_email_required');
  END IF;

  IF p_metadata IS NULL OR jsonb_typeof(p_metadata) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_metadata');
  END IF;

  IF p_metadata ? 'expected_email'
     OR p_metadata ? 'allowlist_sha256'
     OR p_metadata ? 'snapshot_sha256'
     OR p_metadata ? 'jwt'
     OR p_metadata ? 'access_token'
     OR p_metadata ? 'service_role_key'
  THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden_metadata_key');
  END IF;

  v_meta := coalesce(p_metadata, '{}'::jsonb);

  SELECT * INTO v_profile
  FROM public.profiles p
  WHERE p.id = p_profile_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'profile_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users u WHERE u.id = p_auth_user_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'auth_user_not_found');
  END IF;

  SELECT lower(trim(coalesce(u.email, '')))
  INTO v_auth_email
  FROM auth.users u
  WHERE u.id = p_auth_user_id;

  IF v_auth_email IS DISTINCT FROM v_email_norm THEN
    RETURN jsonb_build_object('ok', false, 'code', 'email_mismatch');
  END IF;

  IF v_profile.status IS DISTINCT FROM p_original_profile_status THEN
    RETURN jsonb_build_object('ok', false, 'code', 'status_mismatch');
  END IF;

  IF v_profile.status NOT IN ('active', 'suspended', 'invited') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_profile_status');
  END IF;

  -- Active authority for this identity
  SELECT * INTO v_active
  FROM public.qa_identity_quarantines q
  WHERE q.profile_id = p_profile_id
    AND q.lifecycle_state = 'active'
  FOR UPDATE;

  IF FOUND THEN
    IF v_active.batch_id IS DISTINCT FROM p_batch_id THEN
      RETURN jsonb_build_object('ok', false, 'code', 'active_other_batch');
    END IF;
    IF v_active.auth_ban_state IN ('applied', 'not_required_preexisting') THEN
      RETURN jsonb_build_object(
        'ok', true,
        'code', 'already_quarantined',
        'quarantine_id', v_active.id,
        'lifecycle_state', v_active.lifecycle_state,
        'auth_ban_state', v_active.auth_ban_state,
        'lifecycle_version', v_active.lifecycle_version
      );
    END IF;
    RETURN jsonb_build_object('ok', false, 'code', 'active_incompatible_auth_state');
  END IF;

  -- Pending authority for same identity + batch
  SELECT * INTO v_pending
  FROM public.qa_identity_quarantines q
  WHERE q.profile_id = p_profile_id
    AND q.batch_id = p_batch_id
    AND q.lifecycle_state = 'pending'
  FOR UPDATE;

  IF FOUND THEN
    IF v_pending.auth_user_id IS DISTINCT FROM p_auth_user_id
       OR v_pending.venue_id IS DISTINCT FROM v_profile.venue_id
       OR v_pending.source_operation IS DISTINCT FROM 'OPERATION_B1B'
       OR v_pending.allowlist_sha256 IS DISTINCT FROM v_hash_allow
       OR v_pending.snapshot_sha256 IS DISTINCT FROM v_hash_snap
       OR v_pending.original_profile_status IS DISTINCT FROM p_original_profile_status
       OR v_pending.original_auth_banned IS DISTINCT FROM p_original_auth_banned
       OR lower(trim(v_pending.expected_email)) IS DISTINCT FROM v_email_norm
       OR upper(trim(coalesce(v_pending.allowlist_label, ''))) IS DISTINCT FROM v_label
       OR v_pending.reason IS DISTINCT FROM v_reason
    THEN
      RETURN jsonb_build_object('ok', false, 'code', 'pending_conflict');
    END IF;

    RETURN jsonb_build_object(
      'ok', true,
      'code', 'prepare_idempotent',
      'quarantine_id', v_pending.id,
      'lifecycle_state', v_pending.lifecycle_state,
      'auth_ban_state', v_pending.auth_ban_state,
      'lifecycle_version', v_pending.lifecycle_version
    );
  END IF;

  -- Any other pending for this identity (different batch) is incompatible
  IF EXISTS (
    SELECT 1
    FROM public.qa_identity_quarantines q
    WHERE q.profile_id = p_profile_id
      AND q.lifecycle_state = 'pending'
      AND q.batch_id IS DISTINCT FROM p_batch_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'pending_conflict');
  END IF;

  -- Failed/released history is never silently reused; always insert a new row.
  INSERT INTO public.qa_identity_quarantines (
    profile_id,
    auth_user_id,
    venue_id,
    batch_id,
    source_operation,
    allowlist_sha256,
    snapshot_sha256,
    lifecycle_state,
    auth_ban_state,
    reason,
    created_by,
    lifecycle_version,
    original_profile_status,
    original_auth_banned,
    expected_email,
    allowlist_label,
    metadata,
    updated_at
  ) VALUES (
    p_profile_id,
    p_auth_user_id,
    v_profile.venue_id,
    p_batch_id,
    'OPERATION_B1B',
    v_hash_allow,
    v_hash_snap,
    'pending',
    'pending',
    v_reason,
    v_actor,
    1,
    p_original_profile_status,
    p_original_auth_banned,
    v_email_norm,
    v_label,
    v_meta,
    now()
  )
  RETURNING * INTO v_new;

  PERFORM public.qa_quarantine_write_audit(
    'qa_quarantine.prepare',
    v_new.id,
    v_new.profile_id,
    v_new.batch_id,
    NULL,
    NULL,
    v_new.lifecycle_state,
    v_new.auth_ban_state,
    v_new.lifecycle_version,
    'prepared',
    jsonb_build_object('allowlist_label', v_new.allowlist_label)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'prepared',
    'quarantine_id', v_new.id,
    'lifecycle_state', v_new.lifecycle_state,
    'auth_ban_state', v_new.auth_ban_state,
    'lifecycle_version', v_new.lifecycle_version
  );
END;
$$;

COMMENT ON FUNCTION public.qa_quarantine_prepare(uuid, uuid, uuid, text, text, text, text, boolean, text, text, jsonb) IS
  'OPERATION_B1B WP2: create pending/pending quarantine authority only. No Auth ban. No profiles.status mutation. source_operation fixed to OPERATION_B1B.';

-- -----------------------------------------------------------------------------
-- 2) qa_quarantine_activate_after_auth_ban
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_quarantine_activate_after_auth_ban(
  p_quarantine_id uuid,
  p_expected_lifecycle_version integer,
  p_auth_ban_readback_confirmed boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_row public.qa_identity_quarantines%ROWTYPE;
  v_prev_lifecycle text;
  v_prev_auth text;
BEGIN
  IF NOT public.qa_quarantine_is_authorized_caller() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  IF p_quarantine_id IS NULL OR p_expected_lifecycle_version IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;

  IF coalesce(p_auth_ban_readback_confirmed, false) IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'code', 'auth_ban_readback_required');
  END IF;

  SELECT * INTO v_row
  FROM public.qa_identity_quarantines q
  WHERE q.id = p_quarantine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF v_row.lifecycle_version IS DISTINCT FROM p_expected_lifecycle_version THEN
    RETURN jsonb_build_object('ok', false, 'code', 'version_mismatch');
  END IF;

  IF v_row.lifecycle_state IS DISTINCT FROM 'pending'
     OR v_row.auth_ban_state IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'state_mismatch');
  END IF;

  IF v_row.original_auth_banned IS NOT FALSE THEN
    RETURN jsonb_build_object('ok', false, 'code', 'original_auth_banned_must_be_false');
  END IF;

  v_prev_lifecycle := v_row.lifecycle_state;
  v_prev_auth := v_row.auth_ban_state;

  UPDATE public.qa_identity_quarantines q
  SET
    lifecycle_state = 'active',
    auth_ban_state = 'applied',
    activated_at = now(),
    lifecycle_version = q.lifecycle_version + 1,
    updated_at = now()
  WHERE q.id = p_quarantine_id
  RETURNING * INTO v_row;

  PERFORM public.qa_quarantine_write_audit(
    'qa_quarantine.activate_after_auth_ban',
    v_row.id,
    v_row.profile_id,
    v_row.batch_id,
    v_prev_lifecycle,
    v_prev_auth,
    v_row.lifecycle_state,
    v_row.auth_ban_state,
    v_row.lifecycle_version,
    'activated_after_auth_ban',
    '{}'::jsonb
  );

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'activated_after_auth_ban',
    'quarantine_id', v_row.id,
    'lifecycle_state', v_row.lifecycle_state,
    'auth_ban_state', v_row.auth_ban_state,
    'lifecycle_version', v_row.lifecycle_version
  );
END;
$$;

COMMENT ON FUNCTION public.qa_quarantine_activate_after_auth_ban(uuid, integer, boolean) IS
  'OPERATION_B1B WP2: pending/pending → active/applied after independent Auth ban readback. Does not call Auth Admin API.';

-- -----------------------------------------------------------------------------
-- 3) qa_quarantine_activate_preexisting_ban
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_quarantine_activate_preexisting_ban(
  p_quarantine_id uuid,
  p_expected_lifecycle_version integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_row public.qa_identity_quarantines%ROWTYPE;
  v_prev_lifecycle text;
  v_prev_auth text;
BEGIN
  IF NOT public.qa_quarantine_is_authorized_caller() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  IF p_quarantine_id IS NULL OR p_expected_lifecycle_version IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;

  SELECT * INTO v_row
  FROM public.qa_identity_quarantines q
  WHERE q.id = p_quarantine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF v_row.lifecycle_version IS DISTINCT FROM p_expected_lifecycle_version THEN
    RETURN jsonb_build_object('ok', false, 'code', 'version_mismatch');
  END IF;

  IF v_row.lifecycle_state IS DISTINCT FROM 'pending'
     OR v_row.auth_ban_state IS DISTINCT FROM 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'state_mismatch');
  END IF;

  IF v_row.original_auth_banned IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'code', 'original_auth_banned_must_be_true');
  END IF;

  v_prev_lifecycle := v_row.lifecycle_state;
  v_prev_auth := v_row.auth_ban_state;

  UPDATE public.qa_identity_quarantines q
  SET
    lifecycle_state = 'active',
    auth_ban_state = 'not_required_preexisting',
    activated_at = now(),
    lifecycle_version = q.lifecycle_version + 1,
    updated_at = now()
  WHERE q.id = p_quarantine_id
  RETURNING * INTO v_row;

  PERFORM public.qa_quarantine_write_audit(
    'qa_quarantine.activate_preexisting_ban',
    v_row.id,
    v_row.profile_id,
    v_row.batch_id,
    v_prev_lifecycle,
    v_prev_auth,
    v_row.lifecycle_state,
    v_row.auth_ban_state,
    v_row.lifecycle_version,
    'activated_preexisting_ban',
    jsonb_build_object('preexisting_ban_claimed_by_operation_b1b', false)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'activated_preexisting_ban',
    'quarantine_id', v_row.id,
    'lifecycle_state', v_row.lifecycle_state,
    'auth_ban_state', v_row.auth_ban_state,
    'lifecycle_version', v_row.lifecycle_version
  );
END;
$$;

COMMENT ON FUNCTION public.qa_quarantine_activate_preexisting_ban(uuid, integer) IS
  'OPERATION_B1B WP2: pending/pending → active/not_required_preexisting when original_auth_banned=true. Does not claim B1B applied the ban.';

-- -----------------------------------------------------------------------------
-- 4) qa_quarantine_record_compensated_failure
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_quarantine_record_compensated_failure(
  p_quarantine_id uuid,
  p_expected_lifecycle_version integer,
  p_target_auth_ban_state text,
  p_failure_classification text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_row public.qa_identity_quarantines%ROWTYPE;
  v_prev_lifecycle text;
  v_prev_auth text;
  v_target_auth text;
  v_class text;
BEGIN
  IF NOT public.qa_quarantine_is_authorized_caller() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  IF p_quarantine_id IS NULL OR p_expected_lifecycle_version IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;

  v_target_auth := lower(trim(coalesce(p_target_auth_ban_state, '')));
  IF v_target_auth NOT IN ('failed', 'reverted') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_target_auth_ban_state');
  END IF;

  v_class := lower(trim(coalesce(p_failure_classification, '')));
  IF v_class NOT IN (
    'auth_ban_failed',
    'activation_failed_compensated',
    'compensation_incomplete',
    'prepare_failure_recorded'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_failure_classification');
  END IF;

  SELECT * INTO v_row
  FROM public.qa_identity_quarantines q
  WHERE q.id = p_quarantine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF v_row.lifecycle_version IS DISTINCT FROM p_expected_lifecycle_version THEN
    RETURN jsonb_build_object('ok', false, 'code', 'version_mismatch');
  END IF;

  IF v_row.lifecycle_state IN ('active', 'released') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'state_mismatch');
  END IF;

  IF v_target_auth = 'reverted' AND v_row.original_auth_banned IS NOT FALSE THEN
    RETURN jsonb_build_object('ok', false, 'code', 'reverted_requires_original_unbanned');
  END IF;

  v_prev_lifecycle := v_row.lifecycle_state;
  v_prev_auth := v_row.auth_ban_state;

  UPDATE public.qa_identity_quarantines q
  SET
    lifecycle_state = 'failed',
    auth_ban_state = v_target_auth,
    failure_classification = v_class,
    lifecycle_version = q.lifecycle_version + 1,
    updated_at = now()
  WHERE q.id = p_quarantine_id
  RETURNING * INTO v_row;

  PERFORM public.qa_quarantine_write_audit(
    'qa_quarantine.compensated_failure',
    v_row.id,
    v_row.profile_id,
    v_row.batch_id,
    v_prev_lifecycle,
    v_prev_auth,
    v_row.lifecycle_state,
    v_row.auth_ban_state,
    v_row.lifecycle_version,
    'compensated_failure',
    jsonb_build_object('failure_classification', v_row.failure_classification)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'compensated_failure',
    'quarantine_id', v_row.id,
    'lifecycle_state', v_row.lifecycle_state,
    'auth_ban_state', v_row.auth_ban_state,
    'lifecycle_version', v_row.lifecycle_version,
    'failure_classification', v_row.failure_classification
  );
END;
$$;

COMMENT ON FUNCTION public.qa_quarantine_record_compensated_failure(uuid, integer, text, text) IS
  'OPERATION_B1B WP2: record Boundary 2/3 failure as lifecycle_state=failed with auth_ban_state failed|reverted. No lifecycle_state=reverted.';

-- -----------------------------------------------------------------------------
-- 5) qa_quarantine_release
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_quarantine_release(
  p_quarantine_id uuid,
  p_expected_lifecycle_version integer,
  p_release_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_row public.qa_identity_quarantines%ROWTYPE;
  v_prev_lifecycle text;
  v_prev_auth text;
  v_reason text;
  v_actor text;
  v_should_unban boolean;
BEGIN
  IF NOT public.qa_quarantine_is_authorized_caller() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  v_actor := public.qa_quarantine_actor_text();
  IF v_actor IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'ambiguous_actor');
  END IF;

  IF p_quarantine_id IS NULL OR p_expected_lifecycle_version IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;

  v_reason := trim(coalesce(p_release_reason, ''));
  IF length(v_reason) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'release_reason_required');
  END IF;

  SELECT * INTO v_row
  FROM public.qa_identity_quarantines q
  WHERE q.id = p_quarantine_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  IF v_row.lifecycle_version IS DISTINCT FROM p_expected_lifecycle_version THEN
    RETURN jsonb_build_object('ok', false, 'code', 'version_mismatch');
  END IF;

  IF v_row.lifecycle_state IS DISTINCT FROM 'active' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'state_mismatch');
  END IF;

  IF v_row.auth_ban_state NOT IN ('applied', 'not_required_preexisting') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'auth_state_mismatch');
  END IF;

  v_prev_lifecycle := v_row.lifecycle_state;
  v_prev_auth := v_row.auth_ban_state;
  v_should_unban := (
    v_row.auth_ban_state = 'applied'
    AND v_row.original_auth_banned IS FALSE
  );

  UPDATE public.qa_identity_quarantines q
  SET
    lifecycle_state = 'released',
    released_at = now(),
    released_by = v_actor,
    release_reason = v_reason,
    lifecycle_version = q.lifecycle_version + 1,
    updated_at = now()
  WHERE q.id = p_quarantine_id
  RETURNING * INTO v_row;

  PERFORM public.qa_quarantine_write_audit(
    'qa_quarantine.release',
    v_row.id,
    v_row.profile_id,
    v_row.batch_id,
    v_prev_lifecycle,
    v_prev_auth,
    v_row.lifecycle_state,
    v_row.auth_ban_state,
    v_row.lifecycle_version,
    'released',
    jsonb_build_object('should_unban', v_should_unban)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'released',
    'quarantine_id', v_row.id,
    'lifecycle_state', v_row.lifecycle_state,
    'auth_ban_state', v_row.auth_ban_state,
    'lifecycle_version', v_row.lifecycle_version,
    'should_unban', v_should_unban
  );
END;
$$;

COMMENT ON FUNCTION public.qa_quarantine_release(uuid, integer, text) IS
  'OPERATION_B1B WP2: active → released. Does not Auth-unban. Returns should_unban = (applied AND NOT original_auth_banned).';

-- -----------------------------------------------------------------------------
-- 6) qa_quarantine_get_state — exact authority-state readback
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_quarantine_get_state(
  p_quarantine_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_row public.qa_identity_quarantines%ROWTYPE;
BEGIN
  IF NOT public.qa_quarantine_is_authorized_caller() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  IF p_quarantine_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_input');
  END IF;

  SELECT * INTO v_row
  FROM public.qa_identity_quarantines q
  WHERE q.id = p_quarantine_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'state',
    'id', v_row.id,
    'profile_id', v_row.profile_id,
    'batch_id', v_row.batch_id,
    'lifecycle_state', v_row.lifecycle_state,
    'auth_ban_state', v_row.auth_ban_state,
    'lifecycle_version', v_row.lifecycle_version,
    'original_auth_banned', v_row.original_auth_banned,
    'activated_at', v_row.activated_at,
    'released_at', v_row.released_at,
    'failure_classification', v_row.failure_classification
  );
END;
$$;

COMMENT ON FUNCTION public.qa_quarantine_get_state(uuid) IS
  'OPERATION_B1B WP2: SUPER_ADMIN/service-role state readback. Does not expose expected_email or artifact hashes.';

-- -----------------------------------------------------------------------------
-- 7) qa_quarantine_list_active — sole canonical set-based active read
-- Canonical name resolution: qa_quarantine_list_active
-- Forbidden alias: qa_quarantine_list_active_batched (must not exist)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qa_quarantine_list_active(
  p_profile_ids uuid[]
)
RETURNS TABLE (
  profile_id uuid,
  auth_user_id uuid,
  venue_id text,
  batch_id uuid,
  auth_ban_state text,
  activated_at timestamptz,
  allowlist_label text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_ids uuid[];
  v_count integer;
  c_max_ids constant integer := 500;
BEGIN
  IF NOT public.qa_quarantine_is_authorized_caller() THEN
    RAISE EXCEPTION 'QA_QUARANTINE_FORBIDDEN'
      USING ERRCODE = 'P0001',
            DETAIL = 'SUPER_ADMIN or service_role required';
  END IF;

  IF p_profile_ids IS NULL THEN
    RAISE EXCEPTION 'QA_QUARANTINE_INVALID_INPUT'
      USING ERRCODE = 'P0001',
            DETAIL = 'profile_ids array must not be null';
  END IF;

  SELECT ARRAY(
    SELECT DISTINCT x
    FROM unnest(p_profile_ids) AS t(x)
    WHERE x IS NOT NULL
  )
  INTO v_ids;

  v_count := coalesce(cardinality(v_ids), 0);
  IF v_count > c_max_ids THEN
    RAISE EXCEPTION 'QA_QUARANTINE_INPUT_TOO_LARGE'
      USING ERRCODE = 'P0001',
            DETAIL = format('profile_ids max %s', c_max_ids);
  END IF;

  RETURN QUERY
  SELECT
    q.profile_id,
    q.auth_user_id,
    q.venue_id,
    q.batch_id,
    q.auth_ban_state,
    q.activated_at,
    q.allowlist_label
  FROM public.qa_identity_quarantines q
  WHERE q.lifecycle_state = 'active'
    AND q.auth_ban_state IN ('applied', 'not_required_preexisting')
    AND q.profile_id = ANY (v_ids);
END;
$$;

COMMENT ON FUNCTION public.qa_quarantine_list_active(uuid[]) IS
  'OPERATION_B1B WP2: sole canonical set-based active quarantine read. No qa_quarantine_list_active_batched alias. SUPER_ADMIN/service-role only.';

-- -----------------------------------------------------------------------------
-- EXECUTE grants (revoke PUBLIC first; anon never)
-- authenticated EXECUTE allowed only because bodies enforce SUPER_ADMIN/service-role
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.qa_quarantine_prepare(uuid, uuid, uuid, text, text, text, text, boolean, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_quarantine_prepare(uuid, uuid, uuid, text, text, text, text, boolean, text, text, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.qa_quarantine_prepare(uuid, uuid, uuid, text, text, text, text, boolean, text, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_quarantine_prepare(uuid, uuid, uuid, text, text, text, text, boolean, text, text, jsonb) TO service_role;

REVOKE ALL ON FUNCTION public.qa_quarantine_activate_after_auth_ban(uuid, integer, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_quarantine_activate_after_auth_ban(uuid, integer, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.qa_quarantine_activate_after_auth_ban(uuid, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_quarantine_activate_after_auth_ban(uuid, integer, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.qa_quarantine_activate_preexisting_ban(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_quarantine_activate_preexisting_ban(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.qa_quarantine_activate_preexisting_ban(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_quarantine_activate_preexisting_ban(uuid, integer) TO service_role;

REVOKE ALL ON FUNCTION public.qa_quarantine_record_compensated_failure(uuid, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_quarantine_record_compensated_failure(uuid, integer, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.qa_quarantine_record_compensated_failure(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_quarantine_record_compensated_failure(uuid, integer, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.qa_quarantine_release(uuid, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_quarantine_release(uuid, integer, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.qa_quarantine_release(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_quarantine_release(uuid, integer, text) TO service_role;

REVOKE ALL ON FUNCTION public.qa_quarantine_get_state(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_quarantine_get_state(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.qa_quarantine_get_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_quarantine_get_state(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.qa_quarantine_list_active(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_quarantine_list_active(uuid[]) FROM anon;
GRANT EXECUTE ON FUNCTION public.qa_quarantine_list_active(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qa_quarantine_list_active(uuid[]) TO service_role;

-- Final table posture reinforcement (no direct lifecycle DML grants)
REVOKE ALL ON TABLE public.qa_identity_quarantines FROM PUBLIC;
REVOKE ALL ON TABLE public.qa_identity_quarantines FROM anon;
REVOKE ALL ON TABLE public.qa_identity_quarantines FROM authenticated;
REVOKE ALL ON TABLE public.qa_identity_quarantines FROM service_role;
