-- COURT RESOURCE PHASE 3A / STAGING DATA RECONCILIATION STAGE 3
-- STAGING ONLY project_ref=qyewbxjsiiyufanzcjcq
-- Atomic unit: 2 physical courts + 2 club access rows + 2 legacy mappings.
-- Cluster identity mapping is NOT authored: Phase 3A reconcileClusterIdentity
-- classifies legacy_cluster_id == durable public.court_clusters.id as
-- deterministic DURABLE_CLUSTER_ID without an explicit mapping row.
-- Production must not receive this payload.

DO $stage3$
DECLARE
  v_env jsonb;
  v_actor uuid := '9554d017-b894-41f6-b160-89e02daed3e9'::uuid;
  v_c1 uuid := '952a6c15-a3c1-4cd4-9dee-6720bcf5e073'::uuid;
  v_c2 uuid := '65c66b97-5522-4e09-b9b0-29ec61543370'::uuid;
  v_tenant text := 'venue-staging-a';
  v_cluster text := 'venue-staging-a-tt412-canonical-facility';
  v_club text := 'club-ecebf64c78f948ccb2b59842441eb26c';
  v_src text := 'club-data-v3';
  v_ver text := '3';
  v_reason text := 'Phase 3A TT412 Staging reconciliation';
  v_ctx jsonb := jsonb_build_object(
    'inventoryTable', 'club_data_v3',
    'inventoryPath', 'data.data.courts',
    'fixtureMarker', 'QA|TT412|COURT-SEED-01',
    'reconciliationStage', '3',
    'phase', '3A',
    'labelIsIdentity', false
  );
  v_map1 jsonb;
  v_map2 jsonb;
  v_court_count integer;
  v_reg text;
  v_n integer;
  v_blob_ids text[];
BEGIN
  v_env := public.operation_b1b_database_environment();
  IF NOT (
    COALESCE((v_env->>'ok')::boolean, false)
    AND v_env->>'project_ref' = 'qyewbxjsiiyufanzcjcq'
    AND v_env->>'environment' = 'staging_rehearsal'
    AND v_env->>'operation_target_mode' = 'staging_rehearsal'
  ) THEN
    RAISE EXCEPTION 'STAGING_IDENTITY_GUARD_FAILED: %', v_env;
  END IF;

  SELECT court_count INTO v_court_count
  FROM public.court_clusters
  WHERE id = v_cluster AND venue_id = v_tenant AND status = 'active'
  FOR UPDATE;
  IF v_court_count IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'TARGET_CLUSTER_PRECHECK_FAILED count=%', v_court_count;
  END IF;

  SELECT registered_cluster_id INTO v_reg
  FROM public.clubs
  WHERE id = v_club AND tenant_id = v_tenant
  FOR UPDATE;
  IF v_reg IS DISTINCT FROM v_cluster THEN
    RAISE EXCEPTION 'CLUB_REGISTERED_CLUSTER_MISMATCH %', v_reg;
  END IF;

  IF (SELECT court_count FROM public.court_clusters WHERE id = 'venue-staging-a-hc-owner-auth-test') IS DISTINCT FROM 1
     OR (SELECT court_count FROM public.court_clusters WHERE id = 'venue-staging-a-hc-operator-cluster') IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'FIXTURE_CLUSTER_PRECHECK_FAILED';
  END IF;

  SELECT array_agg(c->>'id' ORDER BY c->>'id')
  INTO v_blob_ids
  FROM public.club_data_v3 b,
       jsonb_array_elements(COALESCE(b.data->'data'->'courts', '[]'::jsonb)) AS c
  WHERE b.club_id = v_club;

  IF v_blob_ids IS DISTINCT FROM ARRAY['tt412-court-01','tt412-court-02']::text[] THEN
    RAISE EXCEPTION 'LEGACY_COURT_INVENTORY_PRECHECK_FAILED %', v_blob_ids;
  END IF;

  IF (
    SELECT count(*) FROM public.club_data_v3 b,
      jsonb_array_elements(COALESCE(b.data->'data'->'courts', '[]'::jsonb)) AS c
    WHERE b.club_id = v_club
      AND c->>'id' = 'tt412-court-01'
      AND c->>'clusterId' = v_cluster
  ) <> 1
     OR (
    SELECT count(*) FROM public.club_data_v3 b,
      jsonb_array_elements(COALESCE(b.data->'data'->'courts', '[]'::jsonb)) AS c
    WHERE b.club_id = v_club
      AND c->>'id' = 'tt412-court-02'
      AND c->>'clusterId' = v_cluster
  ) <> 1 THEN
    RAISE EXCEPTION 'COURT_CLUSTER_MATCH_PRECHECK_FAILED';
  END IF;

  SELECT count(*) INTO v_n FROM public.court_resource_physical_courts;
  IF v_n <> 0 THEN RAISE EXCEPTION 'PREEXISTING_PHYSICAL_ROWS %', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.court_resource_club_operational_access;
  IF v_n <> 0 THEN RAISE EXCEPTION 'PREEXISTING_ACCESS_ROWS %', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.court_resource_cluster_identity_mappings;
  IF v_n <> 0 THEN RAISE EXCEPTION 'PREEXISTING_CLUSTER_MAPPING_ROWS %', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.court_resource_legacy_court_identity_mappings;
  IF v_n <> 0 THEN RAISE EXCEPTION 'PREEXISTING_LEGACY_MAPPING_ROWS %', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.court_reservations;
  IF v_n <> 0 THEN RAISE EXCEPTION 'PREEXISTING_RESERVATION_ROWS %', v_n; END IF;

  IF EXISTS (
    SELECT 1 FROM public.court_resource_legacy_court_identity_mappings
    WHERE legacy_court_id IN ('tt412-court-01','tt412-court-02')
  ) THEN
    RAISE EXCEPTION 'PREEXISTING_CANONICAL_IDENTITY_CONFLICT';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', v_actor::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_actor::text, 'role', 'authenticated')::text,
    true
  );
  IF auth.uid() IS DISTINCT FROM v_actor OR public.is_super_admin() IS NOT TRUE THEN
    RAISE EXCEPTION 'ADMIN_SESSION_UNSATISFIED uid=% super=%', auth.uid(), public.is_super_admin();
  END IF;

  INSERT INTO public.court_resource_physical_courts (
    physical_court_id, tenant_id, cluster_id, display_name, display_number,
    sort_order, lifecycle_status, created_by, updated_by
  ) VALUES
    (v_c1, v_tenant, v_cluster, 'TT412 Sân 1', '1', 1, 'active', v_actor, v_actor),
    (v_c2, v_tenant, v_cluster, 'TT412 Sân 2', '2', 2, 'active', v_actor, v_actor);

  INSERT INTO public.court_resource_club_operational_access (
    tenant_id, club_id, physical_court_id, status, reason, granted_by
  ) VALUES
    (v_tenant, v_club, v_c1, 'enabled', v_reason, v_actor),
    (v_tenant, v_club, v_c2, 'enabled', v_reason, v_actor);

  v_map1 := public.court_resource_resolve_legacy_court_mapping(
    v_tenant, v_club, v_src, v_ver, v_cluster, 'tt412-court-01',
    'deterministic', v_c1,
    jsonb_build_array(
      jsonb_build_object('type','STAGE_1_AUDIT','detail','Stage 1 read-only audit of TT412 inventory in club_data_v3.data.data.courts with fixture marker QA|TT412|COURT-SEED-01'),
      jsonb_build_object('type','STAGE_2_EXPLICIT_FACILITY_PARENTAGE','detail','Owner-established Stage 2 parentage; exactly two TT412 courts; prior clusters were TEST_FIXTURE and rejected; no label-based inference'),
      jsonb_build_object('type','EXPLICIT_LEGACY_COURT_ID','legacyCourtId','tt412-court-01'),
      jsonb_build_object('type','EXPLICIT_CANONICAL_PHYSICAL_UUID','physicalCourtId', v_c1),
      jsonb_build_object('type','LABEL_NUMBER_NOT_IDENTITY_AUTHORITY','detail','Legacy name/number and canonical display_name/display_number were not used as identity authority')
    ),
    v_ctx
  );
  IF COALESCE(v_map1->>'ok','false') <> 'true' OR v_map1->>'code' <> 'CREATED' THEN
    RAISE EXCEPTION 'LEGACY_MAPPING_01_FAILED %', v_map1;
  END IF;

  v_map2 := public.court_resource_resolve_legacy_court_mapping(
    v_tenant, v_club, v_src, v_ver, v_cluster, 'tt412-court-02',
    'deterministic', v_c2,
    jsonb_build_array(
      jsonb_build_object('type','STAGE_1_AUDIT','detail','Stage 1 read-only audit of TT412 inventory in club_data_v3.data.data.courts with fixture marker QA|TT412|COURT-SEED-01'),
      jsonb_build_object('type','STAGE_2_EXPLICIT_FACILITY_PARENTAGE','detail','Owner-established Stage 2 parentage; exactly two TT412 courts; prior clusters were TEST_FIXTURE and rejected; no label-based inference'),
      jsonb_build_object('type','EXPLICIT_LEGACY_COURT_ID','legacyCourtId','tt412-court-02'),
      jsonb_build_object('type','EXPLICIT_CANONICAL_PHYSICAL_UUID','physicalCourtId', v_c2),
      jsonb_build_object('type','LABEL_NUMBER_NOT_IDENTITY_AUTHORITY','detail','Legacy name/number and canonical display_name/display_number were not used as identity authority')
    ),
    v_ctx
  );
  IF COALESCE(v_map2->>'ok','false') <> 'true' OR v_map2->>'code' <> 'CREATED' THEN
    RAISE EXCEPTION 'LEGACY_MAPPING_02_FAILED %', v_map2;
  END IF;

  IF (SELECT count(*) FROM public.court_resource_physical_courts) <> 2
     OR (SELECT count(*) FROM public.court_resource_club_operational_access) <> 2
     OR (SELECT count(*) FROM public.court_resource_legacy_court_identity_mappings) <> 2
     OR (SELECT count(*) FROM public.court_resource_cluster_identity_mappings) <> 0
     OR (SELECT count(*) FROM public.court_reservations) <> 0 THEN
    RAISE EXCEPTION 'POST_APPLY_COUNT_MISMATCH';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.court_resource_physical_courts
    WHERE physical_court_id = v_c1 AND tenant_id = v_tenant AND cluster_id = v_cluster
      AND display_name = 'TT412 Sân 1' AND display_number = '1' AND lifecycle_status = 'active'
  ) OR NOT EXISTS (
    SELECT 1 FROM public.court_resource_physical_courts
    WHERE physical_court_id = v_c2 AND tenant_id = v_tenant AND cluster_id = v_cluster
      AND display_name = 'TT412 Sân 2' AND display_number = '2' AND lifecycle_status = 'active'
  ) THEN
    RAISE EXCEPTION 'PHYSICAL_COURT_ATTR_MISMATCH';
  END IF;

  IF (
    SELECT count(*) FROM public.court_resource_club_operational_access
    WHERE tenant_id = v_tenant AND club_id = v_club AND status = 'enabled'
      AND physical_court_id IN (v_c1, v_c2)
  ) <> 2 THEN
    RAISE EXCEPTION 'CLUB_ACCESS_ATTR_MISMATCH';
  END IF;

  IF (
    SELECT count(*) FROM public.court_resource_legacy_court_identity_mappings
    WHERE tenant_id = v_tenant AND club_id = v_club
      AND source_system = v_src AND source_version = v_ver
      AND legacy_cluster_id = v_cluster AND classification = 'deterministic'
      AND resolved_at IS NOT NULL
      AND (
        (legacy_court_id = 'tt412-court-01' AND physical_court_id = v_c1)
        OR (legacy_court_id = 'tt412-court-02' AND physical_court_id = v_c2)
      )
  ) <> 2 THEN
    RAISE EXCEPTION 'LEGACY_MAPPING_ATTR_MISMATCH';
  END IF;

  IF (SELECT court_count FROM public.court_clusters WHERE id = v_cluster) IS DISTINCT FROM 2
     OR (SELECT registered_cluster_id FROM public.clubs WHERE id = v_club) IS DISTINCT FROM v_cluster
     OR (SELECT court_count FROM public.court_clusters WHERE id = 'venue-staging-a-hc-owner-auth-test') IS DISTINCT FROM 1
     OR (SELECT court_count FROM public.court_clusters WHERE id = 'venue-staging-a-hc-operator-cluster') IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'PARENTAGE_OR_FIXTURE_MUTATION_DETECTED';
  END IF;

  SELECT array_agg(c->>'id' ORDER BY c->>'id')
  INTO v_blob_ids
  FROM public.club_data_v3 b,
       jsonb_array_elements(COALESCE(b.data->'data'->'courts', '[]'::jsonb)) AS c
  WHERE b.club_id = v_club;
  IF v_blob_ids IS DISTINCT FROM ARRAY['tt412-court-01','tt412-court-02']::text[] THEN
    RAISE EXCEPTION 'LEGACY_COURT_IDS_MUTATED %', v_blob_ids;
  END IF;
END
$stage3$;
