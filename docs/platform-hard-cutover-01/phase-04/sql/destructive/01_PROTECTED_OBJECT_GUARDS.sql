-- PLATFORM-HARD-CUTOVER-01 Phase 4 — Protected-object guards
-- Run BEFORE wipe. Abort wipe if any assertion fails.
-- NOT executed by this PR.

DO $$
DECLARE
  v_auth bigint;
  v_profiles bigint;
  v_venues bigint;
  v_tm bigint;
  v_roles bigint;
  v_perms bigint;
  v_rp bigint;
  v_plans bigint;
  v_limits bigint;
  v_catalog bigint;
BEGIN
  SELECT count(*) INTO v_auth FROM auth.users;
  IF v_auth < 1 THEN
    RAISE EXCEPTION 'HARD_CUTOVER_ABORT: auth.users empty';
  END IF;

  SELECT count(*) INTO v_profiles FROM public.profiles;
  IF v_profiles < 1 THEN
    RAISE EXCEPTION 'HARD_CUTOVER_ABORT: profiles empty';
  END IF;

  SELECT count(*) INTO v_venues FROM public.venues;
  IF v_venues < 1 THEN
    RAISE EXCEPTION 'HARD_CUTOVER_ABORT: venues (Owner tenant) missing';
  END IF;

  SELECT count(*) INTO v_tm FROM public.tenant_members;
  IF v_tm < 1 THEN
    RAISE EXCEPTION 'HARD_CUTOVER_ABORT: tenant_members missing Owner binding';
  END IF;

  SELECT count(*) INTO v_roles FROM public.roles;
  SELECT count(*) INTO v_perms FROM public.permissions;
  SELECT count(*) INTO v_rp FROM public.role_permissions;
  IF v_roles < 1 OR v_perms < 1 OR v_rp < 1 THEN
    RAISE EXCEPTION 'HARD_CUTOVER_ABORT: RBAC catalog incomplete';
  END IF;

  SELECT count(*) INTO v_plans FROM public.plans;
  SELECT count(*) INTO v_limits FROM public.plan_limits;
  IF v_plans < 1 OR v_limits < 1 THEN
    RAISE EXCEPTION 'HARD_CUTOVER_ABORT: billing plan catalog missing';
  END IF;

  SELECT count(*) INTO v_catalog
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname LIKE 'public_catalog_list_%';
  IF v_catalog < 4 THEN
    RAISE EXCEPTION 'HARD_CUTOVER_ABORT: public catalog RPCs incomplete (%)', v_catalog;
  END IF;

  RAISE NOTICE 'HARD_CUTOVER_PROTECTED_GUARDS_PASS auth=% profiles=% venues=% tm=%',
    v_auth, v_profiles, v_venues, v_tm;
END $$;
