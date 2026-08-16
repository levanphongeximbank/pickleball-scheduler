-- Court Operations pre-Staging identity-guard correction 01. ADDITIVE.
-- LOCAL AUTHORING ONLY. DO NOT APPLY TO STAGING OR PRODUCTION.
-- IDENTITY_GUARD_CORRECTION_MIGRATION_VERSION=20260816190000
--
-- Replaces public.court_resource_identity_guard() body only.
-- Does NOT edit Phase3A certified SQL files.
-- Does NOT recreate triggers (same function name remains bound).
--
-- NEW semantics for physical courts / cluster mappings:
--   physicalCourt.tenant_id must equal cluster.tenant_id
--   NOT cluster.venue_id
-- Unknown cluster / missing cluster.tenant_id → fail closed.

BEGIN;

CREATE OR REPLACE FUNCTION public.court_resource_identity_guard()
RETURNS trigger LANGUAGE plpgsql
SET search_path = pg_catalog, public AS $$
DECLARE
  v_scope_tenant text;
BEGIN
  -- Table discriminator is evaluated in its own IF/ELSIF before any
  -- table-specific NEW/OLD field. PL/pgSQL binds every record field in a
  -- single IF expression, so `TG_TABLE_NAME = 'x' AND NEW.col` is unsafe
  -- on tables that lack col (Stage 3: legacy mappings have no cluster_id).
  IF TG_OP = 'UPDATE' THEN
    IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'COURT_RESOURCE_IMMUTABLE_IDENTITY_SCOPE';
    END IF;
    IF TG_TABLE_NAME = 'court_resource_physical_courts' THEN
      IF NEW.physical_court_id IS DISTINCT FROM OLD.physical_court_id
         OR NEW.cluster_id IS DISTINCT FROM OLD.cluster_id THEN
        RAISE EXCEPTION 'COURT_RESOURCE_IMMUTABLE_PHYSICAL_IDENTITY';
      END IF;
    ELSIF TG_TABLE_NAME = 'court_resource_club_operational_access' THEN
      IF NEW.access_id IS DISTINCT FROM OLD.access_id
         OR NEW.club_id IS DISTINCT FROM OLD.club_id
         OR NEW.physical_court_id IS DISTINCT FROM OLD.physical_court_id THEN
        RAISE EXCEPTION 'COURT_RESOURCE_IMMUTABLE_ACCESS_IDENTITY';
      END IF;
    ELSIF TG_TABLE_NAME = 'court_resource_cluster_identity_mappings' THEN
      IF NEW.cluster_mapping_id IS DISTINCT FROM OLD.cluster_mapping_id
         OR NEW.source_system IS DISTINCT FROM OLD.source_system
         OR NEW.source_version IS DISTINCT FROM OLD.source_version
         OR NEW.legacy_cluster_id IS DISTINCT FROM OLD.legacy_cluster_id THEN
        RAISE EXCEPTION 'COURT_RESOURCE_IMMUTABLE_CLUSTER_PROVENANCE';
      END IF;
    ELSIF TG_TABLE_NAME = 'court_resource_legacy_court_identity_mappings' THEN
      IF NEW.mapping_id IS DISTINCT FROM OLD.mapping_id
         OR NEW.club_id IS DISTINCT FROM OLD.club_id
         OR NEW.source_system IS DISTINCT FROM OLD.source_system
         OR NEW.source_version IS DISTINCT FROM OLD.source_version
         OR NEW.legacy_cluster_id IS DISTINCT FROM OLD.legacy_cluster_id
         OR NEW.legacy_court_id IS DISTINCT FROM OLD.legacy_court_id THEN
        RAISE EXCEPTION 'COURT_RESOURCE_IMMUTABLE_LEGACY_PROVENANCE';
      END IF;
    END IF;
    NEW.version := OLD.version + 1;
    NEW.updated_at := now();
  END IF;

  IF TG_TABLE_NAME = 'court_resource_physical_courts' THEN
    -- Canonical: validate against cluster.tenant_id (Batch8 semantics).
    -- venue_id is Venue context only — never compared as tenant invent.
    SELECT cc.tenant_id INTO v_scope_tenant
    FROM public.court_clusters cc
    WHERE cc.id = NEW.cluster_id;
    IF NOT FOUND
       OR nullif(btrim(v_scope_tenant), '') IS NULL THEN
      RAISE EXCEPTION 'COURT_RESOURCE_UNKNOWN_CLUSTER';
    END IF;
  ELSIF TG_TABLE_NAME = 'court_resource_club_operational_access' THEN
    SELECT tenant_id INTO v_scope_tenant FROM public.clubs WHERE id = NEW.club_id;
    IF v_scope_tenant IS DISTINCT FROM NEW.tenant_id OR NOT EXISTS (
      SELECT 1 FROM public.court_resource_physical_courts
      WHERE physical_court_id = NEW.physical_court_id
        AND tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'COURT_RESOURCE_INVALID_ACCESS_SCOPE';
    END IF;
  ELSIF TG_TABLE_NAME = 'court_resource_cluster_identity_mappings' THEN
    IF NEW.cluster_id IS NOT NULL THEN
      SELECT cc.tenant_id INTO v_scope_tenant
      FROM public.court_clusters cc
      WHERE cc.id = NEW.cluster_id;
      IF NOT FOUND
         OR nullif(btrim(v_scope_tenant), '') IS NULL THEN
        RAISE EXCEPTION 'COURT_RESOURCE_UNKNOWN_CLUSTER';
      END IF;
    END IF;
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

COMMENT ON FUNCTION public.court_resource_identity_guard() IS
  'Pre-Staging correction: physical court tenant_id validates against court_clusters.tenant_id (not venue_id). Batch8 semantics.';

COMMIT;
