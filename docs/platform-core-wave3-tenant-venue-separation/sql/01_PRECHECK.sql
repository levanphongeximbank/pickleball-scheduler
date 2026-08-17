-- Wave 3 Phase B — PRECHECK (read-only)
-- SQL_EXECUTION_GO must be YES before any APPLY script.
-- Safe to run for inventory; does not mutate.
-- Queries against objects that may not exist yet are guarded.

SELECT 'venues' AS obj, count(*) AS n FROM public.venues
UNION ALL
SELECT 'profiles', count(*) FROM public.profiles
UNION ALL
SELECT 'court_clusters', count(*) FROM public.court_clusters
UNION ALL
SELECT 'clubs', count(*) FROM public.clubs
UNION ALL
SELECT 'tenant_subscriptions', count(*) FROM public.tenant_subscriptions;

-- Is public.tenants a view? Is platform_tenants present yet?
SELECT c.relname, c.relkind
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('tenants', 'platform_tenants');

-- venues columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'venues'
ORDER BY ordinal_position;

-- profiles columns (expect venue_id; tenant_id may be missing pre-apply)
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

-- ── Slug / identity collision inventory (READ-ONLY, venues always exist) ──

-- Duplicate venue slugs (source of derived tenant slug)
SELECT v.slug, count(*) AS n, array_agg(v.id ORDER BY v.id) AS venue_ids
FROM public.venues v
WHERE NULLIF(btrim(v.slug), '') IS NOT NULL
GROUP BY v.slug
HAVING count(*) > 1;

-- Duplicate normalized tenant slugs (blank/null slug → venue.id)
SELECT
  lower(btrim(COALESCE(NULLIF(v.slug, ''), v.id))) AS normalized_tenant_slug,
  count(*) AS n,
  array_agg(v.id ORDER BY v.id) AS venue_ids
FROM public.venues v
GROUP BY 1
HAVING count(*) > 1;

-- Blank / null venue slug behavior (BACKFILL will use venue.id; not a rename)
SELECT v.id, v.name, v.slug
FROM public.venues v
WHERE NULLIF(btrim(COALESCE(v.slug, '')), '') IS NULL
ORDER BY v.id;

-- Guarded inventory against platform_tenants / profiles.tenant_id when present.
DO $$
DECLARE
  rec record;
  n int;
BEGIN
  IF to_regclass('public.platform_tenants') IS NULL THEN
    RAISE NOTICE 'WAVE3_PRECHECK: public.platform_tenants absent (expected before APPLY).';
  ELSE
    SELECT count(*) INTO n FROM public.platform_tenants;
    RAISE NOTICE 'WAVE3_PRECHECK: platform_tenants row count=%', n;

    FOR rec IN
      SELECT
        v.id AS venue_id,
        lower(btrim(COALESCE(NULLIF(v.slug, ''), v.id))) AS derived_slug,
        t.id AS existing_tenant_id,
        t.slug AS existing_tenant_slug
      FROM public.venues v
      JOIN public.platform_tenants t
        ON lower(btrim(t.slug)) = lower(btrim(COALESCE(NULLIF(v.slug, ''), v.id)))
      WHERE t.id <> v.id
    LOOP
      RAISE NOTICE
        'WAVE3_SLUG_COLLISION_EXISTING: venue_id=% derived_slug=% existing_tenant_id=% existing_slug=%',
        rec.venue_id, rec.derived_slug, rec.existing_tenant_id, rec.existing_tenant_slug;
    END LOOP;

    FOR rec IN
      SELECT
        v.id,
        v.name AS venue_name,
        v.slug AS venue_slug,
        t.name AS tenant_name,
        t.slug AS tenant_slug
      FROM public.venues v
      JOIN public.platform_tenants t ON t.id = v.id
      WHERE t.slug IS DISTINCT FROM COALESCE(NULLIF(v.slug, ''), v.id)
         OR t.name IS DISTINCT FROM COALESCE(NULLIF(v.name, ''), v.id)
    LOOP
      RAISE NOTICE
        'WAVE3_ID_INCONSISTENT_EXISTING: id=% venue_slug=% tenant_slug=% venue_name=% tenant_name=%',
        rec.id, rec.venue_slug, rec.tenant_slug, rec.venue_name, rec.tenant_name;
    END LOOP;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name = 'tenant_id'
  ) AND to_regclass('public.platform_tenants') IS NOT NULL THEN
    SELECT count(*) INTO n
    FROM public.profiles p
    WHERE p.tenant_id IS NOT NULL
      AND btrim(p.tenant_id) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.platform_tenants t WHERE t.id = p.tenant_id
      );
    RAISE NOTICE 'WAVE3_PRECHECK: profiles orphan tenant_id count=%', n;

    SELECT
      count(*) FILTER (WHERE tenant_id IS NULL OR btrim(tenant_id) = '')
    INTO n
    FROM public.profiles;
    RAISE NOTICE 'WAVE3_PRECHECK: profiles with NULL tenant_id count=% (Super Admin/platform NULL is allowed)', n;
  ELSE
    RAISE NOTICE 'WAVE3_PRECHECK: profiles.tenant_id absent (expected before APPLY).';
  END IF;
END $$;
