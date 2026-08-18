-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
-- RLS_EXECUTED=NO
--
-- DESIGN CANDIDATE ONLY. Do not apply without a separate Owner GO.
-- Translates clubs.tenant_id from legacy Venue ID to canonical Platform Tenant ID.
-- Does NOT add clubs.venue_id.
-- Does NOT globally retire phase42_is_tenant_member.
--
-- Sequence:
-- 1. assert schema
-- 2. materialize Venue-scope → Tenant map
-- 3. validate mapping
-- 4. drop exact legacy clubs.tenant_id → venues(id) FK
-- 5. update clubs.tenant_id from mapping
-- 6. add clubs.tenant_id → platform_tenants(id) ON DELETE RESTRICT
-- 7. preserve NOT NULL
-- 8–10. Club RPC + Club RLS canonical Tenant entitlement
-- 11–13. verify counts (also see 03_VERIFY.sql)

BEGIN;

DO $$
DECLARE
  v_fk_target text;
BEGIN
  IF to_regclass('public.clubs') IS NULL
     OR to_regclass('public.venues') IS NULL
     OR to_regclass('public.platform_tenants') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: required tables missing';
  END IF;

  SELECT ccu.table_name INTO v_fk_target
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'clubs'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'tenant_id'
  LIMIT 1;

  IF v_fk_target IS DISTINCT FROM 'venues' AND v_fk_target IS DISTINCT FROM 'platform_tenants' THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: unexpected clubs.tenant_id FK target %', v_fk_target;
  END IF;

  PERFORM 1 FROM public.clubs FOR UPDATE;
END $$;

CREATE TEMP TABLE wave5_club_tenant_map ON COMMIT DROP AS
SELECT
  c.id AS club_id,
  c.tenant_id AS legacy_venue_scope_id,
  v.tenant_id AS canonical_tenant_id
FROM public.clubs c
LEFT JOIN public.venues v ON v.id = c.tenant_id;

DO $$
DECLARE
  v_fk_target text;
  v_clubs int;
  v_mapped int;
  v_bad int;
BEGIN
  SELECT ccu.table_name INTO v_fk_target
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'clubs'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'tenant_id'
  LIMIT 1;

  IF v_fk_target = 'platform_tenants' THEN
    RAISE NOTICE 'WAVE5_APPLY_SKIP_TRANSLATE: clubs.tenant_id already canonical';
    RETURN;
  END IF;

  SELECT count(*) INTO v_clubs FROM public.clubs;
  SELECT count(*) INTO v_mapped
  FROM wave5_club_tenant_map
  WHERE canonical_tenant_id IS NOT NULL;

  IF v_clubs <> v_mapped THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: mapping incomplete clubs=% mapped=%', v_clubs, v_mapped;
  END IF;

  SELECT count(*) INTO v_bad
  FROM wave5_club_tenant_map m
  WHERE m.canonical_tenant_id IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM public.platform_tenants pt WHERE pt.id = m.canonical_tenant_id
     );
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: % clubs lack a canonical Tenant', v_bad;
  END IF;
END $$;

DO $$
DECLARE
  v_fk_name text;
  v_fk_target text;
BEGIN
  SELECT tc.constraint_name, ccu.table_name
    INTO v_fk_name, v_fk_target
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name
   AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'clubs'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'tenant_id'
  LIMIT 1;

  IF v_fk_target = 'venues' AND v_fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.clubs DROP CONSTRAINT %I', v_fk_name);
  END IF;
END $$;

UPDATE public.clubs c
SET tenant_id = m.canonical_tenant_id,
    updated_at = now()
FROM wave5_club_tenant_map m
WHERE c.id = m.club_id
  AND m.canonical_tenant_id IS NOT NULL
  AND c.tenant_id IS DISTINCT FROM m.canonical_tenant_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name = 'clubs'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'tenant_id'
      AND ccu.table_name = 'platform_tenants'
  ) THEN
    ALTER TABLE public.clubs
      ADD CONSTRAINT clubs_tenant_id_platform_tenants_fkey
      FOREIGN KEY (tenant_id)
      REFERENCES public.platform_tenants(id)
      ON DELETE RESTRICT;
  END IF;

  ALTER TABLE public.clubs ALTER COLUMN tenant_id SET NOT NULL;
END $$;

-- Neutral Platform/Tenant entitlement predicate (not Club-specific authority).
-- Based on Wave 4: tenant_members + canonical Super Admin.
-- Does not use profiles.venue_id, Venue coincidence, selected context, or
-- profiles.tenant_id alone. Membership is explicit.
CREATE OR REPLACE FUNCTION public.platform_is_canonical_tenant_entitled(p_tenant_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT coalesce(public.phase42_is_platform_super_admin(), false)
         OR exists (
           SELECT 1
           FROM public.tenant_members tm
           WHERE tm.tenant_id = p_tenant_id
             AND tm.user_id = auth.uid()
             AND tm.status = 'active'
         );
$$;

REVOKE ALL ON FUNCTION public.platform_is_canonical_tenant_entitled(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.platform_is_canonical_tenant_entitled(text) TO authenticated;

-- Club RPC: tenant_id is now canonical Platform Tenant. Explicit semantic marker
-- so the client can distinguish pre-SQL vs post-SQL without ID-equality heuristics.
CREATE OR REPLACE FUNCTION public.phase42_club_canonical(p_club_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club public.clubs%rowtype;
  v_owner_name text;
  v_president_name text;
  v_owner_user uuid;
  v_president_user uuid;
  v_member_count int;
BEGIN
  SELECT * INTO v_club FROM public.clubs WHERE id = p_club_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT cm.user_id, coalesce(p.display_name, p.email, cm.user_id::text)
    INTO v_owner_user, v_owner_name
  FROM public.club_governance_assignments g
  JOIN public.club_members cm ON cm.id = g.club_member_id
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  WHERE g.club_id = p_club_id AND g.status = 'active' AND g.role_code = 'club_owner'
  LIMIT 1;

  SELECT cm.user_id, coalesce(p.display_name, p.email, cm.user_id::text)
    INTO v_president_user, v_president_name
  FROM public.club_governance_assignments g
  JOIN public.club_members cm ON cm.id = g.club_member_id
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  WHERE g.club_id = p_club_id AND g.status = 'active' AND g.role_code = 'president'
  LIMIT 1;

  SELECT count(*)::int INTO v_member_count
  FROM public.club_members
  WHERE club_id = p_club_id AND status = 'active';

  RETURN jsonb_build_object(
    'id', v_club.id,
    'tenant_id', v_club.tenant_id,
    'canonical_tenant_id', v_club.tenant_id,
    'scope_semantics', 'canonical_platform_tenant',
    'legacy_venue_scope_id', NULL,
    'name', v_club.name,
    'code', v_club.code,
    'description', v_club.description,
    'status', v_club.status,
    'registered_cluster_id', v_club.registered_cluster_id,
    'version', v_club.version,
    'created_by_user_id', v_club.created_by_user_id,
    'created_at', v_club.created_at,
    'updated_at', v_club.updated_at,
    'owner_user_id', v_owner_user,
    'owner_label', v_owner_name,
    'president_user_id', v_president_user,
    'president_label', v_president_name,
    'active_member_count', v_member_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.club_list_registry(
  p_tenant_id text DEFAULT NULL,
  p_include_inactive boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  END IF;

  SELECT coalesce(jsonb_agg(public.phase42_club_canonical(c.id) ORDER BY c.name), '[]'::jsonb)
    INTO v_rows
  FROM public.clubs c
  WHERE c.deleted_at IS NULL
    AND (p_tenant_id IS NULL OR c.tenant_id = p_tenant_id)
    AND (p_include_inactive OR c.status = 'active')
    AND (
      public.phase42_is_platform_super_admin()
      OR public.platform_is_canonical_tenant_entitled(c.tenant_id)
    );

  RETURN json_build_object('ok', true, 'data', v_rows);
END;
$$;

-- Club RLS only: canonical tenant entitlement. Do not broaden SELECT.
-- Do not change tenant_members / Identity / Court / Referee RLS.
-- Do not globally retire phase42_is_tenant_member.
DROP POLICY IF EXISTS clubs_select ON public.clubs;
CREATE POLICY clubs_select ON public.clubs
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND (
      public.phase42_is_platform_super_admin()
      OR public.platform_is_canonical_tenant_entitled(tenant_id)
      OR public.phase42_active_club_member_id(id) IS NOT NULL
    )
  );

COMMIT;
