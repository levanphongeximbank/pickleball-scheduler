-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
--
-- Wave 5 Club Tenant migration PRECHECK — READ-ONLY, fail closed.
-- Do not repair unexpected data. Do not mutate.
--
-- TENANT_MEMBERS_WAVE4_CANONICAL_FK_EXPECTED=YES
-- WAVE4_SQL_REEXECUTION_REQUIRED=NO

DO $$
DECLARE
  v_clubs_fk text;
  v_members_fk text;
  v_gov_fk text;
  v_req_fk text;
  v_tm_fk text;
  v_state text;
  v_club_count int;
  v_member_count int;
  v_gov_count int;
  v_req_count int;
  v_orphan int;
  v_venue_missing_tenant int;
  v_tenant_unresolved int;
  v_ambiguous int;
  v_mapped int;
  v_mismatch int;
  v_delete_rule text;
BEGIN
  IF to_regclass('public.clubs') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: public.clubs missing';
  END IF;
  IF to_regclass('public.club_members') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: public.club_members missing';
  END IF;
  IF to_regclass('public.club_governance_assignments') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: public.club_governance_assignments missing';
  END IF;
  IF to_regclass('public.club_membership_requests_v42') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: public.club_membership_requests_v42 missing';
  END IF;
  IF to_regclass('public.platform_tenants') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: public.platform_tenants missing';
  END IF;
  IF to_regclass('public.venues') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: public.venues missing';
  END IF;
  IF to_regclass('public.tenant_members') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: public.tenant_members missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clubs' AND column_name = 'tenant_id'
  ) THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: clubs.tenant_id missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'club_members' AND column_name = 'tenant_id'
  ) THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: club_members.tenant_id missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'club_governance_assignments' AND column_name = 'tenant_id'
  ) THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: club_governance_assignments.tenant_id missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'club_membership_requests_v42' AND column_name = 'tenant_id'
  ) THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: club_membership_requests_v42.tenant_id missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'venues' AND column_name = 'tenant_id'
  ) THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: venues.tenant_id missing';
  END IF;

  SELECT ccu.table_name INTO v_clubs_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'clubs'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
  ORDER BY tc.constraint_name
  LIMIT 1;

  SELECT ccu.table_name INTO v_members_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'club_members'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
  ORDER BY tc.constraint_name
  LIMIT 1;

  SELECT ccu.table_name INTO v_gov_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'club_governance_assignments'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
  ORDER BY tc.constraint_name
  LIMIT 1;

  SELECT ccu.table_name INTO v_req_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'club_membership_requests_v42'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
  ORDER BY tc.constraint_name
  LIMIT 1;

  SELECT ccu.table_name INTO v_tm_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'tenant_members'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
  ORDER BY tc.constraint_name
  LIMIT 1;

  IF v_tm_fk IS DISTINCT FROM 'platform_tenants' THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: tenant_members.tenant_id FK is %, expected platform_tenants (Wave 4 closed canonical). WAVE4_SQL_REEXECUTION_REQUIRED=NO — do not repair here',
      coalesce(v_tm_fk, '<null>');
  END IF;

  SELECT rc.delete_rule INTO v_delete_rule
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.referential_constraints rc
    ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'tenant_members'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
    AND ccu.table_name = 'platform_tenants'
  LIMIT 1;
  IF v_delete_rule IS DISTINCT FROM 'RESTRICT' THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: tenant_members.tenant_id delete rule is %, expected RESTRICT',
      coalesce(v_delete_rule, '<null>');
  END IF;

  IF v_clubs_fk IS NULL OR v_members_fk IS NULL OR v_gov_fk IS NULL OR v_req_fk IS NULL THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: STATE_UNKNOWN missing Club tenant_id FK clubs=% members=% gov=% req=%',
      coalesce(v_clubs_fk, '<null>'), coalesce(v_members_fk, '<null>'),
      coalesce(v_gov_fk, '<null>'), coalesce(v_req_fk, '<null>');
  END IF;

  IF v_clubs_fk NOT IN ('venues', 'platform_tenants')
     OR v_members_fk NOT IN ('venues', 'platform_tenants')
     OR v_gov_fk NOT IN ('venues', 'platform_tenants')
     OR v_req_fk NOT IN ('venues', 'platform_tenants') THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: STATE_UNKNOWN unexpected FK clubs=% members=% gov=% req=%',
      v_clubs_fk, v_members_fk, v_gov_fk, v_req_fk;
  END IF;

  IF v_clubs_fk = 'platform_tenants'
     AND v_members_fk = 'platform_tenants'
     AND v_gov_fk = 'platform_tenants'
     AND v_req_fk = 'platform_tenants' THEN
    v_state := 'CANONICAL';
  ELSIF v_clubs_fk = 'venues'
     AND v_members_fk = 'venues'
     AND v_gov_fk = 'venues'
     AND v_req_fk = 'venues' THEN
    v_state := 'LEGACY';
  ELSE
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: STATE_UNKNOWN mixed Club tenant FKs clubs=% members=% gov=% req=%',
      v_clubs_fk, v_members_fk, v_gov_fk, v_req_fk;
  END IF;

  SELECT count(*) INTO v_club_count FROM public.clubs;
  SELECT count(*) INTO v_member_count FROM public.club_members;
  SELECT count(*) INTO v_gov_count FROM public.club_governance_assignments;
  SELECT count(*) INTO v_req_count FROM public.club_membership_requests_v42;

  IF v_state = 'CANONICAL' THEN
    SELECT count(*) INTO v_orphan FROM public.clubs c
    WHERE NOT EXISTS (SELECT 1 FROM public.platform_tenants pt WHERE pt.id = c.tenant_id);
    IF v_orphan > 0 THEN
      RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % clubs.tenant_id are not platform_tenants.id', v_orphan;
    END IF;
    SELECT count(*) INTO v_mismatch
    FROM public.club_members cm
    JOIN public.clubs c ON c.id = cm.club_id
    WHERE cm.tenant_id IS DISTINCT FROM c.tenant_id;
    IF v_mismatch > 0 THEN
      RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % club_members.tenant_id disagree with parent Club', v_mismatch;
    END IF;
    SELECT count(*) INTO v_mismatch
    FROM public.club_governance_assignments g
    JOIN public.clubs c ON c.id = g.club_id
    WHERE g.tenant_id IS DISTINCT FROM c.tenant_id;
    IF v_mismatch > 0 THEN
      RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % club_governance_assignments.tenant_id disagree with parent Club', v_mismatch;
    END IF;
    SELECT count(*) INTO v_mismatch
    FROM public.club_membership_requests_v42 r
    JOIN public.clubs c ON c.id = r.club_id
    WHERE r.tenant_id IS DISTINCT FROM c.tenant_id;
    IF v_mismatch > 0 THEN
      RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % club_membership_requests_v42.tenant_id disagree with parent Club', v_mismatch;
    END IF;
    RAISE NOTICE 'WAVE5_PRECHECK_OK state=CANONICAL clubs=% members=% gov=% req=% — do not re-translate',
      v_club_count, v_member_count, v_gov_count, v_req_count;
    RETURN;
  END IF;

  -- STATE_LEGACY: every Club-owned tenant_id is a Venue ID.
  SELECT count(*) INTO v_orphan
  FROM public.clubs c
  WHERE c.tenant_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.venues v WHERE v.id = c.tenant_id);
  IF v_orphan > 0 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % club tenant_id values do not resolve to venues.id', v_orphan;
  END IF;

  SELECT count(*) INTO v_orphan
  FROM public.club_members cm
  WHERE NOT EXISTS (SELECT 1 FROM public.venues v WHERE v.id = cm.tenant_id);
  IF v_orphan > 0 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % club_members.tenant_id values do not resolve to venues.id', v_orphan;
  END IF;

  SELECT count(*) INTO v_orphan
  FROM public.club_governance_assignments g
  WHERE NOT EXISTS (SELECT 1 FROM public.venues v WHERE v.id = g.tenant_id);
  IF v_orphan > 0 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % club_governance_assignments.tenant_id values do not resolve to venues.id', v_orphan;
  END IF;

  SELECT count(*) INTO v_orphan
  FROM public.club_membership_requests_v42 r
  WHERE NOT EXISTS (SELECT 1 FROM public.venues v WHERE v.id = r.tenant_id);
  IF v_orphan > 0 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % club_membership_requests_v42.tenant_id values do not resolve to venues.id', v_orphan;
  END IF;

  SELECT count(*) INTO v_venue_missing_tenant
  FROM public.clubs c
  JOIN public.venues v ON v.id = c.tenant_id
  WHERE v.tenant_id IS NULL OR btrim(v.tenant_id) = '';
  IF v_venue_missing_tenant > 0 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % clubs map to venues with null tenant_id', v_venue_missing_tenant;
  END IF;

  SELECT count(*) INTO v_tenant_unresolved
  FROM public.clubs c
  JOIN public.venues v ON v.id = c.tenant_id
  WHERE NOT EXISTS (SELECT 1 FROM public.platform_tenants pt WHERE pt.id = v.tenant_id);
  IF v_tenant_unresolved > 0 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % clubs map to venues.tenant_id not in platform_tenants', v_tenant_unresolved;
  END IF;

  SELECT count(*) INTO v_ambiguous
  FROM (
    SELECT c.id
    FROM public.clubs c
    JOIN public.venues v ON v.id = c.tenant_id
    GROUP BY c.id
    HAVING count(DISTINCT v.tenant_id) > 1
  ) amb;
  IF v_ambiguous > 0 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % clubs have non-deterministic canonical Tenant mapping', v_ambiguous;
  END IF;

  SELECT count(*) INTO v_mapped
  FROM public.clubs c
  JOIN public.venues v ON v.id = c.tenant_id
  JOIN public.platform_tenants pt ON pt.id = v.tenant_id;
  IF v_mapped <> v_club_count THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: mapped count % <> club count %', v_mapped, v_club_count;
  END IF;

  SELECT count(*) INTO v_mismatch
  FROM public.club_members cm
  JOIN public.clubs c ON c.id = cm.club_id
  WHERE cm.tenant_id IS DISTINCT FROM c.tenant_id;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % club_members.tenant_id disagree with parent Club (legacy Venue scope)', v_mismatch;
  END IF;

  SELECT count(*) INTO v_mismatch
  FROM public.club_governance_assignments g
  JOIN public.clubs c ON c.id = g.club_id
  WHERE g.tenant_id IS DISTINCT FROM c.tenant_id;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % club_governance_assignments.tenant_id disagree with parent Club', v_mismatch;
  END IF;

  SELECT count(*) INTO v_mismatch
  FROM public.club_membership_requests_v42 r
  JOIN public.clubs c ON c.id = r.club_id
  WHERE r.tenant_id IS DISTINCT FROM c.tenant_id;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: % club_membership_requests_v42.tenant_id disagree with parent Club', v_mismatch;
  END IF;

  RAISE NOTICE 'WAVE5_PRECHECK_OK state=LEGACY clubs=% members=% gov=% req=% mapped=%',
    v_club_count, v_member_count, v_gov_count, v_req_count, v_mapped;
END $$;

SELECT
  (SELECT count(*) FROM public.clubs) AS clubs_count,
  (SELECT count(*) FROM public.club_members) AS club_members_count,
  (SELECT count(*) FROM public.club_governance_assignments) AS club_governance_assignments_count,
  (SELECT count(*) FROM public.club_membership_requests_v42) AS club_membership_requests_v42_count,
  (SELECT count(*) FROM public.venues) AS venues_count,
  (SELECT count(*) FROM public.platform_tenants) AS platform_tenants_count,
  (SELECT count(*) FROM public.tenant_members) AS tenant_members_count;
