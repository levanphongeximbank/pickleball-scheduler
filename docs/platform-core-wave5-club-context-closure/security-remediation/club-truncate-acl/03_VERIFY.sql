-- WAVE5_CLUB_TRUNCATE_ACL — VERIFY (read-only)
-- OWNER_SQL_EXECUTION_GO=NO until separate Owner GO.
-- Fail-closed if any of the 8 TRUNCATE combinations remains effective.

DO $$
DECLARE
  v_env text := current_setting('wave5.target_env', true);
  v_bad int := 0;
  r record;
BEGIN
  IF v_env IS NULL OR v_env NOT IN ('staging', 'production') THEN
    RAISE EXCEPTION 'WAVE5_CLUB_TRUNCATE_VERIFY_FAIL: wave5.target_env must be staging|production via reviewed wrapper (got %)',
      coalesce(v_env, '<NULL>');
  END IF;

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
    IF r.allowed THEN
      v_bad := v_bad + 1;
      RAISE NOTICE 'WAVE5_CLUB_TRUNCATE_VERIFY_FAIL_ROW table=% role=% truncate_allowed=YES',
        r.table_name, r.role_name;
    END IF;
  END LOOP;

  IF v_bad <> 0 THEN
    RAISE EXCEPTION 'WAVE5_CLUB_TRUNCATE_VERIFY_FAIL: % of 8 TRUNCATE privileges still effective',
      v_bad;
  END IF;

  RAISE NOTICE 'WAVE5_CLUB_TRUNCATE_VERIFY_OK env=% combinations=8 truncate=DENIED', v_env;
END $$;
