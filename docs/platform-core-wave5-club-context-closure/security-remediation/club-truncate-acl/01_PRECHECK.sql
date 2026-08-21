-- WAVE5_CLUB_TRUNCATE_ACL — PRECHECK (read-only)
-- OWNER_SQL_EXECUTION_GO=NO until separate Owner GO.
-- No mutation.

DO $$
DECLARE
  v_env text := current_setting('wave5.target_env', true);
  v_granted int := 0;
  v_denied int := 0;
  r record;
BEGIN
  IF v_env IS NULL OR v_env NOT IN ('staging', 'production') THEN
    RAISE EXCEPTION 'WAVE5_CLUB_TRUNCATE_PRECHECK_FAIL: wave5.target_env must be staging|production via reviewed wrapper (got %)',
      coalesce(v_env, '<NULL>');
  END IF;

  RAISE NOTICE 'WAVE5_CLUB_TRUNCATE_PRECHECK_ENV=%', v_env;

  FOR r IN
    SELECT t.table_name, role.role_name,
           has_table_privilege(role.role_name, format('public.%I', t.table_name), 'TRUNCATE') AS allowed
    FROM (VALUES
      ('clubs'),
      ('club_members'),
      ('club_governance_assignments'),
      ('club_membership_requests_v42')
    ) AS t(table_name)
    CROSS JOIN (VALUES ('anon'), ('authenticated')) AS role(role_name)
    ORDER BY 1, 2
  LOOP
    RAISE NOTICE 'WAVE5_CLUB_TRUNCATE_PRECHECK row table=% role=% truncate_allowed=%',
      r.table_name, r.role_name, r.allowed;
    IF r.allowed THEN
      v_granted := v_granted + 1;
    ELSE
      v_denied := v_denied + 1;
    END IF;
  END LOOP;

  IF v_granted + v_denied <> 8 THEN
    RAISE EXCEPTION 'WAVE5_CLUB_TRUNCATE_PRECHECK_FAIL: expected 8 combinations, got granted=% denied=%',
      v_granted, v_denied;
  END IF;

  RAISE NOTICE 'WAVE5_CLUB_TRUNCATE_PRECHECK_OK granted=% denied=% target=REMOVE_GRANTED_ONLY',
    v_granted, v_denied;
END $$;
