-- Wave 3 Phase B — VERIFY
-- Run after APPLY + BACKFILL. READ-ONLY.
-- RLS checks are informational only (RLS is a separate Owner GO).

-- Every venue has tenant_id
SELECT count(*) AS venues_missing_tenant
FROM public.venues
WHERE tenant_id IS NULL OR tenant_id = '';

-- Every venue.tenant_id exists in platform_tenants
SELECT count(*) AS venues_orphan_tenant
FROM public.venues v
LEFT JOIN public.platform_tenants t ON t.id = v.tenant_id
WHERE t.id IS NULL;

-- platform_tenants.slug uniqueness (expect 0 duplicate groups)
SELECT slug, count(*) AS n
FROM public.platform_tenants
GROUP BY slug
HAVING count(*) > 1;

-- orphan profiles.tenant_id
SELECT count(*) AS profiles_orphan_tenant
FROM public.profiles p
WHERE p.tenant_id IS NOT NULL
  AND btrim(p.tenant_id) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM public.platform_tenants t WHERE t.id = p.tenant_id
  );

-- profiles with venue but missing tenant (fallback still needed if > 0)
SELECT count(*) AS profiles_venue_without_tenant
FROM public.profiles
WHERE venue_id IS NOT NULL
  AND btrim(venue_id) <> ''
  AND (tenant_id IS NULL OR btrim(tenant_id) = '');

-- profile tenant vs home venue parent consistency
SELECT count(*) AS profiles_tenant_home_venue_mismatch
FROM public.profiles p
JOIN public.venues v ON v.id = p.venue_id
WHERE p.tenant_id IS NOT NULL
  AND v.tenant_id IS NOT NULL
  AND p.tenant_id <> v.tenant_id;

-- Cardinality: tenants with 0/N venues
SELECT t.id AS tenant_id, count(v.id) AS venue_count
FROM public.platform_tenants t
LEFT JOIN public.venues v ON v.tenant_id = t.id
GROUP BY t.id
ORDER BY venue_count ASC, t.id
LIMIT 50;

SELECT
  count(*) FILTER (WHERE venue_count = 0) AS tenants_with_zero_venues,
  count(*) FILTER (WHERE venue_count = 1) AS tenants_with_one_venue,
  count(*) FILTER (WHERE venue_count > 1) AS tenants_with_n_venues
FROM (
  SELECT t.id, count(v.id) AS venue_count
  FROM public.platform_tenants t
  LEFT JOIN public.venues v ON v.tenant_id = t.id
  GROUP BY t.id
) c;

-- court_clusters tenant/venue consistency (post-apply column must exist)
SELECT count(*) AS clusters_missing_tenant
FROM public.court_clusters
WHERE tenant_id IS NULL OR tenant_id = '';

SELECT count(*) AS clusters_orphan_venue
FROM public.court_clusters cc
LEFT JOIN public.venues v ON v.id = cc.venue_id
WHERE v.id IS NULL;

SELECT count(*) AS clusters_tenant_mismatch_parent_venue
FROM public.court_clusters cc
JOIN public.venues v ON v.id = cc.venue_id
WHERE cc.tenant_id IS NOT NULL
  AND v.tenant_id IS NOT NULL
  AND cc.tenant_id <> v.tenant_id;

-- Cluster tenant schema closure (READ-ONLY)
DO $$
DECLARE
  col_exists boolean;
  missing_tenant int;
  orphan_venue int;
  mismatch int;
  fk_ok boolean;
  idx_ok boolean;
  blockers text[] := '{}';
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'court_clusters'
      AND column_name = 'tenant_id'
      AND data_type = 'text'
  ) INTO col_exists;

  RAISE NOTICE 'COURT_CLUSTERS_TENANT_ID_EXISTS=%',
    CASE WHEN col_exists THEN 'YES' ELSE 'NO' END;

  IF NOT col_exists THEN
    RAISE EXCEPTION 'WAVE3_VERIFY_FAIL: COURT_CLUSTERS_TENANT_ID_EXISTS=NO';
  END IF;

  SELECT count(*) INTO missing_tenant
  FROM public.court_clusters
  WHERE tenant_id IS NULL OR btrim(tenant_id) = '';
  RAISE NOTICE 'CLUSTERS_MISSING_TENANT=%', missing_tenant;
  IF missing_tenant <> 0 THEN
    blockers := array_append(blockers, format('CLUSTERS_MISSING_TENANT=%s', missing_tenant));
  END IF;

  SELECT count(*) INTO orphan_venue
  FROM public.court_clusters cc
  LEFT JOIN public.venues v ON v.id = cc.venue_id
  WHERE v.id IS NULL;
  RAISE NOTICE 'CLUSTERS_ORPHAN_VENUE=%', orphan_venue;
  IF orphan_venue <> 0 THEN
    blockers := array_append(blockers, format('CLUSTERS_ORPHAN_VENUE=%s', orphan_venue));
  END IF;

  SELECT count(*) INTO mismatch
  FROM public.court_clusters cc
  JOIN public.venues v ON v.id = cc.venue_id
  WHERE cc.tenant_id IS DISTINCT FROM v.tenant_id;
  RAISE NOTICE 'CLUSTERS_TENANT_MISMATCH_PARENT_VENUE=%', mismatch;
  IF mismatch <> 0 THEN
    blockers := array_append(
      blockers,
      format('CLUSTERS_TENANT_MISMATCH_PARENT_VENUE=%s', mismatch)
    );
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_class conf ON conf.oid = con.confrelid
    JOIN pg_namespace cnsp ON cnsp.oid = conf.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'court_clusters'
      AND con.contype = 'f'
      AND con.conname = 'court_clusters_tenant_id_fkey'
      AND att.attname = 'tenant_id'
      AND cnsp.nspname = 'public'
      AND conf.relname = 'platform_tenants'
  ) INTO fk_ok;
  RAISE NOTICE 'COURT_CLUSTERS_TENANT_FK=%', CASE WHEN fk_ok THEN 'VALID' ELSE 'INVALID' END;
  IF NOT fk_ok THEN
    blockers := array_append(blockers, 'COURT_CLUSTERS_TENANT_FK=INVALID');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'court_clusters'
      AND indexname = 'court_clusters_tenant_id_idx'
  ) INTO idx_ok;
  RAISE NOTICE 'COURT_CLUSTERS_TENANT_INDEX=%', CASE WHEN idx_ok THEN 'VALID' ELSE 'INVALID' END;
  IF NOT idx_ok THEN
    blockers := array_append(blockers, 'COURT_CLUSTERS_TENANT_INDEX=INVALID');
  END IF;

  IF cardinality(blockers) > 0 THEN
    RAISE EXCEPTION 'WAVE3_VERIFY_FAIL: %', array_to_string(blockers, '; ');
  END IF;
END $$;

-- RLS / runtime readiness (informational; do not treat as deploy)
SELECT
  c.relname,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'platform_tenants';

SELECT pol.polname, pol.polcmd
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'platform_tenants'
ORDER BY pol.polname;

SELECT
  has_table_privilege('authenticated', 'public.platform_tenants', 'SELECT') AS authenticated_select,
  has_table_privilege('anon', 'public.platform_tenants', 'SELECT') AS anon_select,
  has_table_privilege('service_role', 'public.platform_tenants', 'SELECT') AS service_role_select;
