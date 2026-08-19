-- WAVE5_SQL_DESIGN_ONLY
-- OWNER_SQL_EXECUTION_GO=NO
-- DO_NOT_RUN_ON_STAGING
-- DO_NOT_RUN_ON_PRODUCTION
-- SQL_EXECUTED=NO
-- RLS_EXECUTED=NO
--
-- DESIGN CANDIDATE ONLY. Do not apply without a separate Owner GO.
-- Strongly state-guarded Club Tenant cutover.
--
-- STATE_LEGACY: every in-scope Club tenant_id FK is public.venues(id)
--   → materialize map, validate, translate, retarget FK
-- STATE_CANONICAL: every in-scope Club tenant_id FK is public.platform_tenants(id)
--   → DO NOT translate data, DO NOT join Club tenant_id to venues.id as source
-- STATE_UNKNOWN: mixed/other → hard abort
--
-- The DATA UPDATE itself is inside the STATE_LEGACY branch of the same DO block.
-- CANONICAL_STATE_CANNOT_EXECUTE_LEGACY_TRANSLATION=YES
-- Does NOT add clubs.venue_id.
-- Does NOT globally retire phase42_is_tenant_member.
-- Does NOT use venues.id = platform_tenants.id as a migration predicate.
-- DYNAMIC_RPC_TEXT_REWRITE_PRESENT=NO
-- ROUND2_BLOCKER_01=REMEDIATED
-- ROUND2_BLOCKER_02=REMEDIATED

BEGIN;

-- =====================================================================
-- 1. Schema-state machine + data translation (ONE DO block)
-- =====================================================================
DO $$
DECLARE
  v_clubs_fk text;
  v_members_fk text;
  v_gov_fk text;
  v_req_fk text;
  v_state text;
  v_fk_name text;
  v_fk_table text;
  v_clubs int;
  v_mapped int;
  v_bad int;
  v_mismatch int;
BEGIN
  IF to_regclass('public.clubs') IS NULL
     OR to_regclass('public.club_members') IS NULL
     OR to_regclass('public.club_governance_assignments') IS NULL
     OR to_regclass('public.club_membership_requests_v42') IS NULL
     OR to_regclass('public.venues') IS NULL
     OR to_regclass('public.platform_tenants') IS NULL THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: required tables missing';
  END IF;

  SELECT ccu.table_name INTO v_clubs_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'clubs'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
  LIMIT 1;

  SELECT ccu.table_name INTO v_members_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'club_members'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
  LIMIT 1;

  SELECT ccu.table_name INTO v_gov_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'club_governance_assignments'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
  LIMIT 1;

  SELECT ccu.table_name INTO v_req_fk
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
  JOIN information_schema.constraint_column_usage ccu
    ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
  WHERE tc.table_schema = 'public' AND tc.table_name = 'club_membership_requests_v42'
    AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
  LIMIT 1;

  IF v_clubs_fk IS NULL OR v_members_fk IS NULL OR v_gov_fk IS NULL OR v_req_fk IS NULL
     OR v_clubs_fk NOT IN ('venues', 'platform_tenants')
     OR v_members_fk NOT IN ('venues', 'platform_tenants')
     OR v_gov_fk NOT IN ('venues', 'platform_tenants')
     OR v_req_fk NOT IN ('venues', 'platform_tenants') THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: STATE_UNKNOWN clubs=% members=% gov=% req=%',
      coalesce(v_clubs_fk, '<null>'), coalesce(v_members_fk, '<null>'),
      coalesce(v_gov_fk, '<null>'), coalesce(v_req_fk, '<null>');
  END IF;

  IF v_clubs_fk = 'platform_tenants'
     AND v_members_fk = 'platform_tenants'
     AND v_gov_fk = 'platform_tenants'
     AND v_req_fk = 'platform_tenants' THEN
    v_state := 'CANONICAL';
  ELSIF v_clubs_fk = 'venues'
     AND v_members_fk = 'venues'
     AND v_gov_fk = 'venues'
     AND v_req_fk = 'venues' THEN
    v_state := 'LEGACY';
  ELSE
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: STATE_UNKNOWN mixed Club tenant FKs clubs=% members=% gov=% req=%',
      v_clubs_fk, v_members_fk, v_gov_fk, v_req_fk;
  END IF;

  PERFORM 1 FROM public.clubs FOR UPDATE;
  PERFORM 1 FROM public.club_members FOR UPDATE;
  PERFORM 1 FROM public.club_governance_assignments FOR UPDATE;
  PERFORM 1 FROM public.club_membership_requests_v42 FOR UPDATE;

  IF v_state = 'CANONICAL' THEN
    RAISE NOTICE 'WAVE5_APPLY_SKIP_TRANSLATE: Club-owned tenant_id already canonical — no Venue join, no data rewrite';
    -- STATE_CANONICAL: functions/policies below remain rerunnable.
    RETURN;
  END IF;

  -- STATE_LEGACY only from here. DATA UPDATE cannot run in CANONICAL/UNKNOWN.
  EXECUTE $map$
    CREATE TEMP TABLE wave5_club_tenant_map ON COMMIT DROP AS
    SELECT
      c.id AS club_id,
      c.tenant_id AS legacy_venue_scope_id,
      v.tenant_id AS canonical_tenant_id
    FROM public.clubs c
    LEFT JOIN public.venues v ON v.id = c.tenant_id
  $map$;

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

  SELECT count(*) INTO v_mismatch
  FROM public.club_members cm
  JOIN public.clubs c ON c.id = cm.club_id
  WHERE cm.tenant_id IS DISTINCT FROM c.tenant_id;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: % club_members.tenant_id disagree with parent Club', v_mismatch;
  END IF;
  SELECT count(*) INTO v_mismatch
  FROM public.club_governance_assignments g
  JOIN public.clubs c ON c.id = g.club_id
  WHERE g.tenant_id IS DISTINCT FROM c.tenant_id;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: % governance tenant_id disagree with parent Club', v_mismatch;
  END IF;
  SELECT count(*) INTO v_mismatch
  FROM public.club_membership_requests_v42 r
  JOIN public.clubs c ON c.id = r.club_id
  WHERE r.tenant_id IS DISTINCT FROM c.tenant_id;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'WAVE5_APPLY_ABORT: % request tenant_id disagree with parent Club', v_mismatch;
  END IF;

  FOR v_fk_name, v_fk_table IN
    SELECT tc.constraint_name, tc.table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public'
      AND tc.table_name IN (
        'clubs', 'club_members', 'club_governance_assignments', 'club_membership_requests_v42'
      )
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'tenant_id'
      AND ccu.table_name = 'venues'
  LOOP
    IF v_fk_table NOT IN (
      'clubs', 'club_members', 'club_governance_assignments', 'club_membership_requests_v42'
    ) THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: unexpected legacy FK table %', v_fk_table;
    END IF;
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_fk_table, v_fk_name);
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_phase42_gov_active_member'
      AND tgrelid = 'public.club_governance_assignments'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.club_governance_assignments DISABLE TRIGGER trg_phase42_gov_active_member';
  END IF;

  UPDATE public.clubs c
  SET tenant_id = m.canonical_tenant_id
  FROM wave5_club_tenant_map m
  WHERE c.id = m.club_id
    AND c.tenant_id IS DISTINCT FROM m.canonical_tenant_id;

  UPDATE public.club_members cm
  SET tenant_id = m.canonical_tenant_id
  FROM wave5_club_tenant_map m
  WHERE cm.club_id = m.club_id
    AND cm.tenant_id IS DISTINCT FROM m.canonical_tenant_id;

  UPDATE public.club_governance_assignments g
  SET tenant_id = m.canonical_tenant_id
  FROM wave5_club_tenant_map m
  WHERE g.club_id = m.club_id
    AND g.tenant_id IS DISTINCT FROM m.canonical_tenant_id;

  UPDATE public.club_membership_requests_v42 r
  SET tenant_id = m.canonical_tenant_id
  FROM wave5_club_tenant_map m
  WHERE r.club_id = m.club_id
    AND r.tenant_id IS DISTINCT FROM m.canonical_tenant_id;

  IF EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_phase42_gov_active_member'
      AND tgrelid = 'public.club_governance_assignments'::regclass
  ) THEN
    EXECUTE 'ALTER TABLE public.club_governance_assignments ENABLE TRIGGER trg_phase42_gov_active_member';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public' AND tc.table_name = 'clubs'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
      AND ccu.table_name = 'platform_tenants'
  ) THEN
    ALTER TABLE public.clubs
      ADD CONSTRAINT clubs_tenant_id_platform_tenants_fkey
      FOREIGN KEY (tenant_id)
      REFERENCES public.platform_tenants(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public' AND tc.table_name = 'club_members'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
      AND ccu.table_name = 'platform_tenants'
  ) THEN
    ALTER TABLE public.club_members
      ADD CONSTRAINT club_members_tenant_id_platform_tenants_fkey
      FOREIGN KEY (tenant_id)
      REFERENCES public.platform_tenants(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public' AND tc.table_name = 'club_governance_assignments'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
      AND ccu.table_name = 'platform_tenants'
  ) THEN
    ALTER TABLE public.club_governance_assignments
      ADD CONSTRAINT club_governance_assignments_tenant_id_platform_tenants_fkey
      FOREIGN KEY (tenant_id)
      REFERENCES public.platform_tenants(id)
      ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.table_schema = 'public' AND tc.table_name = 'club_membership_requests_v42'
      AND tc.constraint_type = 'FOREIGN KEY' AND kcu.column_name = 'tenant_id'
      AND ccu.table_name = 'platform_tenants'
  ) THEN
    ALTER TABLE public.club_membership_requests_v42
      ADD CONSTRAINT club_membership_requests_v42_tenant_id_platform_tenants_fkey
      FOREIGN KEY (tenant_id)
      REFERENCES public.platform_tenants(id)
      ON DELETE RESTRICT;
  END IF;

  ALTER TABLE public.clubs ALTER COLUMN tenant_id SET NOT NULL;
  ALTER TABLE public.club_members ALTER COLUMN tenant_id SET NOT NULL;
  ALTER TABLE public.club_governance_assignments ALTER COLUMN tenant_id SET NOT NULL;
  ALTER TABLE public.club_membership_requests_v42 ALTER COLUMN tenant_id SET NOT NULL;
END $$;

-- =====================================================================
-- 2. Canonical Tenant entitlement (reuse tenant_members — not Club-specific)
-- =====================================================================
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

-- Honest facility-Venue translation for Participant athlete rows.
-- athletes.tenant_id remains Venue-scoped. Never pass Club Tenant as venues.id.
-- WAVE5_ATHLETE_COMPAT_REQUIRED
-- ATHLETE_NO_CLUSTER_POLICY:
--   existing athlete for user_id → reuse (Participant unique user_id), no Venue required
--   new athlete → require registered_cluster_id → court_clusters.venue_id → venues.id
--     AND venues.tenant_id = clubs.tenant_id (canonical Platform Tenant after cutover)
--   else fail closed ATHLETE_FACILITY_VENUE_REQUIRED
--   cross-Tenant cluster: ATHLETE_FACILITY_VENUE_REQUIRED: REGISTERED_CLUSTER_TENANT_MISMATCH
--   no Tenant-as-Venue, no first/default Venue, no clubs.venue_id, no profiles.venue_id from this wrapper
-- WAVE5_ATHLETE_HELPER_DIRECT_AUTHENTICATED_EXECUTE=DENY
CREATE OR REPLACE FUNCTION public.wave5_resolve_club_facility_venue_id(p_club_id text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venue_id text;
BEGIN
  SELECT cc.venue_id
    INTO v_venue_id
  FROM public.clubs c
  INNER JOIN public.court_clusters cc ON cc.id = c.registered_cluster_id
  INNER JOIN public.venues v ON v.id = cc.venue_id
  WHERE c.id = p_club_id
    AND c.registered_cluster_id IS NOT NULL
    AND v.tenant_id = c.tenant_id
  LIMIT 1;
  IF v_venue_id IS NOT NULL THEN
    RETURN v_venue_id;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.clubs c
    INNER JOIN public.court_clusters cc ON cc.id = c.registered_cluster_id
    INNER JOIN public.venues v ON v.id = cc.venue_id
    WHERE c.id = p_club_id
      AND c.registered_cluster_id IS NOT NULL
      AND v.tenant_id IS DISTINCT FROM c.tenant_id
  ) THEN
    RAISE EXCEPTION 'ATHLETE_FACILITY_VENUE_REQUIRED: REGISTERED_CLUSTER_TENANT_MISMATCH';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.wave5_ensure_athlete_for_club_member(
  p_user_id uuid,
  p_club_id text,
  p_display_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_athlete_id uuid;
  v_venue_id text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'phase42n_ensure_athlete_for_user: p_user_id required';
  END IF;

  -- A. Existing Athlete is reusable regardless of Club facility Venue.
  SELECT a.id INTO v_athlete_id
  FROM public.athletes a
  WHERE a.user_id = p_user_id
  ORDER BY a.created_at ASC
  LIMIT 1;
  IF v_athlete_id IS NOT NULL THEN
    RETURN v_athlete_id;
  END IF;

  -- C. Creation requires independently resolved physical Venue.
  v_venue_id := public.wave5_resolve_club_facility_venue_id(p_club_id);
  IF v_venue_id IS NULL THEN
    RAISE EXCEPTION 'ATHLETE_FACILITY_VENUE_REQUIRED';
  END IF;

  RETURN public.phase42n_ensure_athlete_for_user(p_user_id, v_venue_id, p_display_name);
END;
$$;

-- Internal SECURITY DEFINER helpers. Outer Club RPCs remain the caller-facing authority.
-- PostgreSQL checks nested EXECUTE as the SECURITY DEFINER owner, not the session user,
-- so authenticated may call club_add_member / club_restore_member /
-- club_review_membership_request without direct EXECUTE on these internals.
-- Convention matches phase42n_ensure_athlete_for_user: service_role only.
REVOKE ALL ON FUNCTION public.wave5_resolve_club_facility_venue_id(text) FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.wave5_ensure_athlete_for_club_member(uuid, text, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wave5_resolve_club_facility_venue_id(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.wave5_ensure_athlete_for_club_member(uuid, text, text) TO service_role;

-- =====================================================================
-- 3. Club RPC: tenant_id is canonical Platform Tenant
-- =====================================================================
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

-- p_tenant_id means PLATFORM TENANT ID. Must NOT require venues.id == tenant id.
CREATE OR REPLACE FUNCTION public.club_create(
  p_request_id uuid,
  p_tenant_id text,
  p_name text,
  p_code text DEFAULT NULL,
  p_description text DEFAULT '',
  p_registered_cluster_id text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cached jsonb;
  v_name text := trim(coalesce(p_name, ''));
  v_code text := nullif(trim(coalesce(p_code, '')), '');
  v_tenant text := trim(coalesce(p_tenant_id, ''));
  v_cluster text := nullif(trim(coalesce(p_registered_cluster_id, '')), '');
  v_club_id text;
  v_member_id uuid;
  v_resp jsonb;
  v_limit json;
  v_is_sa boolean := public.phase42_is_platform_super_admin();
  v_assign_president boolean := public.phase42_creator_gets_president();
  v_platform_role text;
  v_cluster_venue text;
  v_cluster_tenant text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  END IF;
  IF p_request_id IS NULL THEN
    RETURN public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.');
  END IF;

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_create');
  IF v_cached IS NOT NULL THEN
    RETURN v_cached::json;
  END IF;

  IF v_tenant = '' OR NOT EXISTS (
    SELECT 1 FROM public.platform_tenants pt WHERE pt.id = v_tenant
  ) THEN
    RETURN public.phase42_err('TENANT_NOT_FOUND', 'Không tìm thấy tenant.');
  END IF;

  IF NOT public.phase42_can_create_in_tenant(v_tenant) THEN
    RETURN public.phase42_err('TENANT_FORBIDDEN', 'Không có quyền tạo CLB trong tenant này.');
  END IF;

  IF NOT v_is_sa AND NOT public.user_has_permission('club.create') THEN
    RETURN public.phase42_err('FORBIDDEN', 'Thiếu permission club.create.');
  END IF;

  v_limit := public.phase42_check_club_plan_limit(v_tenant);
  IF coalesce((v_limit->>'ok')::boolean, false) IS NOT TRUE THEN
    RETURN v_limit;
  END IF;

  IF v_name = '' THEN
    RETURN public.phase42_err('NAME_REQUIRED', 'Thiếu tên CLB.');
  END IF;

  IF v_cluster IS NOT NULL THEN
    IF to_regclass('public.court_clusters') IS NULL THEN
      RETURN public.phase42_err('CLUSTER_NOT_FOUND', 'Không tìm thấy cụm sân.');
    END IF;
    SELECT cc.venue_id, v.tenant_id
      INTO v_cluster_venue, v_cluster_tenant
    FROM public.court_clusters cc
    JOIN public.venues v ON v.id = cc.venue_id
    WHERE cc.id = v_cluster;
    IF v_cluster_venue IS NULL THEN
      RETURN public.phase42_err('CLUSTER_NOT_FOUND', 'Không tìm thấy cụm sân.');
    END IF;
    IF v_cluster_tenant IS DISTINCT FROM v_tenant THEN
      RETURN public.phase42_err('CLUSTER_TENANT_MISMATCH', 'Cụm sân không thuộc tenant này.');
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.tenant_id = v_tenant
      AND c.deleted_at IS NULL
      AND lower(c.name) = lower(v_name)
  ) THEN
    RETURN public.phase42_err('DUPLICATE_NAME', 'Tên CLB đã tồn tại trong tenant này.');
  END IF;

  IF v_code IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.tenant_id = v_tenant
      AND c.deleted_at IS NULL
      AND c.code = v_code
  ) THEN
    RETURN public.phase42_err('DUPLICATE_CODE', 'Mã CLB đã tồn tại trong tenant này.');
  END IF;

  SELECT upper(coalesce(role, '')) INTO v_platform_role
  FROM public.profiles WHERE id = auth.uid();

  v_club_id := 'club-' || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.clubs (
    id, tenant_id, name, code, description, status,
    registered_cluster_id, created_by_user_id, version
  ) VALUES (
    v_club_id, v_tenant, v_name, v_code, coalesce(p_description, ''),
    'active', v_cluster, auth.uid(), 1
  );

  IF NOT v_is_sa THEN
    INSERT INTO public.club_members (
      tenant_id, club_id, user_id, membership_type, status, version
    ) VALUES (
      v_tenant, v_club_id, auth.uid(), 'regular', 'active', 1
    )
    RETURNING id INTO v_member_id;

    INSERT INTO public.club_governance_assignments (
      tenant_id, club_id, club_member_id, role_code, status, version
    ) VALUES (
      v_tenant, v_club_id, v_member_id, 'club_owner', 'active', 1
    );

    IF v_assign_president THEN
      INSERT INTO public.club_governance_assignments (
        tenant_id, club_id, club_member_id, role_code, status, version
      ) VALUES (
        v_tenant, v_club_id, v_member_id, 'president', 'active', 1
      );
    END IF;
  END IF;

  PERFORM public.phase42_write_audit(
    'club.create',
    'club',
    v_club_id,
    v_tenant,
    v_club_id,
    jsonb_build_object(
      'request_id', p_request_id,
      'super_admin_no_member', v_is_sa,
      'creator_member_id', v_member_id,
      'assigned_owner', NOT v_is_sa,
      'assigned_president', (NOT v_is_sa AND v_assign_president),
      'platform_role_unchanged', v_platform_role,
      'owner_scope', 'club_only',
      'scope_semantics', 'canonical_platform_tenant'
    )
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', public.phase42_club_canonical(v_club_id),
    'version', 1
  );

  PERFORM public.phase42_idempotency_put(p_request_id, v_tenant, 'club_create', v_name, v_resp);
  RETURN v_resp::json;

EXCEPTION
  WHEN unique_violation THEN
    RETURN public.phase42_err('DUPLICATE_CLUB', 'CLB trùng tên hoặc mã trong tenant.');
  WHEN raise_exception THEN
    RETURN public.phase42_err('CREATE_FAILED', sqlerrm);
  WHEN others THEN
    RETURN public.phase42_err('CREATE_FAILED', coalesce(sqlerrm, 'Không tạo được CLB.'));
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

CREATE OR REPLACE FUNCTION public.club_list_members(p_club_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club public.clubs%rowtype;
  v_rows jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  END IF;

  SELECT * INTO v_club FROM public.clubs WHERE id = trim(coalesce(p_club_id, '')) AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RETURN public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.');
  END IF;

  IF NOT (
    public.phase42_is_platform_super_admin()
    OR public.platform_is_canonical_tenant_entitled(v_club.tenant_id)
    OR public.phase42_active_club_member_id(v_club.id) IS NOT NULL
  ) THEN
    RETURN public.phase42_err('FORBIDDEN', 'Không có quyền xem thành viên.');
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', cm.id,
    'user_id', cm.user_id,
    'display_name', coalesce(p.display_name, p.email, cm.user_id::text),
    'status', cm.status,
    'membership_type', cm.membership_type,
    'governance_roles', coalesce((
      SELECT jsonb_agg(g.role_code)
      FROM public.club_governance_assignments g
      WHERE g.club_member_id = cm.id AND g.status = 'active'
    ), '[]'::jsonb),
    'joined_at', cm.joined_at,
    'version', cm.version
  ) ORDER BY cm.joined_at), '[]'::jsonb)
    INTO v_rows
  FROM public.club_members cm
  LEFT JOIN public.profiles p ON p.id = cm.user_id
  WHERE cm.club_id = v_club.id;

  RETURN json_build_object('ok', true, 'data', v_rows);
END;
$$;

-- Club authz helpers: keep tenant_owner via tenant_members; remove Venue ID == Tenant ID.
CREATE OR REPLACE FUNCTION public.phase42_can_update_club(p_club_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.phase42_is_platform_super_admin()
    OR public.phase42_has_gov_role(p_club_id, ARRAY['club_owner', 'president'])
    OR EXISTS (
      SELECT 1
      FROM public.clubs c
      WHERE c.id = p_club_id
        AND c.deleted_at IS NULL
        AND public.user_has_permission('club.update')
        AND public.platform_is_canonical_tenant_entitled(c.tenant_id)
        AND EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.tenant_id = c.tenant_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND tm.role_code = 'tenant_owner'
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.phase42_can_assign_club_owner(p_club_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.phase42_is_platform_super_admin()
    OR EXISTS (
      SELECT 1
      FROM public.clubs c
      WHERE c.id = p_club_id
        AND c.deleted_at IS NULL
        AND (
          public.user_has_permission('club.governance.assign_owner')
          OR public.user_has_permission('club.update')
        )
        AND EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.tenant_id = c.tenant_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND tm.role_code = 'tenant_owner'
        )
    );
$$;

CREATE OR REPLACE FUNCTION public.phase42_can_transfer_president(p_club_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.phase42_is_platform_super_admin()
    OR public.phase42_has_gov_role(p_club_id, ARRAY['club_owner', 'president'])
    OR EXISTS (
      SELECT 1
      FROM public.clubs c
      WHERE c.id = p_club_id
        AND c.deleted_at IS NULL
        AND public.user_has_permission('club.update')
        AND EXISTS (
          SELECT 1
          FROM public.tenant_members tm
          WHERE tm.tenant_id = c.tenant_id
            AND tm.user_id = auth.uid()
            AND tm.status = 'active'
            AND tm.role_code = 'tenant_owner'
        )
    );
$$;

-- WAVE5_ATHLETE_COMPAT_REQUIRED — explicit reviewed Club RPC bodies.
-- DYNAMIC_RPC_TEXT_REWRITE_PRESENT=NO
-- Authoritative sources:
--   club_add_member: docs/v5/phase45a4c1/PHASE_45A4C1_MEMBER_RPC.sql
--   club_restore_member: docs/v5/phase45a4d1/PHASE_45A4D1_MEMBER_RESTORE_RPC.sql
--   club_review_membership_request: docs/v5/PHASE_42N_ATHLETE_MEMBERSHIP_BACKFILL.sql
-- Wave 5 delta only: athlete ensure via wave5_ensure_athlete_for_club_member (Club id, not Club tenant_id).

CREATE OR REPLACE FUNCTION public.club_add_member(
  p_request_id uuid,
  p_club_id text,
  p_target_user_id uuid,
  p_membership_type text default 'regular',
  p_expected_version integer default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cached jsonb;
  v_club public.clubs%rowtype;
  v_member public.club_members%rowtype;
  v_left public.club_members%rowtype;
  v_membership_type text;
  v_athlete_id uuid;
  v_display_name text;
  v_reactivated boolean := false;
  v_resp jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  END IF;

  IF p_request_id IS NULL THEN
    RETURN public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.');
  END IF;

  IF p_target_user_id IS NULL THEN
    RETURN public.phase42_err('VALIDATION', 'Thiếu target user_id.');
  END IF;

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_add_member');
  IF v_cached IS NOT NULL THEN
    RETURN v_cached::json;
  END IF;

  SELECT * INTO v_club
  FROM public.clubs
  WHERE id = trim(coalesce(p_club_id, ''))
    AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.');
  END IF;

  IF NOT (
    public.phase42_is_platform_super_admin()
    OR public.phase42_can_review_membership(v_club.id)
  ) THEN
    RETURN public.phase42_err('FORBIDDEN', 'Không có quyền thêm thành viên.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_target_user_id) THEN
    RETURN public.phase42_err('NOT_FOUND', 'Không tìm thấy người dùng đích.');
  END IF;

  v_membership_type := nullif(trim(coalesce(p_membership_type, '')), '');
  IF v_membership_type IS NULL THEN
    v_membership_type := 'regular';
  END IF;

  SELECT * INTO v_member
  FROM public.club_members
  WHERE club_id = v_club.id
    AND user_id = p_target_user_id
    AND status = 'active'
  FOR UPDATE;
  IF FOUND THEN
    RETURN public.phase42_err('ALREADY_MEMBER', 'Người dùng đã là thành viên active.');
  END IF;

  SELECT * INTO v_left
  FROM public.club_members
  WHERE club_id = v_club.id
    AND user_id = p_target_user_id
    AND status = 'left'
  ORDER BY left_at DESC NULLS LAST, updated_at DESC, created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF p_expected_version IS NOT NULL AND v_left.version IS DISTINCT FROM p_expected_version THEN
      RETURN public.phase42_err('VERSION_CONFLICT', 'Phiên bản thành viên đã thay đổi.');
    END IF;

    SELECT coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), p_target_user_id::text)
      INTO v_display_name
    FROM public.profiles p
    WHERE p.id = p_target_user_id;

    v_athlete_id := coalesce(
      v_left.athlete_id,
      public.wave5_ensure_athlete_for_club_member(
        p_target_user_id,
        v_club.id,
        v_display_name
      )
    );

    UPDATE public.club_members
    SET status = 'active',
        left_at = NULL,
        membership_type = v_membership_type,
        athlete_id = v_athlete_id,
        joined_at = coalesce(joined_at, now()),
        version = version + 1,
        updated_at = now()
    WHERE id = v_left.id
    RETURNING * INTO v_member;

    v_reactivated := true;
  ELSE
    IF EXISTS (
      SELECT 1
      FROM public.club_members
      WHERE club_id = v_club.id
        AND user_id = p_target_user_id
        AND status = 'removed'
    ) THEN
      RETURN public.phase42_err(
        'CONFLICT',
        'Thành viên đã bị gỡ (removed). Dùng quy trình restore riêng.'
      );
    END IF;

    SELECT coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), p_target_user_id::text)
      INTO v_display_name
    FROM public.profiles p
    WHERE p.id = p_target_user_id;

    v_athlete_id := public.wave5_ensure_athlete_for_club_member(
      p_target_user_id,
      v_club.id,
      v_display_name
    );

    INSERT INTO public.club_members (
      tenant_id, club_id, user_id, athlete_id, membership_type, status, version
    )
    VALUES (
      v_club.tenant_id, v_club.id, p_target_user_id, v_athlete_id,
      v_membership_type, 'active', 1
    )
    RETURNING * INTO v_member;
  END IF;

  PERFORM public.phase42_write_audit(
    'club.member.add',
    'club_member',
    v_member.id::text,
    v_club.tenant_id,
    v_club.id,
    jsonb_build_object(
      'request_id', p_request_id,
      'target_user_id', p_target_user_id,
      'member_id', v_member.id,
      'athlete_id', v_member.athlete_id,
      'reactivated', v_reactivated,
      'membership_type', v_member.membership_type
    )
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'id', v_member.id,
      'club_id', v_club.id,
      'user_id', v_member.user_id,
      'athlete_id', v_member.athlete_id,
      'status', v_member.status,
      'membership_type', v_member.membership_type,
      'reactivated', v_reactivated
    ),
    'version', v_member.version
  );

  PERFORM public.phase42_idempotency_put(
    p_request_id,
    v_club.tenant_id,
    'club_add_member',
    v_member.id::text,
    v_resp
  );

  RETURN v_resp::json;
EXCEPTION
  WHEN unique_violation THEN
    RETURN public.phase42_err('ALREADY_MEMBER', 'Người dùng đã là thành viên active.');
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'ATHLETE_FACILITY_VENUE_REQUIRED%' THEN
      RETURN public.phase42_err(
        'ATHLETE_FACILITY_VENUE_REQUIRED',
        'CLB chưa đăng ký cụm sân hợp lệ. Không thể tạo hồ sơ VĐV mới khi thiếu cơ sở.'
      );
    END IF;
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.club_add_member(uuid, text, uuid, text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.club_restore_member(
  p_request_id uuid,
  p_club_id text,
  p_target_user_id uuid,
  p_expected_version integer default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cached jsonb;
  v_club public.clubs%rowtype;
  v_active public.club_members%rowtype;
  v_removed public.club_members%rowtype;
  v_member public.club_members%rowtype;
  v_from_version integer;
  v_athlete_id uuid;
  v_display_name text;
  v_resp jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  END IF;

  IF p_request_id IS NULL THEN
    RETURN public.phase42_err('REQUEST_ID_REQUIRED', 'Thiếu request_id.');
  END IF;

  IF p_target_user_id IS NULL THEN
    RETURN public.phase42_err('VALIDATION', 'Thiếu target user_id.');
  END IF;

  v_cached := public.phase42_idempotency_get(p_request_id, 'club_restore_member');
  IF v_cached IS NOT NULL THEN
    RETURN v_cached::json;
  END IF;

  SELECT * INTO v_club
  FROM public.clubs
  WHERE id = trim(coalesce(p_club_id, ''))
    AND deleted_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RETURN public.phase42_err('NOT_FOUND', 'Không tìm thấy CLB.');
  END IF;

  IF NOT (
    public.phase42_is_platform_super_admin()
    OR public.phase42_can_review_membership(v_club.id)
  ) THEN
    RETURN public.phase42_err('FORBIDDEN', 'Không có quyền khôi phục thành viên.');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_target_user_id) THEN
    RETURN public.phase42_err('NOT_FOUND', 'Không tìm thấy người dùng đích.');
  END IF;

  SELECT * INTO v_active
  FROM public.club_members
  WHERE club_id = v_club.id
    AND user_id = p_target_user_id
    AND status = 'active'
  FOR UPDATE;
  IF FOUND THEN
    RETURN public.phase42_err('ALREADY_MEMBER', 'Người dùng đã là thành viên active.');
  END IF;

  SELECT * INTO v_removed
  FROM public.club_members
  WHERE club_id = v_club.id
    AND user_id = p_target_user_id
    AND status = 'removed'
  ORDER BY left_at DESC NULLS LAST, updated_at DESC, created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    IF p_expected_version IS NOT NULL AND v_removed.version IS DISTINCT FROM p_expected_version THEN
      RETURN public.phase42_err('VERSION_CONFLICT', 'Phiên bản thành viên đã thay đổi.');
    END IF;

    v_from_version := v_removed.version;

    SELECT coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), p_target_user_id::text)
      INTO v_display_name
    FROM public.profiles p
    WHERE p.id = p_target_user_id;

    v_athlete_id := coalesce(
      v_removed.athlete_id,
      public.wave5_ensure_athlete_for_club_member(
        p_target_user_id,
        v_club.id,
        v_display_name
      )
    );

    UPDATE public.club_members
    SET status = 'active',
        left_at = NULL,
        athlete_id = v_athlete_id,
        version = version + 1,
        updated_at = now()
    WHERE id = v_removed.id
    RETURNING * INTO v_member;

    PERFORM public.phase42_write_audit(
      'club.member.restore',
      'club_member',
      v_member.id::text,
      v_club.tenant_id,
      v_club.id,
      jsonb_build_object(
        'request_id', p_request_id,
        'target_user_id', p_target_user_id,
        'member_id', v_member.id,
        'from_version', v_from_version,
        'prior_status', 'removed',
        'target_status', 'active',
        'membership_type', v_member.membership_type
      )
    );

    v_resp := jsonb_build_object(
      'ok', true,
      'data', jsonb_build_object(
        'id', v_member.id,
        'club_id', v_club.id,
        'user_id', v_member.user_id,
        'athlete_id', v_member.athlete_id,
        'status', v_member.status,
        'membership_type', v_member.membership_type,
        'restored', true,
        'from_version', v_from_version
      ),
      'version', v_member.version
    );

    PERFORM public.phase42_idempotency_put(
      p_request_id,
      v_club.tenant_id,
      'club_restore_member',
      v_member.id::text,
      v_resp
    );

    RETURN v_resp::json;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.club_members
    WHERE club_id = v_club.id
      AND user_id = p_target_user_id
      AND status = 'left'
  ) THEN
    RETURN public.phase42_err(
      'CONFLICT',
      'Thành viên đang ở trạng thái left. Dùng club_add_member để tái kích hoạt.'
    );
  END IF;

  RETURN public.phase42_err(
    'NOT_FOUND',
    'Không có lịch sử removed. Dùng club_add_member để thêm thành viên mới.'
  );
EXCEPTION
  WHEN unique_violation THEN
    RETURN public.phase42_err('ALREADY_MEMBER', 'Người dùng đã là thành viên active.');
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'ATHLETE_FACILITY_VENUE_REQUIRED%' THEN
      RETURN public.phase42_err(
        'ATHLETE_FACILITY_VENUE_REQUIRED',
        'CLB chưa đăng ký cụm sân hợp lệ. Không thể tạo hồ sơ VĐV mới khi thiếu cơ sở.'
      );
    END IF;
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.club_restore_member(uuid, text, uuid, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.club_review_membership_request(
  p_request_id uuid,
  p_membership_request_id uuid,
  p_decision text,
  p_review_note text default null,
  p_expected_version integer default null
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.club_membership_requests_v42%rowtype;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_member_id uuid;
  v_athlete_id uuid;
  v_resp json;
  v_display_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN public.phase42_err('NOT_AUTHENTICATED', 'Chưa đăng nhập.');
  END IF;

  IF v_decision NOT IN ('approved', 'rejected') THEN
    RETURN public.phase42_err('VALIDATION', 'decision phải là approved hoặc rejected.');
  END IF;

  SELECT * INTO v_row
  FROM public.club_membership_requests_v42
  WHERE id = p_membership_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN public.phase42_err('NOT_FOUND', 'Không tìm thấy yêu cầu.');
  END IF;

  IF NOT public.phase42_has_gov_role(v_row.club_id, ARRAY['club_owner','president','vice_president'])
     AND NOT public.phase42_is_platform_super_admin() THEN
    RETURN public.phase42_err('FORBIDDEN', 'Không có quyền duyệt yêu cầu.');
  END IF;

  IF v_row.status <> 'pending' THEN
    RETURN public.phase42_err('CONFLICT', 'Yêu cầu không còn ở trạng thái pending.');
  END IF;

  IF p_expected_version IS NOT NULL AND v_row.version IS DISTINCT FROM p_expected_version THEN
    RETURN public.phase42_err('VERSION_CONFLICT', 'Phiên bản yêu cầu đã thay đổi.');
  END IF;

  UPDATE public.club_membership_requests_v42
  SET status = v_decision,
      reviewed_by = auth.uid(),
      reviewed_at = now(),
      review_note = p_review_note,
      version = version + 1,
      updated_at = now()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  IF v_decision = 'approved' THEN
    SELECT id, athlete_id INTO v_member_id, v_athlete_id
    FROM public.club_members
    WHERE club_id = v_row.club_id
      AND user_id = v_row.user_id
      AND status = 'active';

    IF v_member_id IS NULL THEN
      SELECT coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), v_row.user_id::text)
        INTO v_display_name
      FROM public.profiles p
      WHERE p.id = v_row.user_id;

      v_athlete_id := public.wave5_ensure_athlete_for_club_member(
        v_row.user_id,
        v_row.club_id,
        v_display_name
      );

      INSERT INTO public.club_members (
        tenant_id, club_id, user_id, athlete_id, membership_type, status, version
      )
      VALUES (
        v_row.tenant_id, v_row.club_id, v_row.user_id, v_athlete_id, 'regular', 'active', 1
      )
      RETURNING id INTO v_member_id;
    ELSIF v_athlete_id IS NULL THEN
      SELECT coalesce(nullif(trim(p.display_name), ''), nullif(trim(p.email), ''), v_row.user_id::text)
        INTO v_display_name
      FROM public.profiles p
      WHERE p.id = v_row.user_id;

      v_athlete_id := public.wave5_ensure_athlete_for_club_member(
        v_row.user_id,
        v_row.club_id,
        v_display_name
      );

      UPDATE public.club_members
      SET athlete_id = v_athlete_id,
          updated_at = now(),
          version = version + 1
      WHERE id = v_member_id;
    END IF;
  END IF;

  PERFORM public.phase42_write_audit(
    'club.membership_request.review',
    'club_membership_request',
    v_row.id::text,
    v_row.tenant_id,
    v_row.club_id,
    jsonb_build_object(
      'decision', v_decision,
      'request_id', p_request_id,
      'member_id', v_member_id,
      'athlete_id', v_athlete_id
    )
  );

  v_resp := jsonb_build_object(
    'ok', true,
    'data', jsonb_build_object(
      'id', v_row.id,
      'club_id', v_row.club_id,
      'user_id', v_row.user_id,
      'status', v_decision,
      'member_id', v_member_id,
      'athlete_id', v_athlete_id
    ),
    'version', v_row.version
  );

  PERFORM public.phase42_idempotency_put(
    p_request_id,
    v_row.tenant_id,
    'club_review_membership_request',
    v_row.id::text,
    v_resp
  );

  RETURN v_resp::json;
EXCEPTION
  WHEN OTHERS THEN
    IF SQLERRM LIKE 'ATHLETE_FACILITY_VENUE_REQUIRED%' THEN
      RETURN public.phase42_err(
        'ATHLETE_FACILITY_VENUE_REQUIRED',
        'CLB chưa đăng ký cụm sân hợp lệ. Không thể tạo hồ sơ VĐV mới khi thiếu cơ sở.'
      );
    END IF;
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.club_review_membership_request(uuid, uuid, text, text, integer) TO authenticated;

-- =====================================================================
-- 4. Club RLS — canonical tenant entitlement. Do not globally retire helper.
-- =====================================================================
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

DROP POLICY IF EXISTS club_members_select ON public.club_members;
CREATE POLICY club_members_select ON public.club_members
  FOR SELECT TO authenticated
  USING (
    public.phase42_is_platform_super_admin()
    OR user_id = auth.uid()
    OR public.platform_is_canonical_tenant_entitled(tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.club_members self
      WHERE self.club_id = club_members.club_id
        AND self.user_id = auth.uid()
        AND self.status = 'active'
    )
  );

DROP POLICY IF EXISTS club_gov_select ON public.club_governance_assignments;
CREATE POLICY club_gov_select ON public.club_governance_assignments
  FOR SELECT TO authenticated
  USING (
    public.phase42_is_platform_super_admin()
    OR public.platform_is_canonical_tenant_entitled(tenant_id)
    OR EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = club_governance_assignments.club_id
        AND cm.user_id = auth.uid()
        AND cm.status = 'active'
    )
  );

COMMIT;
