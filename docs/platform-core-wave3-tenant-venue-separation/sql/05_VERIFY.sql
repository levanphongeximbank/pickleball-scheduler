-- Wave 3 Phase B — VERIFY
-- Run after APPLY + BACKFILL.
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

-- court_clusters tenant/venue consistency
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
