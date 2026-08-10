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
-- Fail-closed preflight: WP1 authority must already exist with expected definitions
-- -----------------------------------------------------------------------------
DO $preflight$
DECLARE
  v_missing_cols text;
  v_has_auth_ban_applied boolean;
  v_def text;
  v_idxdef text;
  v_spec record;
  v_tg_oid oid;
  v_tg_enabled char;
  v_tg_type integer;
  v_tg_fn oid;
  v_tg_fn_name text;
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

  -- Constraint definition validation via pg_get_constraintdef (not name-only)
  FOR v_spec IN
    SELECT *
    FROM (
      VALUES
        (
          'qa_identity_quarantines_lifecycle_state_check',
          ARRAY['pending', 'active', 'released', 'failed']::text[],
          ARRAY['reverted']::text[]
        ),
        (
          'qa_identity_quarantines_auth_ban_state_check',
          ARRAY['pending', 'applied', 'not_required_preexisting', 'reverted', 'failed']::text[],
          ARRAY[]::text[]
        ),
        (
          'qa_identity_quarantines_identity_bind_check',
          ARRAY['profile_id', 'auth_user_id']::text[],
          ARRAY[]::text[]
        ),
        (
          'qa_identity_quarantines_active_success_check',
          ARRAY['active', 'applied', 'not_required_preexisting', 'activated_at']::text[],
          ARRAY[]::text[]
        ),
        (
          'qa_identity_quarantines_pending_auth_check',
          ARRAY['pending', 'activated_at', 'released_at']::text[],
          ARRAY[]::text[]
        ),
        (
          'qa_identity_quarantines_release_consistency_check',
          ARRAY['released', 'activated_at', 'released_at', 'released_by']::text[],
          ARRAY[]::text[]
        ),
        (
          'qa_identity_quarantines_reverted_failure_check',
          ARRAY['reverted', 'failed']::text[],
          ARRAY[]::text[]
        ),
        (
          'qa_identity_quarantines_failed_auth_not_active_check',
          ARRAY['failed', 'active']::text[],
          ARRAY[]::text[]
        )
    ) AS t(conname, required_tokens, forbidden_tokens)
  LOOP
    SELECT pg_get_constraintdef(c.oid)
    INTO v_def
    FROM pg_constraint c
    WHERE c.conname = v_spec.conname
      AND c.conrelid = 'public.qa_identity_quarantines'::regclass;

    IF v_def IS NULL THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: missing WP1 constraint %',
        v_spec.conname
        USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM unnest(v_spec.required_tokens) tok
      WHERE position(lower(tok) in lower(v_def)) = 0
    ) THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: incompatible constraint % definition: %',
        v_spec.conname, v_def
        USING ERRCODE = 'P0001';
    END IF;

    IF v_spec.conname = 'qa_identity_quarantines_identity_bind_check'
       AND v_def !~* 'profile_id\s*=\s*auth_user_id' THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: identity-bind definition mismatch: %',
        v_def
        USING ERRCODE = 'P0001';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM unnest(v_spec.forbidden_tokens) tok
      WHERE position('''' || lower(tok) || '''' in lower(v_def)) > 0
    ) THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: forbidden token in constraint %: %',
        v_spec.conname, v_def
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Index definition validation via pg_get_indexdef (not name-only)
  FOR v_spec IN
    SELECT *
    FROM (
      VALUES
        (
          'qa_identity_quarantines_active_profile_uidx',
          'profile_id',
          'lifecycle_state',
          'active'
        ),
        (
          'qa_identity_quarantines_active_auth_uidx',
          'auth_user_id',
          'lifecycle_state',
          'active'
        ),
        (
          'qa_identity_quarantines_pending_profile_batch_uidx',
          'profile_id',
          'lifecycle_state',
          'pending'
        )
    ) AS t(idxname, key_col, pred_col, pred_val)
  LOOP
    SELECT pg_get_indexdef(c.oid)
    INTO v_idxdef
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'i'
      AND c.relname = v_spec.idxname;

    IF v_idxdef IS NULL THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: missing WP1 index %',
        v_spec.idxname
        USING ERRCODE = 'P0001';
    END IF;

    IF v_idxdef !~* 'unique'
       OR position('qa_identity_quarantines' in lower(v_idxdef)) = 0
       OR position(lower(v_spec.key_col) in lower(v_idxdef)) = 0
       OR v_idxdef !~* (v_spec.pred_col || '\s*=\s*''' || v_spec.pred_val || '''')
    THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: incompatible index % definition: %',
        v_spec.idxname, v_idxdef
        USING ERRCODE = 'P0001';
    END IF;

    IF v_spec.idxname = 'qa_identity_quarantines_pending_profile_batch_uidx'
       AND position('batch_id' in lower(v_idxdef)) = 0 THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: pending index missing batch_id: %',
        v_idxdef
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

  -- Trigger definition validation: table, timing/event, function, enabled
  FOR v_spec IN
    SELECT *
    FROM (
      VALUES
        (
          'qa_identity_quarantines_immutable_fields_trg',
          'qa_identity_quarantines_immutable_fields_guard',
          'UPDATE'::text
        ),
        (
          'qa_identity_quarantines_deny_hard_delete_trg',
          'qa_identity_quarantines_deny_hard_delete',
          'DELETE'::text
        )
    ) AS t(tgname, fnname, evtype)
  LOOP
    SELECT t.oid, t.tgenabled, t.tgtype, t.tgfoid
    INTO v_tg_oid, v_tg_enabled, v_tg_type, v_tg_fn
    FROM pg_trigger t
    WHERE t.tgname = v_spec.tgname
      AND t.tgrelid = 'public.qa_identity_quarantines'::regclass
      AND NOT t.tgisinternal;

    IF v_tg_oid IS NULL THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: missing WP1 trigger %',
        v_spec.tgname
        USING ERRCODE = 'P0001';
    END IF;

    -- tgenabled: O = origin/enabled, A = always
    IF v_tg_enabled IS DISTINCT FROM 'O' AND v_tg_enabled IS DISTINCT FROM 'A' THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: trigger % is not enabled (tgenabled=%)',
        v_spec.tgname, v_tg_enabled
        USING ERRCODE = 'P0001';
    END IF;

    -- BEFORE row trigger bits: tgtype & 2 = before, & 1 = row
    IF (v_tg_type & 2) = 0 OR (v_tg_type & 1) = 0 THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: trigger % must be BEFORE ROW',
        v_spec.tgname
        USING ERRCODE = 'P0001';
    END IF;

    IF v_spec.evtype = 'UPDATE' AND (v_tg_type & 16) = 0 THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: trigger % must fire on UPDATE',
        v_spec.tgname
        USING ERRCODE = 'P0001';
    END IF;

    IF v_spec.evtype = 'DELETE' AND (v_tg_type & 8) = 0 THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: trigger % must fire on DELETE',
        v_spec.tgname
        USING ERRCODE = 'P0001';
    END IF;

    SELECT p.proname INTO v_tg_fn_name FROM pg_proc p WHERE p.oid = v_tg_fn;
    IF v_tg_fn_name IS DISTINCT FROM v_spec.fnname THEN
      RAISE EXCEPTION
        'QA_IDENTITY_QUARANTINE_AUTHORITY_PREFLIGHT: trigger % must invoke public.%()',
        v_spec.tgname, v_spec.fnname
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;

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
        'qa_quarantine_is_directory_filter_reader',
        'qa_quarantine_actor_text',
        'qa_quarantine_write_audit',
        'operation_b1b_database_environment',
        'operation_b1b_qa_label_email_contract_check',
        'operation_b1b_qa_label_email_contract_is_valid',
        'operation_b1b_validate_qa_prepare_contract',
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
      WHEN 'qa_quarantine_is_directory_filter_reader' THEN ''
      WHEN 'qa_quarantine_actor_text' THEN ''
      WHEN 'qa_quarantine_write_audit' THEN
        'p_action text, p_quarantine_id uuid, p_profile_id uuid, p_batch_id uuid, p_prev_lifecycle_state text, p_prev_auth_ban_state text, p_new_lifecycle_state text, p_new_auth_ban_state text, p_lifecycle_version integer, p_result_code text, p_extra jsonb'
      WHEN 'operation_b1b_database_environment' THEN
        ''
      WHEN 'operation_b1b_qa_label_email_contract_check' THEN
        'p_allowlist_label text, p_expected_email text'
      WHEN 'operation_b1b_qa_label_email_contract_is_valid' THEN
        'p_allowlist_label text, p_expected_email text'
      WHEN 'operation_b1b_validate_qa_prepare_contract' THEN
        'p_bindings jsonb'
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
-- Additive audit_logs_action_check whitelist
-- Canonical PHASE_1B pattern:
--   docs/v5/phase1b/PHASE_1B_AUDIT_WHITELIST_ADDITIVE.sql
-- Union of:
--   A) current non-empty DISTINCT audit_logs.action rows
--   B) complete known historical / Phase 1B defensive action set
--   C) five WP2 qa_quarantine.* actions
-- Never shrinks allowed actions that lack stored rows yet.
-- No audit row DML. Bounded IN-list only (not unrestricted).
-- -----------------------------------------------------------------------------
DO $audit_whitelist$
DECLARE
  v_list text;
  v_sql text;
BEGIN
  SELECT string_agg(quote_literal(a), ', ' ORDER BY a)
  INTO v_list
  FROM (
    -- A) Historical rows already on this database (must never be excluded)
    SELECT DISTINCT action AS a
    FROM public.audit_logs
    WHERE action IS NOT NULL
      AND length(trim(action)) > 0

    UNION

    -- B) Known identity / club / Phase 1B actions (may not yet exist as rows)
    SELECT unnest(ARRAY[
      -- Identity / admin (identity Phase B + client AUDIT_ACTIONS)
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
      -- Membership requests
      'club.membership_request.submit',
      'club.membership_request.review',
      'club.membership_request.correction',
      'club.membership_request.cancel',
      -- Member commands (Phase 45A.4C / 45A.4D / 1B)
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
      -- Common client audit strings observed in app code (defensive)
      'rating.verify',
      'rating.propose',
      'audit.view',
      'workflow.notification',
      'user.manage.denied',
      'user.manage.status-change',
      'payment_success',
      'approve'
    ]::text[])

    UNION

    -- C) WP2 QA quarantine lifecycle actions
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
  'OPERATION_B1B WP2: SUPER_ADMIN (is_super_admin) or service-role claim only. Lifecycle writers + privileged state readback.';

-- Directory-filter read path only (WP3 corrective): least-privilege read for platform
-- Players viewers. SYSTEM_TECHNICIAN may read active membership keys for filtering.
-- Does NOT grant lifecycle prepare/activate/release/compensate write authority.
CREATE OR REPLACE FUNCTION public.qa_quarantine_is_directory_filter_reader()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT
    public.is_super_admin()
    OR public.qa_quarantine_is_service_role()
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND upper(trim(coalesce(p.role, ''))) = 'SYSTEM_TECHNICIAN'
    );
$$;

COMMENT ON FUNCTION public.qa_quarantine_is_directory_filter_reader() IS
  'OPERATION_B1B WP3 corrective: read-only directory filter authz for SUPER_ADMIN/service_role/SYSTEM_TECHNICIAN. No write privileges.';

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

-- -----------------------------------------------------------------------------
-- Option C corrective: trusted DB environment binding schema (no seed here).
-- Environment-specific seed is ONLY via:
--   21_OPERATION_B1B_ENVIRONMENT_BINDING_STAGING.sql
--   22_OPERATION_B1B_ENVIRONMENT_BINDING_PRODUCTION.sql
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.operation_b1b_environment_binding (
  singleton_key smallint PRIMARY KEY CHECK (singleton_key = 1),
  operation_target_mode text NOT NULL,
  project_ref text NOT NULL,
  installed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT operation_b1b_environment_binding_pair_check CHECK (
    (
      operation_target_mode = 'production'
      AND project_ref = 'expuvcohlcjzvrrauvud'
    )
    OR (
      operation_target_mode = 'staging_rehearsal'
      AND project_ref = 'qyewbxjsiiyufanzcjcq'
    )
  )
);

COMMENT ON TABLE public.operation_b1b_environment_binding IS
  'OPERATION_B1B: singleton trusted DB environment binding. Runtime-immutable; install via explicit SQL artifacts only.';

REVOKE ALL ON TABLE public.operation_b1b_environment_binding FROM PUBLIC;
REVOKE ALL ON TABLE public.operation_b1b_environment_binding FROM anon;
REVOKE ALL ON TABLE public.operation_b1b_environment_binding FROM authenticated;
REVOKE ALL ON TABLE public.operation_b1b_environment_binding FROM service_role;

CREATE OR REPLACE FUNCTION public.operation_b1b_database_environment()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
  v_mode text;
  v_ref text;
BEGIN
  SELECT count(*)::integer INTO v_count
  FROM public.operation_b1b_environment_binding;

  IF v_count = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'database_environment_unbound');
  END IF;

  IF v_count <> 1 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'database_environment_ambiguous');
  END IF;

  SELECT operation_target_mode, project_ref
    INTO v_mode, v_ref
  FROM public.operation_b1b_environment_binding
  WHERE singleton_key = 1;

  IF v_mode IS NULL OR v_ref IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'database_environment_unbound');
  END IF;

  IF NOT (
    (v_mode = 'production' AND v_ref = 'expuvcohlcjzvrrauvud')
    OR (v_mode = 'staging_rehearsal' AND v_ref = 'qyewbxjsiiyufanzcjcq')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'database_environment_invalid_pair');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'database_environment_bound',
    'operation_target_mode', v_mode,
    'project_ref', v_ref,
    'environment', v_mode
  );
END;
$$;

COMMENT ON FUNCTION public.operation_b1b_database_environment() IS
  'OPERATION_B1B: read trusted singleton DB environment binding. Fail-closed. No caller mode override.';

REVOKE ALL ON FUNCTION public.operation_b1b_database_environment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operation_b1b_database_environment() FROM anon;
REVOKE ALL ON FUNCTION public.operation_b1b_database_environment() FROM authenticated;
REVOKE ALL ON FUNCTION public.operation_b1b_database_environment() FROM service_role;

-- -----------------------------------------------------------------------------
-- Option C: shared exact-eight label ↔ certified-email contract
-- Bound to trusted DB environment (not caller-supplied mode).
-- Production DB: QA-04..QA-11 only. Staging DB: STG-QA-04..STG-QA-11 only.
-- No broad QA-*/STG-QA-* regex acceptance.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.operation_b1b_qa_label_email_contract_check(
  p_allowlist_label text,
  p_expected_email text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_label text;
  v_email text;
  v_db jsonb;
  v_mode text;
  v_ref text;
  v_prod_label boolean := false;
  v_stg_label boolean := false;
  v_prod_email boolean := false;
  v_stg_email boolean := false;
BEGIN
  v_db := public.operation_b1b_database_environment();
  IF coalesce((v_db->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', coalesce(nullif(v_db->>'code', ''), 'database_environment_unbound')
    );
  END IF;

  v_mode := v_db->>'operation_target_mode';
  v_ref := v_db->>'project_ref';

  v_label := upper(trim(coalesce(p_allowlist_label, '')));
  v_email := lower(trim(coalesce(p_expected_email, '')));

  IF length(v_label) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_allowlist_label');
  END IF;

  IF length(v_email) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'expected_email_required');
  END IF;

  IF v_email = 'phase1b-smith@gmail.com' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden_real_user_email');
  END IF;

  v_prod_label := v_label IN (
    'QA-04', 'QA-05', 'QA-06', 'QA-07',
    'QA-08', 'QA-09', 'QA-10', 'QA-11'
  );
  v_stg_label := v_label IN (
    'STG-QA-04', 'STG-QA-05', 'STG-QA-06', 'STG-QA-07',
    'STG-QA-08', 'STG-QA-09', 'STG-QA-10', 'STG-QA-11'
  );

  -- Exact Staging fixture family (mirrors JS isCertifiedQaEmail + staging allowlist).
  v_stg_email := (v_email ~ '^phase1c\.stg\.[^@]+@staging-qa\.local$');

  -- Exact Production fixture families (never @staging-qa.local).
  v_prod_email := (
       v_email ~ '^phase1c\.prod\.[^@]+@prod-qa\.local$'
    OR v_email ~ '^phase1b-[^@]+@pickleball-scheduler\.qa$'
    OR v_email ~ '^qa42l-prod[^@]*@pickleball-scheduler\.qa$'
  );

  IF v_mode = 'production' THEN
    IF v_stg_label THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'staging_label_rejected_on_production_db',
        'operation_target_mode', v_mode,
        'project_ref', v_ref
      );
    END IF;
    IF NOT v_prod_label THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invalid_allowlist_label');
    END IF;
    IF NOT v_prod_email THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invalid_label_email_contract');
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'code', 'valid',
      'environment', v_mode,
      'operation_target_mode', v_mode,
      'project_ref', v_ref
    );
  END IF;

  IF v_mode = 'staging_rehearsal' THEN
    IF v_prod_label THEN
      RETURN jsonb_build_object(
        'ok', false,
        'code', 'production_label_rejected_on_staging_db',
        'operation_target_mode', v_mode,
        'project_ref', v_ref
      );
    END IF;
    IF NOT v_stg_label THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invalid_allowlist_label');
    END IF;
    IF NOT v_stg_email THEN
      RETURN jsonb_build_object('ok', false, 'code', 'invalid_label_email_contract');
    END IF;
    RETURN jsonb_build_object(
      'ok', true,
      'code', 'valid',
      'environment', v_mode,
      'operation_target_mode', v_mode,
      'project_ref', v_ref
    );
  END IF;

  RETURN jsonb_build_object('ok', false, 'code', 'database_environment_invalid_pair');
END;
$$;

COMMENT ON FUNCTION public.operation_b1b_qa_label_email_contract_check(text, text) IS
  'OPERATION_B1B Option C: exact-eight label/email contract bound to trusted DB environment. Production DB rejects STG-QA-*; Staging DB rejects QA-*.';

CREATE OR REPLACE FUNCTION public.operation_b1b_qa_label_email_contract_is_valid(
  p_allowlist_label text,
  p_expected_email text
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    (
      public.operation_b1b_qa_label_email_contract_check(
        p_allowlist_label,
        p_expected_email
      )->>'ok'
    )::boolean,
    false
  );
$$;

COMMENT ON FUNCTION public.operation_b1b_qa_label_email_contract_is_valid(text, text) IS
  'OPERATION_B1B Option C: boolean wrapper over shared DB-env-bound label/email contract check.';

REVOKE ALL ON FUNCTION public.qa_quarantine_is_service_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_quarantine_is_service_role() FROM anon;
REVOKE ALL ON FUNCTION public.qa_quarantine_is_service_role() FROM authenticated;

REVOKE ALL ON FUNCTION public.qa_quarantine_is_authorized_caller() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_quarantine_is_authorized_caller() FROM anon;
REVOKE ALL ON FUNCTION public.qa_quarantine_is_authorized_caller() FROM authenticated;

REVOKE ALL ON FUNCTION public.qa_quarantine_is_directory_filter_reader() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_quarantine_is_directory_filter_reader() FROM anon;
REVOKE ALL ON FUNCTION public.qa_quarantine_is_directory_filter_reader() FROM authenticated;

REVOKE ALL ON FUNCTION public.qa_quarantine_actor_text() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_quarantine_actor_text() FROM anon;
REVOKE ALL ON FUNCTION public.qa_quarantine_actor_text() FROM authenticated;

REVOKE ALL ON FUNCTION public.qa_quarantine_write_audit(text, uuid, uuid, uuid, text, text, text, text, integer, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.qa_quarantine_write_audit(text, uuid, uuid, uuid, text, text, text, text, integer, text, jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.qa_quarantine_write_audit(text, uuid, uuid, uuid, text, text, text, text, integer, text, jsonb) FROM authenticated;

REVOKE ALL ON FUNCTION public.operation_b1b_database_environment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operation_b1b_database_environment() FROM anon;
REVOKE ALL ON FUNCTION public.operation_b1b_database_environment() FROM authenticated;

REVOKE ALL ON FUNCTION public.operation_b1b_qa_label_email_contract_check(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operation_b1b_qa_label_email_contract_check(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.operation_b1b_qa_label_email_contract_check(text, text) FROM authenticated;

REVOKE ALL ON FUNCTION public.operation_b1b_qa_label_email_contract_is_valid(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operation_b1b_qa_label_email_contract_is_valid(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.operation_b1b_qa_label_email_contract_is_valid(text, text) FROM authenticated;

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
  v_conflict public.qa_identity_quarantines%ROWTYPE;
  v_constraint text;
  v_bindings_match boolean;
  v_contract jsonb;
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

  -- Executable retired-batch denial (Operation B1 batch permanently non-reusable)
  IF p_batch_id = 'b37186cf-e620-4f27-aba3-d7e8750ae7df'::uuid THEN
    RETURN jsonb_build_object('ok', false, 'code', 'retired_batch_forbidden');
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
  v_email_norm := lower(trim(coalesce(p_expected_email, '')));
  IF length(v_email_norm) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'expected_email_required');
  END IF;

  -- Option C: shared exact-eight label/email contract (Production QA-* vs Staging STG-QA-*).
  v_contract := public.operation_b1b_qa_label_email_contract_check(v_label, v_email_norm);
  IF coalesce((v_contract->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', coalesce(nullif(v_contract->>'code', ''), 'invalid_label_email_contract')
    );
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
  BEGIN
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
  EXCEPTION
    WHEN unique_violation THEN
      GET STACKED DIAGNOSTICS v_constraint = CONSTRAINT_NAME;
      IF coalesce(nullif(trim(v_constraint), ''), '') = '' THEN
        v_constraint := coalesce(
          (regexp_match(SQLERRM, '"(qa_identity_quarantines_[a-z0-9_]+)"'))[1],
          ''
        );
      END IF;

      IF v_constraint NOT IN (
        'qa_identity_quarantines_active_profile_uidx',
        'qa_identity_quarantines_active_auth_uidx',
        'qa_identity_quarantines_pending_profile_batch_uidx'
      ) THEN
        RAISE;
      END IF;

      -- Re-read authority after expected live-authority uniqueness race.
      SELECT * INTO v_conflict
      FROM public.qa_identity_quarantines q
      WHERE q.profile_id = p_profile_id
        AND q.lifecycle_state = 'active'
      FOR UPDATE;

      IF FOUND THEN
        v_bindings_match := (
          v_conflict.profile_id IS NOT DISTINCT FROM p_profile_id
          AND v_conflict.auth_user_id IS NOT DISTINCT FROM p_auth_user_id
          AND v_conflict.batch_id IS NOT DISTINCT FROM p_batch_id
          AND v_conflict.source_operation IS NOT DISTINCT FROM 'OPERATION_B1B'
          AND v_conflict.allowlist_sha256 IS NOT DISTINCT FROM v_hash_allow
          AND v_conflict.snapshot_sha256 IS NOT DISTINCT FROM v_hash_snap
          AND v_conflict.reason IS NOT DISTINCT FROM v_reason
          AND v_conflict.original_profile_status IS NOT DISTINCT FROM p_original_profile_status
          AND v_conflict.original_auth_banned IS NOT DISTINCT FROM p_original_auth_banned
          AND lower(trim(v_conflict.expected_email)) IS NOT DISTINCT FROM v_email_norm
          AND upper(trim(coalesce(v_conflict.allowlist_label, ''))) IS NOT DISTINCT FROM v_label
          AND v_conflict.venue_id IS NOT DISTINCT FROM v_profile.venue_id
        );

        IF v_bindings_match
           AND v_conflict.auth_ban_state IN ('applied', 'not_required_preexisting') THEN
          -- Idempotent race win by peer; no duplicate prepare audit.
          RETURN jsonb_build_object(
            'ok', true,
            'code', 'already_quarantined',
            'quarantine_id', v_conflict.id,
            'lifecycle_state', v_conflict.lifecycle_state,
            'auth_ban_state', v_conflict.auth_ban_state,
            'lifecycle_version', v_conflict.lifecycle_version
          );
        END IF;

        IF v_conflict.batch_id IS DISTINCT FROM p_batch_id THEN
          RETURN jsonb_build_object('ok', false, 'code', 'active_other_batch');
        END IF;

        RETURN jsonb_build_object('ok', false, 'code', 'prepare_conflict');
      END IF;

      SELECT * INTO v_conflict
      FROM public.qa_identity_quarantines q
      WHERE q.profile_id = p_profile_id
        AND q.batch_id = p_batch_id
        AND q.lifecycle_state = 'pending'
      FOR UPDATE;

      IF FOUND THEN
        v_bindings_match := (
          v_conflict.profile_id IS NOT DISTINCT FROM p_profile_id
          AND v_conflict.auth_user_id IS NOT DISTINCT FROM p_auth_user_id
          AND v_conflict.batch_id IS NOT DISTINCT FROM p_batch_id
          AND v_conflict.source_operation IS NOT DISTINCT FROM 'OPERATION_B1B'
          AND v_conflict.allowlist_sha256 IS NOT DISTINCT FROM v_hash_allow
          AND v_conflict.snapshot_sha256 IS NOT DISTINCT FROM v_hash_snap
          AND v_conflict.reason IS NOT DISTINCT FROM v_reason
          AND v_conflict.original_profile_status IS NOT DISTINCT FROM p_original_profile_status
          AND v_conflict.original_auth_banned IS NOT DISTINCT FROM p_original_auth_banned
          AND lower(trim(v_conflict.expected_email)) IS NOT DISTINCT FROM v_email_norm
          AND upper(trim(coalesce(v_conflict.allowlist_label, ''))) IS NOT DISTINCT FROM v_label
          AND v_conflict.venue_id IS NOT DISTINCT FROM v_profile.venue_id
        );

        IF v_bindings_match THEN
          -- Idempotent pending race; no duplicate prepare audit.
          RETURN jsonb_build_object(
            'ok', true,
            'code', 'prepare_idempotent',
            'quarantine_id', v_conflict.id,
            'lifecycle_state', v_conflict.lifecycle_state,
            'auth_ban_state', v_conflict.auth_ban_state,
            'lifecycle_version', v_conflict.lifecycle_version
          );
        END IF;

        RETURN jsonb_build_object('ok', false, 'code', 'pending_conflict');
      END IF;

      RETURN jsonb_build_object('ok', false, 'code', 'prepare_conflict');
  END;

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
  'OPERATION_B1B WP2/Option C: create pending/pending quarantine authority only. Accepts Production QA-04..11 or Staging STG-QA-04..11 only with matching certified email. No Auth ban. No profiles.status mutation. source_operation fixed to OPERATION_B1B.';

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
    'prepare_failure_recorded',
    'activation_failed_preexisting'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_failure_classification');
  END IF;

  -- Exact compensation classification matrix (fail closed; never silently rewrite)
  -- auth_ban_failed                 → failed
  -- activation_failed_compensated   → reverted
  -- compensation_incomplete         → failed  (never reverted)
  -- prepare_failure_recorded        → failed
  -- activation_failed_preexisting   → failed  (original_auth_banned=true only; no B1B Auth mutation)
  IF NOT (
    (v_class = 'auth_ban_failed' AND v_target_auth = 'failed')
    OR (v_class = 'activation_failed_compensated' AND v_target_auth = 'reverted')
    OR (v_class = 'compensation_incomplete' AND v_target_auth = 'failed')
    OR (v_class = 'prepare_failure_recorded' AND v_target_auth = 'failed')
    OR (v_class = 'activation_failed_preexisting' AND v_target_auth = 'failed')
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'invalid_compensation_pair');
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

  IF v_class = 'activation_failed_preexisting'
     AND v_row.original_auth_banned IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'preexisting_classification_requires_original_banned'
    );
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
  'OPERATION_B1B WP2: record Boundary 2/3 failure as lifecycle_state=failed. Exact matrix: auth_ban_failed→failed; activation_failed_compensated→reverted; compensation_incomplete→failed; prepare_failure_recorded→failed; activation_failed_preexisting→failed (original_auth_banned=true only). No lifecycle_state=reverted.';

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
-- Wire minimization (WP3 corrective): returns profile_id only for browser/directory filter.
-- AuthZ (WP3 corrective): directory-filter reader (SUPER_ADMIN / service_role / SYSTEM_TECHNICIAN).
-- Input bound raised so one Players page performs exactly one set-based RPC (no client chunking).
-- DROP first: PostgreSQL CREATE OR REPLACE cannot change RETURNS TABLE shape.
-- -----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.qa_quarantine_list_active(uuid[]);

CREATE OR REPLACE FUNCTION public.qa_quarantine_list_active(
  p_profile_ids uuid[]
)
RETURNS TABLE (
  profile_id uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_ids uuid[];
  v_count integer;
  -- Single set-based page lookup; client must not chunk (MAX queries/page = 1).
  c_max_ids constant integer := 10000;
BEGIN
  IF NOT public.qa_quarantine_is_directory_filter_reader() THEN
    RAISE EXCEPTION 'QA_QUARANTINE_FORBIDDEN'
      USING ERRCODE = 'P0001',
            DETAIL = 'SUPER_ADMIN, SYSTEM_TECHNICIAN, or service_role required for directory filter read';
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

  -- Same canonical authority table; minimized projection only.
  RETURN QUERY
  SELECT
    q.profile_id
  FROM public.qa_identity_quarantines q
  WHERE q.lifecycle_state = 'active'
    AND q.auth_ban_state IN ('applied', 'not_required_preexisting')
    AND q.profile_id = ANY (v_ids);
END;
$$;

COMMENT ON FUNCTION public.qa_quarantine_list_active(uuid[]) IS
  'OPERATION_B1B: sole canonical set-based active quarantine membership read (profile_id only). Directory-filter readers: SUPER_ADMIN/SYSTEM_TECHNICIAN/service_role. Writers remain SUPER_ADMIN/service_role only. No qa_quarantine_list_active_batched alias.';

-- -----------------------------------------------------------------------------
-- Option C: READ-ONLY preclaim label/email compatibility validator
-- No INSERT/UPDATE/DELETE/audit/Auth/quarantine prepare/durable claim.
-- service_role only. Uses the SAME contract predicate as qa_quarantine_prepare.
-- Returns trusted DB operation_target_mode + project_ref for runner match gate.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.operation_b1b_validate_qa_prepare_contract(
  p_bindings jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_item jsonb;
  v_idx integer := 0;
  v_label text;
  v_email text;
  v_check jsonb;
  v_failures jsonb := '[]'::jsonb;
  v_labels text[] := ARRAY[]::text[];
  v_db jsonb;
  v_mode text;
  v_ref text;
BEGIN
  IF NOT public.qa_quarantine_is_service_role() THEN
    RETURN jsonb_build_object('ok', false, 'code', 'forbidden');
  END IF;

  v_db := public.operation_b1b_database_environment();
  IF coalesce((v_db->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', coalesce(nullif(v_db->>'code', ''), 'database_environment_unbound')
    );
  END IF;
  v_mode := v_db->>'operation_target_mode';
  v_ref := v_db->>'project_ref';

  IF p_bindings IS NULL OR jsonb_typeof(p_bindings) <> 'array' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bindings_required');
  END IF;

  IF jsonb_array_length(p_bindings) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'bindings_empty');
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_bindings)
  LOOP
    v_idx := v_idx + 1;

    IF v_item IS NULL OR jsonb_typeof(v_item) <> 'object' THEN
      v_failures := v_failures || jsonb_build_array(
        jsonb_build_object('index', v_idx, 'code', 'binding_not_object')
      );
      CONTINUE;
    END IF;

    v_label := upper(trim(coalesce(v_item->>'allowlist_label', '')));
    v_email := lower(trim(coalesce(v_item->>'expected_email', '')));
    v_check := public.operation_b1b_qa_label_email_contract_check(v_label, v_email);

    IF coalesce((v_check->>'ok')::boolean, false) IS NOT TRUE THEN
      v_failures := v_failures || jsonb_build_array(
        jsonb_build_object(
          'index', v_idx,
          'allowlist_label', nullif(v_label, ''),
          'code', coalesce(nullif(v_check->>'code', ''), 'invalid_label_email_contract')
        )
      );
      CONTINUE;
    END IF;

    IF v_label = ANY (v_labels) THEN
      v_failures := v_failures || jsonb_build_array(
        jsonb_build_object(
          'index', v_idx,
          'allowlist_label', v_label,
          'code', 'duplicate_allowlist_label'
        )
      );
      CONTINUE;
    END IF;
    v_labels := array_append(v_labels, v_label);
  END LOOP;

  IF jsonb_array_length(v_failures) > 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'code', 'prepare_contract_incompatible',
      'checked', v_idx,
      'failures', v_failures,
      'operation_target_mode', v_mode,
      'project_ref', v_ref
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'code', 'prepare_contract_compatible',
    'checked', v_idx,
    'environment', v_mode,
    'operation_target_mode', v_mode,
    'project_ref', v_ref
  );
END;
$$;

COMMENT ON FUNCTION public.operation_b1b_validate_qa_prepare_contract(jsonb) IS
  'OPERATION_B1B Option C: read-only service_role preclaim validator against trusted DB environment + exact-eight label/email contract. No persistent mutations.';

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

-- Option C preclaim validator: service_role ONLY (no authenticated EXECUTE).
REVOKE ALL ON FUNCTION public.operation_b1b_validate_qa_prepare_contract(jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operation_b1b_validate_qa_prepare_contract(jsonb) FROM anon;
REVOKE ALL ON FUNCTION public.operation_b1b_validate_qa_prepare_contract(jsonb) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.operation_b1b_validate_qa_prepare_contract(jsonb) TO service_role;

-- Internal contract helpers remain non-client-callable (no EXECUTE grants).
REVOKE ALL ON FUNCTION public.operation_b1b_database_environment() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operation_b1b_database_environment() FROM anon;
REVOKE ALL ON FUNCTION public.operation_b1b_database_environment() FROM authenticated;
REVOKE ALL ON FUNCTION public.operation_b1b_qa_label_email_contract_check(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operation_b1b_qa_label_email_contract_check(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.operation_b1b_qa_label_email_contract_check(text, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.operation_b1b_qa_label_email_contract_is_valid(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.operation_b1b_qa_label_email_contract_is_valid(text, text) FROM anon;
REVOKE ALL ON FUNCTION public.operation_b1b_qa_label_email_contract_is_valid(text, text) FROM authenticated;

-- Final table posture reinforcement (no direct lifecycle DML grants)
REVOKE ALL ON TABLE public.qa_identity_quarantines FROM PUBLIC;
REVOKE ALL ON TABLE public.qa_identity_quarantines FROM anon;
REVOKE ALL ON TABLE public.qa_identity_quarantines FROM authenticated;
REVOKE ALL ON TABLE public.qa_identity_quarantines FROM service_role;

REVOKE ALL ON TABLE public.operation_b1b_environment_binding FROM PUBLIC;
REVOKE ALL ON TABLE public.operation_b1b_environment_binding FROM anon;
REVOKE ALL ON TABLE public.operation_b1b_environment_binding FROM authenticated;
REVOKE ALL ON TABLE public.operation_b1b_environment_binding FROM service_role;
