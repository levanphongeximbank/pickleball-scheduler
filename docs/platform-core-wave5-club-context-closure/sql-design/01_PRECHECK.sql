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
  v_overload int;
  v_rpc_def text;
  v_dup_name int;
  v_dup_code int;
  v_diag text;
  v_cluster_orphan int;
  v_cluster_xtenant int;
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

  -- Exact RPC signatures (to_regprocedure). No proname LIMIT 1 replacement.
  IF to_regprocedure('public.club_add_member(uuid,text,uuid,text,integer)') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: RPC_SIGNATURE_DRIFT club_add_member(uuid,text,uuid,text,integer) missing';
  END IF;
  IF to_regprocedure('public.club_restore_member(uuid,text,uuid,integer)') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: RPC_SIGNATURE_DRIFT club_restore_member(uuid,text,uuid,integer) missing';
  END IF;
  IF to_regprocedure('public.club_review_membership_request(uuid,uuid,text,text,integer)') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: RPC_SIGNATURE_DRIFT club_review_membership_request(uuid,uuid,text,text,integer) missing';
  END IF;

  SELECT count(*) INTO v_overload
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'club_add_member';
  IF v_overload <> 1 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: RPC_SIGNATURE_DRIFT club_add_member overload_count=%', v_overload;
  END IF;
  SELECT count(*) INTO v_overload
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'club_restore_member';
  IF v_overload <> 1 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: RPC_SIGNATURE_DRIFT club_restore_member overload_count=%', v_overload;
  END IF;
  SELECT count(*) INTO v_overload
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'club_review_membership_request';
  IF v_overload <> 1 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: RPC_SIGNATURE_DRIFT club_review_membership_request overload_count=%', v_overload;
  END IF;

  v_rpc_def := pg_get_functiondef('public.club_add_member(uuid,text,uuid,text,integer)'::regprocedure);
  IF position('phase42_can_review_membership' in v_rpc_def) = 0
     OR position('club_members' in v_rpc_def) = 0
     OR position('phase42_idempotency' in v_rpc_def) = 0 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: RPC_SIGNATURE_DRIFT club_add_member missing certified semantics';
  END IF;
  IF position('wave5_ensure_athlete_for_club_member' in v_rpc_def) = 0
     AND position('phase42n_ensure_athlete_for_user' in v_rpc_def) = 0 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: RPC_SIGNATURE_DRIFT club_add_member athlete-ensure call missing';
  END IF;

  v_rpc_def := pg_get_functiondef('public.club_restore_member(uuid,text,uuid,integer)'::regprocedure);
  IF position('phase42_can_review_membership' in v_rpc_def) = 0
     OR position('club_members' in v_rpc_def) = 0 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: RPC_SIGNATURE_DRIFT club_restore_member missing certified semantics';
  END IF;

  v_rpc_def := pg_get_functiondef('public.club_review_membership_request(uuid,uuid,text,text,integer)'::regprocedure);
  IF position('club_membership_requests_v42' in v_rpc_def) = 0
     OR position('VERSION_CONFLICT' in v_rpc_def) = 0 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: RPC_SIGNATURE_DRIFT club_review_membership_request missing certified semantics';
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

    SELECT count(*) INTO v_dup_name FROM (
      SELECT c.tenant_id, lower(c.name)
      FROM public.clubs c
      WHERE c.deleted_at IS NULL
      GROUP BY c.tenant_id, lower(c.name)
      HAVING count(*) > 1
    ) d;
    IF v_dup_name > 0 THEN
      SELECT string_agg(format('tenant=%s name=%s count=%s ids=%s', d.tenant_id, d.n, d.cnt, d.ids), ' | ')
        INTO v_diag
      FROM (
        SELECT c.tenant_id, lower(c.name) AS n, count(*)::int AS cnt,
               string_agg(c.id, ',' ORDER BY c.id) AS ids
        FROM public.clubs c
        WHERE c.deleted_at IS NULL
        GROUP BY c.tenant_id, lower(c.name)
        HAVING count(*) > 1
      ) d;
      RAISE NOTICE 'WAVE5_PRECHECK_COLLISION_NAME %', v_diag;
      RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: POST_MAP_DUPLICATE_CLUB_NAME_COUNT=% DATA_RECONCILIATION_OWNER_DECISION_REQUIRED',
        v_dup_name;
    END IF;
    SELECT count(*) INTO v_dup_code FROM (
      SELECT c.tenant_id, c.code
      FROM public.clubs c
      WHERE c.deleted_at IS NULL AND c.code IS NOT NULL
      GROUP BY c.tenant_id, c.code
      HAVING count(*) > 1
    ) d;
    IF v_dup_code > 0 THEN
      SELECT string_agg(format('tenant=%s code=%s count=%s ids=%s', d.tenant_id, d.code, d.cnt, d.ids), ' | ')
        INTO v_diag
      FROM (
        SELECT c.tenant_id, c.code, count(*)::int AS cnt,
               string_agg(c.id, ',' ORDER BY c.id) AS ids
        FROM public.clubs c
        WHERE c.deleted_at IS NULL AND c.code IS NOT NULL
        GROUP BY c.tenant_id, c.code
        HAVING count(*) > 1
      ) d;
      RAISE NOTICE 'WAVE5_PRECHECK_COLLISION_CODE %', v_diag;
      RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: POST_MAP_DUPLICATE_CLUB_CODE_COUNT=% DATA_RECONCILIATION_OWNER_DECISION_REQUIRED',
        v_dup_code;
    END IF;

    -- REGISTERED_CLUSTER_ORPHAN_PRECHECK / REGISTERED_CLUSTER_CROSS_TENANT_PRECHECK
    -- Canonical: Club.tenant_id is already platform_tenants.id. Compare to cluster Venue.tenant_id.
    -- Do not compare clubs.tenant_id = cluster.venue_id.
    IF to_regclass('public.court_clusters') IS NULL THEN
      SELECT count(*) INTO v_cluster_orphan
      FROM public.clubs c
      WHERE nullif(trim(c.registered_cluster_id), '') IS NOT NULL;
      v_cluster_xtenant := 0;
    ELSE
      SELECT count(*) INTO v_cluster_orphan
      FROM public.clubs c
      WHERE nullif(trim(c.registered_cluster_id), '') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM public.court_clusters cc
          JOIN public.venues v ON v.id = cc.venue_id
          WHERE cc.id = c.registered_cluster_id
            AND nullif(trim(cc.venue_id), '') IS NOT NULL
        );
      SELECT count(*) INTO v_cluster_xtenant
      FROM public.clubs c
      JOIN public.court_clusters cc ON cc.id = c.registered_cluster_id
      JOIN public.venues v ON v.id = cc.venue_id
      WHERE nullif(trim(c.registered_cluster_id), '') IS NOT NULL
        AND v.tenant_id IS DISTINCT FROM c.tenant_id;
    END IF;
    IF v_cluster_orphan > 0 THEN
      RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: REGISTERED_CLUSTER_ORPHAN_COUNT=% DATA_RECONCILIATION_OWNER_DECISION_REQUIRED',
        v_cluster_orphan;
    END IF;
    IF v_cluster_xtenant > 0 THEN
      RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: REGISTERED_CLUSTER_CROSS_TENANT_COUNT=% DATA_RECONCILIATION_OWNER_DECISION_REQUIRED',
        v_cluster_xtenant;
    END IF;

    RAISE NOTICE 'WAVE5_PRECHECK_OK state=CANONICAL clubs=% members=% gov=% req=% POST_MAP_DUPLICATE_CLUB_NAME_COUNT=0 POST_MAP_DUPLICATE_CLUB_CODE_COUNT=0 REGISTERED_CLUSTER_ORPHAN_COUNT=0 REGISTERED_CLUSTER_CROSS_TENANT_COUNT=0 — do not re-translate',
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

  -- POST_MAP uniqueness: Venue ID → venues.tenant_id collapses namespaces. Fail closed. No rename.
  SELECT count(*) INTO v_dup_name FROM (
    SELECT v.tenant_id AS canonical_tenant_id, lower(c.name) AS normalized_name
    FROM public.clubs c
    JOIN public.venues v ON v.id = c.tenant_id
    WHERE c.deleted_at IS NULL
    GROUP BY v.tenant_id, lower(c.name)
    HAVING count(*) > 1
  ) d;
  IF v_dup_name > 0 THEN
    SELECT string_agg(format('tenant=%s name=%s count=%s ids=%s', d.canonical_tenant_id, d.n, d.cnt, d.ids), ' | ')
      INTO v_diag
    FROM (
      SELECT v.tenant_id AS canonical_tenant_id, lower(c.name) AS n, count(*)::int AS cnt,
             string_agg(c.id, ',' ORDER BY c.id) AS ids
      FROM public.clubs c
      JOIN public.venues v ON v.id = c.tenant_id
      WHERE c.deleted_at IS NULL
      GROUP BY v.tenant_id, lower(c.name)
      HAVING count(*) > 1
    ) d;
    RAISE NOTICE 'WAVE5_PRECHECK_COLLISION_NAME %', v_diag;
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: POST_MAP_DUPLICATE_CLUB_NAME_COUNT=% DATA_RECONCILIATION_OWNER_DECISION_REQUIRED',
      v_dup_name;
  END IF;

  SELECT count(*) INTO v_dup_code FROM (
    SELECT v.tenant_id AS canonical_tenant_id, c.code
    FROM public.clubs c
    JOIN public.venues v ON v.id = c.tenant_id
    WHERE c.deleted_at IS NULL AND c.code IS NOT NULL
    GROUP BY v.tenant_id, c.code
    HAVING count(*) > 1
  ) d;
  IF v_dup_code > 0 THEN
    SELECT string_agg(format('tenant=%s code=%s count=%s ids=%s', d.canonical_tenant_id, d.code, d.cnt, d.ids), ' | ')
      INTO v_diag
    FROM (
      SELECT v.tenant_id AS canonical_tenant_id, c.code, count(*)::int AS cnt,
             string_agg(c.id, ',' ORDER BY c.id) AS ids
      FROM public.clubs c
      JOIN public.venues v ON v.id = c.tenant_id
      WHERE c.deleted_at IS NULL AND c.code IS NOT NULL
      GROUP BY v.tenant_id, c.code
      HAVING count(*) > 1
    ) d;
    RAISE NOTICE 'WAVE5_PRECHECK_COLLISION_CODE %', v_diag;
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: POST_MAP_DUPLICATE_CLUB_CODE_COUNT=% DATA_RECONCILIATION_OWNER_DECISION_REQUIRED',
      v_dup_code;
  END IF;

  -- REGISTERED_CLUSTER_ORPHAN_PRECHECK / REGISTERED_CLUSTER_CROSS_TENANT_PRECHECK
  -- Legacy Club.tenant_id is Venue ID. Canonical Tenant = Club Venue.tenant_id.
  -- Cluster canonical Tenant = cluster Venue.tenant_id. Compare Tenant IDs, not Venue IDs.
  IF to_regclass('public.court_clusters') IS NULL THEN
    SELECT count(*) INTO v_cluster_orphan
    FROM public.clubs c
    WHERE nullif(trim(c.registered_cluster_id), '') IS NOT NULL;
    v_cluster_xtenant := 0;
  ELSE
    SELECT count(*) INTO v_cluster_orphan
    FROM public.clubs c
    WHERE nullif(trim(c.registered_cluster_id), '') IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.court_clusters cc
        JOIN public.venues v ON v.id = cc.venue_id
        WHERE cc.id = c.registered_cluster_id
          AND nullif(trim(cc.venue_id), '') IS NOT NULL
      );
    SELECT count(*) INTO v_cluster_xtenant
    FROM public.clubs c
    JOIN public.venues club_v ON club_v.id = c.tenant_id
    JOIN public.court_clusters cc ON cc.id = c.registered_cluster_id
    JOIN public.venues cluster_v ON cluster_v.id = cc.venue_id
    WHERE nullif(trim(c.registered_cluster_id), '') IS NOT NULL
      AND club_v.tenant_id IS DISTINCT FROM cluster_v.tenant_id;
  END IF;
  IF v_cluster_orphan > 0 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: REGISTERED_CLUSTER_ORPHAN_COUNT=% DATA_RECONCILIATION_OWNER_DECISION_REQUIRED',
      v_cluster_orphan;
  END IF;
  IF v_cluster_xtenant > 0 THEN
    RAISE EXCEPTION 'WAVE5_PRECHECK_FAIL: REGISTERED_CLUSTER_CROSS_TENANT_COUNT=% DATA_RECONCILIATION_OWNER_DECISION_REQUIRED',
      v_cluster_xtenant;
  END IF;

  RAISE NOTICE 'WAVE5_PRECHECK_OK state=LEGACY clubs=% members=% gov=% req=% mapped=% POST_MAP_DUPLICATE_CLUB_NAME_COUNT=0 POST_MAP_DUPLICATE_CLUB_CODE_COUNT=0 REGISTERED_CLUSTER_ORPHAN_COUNT=0 REGISTERED_CLUSTER_CROSS_TENANT_COUNT=0',
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
