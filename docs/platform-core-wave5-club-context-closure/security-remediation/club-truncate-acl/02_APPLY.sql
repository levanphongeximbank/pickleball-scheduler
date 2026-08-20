-- WAVE5_CLUB_TRUNCATE_ACL — APPLY
-- OWNER_SQL_EXECUTION_GO=NO until separate Owner GO.
-- AUTHORIZED_MUTATION=REVOKE TRUNCATE ONLY
-- AUTHORIZED_PRIVILEGE_EDGES=8
-- Revokes TRUNCATE only for anon/authenticated on the four Club tables.
-- Does not change INSERT/UPDATE/DELETE, RPC EXECUTE, or service_role.

BEGIN;

DO $$
DECLARE
  v_env text := current_setting('wave5.target_env', true);
BEGIN
  IF v_env IS NULL OR v_env NOT IN ('staging', 'production') THEN
    RAISE EXCEPTION 'WAVE5_CLUB_TRUNCATE_APPLY_ABORT: wave5.target_env must be staging|production via reviewed wrapper (got %)',
      coalesce(v_env, '<NULL>');
  END IF;

  RAISE NOTICE 'WAVE5_CLUB_TRUNCATE_APPLY_ENV=%', v_env;
END $$;

-- Exact 4 tables × 2 roles. No other privileges.
REVOKE TRUNCATE ON TABLE
  public.clubs,
  public.club_members,
  public.club_governance_assignments,
  public.club_membership_requests_v42
FROM anon, authenticated;

DO $$
BEGIN
  RAISE NOTICE 'WAVE5_CLUB_TRUNCATE_APPLY_OK privilege=TRUNCATE roles=anon,authenticated tables=4';
END $$;

COMMIT;
