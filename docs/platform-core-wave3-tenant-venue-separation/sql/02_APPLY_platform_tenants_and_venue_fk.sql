-- Wave 3 Phase B — APPLY
-- OWNER_SQL_GO_WAVE3_PHASE_B=YES required before execution.
-- Creates durable Tenant entity + Venue.tenant_id + profiles.tenant_id.
-- Does NOT implement Organization.
-- Does NOT enable RLS (see 04_RLS_PACKAGE.md / 04_RLS_POLICIES.sql).
-- Does NOT grant authenticated/anon access; browser bind stays compatibility
-- until the RLS package is separately authorized.

BEGIN;

-- 1) Real tenants table (avoid dropping the legacy view until cutover complete).
CREATE TABLE IF NOT EXISTS public.platform_tenants (
  id text PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL,
  owner_user_id uuid NULL,
  timezone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  status text NOT NULL DEFAULT 'active',
  plan text NOT NULL DEFAULT 'trial',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_tenants_status_check
    CHECK (status IN ('active', 'inactive', 'trial', 'suspended'))
);

CREATE UNIQUE INDEX IF NOT EXISTS platform_tenants_slug_uidx
  ON public.platform_tenants (slug);

REVOKE ALL ON TABLE public.platform_tenants FROM PUBLIC;
REVOKE ALL ON TABLE public.platform_tenants FROM anon;
REVOKE ALL ON TABLE public.platform_tenants FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_tenants TO service_role;

-- 2) Venue → Tenant FK (1:N)
ALTER TABLE public.venues
  ADD COLUMN IF NOT EXISTS tenant_id text;

-- FK added after backfill in 03_BACKFILL.sql (nullable until filled).

-- 3) Profile distinct tenant assignment (nullable: Super Admin / platform users)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tenant_id text;

COMMENT ON TABLE public.platform_tenants IS
  'Wave 3 durable Tenant identity. Distinct from Venue. Organization NOT_CONFIGURED. Canonical runtime authority after RLS GO.';
COMMENT ON COLUMN public.venues.tenant_id IS
  'Parent Tenant id. Tenant → Venue = 1:N. Never invent Venue id from Tenant id.';
COMMENT ON COLUMN public.profiles.tenant_id IS
  'Actor home Tenant. Distinct from profiles.venue_id (home Venue). NULL allowed for Super Admin / platform-scoped users.';

COMMIT;
