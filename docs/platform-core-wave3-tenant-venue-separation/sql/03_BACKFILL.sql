-- Wave 3 Phase B — BACKFILL (1:1 bootstrap toward 1:N)
-- OWNER_SQL_GO_WAVE3_PHASE_B=YES required.
-- Strategy: each existing venue becomes the first venue of a tenant with the same id.
-- Operators may later add more venues under the same tenant_id.

BEGIN;

-- Create platform_tenants rows from venues (id preserved for billing continuity).
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
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  updated_at = now();

-- Stamp venues.tenant_id
UPDATE public.venues
SET tenant_id = id
WHERE tenant_id IS NULL;

-- Stamp profiles.tenant_id from home venue (provisional equality during bootstrap)
UPDATE public.profiles p
SET tenant_id = p.venue_id
WHERE p.tenant_id IS NULL
  AND p.venue_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.platform_tenants t WHERE t.id = p.venue_id);

-- Align court_clusters.tenant_id when missing
UPDATE public.court_clusters cc
SET tenant_id = v.tenant_id
FROM public.venues v
WHERE cc.venue_id = v.id
  AND (cc.tenant_id IS NULL OR cc.tenant_id = '');

-- Enforce NOT NULL + FK after backfill
ALTER TABLE public.venues
  ALTER COLUMN tenant_id SET NOT NULL;

ALTER TABLE public.venues
  DROP CONSTRAINT IF EXISTS venues_tenant_id_fkey;

ALTER TABLE public.venues
  ADD CONSTRAINT venues_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.platform_tenants(id);

CREATE INDEX IF NOT EXISTS venues_tenant_id_idx ON public.venues (tenant_id);
CREATE INDEX IF NOT EXISTS profiles_tenant_id_idx ON public.profiles (tenant_id);

COMMIT;
