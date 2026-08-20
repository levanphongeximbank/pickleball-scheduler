-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
--
-- Post-VERIFY intended public command surface ONLY.
-- Run after 03_VERIFY canonical/body PASS and 03B VERIFIED.
-- Explicit signatures. Not a generic GRANT. Not 07C snapshot replay.
--
-- Intended post-cutover command surface (14 canonical):
--   authenticated EXECUTE = YES
--   anon EXECUTE = DENIED
--   PUBLIC EXECUTE = DENIED
--   service_role: not the PostgREST command path (no generic GRANT)
-- Internal helpers: authenticated/anon/PUBLIC EXECUTE = DENIED; service_role EXECUTE = YES
-- POST_CUTOVER_ACL_NORMALIZED=YES
-- AUTHENTICATED_GRANT_OPTION_DENIED=YES
-- Service role mutation entrypoints: reviewed intended state is DENIED (no generic GRANT).
-- After VERIFIED: restore exact captured pre-cutover service_role Club table DML from
-- wave5_cutover_table_privilege_snapshot (infrastructure capability, not Club domain authority).
-- SERVICE_ROLE_DIRECT_DML_IS_CLUB_DOMAIN_AUTHORITY=NO
-- RESTORE_FINAL_TABLE_DML_EQUALS_SNAPSHOT=YES
-- anon/authenticated Club table DML remain DENIED.
-- Legacy club_leave_my_membership():
--   CANONICAL_COMMAND_SURFACE=NO
--   POST_CANONICAL_RESTORE=NO
--   LEGACY_LEAVE_MY_POST_CUTOVER_STATE=QUIESCED_EXECUTE_DENIED
-- Rationale: not a canonical V2 command; app path is club_leave_membership(uuid, text).

BEGIN;

DO $$
DECLARE
  v_batch uuid;
  v_state text;
  v_updated int := 0;
BEGIN
  BEGIN
    v_batch := nullif(btrim(current_setting('wave5.cutover_batch_id', true)), '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: wave5.cutover_batch_id is not a uuid';
  END;
  IF v_batch IS NULL THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: explicit cutover_batch_id required';
  END IF;

  SELECT b.state INTO v_state
  FROM public.wave5_club_cutover_batch b
  WHERE b.batch_id = v_batch
    AND b.cutover_kind = 'WAVE5_CLUB_TENANT'
  FOR UPDATE;

  IF v_state IS DISTINCT FROM 'VERIFIED' THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: wrong state % — require VERIFIED',
      coalesce(v_state, '<missing>');
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.wave5_resolve_club_facility_venue_id(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.wave5_ensure_athlete_for_club_member(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wave5_resolve_club_facility_venue_id(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wave5_ensure_athlete_for_club_member(uuid, text, text) TO service_role;

REVOKE ALL ON FUNCTION public.platform_is_canonical_tenant_entitled(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_is_canonical_tenant_entitled(text) TO authenticated;

-- POST_CUTOVER_ACL_NORMALIZED=YES: REVOKE EXECUTE from PUBLIC/anon/authenticated
-- on exact canonical commands, then GRANT authenticated without GRANT OPTION.
REVOKE EXECUTE ON FUNCTION public.club_create(uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.club_update(uuid, text, integer, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.club_assign_owner(uuid, text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.club_clear_owner(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.club_transfer_president(uuid, text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.club_assign_vice_president(uuid, text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.club_clear_vice_president(uuid, text, integer, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.club_add_member(uuid, text, uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.club_remove_member(uuid, text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.club_restore_member(uuid, text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.club_leave_membership(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.club_submit_membership_request(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.club_cancel_membership_request(uuid, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.club_review_membership_request(uuid, uuid, text, text, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.club_create(uuid, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_update(uuid, text, integer, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_assign_owner(uuid, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_clear_owner(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_transfer_president(uuid, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_assign_vice_president(uuid, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_clear_vice_president(uuid, text, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_add_member(uuid, text, uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_remove_member(uuid, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_restore_member(uuid, text, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_leave_membership(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_submit_membership_request(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_cancel_membership_request(uuid, uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.club_review_membership_request(uuid, uuid, text, text, integer) TO authenticated;

DO $$
DECLARE
  v_sig text;
  v_oid regprocedure;
  v_ok int := 0;
  v_batch uuid;
  v_updated int := 0;
  r record;
  v_tbl_granted int := 0;
  v_tbl text;
  v_priv text;
BEGIN
  IF has_function_privilege(
       'authenticated',
       'public.wave5_ensure_athlete_for_club_member(uuid,text,text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: authenticated EXECUTE must stay DENIED on wave5_ensure_athlete_for_club_member';
  END IF;
  IF has_function_privilege(
       'authenticated',
       'public.wave5_resolve_club_facility_venue_id(text)',
       'EXECUTE'
     ) THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: authenticated EXECUTE must stay DENIED on wave5_resolve_club_facility_venue_id';
  END IF;

  FOREACH v_sig IN ARRAY ARRAY[
    -- WAVE5_CANONICAL_14_ARRAY_BEGIN
    'public.club_create(uuid,text,text,text,text,text)',
    'public.club_update(uuid,text,integer,text,text,text,text,text)',
    'public.club_assign_owner(uuid,text,uuid,integer)',
    'public.club_clear_owner(uuid,text,integer)',
    'public.club_transfer_president(uuid,text,uuid,integer)',
    'public.club_assign_vice_president(uuid,text,uuid,integer)',
    'public.club_clear_vice_president(uuid,text,integer,uuid)',
    'public.club_add_member(uuid,text,uuid,text,integer)',
    'public.club_remove_member(uuid,text,uuid,integer)',
    'public.club_restore_member(uuid,text,uuid,integer)',
    'public.club_leave_membership(uuid,text)',
    'public.club_submit_membership_request(uuid,text,text)',
    'public.club_cancel_membership_request(uuid,uuid,integer)',
    'public.club_review_membership_request(uuid,uuid,text,text,integer)'
    -- WAVE5_CANONICAL_14_ARRAY_END
  ]
  LOOP
    IF NOT has_function_privilege('authenticated', v_sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: authenticated EXECUTE missing on %', v_sig;
    END IF;
    IF has_function_privilege('anon', v_sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: anon EXECUTE must be DENIED on %', v_sig;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc p
      CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
      WHERE p.oid = v_sig::regprocedure
        AND acl.privilege_type = 'EXECUTE'
        AND acl.grantee = 0
    ) THEN
      RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: PUBLIC EXECUTE must be DENIED on %', v_sig;
    END IF;
    IF EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc p
      CROSS JOIN LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) AS acl
      JOIN pg_catalog.pg_roles r ON r.oid = acl.grantee
      WHERE p.oid = v_sig::regprocedure
        AND acl.privilege_type = 'EXECUTE'
        AND r.rolname = 'authenticated'
        AND acl.is_grantable
    ) THEN
      RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: AUTHENTICATED_GRANT_OPTION_DENIED=NO on %', v_sig;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'service_role')
       AND has_function_privilege('service_role', v_sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: service_role mutation EXECUTE is not in reviewed intended state for %',
        v_sig;
    END IF;
    v_ok := v_ok + 1;
  END LOOP;

  IF v_ok <> 14 THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: POST_CUTOVER_MUTATION_PRIVILEGE_VERIFY_COUNT expected 14, got %',
      v_ok;
  END IF;

  v_oid := to_regprocedure('public.club_leave_my_membership()');
  IF v_oid IS NOT NULL THEN
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC', v_oid);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon', v_oid);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM authenticated', v_oid);
    IF has_function_privilege('authenticated', v_oid, 'EXECUTE')
       OR has_function_privilege('anon', v_oid, 'EXECUTE') THEN
      RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: legacy club_leave_my_membership must stay QUIESCED_EXECUTE_DENIED';
    END IF;
  END IF;

  v_batch := nullif(btrim(current_setting('wave5.cutover_batch_id', true)), '')::uuid;

  -- Exact service_role Club table DML restore from Q0A snapshot (infrastructure only).
  IF EXISTS (
    SELECT 1
    FROM public.wave5_cutover_table_privilege_snapshot s
    WHERE s.batch_id = v_batch
      AND (
        s.grantee_name IS DISTINCT FROM 'service_role'
        OR s.schema_name IS DISTINCT FROM 'public'
        OR s.table_name NOT IN (
          'clubs',
          'club_members',
          'club_governance_assignments',
          'club_membership_requests_v42'
        )
        OR s.privilege_type NOT IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
      )
  ) THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: table privilege snapshot out of certified scope';
  END IF;

  FOR r IN
    SELECT s.schema_name, s.table_name, s.grantee_name, s.privilege_type, s.is_grantable
    FROM public.wave5_cutover_table_privilege_snapshot s
    WHERE s.batch_id = v_batch
      AND s.grantee_name = 'service_role'
      AND s.privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE')
  LOOP
    EXECUTE format(
      'GRANT %s ON TABLE %I.%I TO %I%s',
      r.privilege_type,
      r.schema_name,
      r.table_name,
      r.grantee_name,
      CASE WHEN r.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END
    );
    v_tbl_granted := v_tbl_granted + 1;
  END LOOP;

  FOREACH v_tbl IN ARRAY ARRAY[
    'clubs',
    'club_members',
    'club_governance_assignments',
    'club_membership_requests_v42'
  ]
  LOOP
    FOREACH v_priv IN ARRAY ARRAY['INSERT', 'UPDATE', 'DELETE', 'TRUNCATE']
    LOOP
      IF has_table_privilege('anon', format('public.%I', v_tbl), v_priv)
         OR has_table_privilege('authenticated', format('public.%I', v_tbl), v_priv) THEN
        RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: anon/authenticated Club table DML must remain DENIED on %.%',
          v_tbl, v_priv;
      END IF;
      IF has_table_privilege('service_role', format('public.%I', v_tbl), v_priv)
         IS DISTINCT FROM EXISTS (
           SELECT 1
           FROM public.wave5_cutover_table_privilege_snapshot s
           WHERE s.batch_id = v_batch
             AND s.schema_name = 'public'
             AND s.table_name = v_tbl
             AND s.grantee_name = 'service_role'
             AND s.privilege_type = v_priv
         ) THEN
        RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: RESTORE_FINAL_TABLE_DML_EQUALS_SNAPSHOT=NO on %.%',
          v_tbl, v_priv;
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.wave5_club_cutover_batch
  SET state = 'RESTORED',
      writes_restored_at = clock_timestamp()
  WHERE batch_id = v_batch
    AND state = 'VERIFIED';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 1 THEN
    RAISE EXCEPTION 'WAVE5_RESTORE_INTENDED_ABORT: VERIFIED → RESTORED failed';
  END IF;

  RAISE NOTICE 'WAVE5_RESTORE_INTENDED_WRITES_OK INTERNAL_HELPER_AUTHENTICATED_EXECUTE=DENIED POST_CUTOVER_ACL_NORMALIZED=YES AUTHENTICATED_GRANT_OPTION_DENIED=YES POST_CUTOVER_MUTATION_PRIVILEGE_VERIFY_COUNT=14 LEGACY_LEAVE_MY_POST_CUTOVER_STATE=QUIESCED_EXECUTE_DENIED RESTORE_FINAL_TABLE_DML_EQUALS_SNAPSHOT=YES replayed_table_dml_grants=% SERVICE_ROLE_DIRECT_DML_IS_CLUB_DOMAIN_AUTHORITY=NO',
    v_tbl_granted;
END $$;

COMMIT;
