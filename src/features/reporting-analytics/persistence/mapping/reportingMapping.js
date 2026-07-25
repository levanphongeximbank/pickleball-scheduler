/**
 * Snake-case row ↔ reporting domain mappings (REPORTING-02).
 */

import {
  createExportJobRecord,
  createReportDefinition,
  createReportExecutionRecord,
  createSavedFilterConfiguration,
  createSavedReportConfiguration,
} from "../../contracts/index.js";

function json(value, fallback) {
  if (value == null) return fallback;
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function scopeToRow(scope) {
  return {
    scope_kind: scope.kind,
    tenant_id: scope.tenantId,
    club_id: scope.clubId,
    venue_id: scope.venueId,
  };
}

function scopeFromRow(row) {
  return {
    kind: row.scope_kind,
    tenantId: row.tenant_id,
    clubId: row.club_id,
    venueId: row.venue_id,
  };
}

function sourceToRow(source) {
  return {
    source_kind: source.kind,
    source_id: source.sourceId,
    projection_id: source.projectionId,
    source_label: source.label,
    source_configured: source.configured,
  };
}

function sourceFromRow(row) {
  return {
    kind: row.source_kind,
    sourceId: row.source_id,
    projectionId: row.projection_id,
    label: row.source_label,
    configured: row.source_configured,
  };
}

export function mapDefinitionDomainToRow(definition) {
  return {
    report_definition_id: definition.reportDefinitionId,
    ...scopeToRow(definition.scope),
    ...sourceToRow(definition.source),
    ownership_class:
      definition.scope?.kind === "PLATFORM_CROSS_TENANT" ? "PLATFORM" : "TENANT",
    name: definition.name,
    title: definition.title,
    description: definition.description,
    report_type: definition.reportType,
    parameters: json(definition.parameters, []),
    filter_definitions: json(definition.filterDefinitions, []),
    sortable_fields: json(definition.sortableFields, []),
    groupable_fields: json(definition.groupableFields, []),
    columns: json(definition.columns, []),
    sensitivity: json(definition.sensitivity, {}),
    availability_policy: json(definition.availabilityPolicy, {}),
    freshness_expectations: json(definition.freshnessExpectations, {}),
    status: definition.status || "ACTIVE",
    version: definition.version,
    created_at: definition.createdAt,
    updated_at: definition.updatedAt,
  };
}

export function mapDefinitionRowToDomain(row) {
  return createReportDefinition({
    reportDefinitionId: row.report_definition_id,
    scope: scopeFromRow(row),
    source: sourceFromRow(row),
    name: row.name,
    title: row.title,
    description: row.description,
    reportType: row.report_type,
    parameters: json(row.parameters, []),
    filterDefinitions: json(row.filter_definitions, []),
    sortableFields: json(row.sortable_fields, []),
    groupableFields: json(row.groupable_fields, []),
    columns: json(row.columns, []),
    sensitivity: json(row.sensitivity, {}),
    availabilityPolicy: json(row.availability_policy, {}),
    freshnessExpectations: json(row.freshness_expectations, {}),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function mapSavedReportDomainToRow(saved) {
  return {
    saved_report_id: saved.savedReportId,
    report_definition_id: saved.reportDefinitionId,
    owner_id: saved.ownerId,
    ...scopeToRow(saved.scope),
    name: saved.name,
    parameters: json(saved.parameters, {}),
    filters: json(saved.filters, []),
    sorting: json(saved.sorting, []),
    grouping: json(saved.grouping, []),
    selected_columns: json(saved.columns, []),
    provenance_preference: saved.provenancePreference,
    status: saved.status || "ACTIVE",
    version: saved.version,
    created_at: saved.createdAt,
    updated_at: saved.updatedAt,
  };
}

export function mapSavedReportRowToDomain(row) {
  return createSavedReportConfiguration({
    savedReportId: row.saved_report_id,
    reportDefinitionId: row.report_definition_id,
    ownerId: row.owner_id,
    scope: scopeFromRow(row),
    name: row.name,
    parameters: json(row.parameters, {}),
    filters: json(row.filters, []),
    sorting: json(row.sorting, []),
    grouping: json(row.grouping, []),
    columns: json(row.selected_columns, []),
    provenancePreference: row.provenance_preference,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function mapSavedFilterDomainToRow(saved) {
  return {
    saved_filter_id: saved.savedFilterId,
    report_definition_id: saved.reportDefinitionId,
    owner_id: saved.ownerId,
    ...scopeToRow(saved.scope),
    name: saved.name,
    filters: json(saved.filters, []),
    status: saved.status || "ACTIVE",
    version: saved.version,
    created_at: saved.createdAt,
    updated_at: saved.updatedAt,
  };
}

export function mapSavedFilterRowToDomain(row) {
  return createSavedFilterConfiguration({
    savedFilterId: row.saved_filter_id,
    reportDefinitionId: row.report_definition_id,
    ownerId: row.owner_id,
    scope: scopeFromRow(row),
    name: row.name,
    filters: json(row.filters, []),
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function mapExecutionDomainToRow(record) {
  const snapshot = json(record.requestSnapshot, {});
  Reflect.deleteProperty(snapshot, "rows");
  return {
    execution_id: record.executionId,
    report_definition_id: record.reportDefinitionId,
    saved_report_id: record.savedReportId,
    saved_filter_id: record.savedFilterId,
    actor_id: record.actorId,
    ...scopeToRow(record.scope),
    idempotency_key: record.idempotencyKey,
    request_snapshot: snapshot,
    status: record.status,
    availability: record.availability,
    provenance: json(record.provenance, {}),
    freshness: json(record.freshness, {}),
    source_references: json(record.sourceReferences, []),
    row_count: record.rowCount,
    warning_codes: json(record.warningCodes, []),
    error_code: record.errorCode,
    error_message: record.errorMessage,
    started_at: record.startedAt,
    completed_at: record.completedAt,
    version: record.version,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
  };
}

export function mapExecutionRowToDomain(row) {
  return createReportExecutionRecord({
    executionId: row.execution_id,
    reportDefinitionId: row.report_definition_id,
    savedReportId: row.saved_report_id,
    savedFilterId: row.saved_filter_id,
    actorId: row.actor_id,
    scope: scopeFromRow(row),
    idempotencyKey: row.idempotency_key,
    requestSnapshot: json(row.request_snapshot, {}),
    status: row.status,
    availability: row.availability,
    provenance: json(row.provenance, {}),
    freshness: json(row.freshness, {}),
    sourceReferences: json(row.source_references, []),
    rowCount: row.row_count,
    warningCodes: json(row.warning_codes, []),
    errorCode: row.error_code,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function mapExportJobDomainToRow(job) {
  return {
    export_job_id: job.exportJobId,
    export_record_id: job.exportRecordId,
    execution_id: job.executionId,
    report_definition_id: job.reportDefinitionId,
    actor_id: job.actorId,
    ...scopeToRow(job.scope),
    format: job.format,
    selected_columns: json(job.selectedColumns, []),
    idempotency_key: job.idempotencyKey,
    status: job.status,
    authorization_outcome: job.authorizationOutcome,
    output_artifact_reference: json(job.outputArtifactReference, null),
    content_metadata: json(job.contentMetadata, {}),
    expires_at: job.expiresAt,
    retention_until: job.retentionUntil,
    error_code: job.errorCode,
    error_message: job.errorMessage,
    started_at: job.startedAt,
    completed_at: job.completedAt,
    version: job.version,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
  };
}

export function mapExportJobRowToDomain(row) {
  return createExportJobRecord({
    exportJobId: row.export_job_id,
    exportRecordId: row.export_record_id,
    executionId: row.execution_id,
    reportDefinitionId: row.report_definition_id,
    actorId: row.actor_id,
    scope: scopeFromRow(row),
    format: row.format,
    selectedColumns: json(row.selected_columns, []),
    idempotencyKey: row.idempotency_key,
    status: row.status,
    authorizationOutcome: row.authorization_outcome,
    outputArtifactReference: json(row.output_artifact_reference, null),
    contentMetadata: json(row.content_metadata, {}),
    expiresAt: row.expires_at,
    retentionUntil: row.retention_until,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}
