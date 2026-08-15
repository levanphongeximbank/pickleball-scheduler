-- Phase 3A Option B. ADDITIVE, LOCAL AUTHORING ONLY. NOT APPLIED.
BEGIN;

CREATE TABLE public.court_resource_physical_courts (
  physical_court_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  cluster_id text NOT NULL REFERENCES public.court_clusters(id) ON DELETE RESTRICT,
  display_name text NOT NULL CHECK (btrim(display_name) <> ''),
  display_code text NULL,
  display_number text NULL,
  sort_order integer NOT NULL DEFAULT 0,
  lifecycle_status text NOT NULL DEFAULT 'active'
    CHECK (lifecycle_status IN ('active', 'inactive', 'maintenance')),
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT court_resource_physical_courts_identity_scope_uniq
    UNIQUE (physical_court_id, tenant_id)
);
CREATE INDEX court_resource_physical_courts_cluster_idx
  ON public.court_resource_physical_courts
  (tenant_id, cluster_id, lifecycle_status);

CREATE TABLE public.court_resource_club_operational_access (
  access_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  club_id text NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
  physical_court_id uuid NOT NULL
    REFERENCES public.court_resource_physical_courts(physical_court_id)
    ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'enabled'
    CHECK (status IN ('enabled', 'disabled')),
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  reason text NOT NULL DEFAULT '',
  granted_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  revoked_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT court_resource_club_access_identity_uniq
    UNIQUE (tenant_id, club_id, physical_court_id),
  CONSTRAINT court_resource_club_access_status_audit_check CHECK (
    (status = 'enabled' AND revoked_at IS NULL)
    OR (status = 'disabled' AND revoked_at IS NOT NULL)
  )
);
CREATE INDEX court_resource_club_access_club_idx
  ON public.court_resource_club_operational_access (tenant_id, club_id, status);
CREATE INDEX court_resource_club_access_court_idx
  ON public.court_resource_club_operational_access
  (tenant_id, physical_court_id, status);

CREATE TABLE public.court_resource_cluster_identity_mappings (
  cluster_mapping_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  source_system text NOT NULL CHECK (btrim(source_system) <> ''),
  source_version text NOT NULL CHECK (btrim(source_version) <> ''),
  legacy_cluster_id text NOT NULL CHECK (btrim(legacy_cluster_id) <> ''),
  cluster_id text NULL REFERENCES public.court_clusters(id) ON DELETE RESTRICT,
  classification text NOT NULL CHECK (classification IN (
    'deterministic', 'candidate_review', 'ambiguous',
    'unresolved_cluster', 'invalid_scope'
  )),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(evidence) = 'array'),
  source_context jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(source_context) = 'object'),
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT court_resource_cluster_mapping_key_uniq
    UNIQUE (tenant_id, source_system, source_version, legacy_cluster_id),
  CONSTRAINT court_resource_cluster_mapping_resolution_check CHECK (
    (classification = 'deterministic' AND cluster_id IS NOT NULL)
    OR (classification <> 'deterministic' AND cluster_id IS NULL)
  )
);
CREATE INDEX court_resource_cluster_mapping_target_idx
  ON public.court_resource_cluster_identity_mappings (tenant_id, cluster_id)
  WHERE cluster_id IS NOT NULL;

CREATE TABLE public.court_resource_legacy_court_identity_mappings (
  mapping_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL REFERENCES public.venues(id) ON DELETE RESTRICT,
  club_id text NOT NULL REFERENCES public.clubs(id) ON DELETE RESTRICT,
  source_system text NOT NULL CHECK (btrim(source_system) <> ''),
  source_version text NOT NULL CHECK (btrim(source_version) <> ''),
  legacy_cluster_id text NOT NULL CHECK (btrim(legacy_cluster_id) <> ''),
  legacy_court_id text NOT NULL CHECK (btrim(legacy_court_id) <> ''),
  physical_court_id uuid NULL
    REFERENCES public.court_resource_physical_courts(physical_court_id)
    ON DELETE RESTRICT,
  classification text NOT NULL CHECK (classification IN (
    'deterministic', 'candidate_review', 'ambiguous',
    'unresolved_cluster', 'invalid_scope'
  )),
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(evidence) = 'array'),
  source_context jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(source_context) = 'object'),
  version bigint NOT NULL DEFAULT 1 CHECK (version >= 1),
  resolved_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT court_resource_legacy_mapping_key_uniq UNIQUE (
    tenant_id, club_id, source_system, source_version,
    legacy_cluster_id, legacy_court_id
  ),
  CONSTRAINT court_resource_legacy_mapping_resolution_check CHECK (
    (classification = 'deterministic'
      AND physical_court_id IS NOT NULL AND resolved_at IS NOT NULL)
    OR (classification <> 'deterministic'
      AND physical_court_id IS NULL AND resolved_at IS NULL)
  )
);
CREATE INDEX court_resource_legacy_mapping_court_idx
  ON public.court_resource_legacy_court_identity_mappings
  (tenant_id, physical_court_id) WHERE physical_court_id IS NOT NULL;
CREATE INDEX court_resource_legacy_mapping_review_idx
  ON public.court_resource_legacy_court_identity_mappings
  (tenant_id, club_id, classification, updated_at);

CREATE FUNCTION public.court_resource_identity_guard()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
DECLARE
  v_scope_tenant text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'COURT_RESOURCE_IMMUTABLE_IDENTITY_SCOPE';
    END IF;
    IF TG_TABLE_NAME = 'court_resource_physical_courts'
       AND (NEW.physical_court_id IS DISTINCT FROM OLD.physical_court_id
         OR NEW.cluster_id IS DISTINCT FROM OLD.cluster_id) THEN
      RAISE EXCEPTION 'COURT_RESOURCE_IMMUTABLE_PHYSICAL_IDENTITY';
    ELSIF TG_TABLE_NAME = 'court_resource_club_operational_access'
       AND (NEW.access_id IS DISTINCT FROM OLD.access_id
         OR NEW.club_id IS DISTINCT FROM OLD.club_id
         OR NEW.physical_court_id IS DISTINCT FROM OLD.physical_court_id) THEN
      RAISE EXCEPTION 'COURT_RESOURCE_IMMUTABLE_ACCESS_IDENTITY';
    ELSIF TG_TABLE_NAME = 'court_resource_cluster_identity_mappings'
       AND (NEW.cluster_mapping_id IS DISTINCT FROM OLD.cluster_mapping_id
         OR NEW.source_system IS DISTINCT FROM OLD.source_system
         OR NEW.source_version IS DISTINCT FROM OLD.source_version
         OR NEW.legacy_cluster_id IS DISTINCT FROM OLD.legacy_cluster_id) THEN
      RAISE EXCEPTION 'COURT_RESOURCE_IMMUTABLE_CLUSTER_PROVENANCE';
    ELSIF TG_TABLE_NAME = 'court_resource_legacy_court_identity_mappings'
       AND (NEW.mapping_id IS DISTINCT FROM OLD.mapping_id
         OR NEW.club_id IS DISTINCT FROM OLD.club_id
         OR NEW.source_system IS DISTINCT FROM OLD.source_system
         OR NEW.source_version IS DISTINCT FROM OLD.source_version
         OR NEW.legacy_cluster_id IS DISTINCT FROM OLD.legacy_cluster_id
         OR NEW.legacy_court_id IS DISTINCT FROM OLD.legacy_court_id) THEN
      RAISE EXCEPTION 'COURT_RESOURCE_IMMUTABLE_LEGACY_PROVENANCE';
    END IF;
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  END IF;

  IF TG_TABLE_NAME = 'court_resource_physical_courts' THEN
    SELECT venue_id INTO v_scope_tenant FROM public.court_clusters
      WHERE id = NEW.cluster_id;
  ELSIF TG_TABLE_NAME = 'court_resource_club_operational_access' THEN
    SELECT tenant_id INTO v_scope_tenant FROM public.clubs WHERE id = NEW.club_id;
    IF v_scope_tenant IS DISTINCT FROM NEW.tenant_id OR NOT EXISTS (
      SELECT 1 FROM public.court_resource_physical_courts
      WHERE physical_court_id = NEW.physical_court_id
        AND tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'COURT_RESOURCE_INVALID_ACCESS_SCOPE';
    END IF;
  ELSIF TG_TABLE_NAME = 'court_resource_cluster_identity_mappings'
        AND NEW.cluster_id IS NOT NULL THEN
    SELECT venue_id INTO v_scope_tenant FROM public.court_clusters
      WHERE id = NEW.cluster_id;
  ELSIF TG_TABLE_NAME = 'court_resource_legacy_court_identity_mappings' THEN
    SELECT tenant_id INTO v_scope_tenant FROM public.clubs WHERE id = NEW.club_id;
    IF v_scope_tenant IS DISTINCT FROM NEW.tenant_id
       OR (NEW.physical_court_id IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.court_resource_physical_courts
         WHERE physical_court_id = NEW.physical_court_id
           AND tenant_id = NEW.tenant_id
       )) THEN
      RAISE EXCEPTION 'COURT_RESOURCE_INVALID_MAPPING_SCOPE';
    END IF;
  END IF;
  IF v_scope_tenant IS NOT NULL
     AND v_scope_tenant IS DISTINCT FROM NEW.tenant_id THEN
    RAISE EXCEPTION 'COURT_RESOURCE_CROSS_TENANT_SCOPE';
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER trg_court_resource_physical_courts_guard
BEFORE INSERT OR UPDATE ON public.court_resource_physical_courts
FOR EACH ROW EXECUTE FUNCTION public.court_resource_identity_guard();
CREATE TRIGGER trg_court_resource_club_access_guard
BEFORE INSERT OR UPDATE ON public.court_resource_club_operational_access
FOR EACH ROW EXECUTE FUNCTION public.court_resource_identity_guard();
CREATE TRIGGER trg_court_resource_cluster_mapping_guard
BEFORE INSERT OR UPDATE ON public.court_resource_cluster_identity_mappings
FOR EACH ROW EXECUTE FUNCTION public.court_resource_identity_guard();
CREATE TRIGGER trg_court_resource_legacy_mapping_guard
BEFORE INSERT OR UPDATE ON public.court_resource_legacy_court_identity_mappings
FOR EACH ROW EXECUTE FUNCTION public.court_resource_identity_guard();

ALTER TABLE public.court_resource_physical_courts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_resource_physical_courts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.court_resource_club_operational_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_resource_club_operational_access FORCE ROW LEVEL SECURITY;
ALTER TABLE public.court_resource_cluster_identity_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_resource_cluster_identity_mappings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.court_resource_legacy_court_identity_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.court_resource_legacy_court_identity_mappings FORCE ROW LEVEL SECURITY;

CREATE POLICY court_resource_physical_courts_select
ON public.court_resource_physical_courts FOR SELECT TO authenticated USING (
  public.is_super_admin() OR (
    tenant_id = public.user_venue_id() AND public.can_access_cluster(cluster_id)
  )
);
CREATE POLICY court_resource_club_access_select
ON public.court_resource_club_operational_access FOR SELECT TO authenticated USING (
  public.is_super_admin() OR (
    tenant_id = public.user_venue_id()
    AND public.phase42_has_gov_role(
      club_id, ARRAY['club_owner', 'president', 'vice_president']
    )
  )
);
CREATE POLICY court_resource_cluster_mappings_select
ON public.court_resource_cluster_identity_mappings FOR SELECT TO authenticated USING (
  public.is_super_admin() OR (
    tenant_id = public.user_venue_id()
    AND cluster_id IS NOT NULL
    AND public.can_access_cluster(cluster_id)
  )
);
CREATE POLICY court_resource_legacy_mappings_select
ON public.court_resource_legacy_court_identity_mappings FOR SELECT TO authenticated USING (
  public.is_super_admin() OR (
    tenant_id = public.user_venue_id()
    AND public.phase42_has_gov_role(
      club_id, ARRAY['club_owner', 'president', 'vice_president']
    )
  )
);

REVOKE ALL ON public.court_resource_physical_courts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.court_resource_club_operational_access FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.court_resource_cluster_identity_mappings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.court_resource_legacy_court_identity_mappings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.court_resource_identity_guard()
  FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.court_resource_resolve_legacy_court_mapping(
  p_tenant_id text,
  p_club_id text,
  p_source_system text,
  p_source_version text,
  p_legacy_cluster_id text,
  p_legacy_court_id text,
  p_classification text,
  p_physical_court_id uuid,
  p_evidence jsonb DEFAULT '[]'::jsonb,
  p_source_context jsonb DEFAULT '{}'::jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public AS $$
DECLARE
  v_existing public.court_resource_legacy_court_identity_mappings%ROWTYPE;
  v_mapping_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'UNAUTHENTICATED');
  END IF;
  IF nullif(btrim(p_tenant_id), '') IS NULL
     OR nullif(btrim(p_club_id), '') IS NULL
     OR nullif(btrim(p_source_system), '') IS NULL
     OR nullif(btrim(p_source_version), '') IS NULL
     OR nullif(btrim(p_legacy_cluster_id), '') IS NULL
     OR nullif(btrim(p_legacy_court_id), '') IS NULL
     OR p_classification NOT IN (
       'deterministic', 'candidate_review', 'ambiguous',
       'unresolved_cluster', 'invalid_scope'
     )
     OR jsonb_typeof(p_evidence) <> 'array'
     OR jsonb_typeof(p_source_context) <> 'object'
     OR (p_classification = 'deterministic') IS DISTINCT FROM
        (p_physical_court_id IS NOT NULL) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_INPUT');
  END IF;
  IF NOT (
    public.is_super_admin()
    OR (
      p_tenant_id = public.user_venue_id()
      AND public.phase42_has_gov_role(
        p_club_id, ARRAY['club_owner', 'president', 'vice_president']
      )
    )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN');
  END IF;
  IF p_physical_court_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.court_resource_physical_courts pc
    WHERE pc.physical_court_id = p_physical_court_id
      AND pc.tenant_id = p_tenant_id
      AND (
        public.is_super_admin()
        OR public.can_access_cluster(pc.cluster_id)
      )
  ) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'FORBIDDEN_COURT_SCOPE');
  END IF;

  SELECT * INTO v_existing
  FROM public.court_resource_legacy_court_identity_mappings
  WHERE tenant_id = p_tenant_id AND club_id = p_club_id
    AND source_system = p_source_system AND source_version = p_source_version
    AND legacy_cluster_id = p_legacy_cluster_id
    AND legacy_court_id = p_legacy_court_id
  FOR UPDATE;
  IF FOUND THEN
    IF v_existing.classification = p_classification
       AND v_existing.physical_court_id IS NOT DISTINCT FROM p_physical_court_id THEN
      RETURN jsonb_build_object(
        'ok', true, 'code', 'UNCHANGED', 'mappingId', v_existing.mapping_id
      );
    END IF;
    RETURN jsonb_build_object(
      'ok', false, 'code', 'CONFLICTING_MAPPING', 'mappingId', v_existing.mapping_id
    );
  END IF;

  INSERT INTO public.court_resource_legacy_court_identity_mappings (
    tenant_id, club_id, source_system, source_version, legacy_cluster_id,
    legacy_court_id, physical_court_id, classification, evidence,
    source_context, resolved_by, resolved_at
  ) VALUES (
    p_tenant_id, p_club_id, p_source_system, p_source_version,
    p_legacy_cluster_id, p_legacy_court_id, p_physical_court_id,
    p_classification, p_evidence, p_source_context,
    CASE WHEN p_physical_court_id IS NULL THEN NULL ELSE auth.uid() END,
    CASE WHEN p_physical_court_id IS NULL THEN NULL ELSE now() END
  ) RETURNING mapping_id INTO v_mapping_id;
  RETURN jsonb_build_object('ok', true, 'code', 'CREATED', 'mappingId', v_mapping_id);
EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'code', 'CONFLICTING_MAPPING');
  WHEN foreign_key_violation OR check_violation OR raise_exception THEN
    RETURN jsonb_build_object('ok', false, 'code', 'INVALID_SCOPE_OR_VALUE');
END
$$;
REVOKE ALL ON FUNCTION public.court_resource_resolve_legacy_court_mapping(
  text,text,text,text,text,text,text,uuid,jsonb,jsonb
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.court_resource_resolve_legacy_court_mapping(
  text,text,text,text,text,text,text,uuid,jsonb,jsonb
) TO authenticated;

COMMIT;
