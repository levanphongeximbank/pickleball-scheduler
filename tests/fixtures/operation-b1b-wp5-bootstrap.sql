-- =============================================================================
-- OPERATION B1B — WP5 disposable local PostgreSQL bootstrap
-- Prerequisites ONLY for loading merged WP1/WP2 SQL in an isolated test DB.
-- Does NOT redefine, weaken, or replace B1B constraints / RLS / triggers.
-- NOT for Staging/Production apply.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Supabase-compatible roles (local disposable only)
DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
  -- Ordinary product/tenant stand-in used only for negative AuthZ proofs
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'wp5_tenant_role') THEN
    CREATE ROLE wp5_tenant_role NOLOGIN;
  END IF;
END
$roles$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role, wp5_tenant_role;

-- Minimal auth schema helpers expected by merged B1B SQL
CREATE SCHEMA IF NOT EXISTS auth;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role, wp5_tenant_role;

CREATE TABLE IF NOT EXISTS auth.users (
  id uuid PRIMARY KEY,
  email text,
  banned_until timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION auth.role()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    'anon'
  );
$$;

CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_strip_nulls(
    jsonb_build_object(
      'sub', NULLIF(current_setting('request.jwt.claim.sub', true), ''),
      'role', NULLIF(current_setting('request.jwt.claim.role', true), ''),
      'email', NULLIF(current_setting('request.jwt.claim.email', true), '')
    )
  );
$$;

-- Minimal venues (profiles.venue_id text FK-compatible; venue optional for WP5)
CREATE TABLE IF NOT EXISTS public.venues (
  id text PRIMARY KEY,
  name text NOT NULL DEFAULT 'wp5-venue'
);

INSERT INTO public.venues (id, name)
VALUES ('venue-wp5-local', 'WP5 Local Venue')
ON CONFLICT (id) DO NOTHING;

-- Minimal profiles with REAL named profiles_status_check domain
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE RESTRICT,
  email text NOT NULL,
  display_name text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT 'PLAYER',
  venue_id text NULL REFERENCES public.venues (id) ON DELETE SET NULL,
  club_id text NULL,
  player_id text NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_status_check
    CHECK (status IN ('active', 'suspended', 'invited'))
);

-- Allow SYSTEM_TECHNICIAN for directory-filter reader proofs (bootstrap only).
-- Do not constrain product roles tightly beyond WP5 needs.
DO $profiles_role$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_role_check'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (
        role IN (
          'SUPER_ADMIN',
          'SYSTEM_TECHNICIAN',
          'VENUE_OWNER',
          'VENUE_MANAGER',
          'COURT_OWNER',
          'COURT_MANAGER',
          'CASHIER',
          'ACCOUNTANT',
          'REFEREE',
          'CLUB_OWNER',
          'PLAYER'
        )
      );
  END IF;
END
$profiles_role$;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'SUPER_ADMIN'
      AND p.status = 'active'
  );
$$;

-- Minimal audit_logs contract (action CHECK widened by WP2 forward SQL)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  actor_email text DEFAULT '',
  action text NOT NULL
    CONSTRAINT audit_logs_action_check
    CHECK (action IN (
      'login', 'logout', 'create', 'update', 'delete',
      'assign_role', 'permission_change'
    )),
  resource_type text DEFAULT '',
  resource_id text DEFAULT '',
  venue_id text,
  club_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SECURITY DEFINER writers insert audit rows as function owner; grant owner path.
GRANT SELECT, INSERT ON TABLE public.audit_logs TO PUBLIC;

-- Table privilege baseline matching repository posture (tightened further by WP1/WP2)
REVOKE ALL ON TABLE public.profiles FROM PUBLIC;
GRANT SELECT ON TABLE public.profiles TO authenticated, service_role, anon;
