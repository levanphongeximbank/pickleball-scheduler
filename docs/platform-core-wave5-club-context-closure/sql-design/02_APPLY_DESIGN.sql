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
CREATE OR REPLACE FUNCTION public.wave5_resolve_club_facility_venue_id(p_club_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cc.venue_id
  FROM public.clubs c
  JOIN public.court_clusters cc ON cc.id = c.registered_cluster_id
  WHERE c.id = p_club_id
  LIMIT 1;
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
  v_venue_id text;
BEGIN
  v_venue_id := public.wave5_resolve_club_facility_venue_id(p_club_id);
  RETURN public.phase42n_ensure_athlete_for_user(p_user_id, v_venue_id, p_display_name);
END;
$$;

REVOKE ALL ON FUNCTION public.wave5_resolve_club_facility_venue_id(text) FROM public, anon;
REVOKE ALL ON FUNCTION public.wave5_ensure_athlete_for_club_member(uuid, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.wave5_resolve_club_facility_venue_id(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.wave5_ensure_athlete_for_club_member(uuid, text, text) TO authenticated;

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

-- WAVE5_ATHLETE_COMPAT_REQUIRED — rewrite live Club RPC athlete-ensure calls.
DO $$
DECLARE
  v_name text;
  v_def text;
  v_next text;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'club_add_member',
    'club_restore_member',
    'club_review_membership_request'
  ]
  LOOP
    SELECT pg_get_functiondef(p.oid) INTO v_def
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = v_name
    ORDER BY p.oid
    LIMIT 1;
    IF v_def IS NULL THEN
      RAISE NOTICE 'WAVE5_APPLY: % not present — skip athlete compat rewrite', v_name;
      CONTINUE;
    END IF;
    v_next := regexp_replace(
      v_def,
      'public\.phase42n_ensure_athlete_for_user[[:space:]]*\([[:space:]]*([^,]+),[[:space:]]*v_club\.tenant_id[[:space:]]*,',
      'public.wave5_ensure_athlete_for_club_member(\1, v_club.id,',
      'g'
    );
    v_next := regexp_replace(
      v_next,
      'public\.phase42n_ensure_athlete_for_user[[:space:]]*\([[:space:]]*([^,]+),[[:space:]]*v_row\.tenant_id[[:space:]]*,',
      'public.wave5_ensure_athlete_for_club_member(\1, v_row.club_id,',
      'g'
    );
    IF v_next ~ 'phase42n_ensure_athlete_for_user'
       AND (v_next ~ 'v_club\.tenant_id' OR v_next ~ 'v_row\.tenant_id') THEN
      RAISE EXCEPTION 'WAVE5_APPLY_ABORT: % still passes Club tenant_id into athlete helper', v_name;
    END IF;
    IF v_next IS DISTINCT FROM v_def THEN
      EXECUTE v_next;
    END IF;
  END LOOP;
END $$;

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
