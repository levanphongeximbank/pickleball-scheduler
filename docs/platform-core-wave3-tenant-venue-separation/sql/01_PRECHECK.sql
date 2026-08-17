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

-- court_clusters tenant_id may be ABSENT (Production) or PRESENT (Staging).
-- Absence is a pre-schema shape, not resource-data corruption.
SELECT column_name, data_type, is_nullable
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

-- ── Fail-closed blockers + court_clusters.tenant_id classification (READ-ONLY) ──
-- Absence of court_clusters.tenant_id is EXPECTED on clean pre-Wave-3 Production
-- (02_APPLY creates it). Do not classify that absence as corrupt resource data.
DO $$
DECLARE
  col_exists boolean := false;
  venues_tenant_exists boolean := false;
  col_type text;
  col_nullable text;
  fk_table text;
  n int;
  blockers text[] := '{}';
  column_state text;
BEGIN
  IF to_regclass('public.court_clusters') IS NULL THEN
    RAISE EXCEPTION 'WAVE3_PRECHECK_BLOCK: public.court_clusters missing';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'court_clusters'
      AND column_name = 'tenant_id'
  ) INTO col_exists;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'venues'
      AND column_name = 'tenant_id'
  ) INTO venues_tenant_exists;

  RAISE NOTICE 'COURT_CLUSTERS_TENANT_ID_EXISTS=%',
    CASE WHEN col_exists THEN 'YES' ELSE 'NO' END;

  IF NOT col_exists THEN
    column_state := 'ABSENT_EXPECTED_TO_BE_CREATED_BY_02';
    RAISE NOTICE 'COURT_CLUSTERS_TENANT_COLUMN_STATE=%', column_state;
    RAISE NOTICE 'WAVE3_PRECHECK: court_clusters.tenant_id absent is EXPECTED_PRE_SCHEMA → CREATED_BY_02 → BACKFILLED_BY_03 → VERIFIED_BY_05; not data corruption.';
  ELSE
    SELECT c.data_type, c.is_nullable
    INTO col_type, col_nullable
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'court_clusters'
      AND c.column_name = 'tenant_id';

    SELECT conf.relname INTO fk_table
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY (con.conkey)
    LEFT JOIN pg_class conf ON conf.oid = con.confrelid
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'court_clusters'
      AND con.contype = 'f'
      AND att.attname = 'tenant_id'
    LIMIT 1;

    IF col_type IS DISTINCT FROM 'text' THEN
      column_state := 'PRESENT_INCOMPATIBLE';
      blockers := array_append(
        blockers,
        format('COURT_CLUSTERS_TENANT_TYPE_INCOMPATIBLE data_type=%s (canonical=text)', col_type)
      );
    ELSIF fk_table IS NOT NULL AND fk_table IS DISTINCT FROM 'platform_tenants' THEN
      column_state := 'PRESENT_INCOMPATIBLE';
      blockers := array_append(
        blockers,
        format('COURT_CLUSTERS_TENANT_FK_CONFLICT referenced=%s (canonical=platform_tenants)', fk_table)
      );
    ELSE
      column_state := 'PRESENT_COMPATIBLE';
    END IF;

    RAISE NOTICE 'COURT_CLUSTERS_TENANT_COLUMN_STATE=%', column_state;
    RAISE NOTICE 'WAVE3_PRECHECK: court_clusters.tenant_id type=% nullable=% existing_fk=%',
      col_type, col_nullable, COALESCE(fk_table, '<none>');
  END IF;

  SELECT count(*) INTO n
  FROM public.court_clusters cc
  LEFT JOIN public.venues v ON v.id = cc.venue_id
  WHERE v.id IS NULL;
  RAISE NOTICE 'CLUSTER_ORPHAN_PARENT_VENUES=%', n;
  IF n > 0 THEN
    blockers := array_append(blockers, format('CLUSTER_ORPHAN_PARENT_VENUES=%s', n));
  END IF;

  IF col_exists AND venues_tenant_exists THEN
    SELECT count(*) INTO n
    FROM public.court_clusters cc
    JOIN public.venues v ON v.id = cc.venue_id
    WHERE nullif(btrim(cc.tenant_id), '') IS NOT NULL
      AND nullif(btrim(v.tenant_id), '') IS NOT NULL
      AND cc.tenant_id IS DISTINCT FROM v.tenant_id;
    RAISE NOTICE 'CLUSTER_TENANT_PARENT_BOOTSTRAP_MISMATCHES=%', n;
    IF n > 0 THEN
      blockers := array_append(
        blockers,
        format('CLUSTER_TENANT_PARENT_MISMATCH=%s', n)
      );
    END IF;
  ELSE
    RAISE NOTICE 'CLUSTER_TENANT_PARENT_BOOTSTRAP_MISMATCHES=N/A (parent venues.tenant_id and/or cluster tenant_id not both present)';
  END IF;

  SELECT count(*) INTO n
  FROM (
    SELECT lower(btrim(COALESCE(NULLIF(slug, ''), id))) AS normalized_slug
    FROM public.venues
    GROUP BY 1
    HAVING count(*) > 1
  ) d;
  RAISE NOTICE 'SLUG_COLLISIONS=%', n;
  IF n > 0 THEN
    blockers := array_append(blockers, format('SLUG_COLLISIONS=%s', n));
  END IF;

  SELECT count(*) INTO n
  FROM public.profiles p
  WHERE p.venue_id IS NOT NULL
    AND btrim(p.venue_id) <> ''
    AND NOT EXISTS (SELECT 1 FROM public.venues v WHERE v.id = p.venue_id);
  RAISE NOTICE 'PROFILE_HOME_VENUE_ORPHANS=%', n;
  IF n > 0 THEN
    blockers := array_append(blockers, format('PROFILE_HOME_VENUE_ORPHANS=%s', n));
  END IF;

  IF to_regclass('public.clubs') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'clubs' AND column_name = 'tenant_id'
     ) THEN
    SELECT count(*) INTO n
    FROM public.clubs c
    WHERE c.tenant_id IS NOT NULL
      AND btrim(c.tenant_id) <> ''
      AND NOT EXISTS (SELECT 1 FROM public.venues v WHERE v.id = c.tenant_id);
    RAISE NOTICE 'CLUB_TENANT_BOOTSTRAP_ORPHANS=%', n;
    IF n > 0 THEN
      blockers := array_append(blockers, format('CLUB_TENANT_BOOTSTRAP_ORPHANS=%s', n));
    END IF;
  END IF;

  IF to_regclass('public.tenant_subscriptions') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'tenant_subscriptions'
         AND column_name = 'tenant_id'
     ) THEN
    SELECT count(*) INTO n
    FROM public.tenant_subscriptions s
    WHERE s.tenant_id IS NOT NULL
      AND btrim(s.tenant_id) <> ''
      AND NOT EXISTS (SELECT 1 FROM public.venues v WHERE v.id = s.tenant_id);
    RAISE NOTICE 'SUBSCRIPTION_TENANT_BOOTSTRAP_ORPHANS=%', n;
    IF n > 0 THEN
      blockers := array_append(blockers, format('SUBSCRIPTION_TENANT_BOOTSTRAP_ORPHANS=%s', n));
    END IF;
  END IF;

  IF cardinality(blockers) > 0 THEN
    RAISE EXCEPTION 'WAVE3_PRECHECK_BLOCK: %', array_to_string(blockers, '; ');
  END IF;

  RAISE NOTICE 'WAVE3_PRECHECK_BLOCKERS=0';
END $$;
