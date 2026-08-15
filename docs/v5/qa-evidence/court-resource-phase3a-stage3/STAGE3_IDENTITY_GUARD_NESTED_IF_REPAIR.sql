-- COURT RESOURCE PHASE 3A / STAGING CONTRACT REPAIR
-- STAGING ONLY project_ref=qyewbxjsiiyufanzcjcq
-- Prerequisite for Stage 3 legacy mapping writes.
-- Nested-IF so NEW.cluster_id is not evaluated on tables that lack the column.
-- Semantics unchanged from authored 02_APPLY.sql.

CREATE OR REPLACE FUNCTION public.court_resource_identity_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'pg_catalog', 'public'
AS $function$
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
  ELSIF TG_TABLE_NAME = 'court_resource_cluster_identity_mappings' THEN
    IF NEW.cluster_id IS NOT NULL THEN
      SELECT venue_id INTO v_scope_tenant FROM public.court_clusters
        WHERE id = NEW.cluster_id;
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
$function$;
