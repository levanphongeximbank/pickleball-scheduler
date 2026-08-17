-- Wave 3 Phase B — BACKFILL (1:1 bootstrap toward 1:N)
-- OWNER_SQL_GO_WAVE3_PHASE_B=YES required.
-- Strategy: each existing venue becomes the first venue of a tenant with the same id.
-- Operators may later add more venues under the same tenant_id.
--
-- Order (must be preserved):
--   1. create/bootstrap platform_tenants
--   2. stamp venues.tenant_id
--   3. stamp profiles.tenant_id
--   4. align court_clusters.tenant_id from parent venues
--   5. cluster tenant NOT NULL + FK + index
--
-- Cluster tenant_id is Tenant scope/projection. venue_id remains physical parent.
-- Never invent Venue from Tenant. Never use Cluster id as Tenant.
--
-- SLUG POLICY (no silent rename of a real tenant):
--   blank/null venue.slug → tenant.slug = venue.id
--   duplicate normalized slugs → FAIL (Owner decision required)
--   slug collision with an existing platform_tenants row of a different id → FAIL
--   existing platform_tenants row with the same id → DO NOTHING (do not overwrite)
-- Deterministic suffix {slug}--{venue_id} is documented but NOT auto-applied.

BEGIN;

-- Block duplicate derived slugs among venues.
DO $$
DECLARE
  dup_count int;
  collision_count int;
BEGIN
  SELECT count(*) INTO dup_count
  FROM (
    SELECT lower(btrim(COALESCE(NULLIF(slug, ''), id))) AS normalized_slug
    FROM public.venues
    GROUP BY 1
    HAVING count(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE EXCEPTION
      'WAVE3_SLUG_COLLISION: % duplicate normalized tenant slug(s) among venues. Owner decision required. No silent rename.',
      dup_count;
  END IF;

  IF to_regclass('public.platform_tenants') IS NULL THEN
    RAISE EXCEPTION 'WAVE3_BACKFILL: public.platform_tenants missing. Run 02_APPLY first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'court_clusters'
      AND column_name = 'tenant_id'
  ) THEN
    RAISE EXCEPTION
      'WAVE3_BACKFILL: court_clusters.tenant_id missing. Run 02_APPLY first.';
  END IF;

  SELECT count(*) INTO collision_count
  FROM public.venues v
  JOIN public.platform_tenants t
    ON lower(btrim(t.slug)) = lower(btrim(COALESCE(NULLIF(v.slug, ''), v.id)))
  WHERE t.id <> v.id;

  IF collision_count > 0 THEN
    RAISE EXCEPTION
      'WAVE3_SLUG_COLLISION_EXISTING: % venue-derived slug(s) collide with existing platform_tenants rows of different id. Owner decision required. No silent rename.',
      collision_count;
  END IF;
END $$;

-- Create platform_tenants rows from venues (id preserved for billing continuity).
-- ON CONFLICT (id) DO NOTHING — never overwrite an existing real tenant.
INSERT INTO public.platform_tenants (
  id, name, slug, owner_user_id, timezone, status, plan, note, created_at, updated_at
)
SELECT
  v.id,
  COALESCE(NULLIF(v.name, ''), v.id),
  COALESCE(NULLIF(v.slug, ''), v.id),
  v.owner_id,
  COALESCE(NULLIF(v.timezone, ''), 'Asia/Ho_Chi_Minh'),
  CASE
    WHEN lower(COALESCE(v.status, 'active')) IN ('active', 'inactive', 'trial', 'suspended')
      THEN lower(v.status)
    ELSE 'active'
  END,
  'trial',
  COALESCE(v.note, ''),
  COALESCE(v.created_at, now()),
  COALESCE(v.updated_at, now())
FROM public.venues v
ON CONFLICT (id) DO NOTHING;

-- Stamp venues.tenant_id
UPDATE public.venues
SET tenant_id = id
WHERE tenant_id IS NULL;

-- Stamp profiles.tenant_id from home venue parent after bootstrap.
-- Super Admin / platform users with NULL venue_id remain NULL.
UPDATE public.profiles p
SET tenant_id = v.tenant_id
FROM public.venues v
WHERE p.tenant_id IS NULL
  AND p.venue_id IS NOT NULL
  AND v.id = p.venue_id
  AND v.tenant_id IS NOT NULL;

-- Align court_clusters.tenant_id from parent venue (never invent venue from tenant).
-- Cluster identity is not Tenant identity. Venue remains the physical parent.
UPDATE public.court_clusters cc
SET tenant_id = v.tenant_id
FROM public.venues v
WHERE cc.venue_id = v.id
  AND (cc.tenant_id IS NULL OR btrim(cc.tenant_id) = '');

-- Cluster tenant durable closure: fail closed before NOT NULL / FK / index.
DO $$
DECLARE
  orphan_venue int;
  missing_tenant int;
  mismatch int;
  orphan_tenant int;
BEGIN
  SELECT count(*) INTO orphan_venue
  FROM public.court_clusters cc
  LEFT JOIN public.venues v ON v.id = cc.venue_id
  WHERE v.id IS NULL;

  IF orphan_venue > 0 THEN
    RAISE EXCEPTION
      'WAVE3_CLUSTER_ORPHAN_VENUE: % cluster(s) have venue_id with no parent Venue. Refusing NOT NULL/FK.',
      orphan_venue;
  END IF;

  SELECT count(*) INTO missing_tenant
  FROM public.court_clusters
  WHERE tenant_id IS NULL OR btrim(tenant_id) = '';

  IF missing_tenant > 0 THEN
    RAISE EXCEPTION
      'WAVE3_CLUSTER_MISSING_TENANT: % cluster(s) still missing tenant_id after parent-venue alignment.',
      missing_tenant;
  END IF;

  SELECT count(*) INTO mismatch
  FROM public.court_clusters cc
  JOIN public.venues v ON v.id = cc.venue_id
  WHERE cc.tenant_id IS DISTINCT FROM v.tenant_id;

  IF mismatch > 0 THEN
    RAISE EXCEPTION
      'WAVE3_CLUSTER_TENANT_MISMATCH_PARENT_VENUE: % cluster tenant_id value(s) do not match parent Venue.tenant_id. Refusing silent overwrite of non-null drift.',
      mismatch;
  END IF;

  SELECT count(*) INTO orphan_tenant
  FROM public.court_clusters cc
  WHERE NOT EXISTS (
    SELECT 1 FROM public.platform_tenants t WHERE t.id = cc.tenant_id
  );

  IF orphan_tenant > 0 THEN
    RAISE EXCEPTION
      'WAVE3_CLUSTER_TENANT_ORPHAN: % cluster tenant_id value(s) do not exist in platform_tenants. Refusing FK.',
      orphan_tenant;
  END IF;
END $$;

ALTER TABLE public.court_clusters
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.court_clusters
  DROP CONSTRAINT IF EXISTS court_clusters_tenant_id_fkey;

ALTER TABLE public.court_clusters
  ADD CONSTRAINT court_clusters_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.platform_tenants(id);

CREATE INDEX IF NOT EXISTS court_clusters_tenant_id_idx
  ON public.court_clusters (tenant_id);

-- Venue tenant durable closure (NOT NULL + FK after backfill)
ALTER TABLE public.venues
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.venues
  DROP CONSTRAINT IF EXISTS venues_tenant_id_fkey;

ALTER TABLE public.venues
  ADD CONSTRAINT venues_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.platform_tenants(id);

-- Actor → Tenant FK: nullable (Super Admin / platform users may remain NULL)
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_tenant_id_fkey;

DO $$
DECLARE
  orphan_count int;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM public.profiles p
  WHERE p.tenant_id IS NOT NULL
    AND btrim(p.tenant_id) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.platform_tenants t WHERE t.id = p.tenant_id
    );

  IF orphan_count > 0 THEN
    RAISE EXCEPTION
      'WAVE3_PROFILE_TENANT_ORPHAN: % non-null profiles.tenant_id value(s) do not exist in platform_tenants. Refusing FK.',
      orphan_count;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.platform_tenants(id)
  ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS venues_tenant_id_idx ON public.venues (tenant_id);
CREATE INDEX IF NOT EXISTS profiles_tenant_id_idx ON public.profiles (tenant_id);

COMMIT;
