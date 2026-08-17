-- Wave 3 Phase B — PRECHECK (read-only)
-- SQL_EXECUTION_GO must be YES before any APPLY script.
-- Safe to run for inventory; does not mutate.

SELECT 'venues' AS obj, count(*) AS n FROM public.venues
UNION ALL
SELECT 'profiles', count(*) FROM public.profiles
UNION ALL
SELECT 'court_clusters', count(*) FROM public.court_clusters
UNION ALL
SELECT 'clubs', count(*) FROM public.clubs
UNION ALL
SELECT 'tenant_subscriptions', count(*) FROM public.tenant_subscriptions;

-- Is public.tenants a view?
SELECT c.relname, c.relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'tenants';

-- venues columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'venues'
ORDER BY ordinal_position;

-- profiles columns (expect venue_id, expect missing tenant_id pre-apply)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name IN ('venue_id', 'tenant_id')
ORDER BY column_name;

-- court_clusters already has tenant_id?
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'court_clusters'
  AND column_name IN ('venue_id', 'tenant_id');
