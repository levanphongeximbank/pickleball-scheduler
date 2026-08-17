-- Wave 4 Staging remediation — 03_APPLY_TENANT_MEMBERS_RLS_AND_GRANTS.sql
-- AUTHOR ONLY. DO NOT EXECUTE without Owner RLS_EXECUTION_GO for this file.
-- SQL_EXECUTION_GO = NO
-- RLS_EXECUTION_GO = NO
--
-- A. Revoke TRUNCATE from anon, authenticated.
-- B. Canonical SELECT: Super Admin global read OR own user_id = auth.uid().
-- C. Preserve RLS enabled. Do NOT enable FORCE RLS.
-- D. Do not modify user_tenant_id().
-- E. Do not globally replace phase42_is_tenant_member.
-- F. Do not modify Production.

REVOKE TRUNCATE ON public.tenant_members FROM anon, authenticated;

-- Inventory remaining dangerous grants (read by 05_VERIFY). This apply does
-- not revoke SELECT. Direct DML remains revoked if already revoked.
REVOKE INSERT, UPDATE, DELETE ON public.tenant_members FROM anon, authenticated;

DO $$
DECLARE
  rec record;
  using_expr text;
BEGIN
  IF to_regclass('public.tenant_members') IS NULL THEN
    RAISE EXCEPTION 'WAVE4_RLS_ABORT: public.tenant_members missing';
  END IF;

  -- Do not FORCE RLS.
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'tenant_members'
      AND c.relforcerowsecurity
  ) THEN
    RAISE NOTICE 'WAVE4_RLS: FORCE RLS already on; this package will not change FORCE RLS';
  END IF;

  ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

  FOR rec IN
    SELECT pol.polname, pg_get_expr(pol.polqual, pol.polrelid) AS using_expr
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'tenant_members'
      AND pol.polcmd = 'r'
  LOOP
    using_expr := coalesce(rec.using_expr, '');
    IF using_expr ILIKE '%phase42_is_tenant_member%'
       OR using_expr ILIKE '%venue_id%'
       OR rec.polname = 'tenant_members_select' THEN
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.tenant_members', rec.polname);
      RAISE NOTICE 'WAVE4_RLS: dropped SELECT policy %', rec.polname;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'tenant_members'
      AND pol.polname = 'tenant_members_select'
  ) THEN
    CREATE POLICY tenant_members_select ON public.tenant_members
      FOR SELECT TO authenticated
      USING (
        public.phase42_is_platform_super_admin()
        OR user_id = auth.uid()
      );
    RAISE NOTICE 'WAVE4_RLS: created canonical tenant_members_select';
  END IF;
END $$;

GRANT SELECT ON public.tenant_members TO authenticated;
