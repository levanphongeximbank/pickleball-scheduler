-- =============================================================================
-- REPORTING-02 — Tables and constraints
-- Purpose: Durable persistence for report definitions, saved configs,
--          executions, and export jobs (REPORTING-01 contracts).
-- Schema: public
-- Status: AUTHORED ONLY — do not apply to Staging or Production without
--         separate Owner authorization.
-- Idempotency: CREATE TABLE IF NOT EXISTS; constraints via DO blocks.
-- Destructive: none. No secrets. No raw sensitive result rows.
-- =============================================================================

SET search_path = public, pg_temp;

-- -----------------------------------------------------------------------------
-- 1. reporting_report_definitions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reporting_report_definitions (
  report_definition_id text PRIMARY KEY,
  tenant_id text NULL,
  club_id text NULL,
  venue_id text NULL,
  scope_kind text NOT NULL,
  ownership_class text NOT NULL DEFAULT 'TENANT',
  name text NOT NULL,
  title text NOT NULL,
  description text NULL,
  report_type text NOT NULL,
  source_kind text NOT NULL,
  source_id text NULL,
  projection_id text NULL,
  source_label text NULL,
  source_configured boolean NOT NULL DEFAULT false,
  parameters jsonb NOT NULL DEFAULT '[]'::jsonb,
  filter_definitions jsonb NOT NULL DEFAULT '[]'::jsonb,
  sortable_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  groupable_fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  sensitivity jsonb NOT NULL DEFAULT '{}'::jsonb,
  availability_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  freshness_expectations jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'ACTIVE',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT reporting_report_definitions_scope_kind_chk
    CHECK (scope_kind IN ('TENANT', 'CLUB', 'VENUE', 'PLATFORM_CROSS_TENANT')),
  CONSTRAINT reporting_report_definitions_ownership_chk
    CHECK (ownership_class IN ('TENANT', 'PLATFORM')),
  CONSTRAINT reporting_report_definitions_report_type_chk
    CHECK (report_type IN (
      'OPERATIONAL_KPI',
      'OPERATIONAL_TABLE',
      'OPERATIONAL_DASHBOARD',
      'OPERATIONAL_SNAPSHOT',
      'STATISTICS_COMPOSE'
    )),
  CONSTRAINT reporting_report_definitions_source_kind_chk
    CHECK (source_kind IN (
      'OPERATIONAL',
      'STATISTICS',
      'INTELLIGENCE_PROJECTION',
      'DASHBOARD_ADAPTER',
      'UNAVAILABLE'
    )),
  CONSTRAINT reporting_report_definitions_status_chk
    CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  CONSTRAINT reporting_report_definitions_name_nonempty
    CHECK (length(trim(name)) > 0),
  CONSTRAINT reporting_report_definitions_title_nonempty
    CHECK (length(trim(title)) > 0),
  CONSTRAINT reporting_report_definitions_version_positive
    CHECK (version >= 1),
  CONSTRAINT reporting_report_definitions_updated_at_gte_created_at
    CHECK (updated_at >= created_at),
  CONSTRAINT reporting_report_definitions_parameters_array
    CHECK (jsonb_typeof(parameters) = 'array'),
  CONSTRAINT reporting_report_definitions_filter_definitions_array
    CHECK (jsonb_typeof(filter_definitions) = 'array'),
  CONSTRAINT reporting_report_definitions_sortable_fields_array
    CHECK (jsonb_typeof(sortable_fields) = 'array'),
  CONSTRAINT reporting_report_definitions_groupable_fields_array
    CHECK (jsonb_typeof(groupable_fields) = 'array'),
  CONSTRAINT reporting_report_definitions_columns_array
    CHECK (jsonb_typeof(columns) = 'array'),
  CONSTRAINT reporting_report_definitions_columns_nonempty
    CHECK (jsonb_array_length(columns) >= 1),
  CONSTRAINT reporting_report_definitions_sensitivity_object
    CHECK (jsonb_typeof(sensitivity) = 'object'),
  CONSTRAINT reporting_report_definitions_availability_policy_object
    CHECK (jsonb_typeof(availability_policy) = 'object'),
  CONSTRAINT reporting_report_definitions_freshness_expectations_object
    CHECK (jsonb_typeof(freshness_expectations) = 'object'),
  CONSTRAINT reporting_report_definitions_tenant_required_when_tenant_scoped
    CHECK (
      scope_kind = 'PLATFORM_CROSS_TENANT'
      OR (tenant_id IS NOT NULL AND length(trim(tenant_id)) > 0)
    ),
  CONSTRAINT reporting_report_definitions_club_required_when_club
    CHECK (
      scope_kind <> 'CLUB'
      OR (club_id IS NOT NULL AND length(trim(club_id)) > 0)
    ),
  CONSTRAINT reporting_report_definitions_venue_required_when_venue
    CHECK (
      scope_kind <> 'VENUE'
      OR (venue_id IS NOT NULL AND length(trim(venue_id)) > 0)
    )
);

COMMENT ON TABLE public.reporting_report_definitions IS
  'REPORTING-02 report definition aggregate. Owned by Reporting & Analytics. Soft archive via status=ARCHIVED.';

-- -----------------------------------------------------------------------------
-- 2. reporting_saved_reports
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reporting_saved_reports (
  saved_report_id text PRIMARY KEY,
  report_definition_id text NOT NULL,
  owner_id text NOT NULL,
  tenant_id text NULL,
  club_id text NULL,
  venue_id text NULL,
  scope_kind text NOT NULL,
  name text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  sorting jsonb NOT NULL DEFAULT '[]'::jsonb,
  grouping jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  provenance_preference text NULL,
  status text NOT NULL DEFAULT 'ACTIVE',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT reporting_saved_reports_scope_kind_chk
    CHECK (scope_kind IN ('TENANT', 'CLUB', 'VENUE', 'PLATFORM_CROSS_TENANT')),
  CONSTRAINT reporting_saved_reports_status_chk
    CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  CONSTRAINT reporting_saved_reports_name_nonempty
    CHECK (length(trim(name)) > 0),
  CONSTRAINT reporting_saved_reports_owner_nonempty
    CHECK (length(trim(owner_id)) > 0),
  CONSTRAINT reporting_saved_reports_version_positive
    CHECK (version >= 1),
  CONSTRAINT reporting_saved_reports_updated_at_gte_created_at
    CHECK (updated_at >= created_at),
  CONSTRAINT reporting_saved_reports_parameters_object
    CHECK (jsonb_typeof(parameters) = 'object'),
  CONSTRAINT reporting_saved_reports_filters_array
    CHECK (jsonb_typeof(filters) = 'array'),
  CONSTRAINT reporting_saved_reports_sorting_array
    CHECK (jsonb_typeof(sorting) = 'array'),
  CONSTRAINT reporting_saved_reports_grouping_array
    CHECK (jsonb_typeof(grouping) = 'array'),
  CONSTRAINT reporting_saved_reports_selected_columns_array
    CHECK (jsonb_typeof(selected_columns) = 'array'),
  CONSTRAINT reporting_saved_reports_tenant_required_when_tenant_scoped
    CHECK (
      scope_kind = 'PLATFORM_CROSS_TENANT'
      OR (tenant_id IS NOT NULL AND length(trim(tenant_id)) > 0)
    ),
  CONSTRAINT reporting_saved_reports_definition_fk
    FOREIGN KEY (report_definition_id)
    REFERENCES public.reporting_report_definitions (report_definition_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

COMMENT ON TABLE public.reporting_saved_reports IS
  'REPORTING-02 saved report configurations. Owner-private by default; service authz before persist.';

-- -----------------------------------------------------------------------------
-- 3. reporting_saved_filters
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reporting_saved_filters (
  saved_filter_id text PRIMARY KEY,
  report_definition_id text NOT NULL,
  owner_id text NOT NULL,
  tenant_id text NULL,
  club_id text NULL,
  venue_id text NULL,
  scope_kind text NOT NULL,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'ACTIVE',
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT reporting_saved_filters_scope_kind_chk
    CHECK (scope_kind IN ('TENANT', 'CLUB', 'VENUE', 'PLATFORM_CROSS_TENANT')),
  CONSTRAINT reporting_saved_filters_status_chk
    CHECK (status IN ('ACTIVE', 'ARCHIVED')),
  CONSTRAINT reporting_saved_filters_name_nonempty
    CHECK (length(trim(name)) > 0),
  CONSTRAINT reporting_saved_filters_owner_nonempty
    CHECK (length(trim(owner_id)) > 0),
  CONSTRAINT reporting_saved_filters_version_positive
    CHECK (version >= 1),
  CONSTRAINT reporting_saved_filters_updated_at_gte_created_at
    CHECK (updated_at >= created_at),
  CONSTRAINT reporting_saved_filters_filters_array
    CHECK (jsonb_typeof(filters) = 'array'),
  CONSTRAINT reporting_saved_filters_tenant_required_when_tenant_scoped
    CHECK (
      scope_kind = 'PLATFORM_CROSS_TENANT'
      OR (tenant_id IS NOT NULL AND length(trim(tenant_id)) > 0)
    ),
  CONSTRAINT reporting_saved_filters_definition_fk
    FOREIGN KEY (report_definition_id)
    REFERENCES public.reporting_report_definitions (report_definition_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
);

COMMENT ON TABLE public.reporting_saved_filters IS
  'REPORTING-02 saved filter configurations. Owner-private by default.';

-- -----------------------------------------------------------------------------
-- 4. reporting_executions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reporting_executions (
  execution_id text PRIMARY KEY,
  report_definition_id text NOT NULL,
  saved_report_id text NULL,
  saved_filter_id text NULL,
  actor_id text NOT NULL,
  tenant_id text NULL,
  club_id text NULL,
  venue_id text NULL,
  scope_kind text NOT NULL,
  idempotency_key text NOT NULL,
  request_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING',
  availability text NULL,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  freshness jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_references jsonb NOT NULL DEFAULT '[]'::jsonb,
  row_count integer NULL,
  warning_codes jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_code text NULL,
  error_message text NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT reporting_executions_scope_kind_chk
    CHECK (scope_kind IN ('TENANT', 'CLUB', 'VENUE', 'PLATFORM_CROSS_TENANT')),
  CONSTRAINT reporting_executions_status_chk
    CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'UNAVAILABLE')),
  CONSTRAINT reporting_executions_actor_nonempty
    CHECK (length(trim(actor_id)) > 0),
  CONSTRAINT reporting_executions_idempotency_nonempty
    CHECK (length(trim(idempotency_key)) > 0),
  CONSTRAINT reporting_executions_version_positive
    CHECK (version >= 1),
  CONSTRAINT reporting_executions_updated_at_gte_created_at
    CHECK (updated_at >= created_at),
  CONSTRAINT reporting_executions_request_snapshot_object
    CHECK (jsonb_typeof(request_snapshot) = 'object'),
  CONSTRAINT reporting_executions_provenance_object
    CHECK (jsonb_typeof(provenance) = 'object'),
  CONSTRAINT reporting_executions_freshness_object
    CHECK (jsonb_typeof(freshness) = 'object'),
  CONSTRAINT reporting_executions_source_references_array
    CHECK (jsonb_typeof(source_references) = 'array'),
  CONSTRAINT reporting_executions_warning_codes_array
    CHECK (jsonb_typeof(warning_codes) = 'array'),
  CONSTRAINT reporting_executions_no_raw_rows_key
    CHECK (NOT (request_snapshot ? 'rows')),
  CONSTRAINT reporting_executions_definition_fk
    FOREIGN KEY (report_definition_id)
    REFERENCES public.reporting_report_definitions (report_definition_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT reporting_executions_saved_report_fk
    FOREIGN KEY (saved_report_id)
    REFERENCES public.reporting_saved_reports (saved_report_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT reporting_executions_saved_filter_fk
    FOREIGN KEY (saved_filter_id)
    REFERENCES public.reporting_saved_filters (saved_filter_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reporting_executions_tenant_idempotency_uq'
      AND conrelid = 'public.reporting_executions'::regclass
  ) THEN
    ALTER TABLE public.reporting_executions
      ADD CONSTRAINT reporting_executions_tenant_idempotency_uq
      UNIQUE (tenant_id, idempotency_key);
  END IF;
END $$;

COMMENT ON TABLE public.reporting_executions IS
  'REPORTING-02 execution lifecycle evidence. Metadata/provenance only — no raw sensitive rows.';

COMMENT ON COLUMN public.reporting_executions.idempotency_key IS
  'Client/server idempotency key. Unique per tenant_id (NULL tenant treated distinctly by Postgres UNIQUE).';

-- -----------------------------------------------------------------------------
-- 5. reporting_export_jobs
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reporting_export_jobs (
  export_job_id text PRIMARY KEY,
  export_record_id text NULL,
  execution_id text NULL,
  report_definition_id text NOT NULL,
  actor_id text NOT NULL,
  tenant_id text NULL,
  club_id text NULL,
  venue_id text NULL,
  scope_kind text NOT NULL,
  format text NOT NULL,
  selected_columns jsonb NOT NULL DEFAULT '[]'::jsonb,
  idempotency_key text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  authorization_outcome text NULL,
  output_artifact_reference jsonb NULL,
  content_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NULL,
  retention_until timestamptz NULL,
  error_code text NULL,
  error_message text NULL,
  started_at timestamptz NULL,
  completed_at timestamptz NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  CONSTRAINT reporting_export_jobs_scope_kind_chk
    CHECK (scope_kind IN ('TENANT', 'CLUB', 'VENUE', 'PLATFORM_CROSS_TENANT')),
  CONSTRAINT reporting_export_jobs_format_chk
    CHECK (format IN ('CSV', 'XLSX', 'PDF', 'JSON')),
  CONSTRAINT reporting_export_jobs_status_chk
    CHECK (status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'UNAVAILABLE')),
  CONSTRAINT reporting_export_jobs_actor_nonempty
    CHECK (length(trim(actor_id)) > 0),
  CONSTRAINT reporting_export_jobs_idempotency_nonempty
    CHECK (length(trim(idempotency_key)) > 0),
  CONSTRAINT reporting_export_jobs_version_positive
    CHECK (version >= 1),
  CONSTRAINT reporting_export_jobs_updated_at_gte_created_at
    CHECK (updated_at >= created_at),
  CONSTRAINT reporting_export_jobs_selected_columns_array
    CHECK (jsonb_typeof(selected_columns) = 'array'),
  CONSTRAINT reporting_export_jobs_content_metadata_object
    CHECK (jsonb_typeof(content_metadata) = 'object'),
  CONSTRAINT reporting_export_jobs_output_artifact_object_or_null
    CHECK (
      output_artifact_reference IS NULL
      OR jsonb_typeof(output_artifact_reference) = 'object'
    ),
  CONSTRAINT reporting_export_jobs_no_secret_metadata
    CHECK (
      NOT (content_metadata ?| ARRAY['apiKey', 'secret', 'token', 'password', 'serviceRoleKey'])
    ),
  CONSTRAINT reporting_export_jobs_succeeded_requires_artifact
    CHECK (
      status <> 'SUCCEEDED'
      OR (
        output_artifact_reference IS NOT NULL
        AND jsonb_typeof(output_artifact_reference) = 'object'
      )
    ),
  CONSTRAINT reporting_export_jobs_definition_fk
    FOREIGN KEY (report_definition_id)
    REFERENCES public.reporting_report_definitions (report_definition_id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT reporting_export_jobs_execution_fk
    FOREIGN KEY (execution_id)
    REFERENCES public.reporting_executions (execution_id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reporting_export_jobs_tenant_idempotency_uq'
      AND conrelid = 'public.reporting_export_jobs'::regclass
  ) THEN
    ALTER TABLE public.reporting_export_jobs
      ADD CONSTRAINT reporting_export_jobs_tenant_idempotency_uq
      UNIQUE (tenant_id, idempotency_key);
  END IF;
END $$;

COMMENT ON TABLE public.reporting_export_jobs IS
  'REPORTING-02 export job lifecycle. Stores artifact references only — never fabricated URLs or file bytes.';
