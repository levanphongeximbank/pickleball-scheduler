-- Wave 3 Phase B — VERIFY
-- Run after APPLY + BACKFILL.

-- Every venue has tenant_id
SELECT count(*) AS venues_missing_tenant
FROM public.venues
WHERE tenant_id IS NULL OR tenant_id = '';

-- Every venue.tenant_id exists in platform_tenants
SELECT count(*) AS venues_orphan_tenant
FROM public.venues v
LEFT JOIN public.platform_tenants t ON t.id = v.tenant_id
WHERE t.id IS NULL;

-- profiles with venue but missing tenant
SELECT count(*) AS profiles_venue_without_tenant
FROM public.profiles
WHERE venue_id IS NOT NULL AND (tenant_id IS NULL OR tenant_id = '');

-- Cardinality sample: tenants with venue counts (expect >=1 after bootstrap)
SELECT t.id AS tenant_id, count(v.id) AS venue_count
FROM public.platform_tenants t
LEFT JOIN public.venues v ON v.tenant_id = t.id
GROUP BY t.id
ORDER BY venue_count DESC, t.id
LIMIT 50;

-- court_clusters tenant alignment
SELECT count(*) AS clusters_missing_tenant
FROM public.court_clusters
WHERE tenant_id IS NULL OR tenant_id = '';
