/**
 * E2E-06 Governance & Reliability Runtime — constants.
 * Capability IDs: GOV-01..07, GOV-09..10 (E2E-00 register). OPS-11/OPS-12 deferred/MVP-limited.
 */

export const E2E06_GOVERNANCE_VERSION = "e2e-06-governance-reliability-v1";
export const E2E06_GOVERNANCE_PHASE = "E2E-06";
export const E2E06_RELIABILITY_POLICY_VERSION = "e2e-06-reliability-policy-v1";

/** E2E-00 capability codes owned/governed by this wave. */
export const E2E06_CAPABILITY = Object.freeze({
  GOV_01: "GOV-01",
  GOV_02: "GOV-02",
  GOV_03: "GOV-03",
  GOV_04: "GOV-04",
  GOV_05: "GOV-05",
  GOV_06: "GOV-06",
  GOV_07: "GOV-07",
  GOV_09: "GOV-09",
  GOV_10: "GOV-10",
  OPS_12: "OPS-12",
});

export const GOVERNANCE_QUERY = Object.freeze({
  GOVERNANCE_STATE: "governance.state",
  OPERATION_READINESS: "governance.operationReadiness",
  PUBLICATION_READINESS: "governance.publicationReadiness",
  COMPLETION_READINESS: "governance.completionReadiness",
  ARCHIVE_READINESS: "governance.archiveReadiness",
  RECOVERY_READINESS: "governance.recoveryReadiness",
  REPLAY_READINESS: "governance.replayReadiness",
  IMPORT_READINESS: "governance.importReadiness",
  EXPORT_READINESS: "governance.exportReadiness",
  RELIABILITY_EVIDENCE: "governance.reliabilityEvidence",
  INCIDENT_PROJECTION: "governance.incidentProjection",
  DEGRADED_MODE: "governance.degradedMode",
  CERTIFICATION_READINESS: "governance.certificationReadiness",
});

export const GOVERNANCE_QUERY_VALUES = Object.freeze(
  Object.values(GOVERNANCE_QUERY)
);

export const GOVERNANCE_ACTION = Object.freeze({
  GOVERNANCE_READ: "governance.read",
  RELIABILITY_EVALUATE: "governance.reliability.evaluate",
  RECOVERY_EVALUATE: "governance.recovery.evaluate",
  REPLAY_EVALUATE: "governance.replay.evaluate",
  IMPORT_EVALUATE: "governance.import.evaluate",
  EXPORT_EVALUATE: "governance.export.evaluate",
  ARCHIVE_EVALUATE: "governance.archive.evaluate",
  EVIDENCE_BUILD: "governance.evidence.build",
  CERTIFICATION_READ: "governance.certification.read",
});

export const GOVERNANCE_ACTION_VALUES = Object.freeze(
  Object.values(GOVERNANCE_ACTION)
);

/**
 * Runtime health projection states (not a parallel lifecycle engine).
 * Maps over canonical lifecycle/workflow/publication evidence.
 */
export const RUNTIME_HEALTH_STATE = Object.freeze({
  READY: "READY",
  DEGRADED: "DEGRADED",
  BLOCKED: "BLOCKED",
  RECOVERING: "RECOVERING",
  SUSPENDED: "SUSPENDED",
  COMPLETED: "COMPLETED",
  ARCHIVE_READY: "ARCHIVE_READY",
  ARCHIVED: "ARCHIVED",
});

export const RUNTIME_HEALTH_STATE_VALUES = Object.freeze(
  Object.values(RUNTIME_HEALTH_STATE)
);

export const ISSUE_SEVERITY = Object.freeze({
  INFO: "INFO",
  WARNING: "WARNING",
  BLOCKING: "BLOCKING",
  CRITICAL: "CRITICAL",
});

export const ISSUE_SEVERITY_VALUES = Object.freeze(
  Object.values(ISSUE_SEVERITY)
);

export const ISSUE_SOURCE_OWNER = Object.freeze({
  E2E06: "competition-engine.e2e-06",
  CORE19: "competition-core.workflow",
  CORE20: "competition-core.audit",
  CORE21: "competition-core.deterministic-seed-replay",
  CORE22: "competition-core.import-export",
  CORE23: "competition-core.recovery-resume",
  CM06: "competition-management.publication",
  CM07: "competition-management.suspension-cancellation",
  CM08: "competition-management.archive",
  E2E01: "competition-engine.integration",
  PLATFORM: "platform-governance-operations",
});

export const RELIABILITY_ISSUE_CODE = Object.freeze({
  MISSING_TENANT: "GOV_MISSING_TENANT",
  MISSING_COMPETITION: "GOV_MISSING_COMPETITION",
  MISSING_IDENTITY: "GOV_MISSING_IDENTITY",
  MISSING_PORTS: "GOV_MISSING_PORTS",
  WORKFLOW_INCONSISTENT: "GOV_WORKFLOW_INCONSISTENT",
  LIFECYCLE_INCONSISTENT: "GOV_LIFECYCLE_INCONSISTENT",
  PUBLICATION_INCONSISTENT: "GOV_PUBLICATION_INCONSISTENT",
  PARTICIPANT_LOCK_INCONSISTENT: "GOV_PARTICIPANT_LOCK_INCONSISTENT",
  SCHEDULE_COURT_UNCERTIFIED: "GOV_SCHEDULE_COURT_UNCERTIFIED",
  SCORING_VALIDATION_INCONSISTENT: "GOV_SCORING_VALIDATION_INCONSISTENT",
  STANDINGS_QUAL_INCONSISTENT: "GOV_STANDINGS_QUAL_INCONSISTENT",
  FINAL_PUBLICATION_INCONSISTENT: "GOV_FINAL_PUBLICATION_INCONSISTENT",
  AUDIT_EVIDENCE_MISSING: "GOV_AUDIT_EVIDENCE_MISSING",
  REPLAY_SEED_MISSING: "GOV_REPLAY_SEED_MISSING",
  REPLAY_LINEAGE_CONFLICT: "GOV_REPLAY_LINEAGE_CONFLICT",
  RECOVERY_CHECKPOINT_MISSING: "GOV_RECOVERY_CHECKPOINT_MISSING",
  RECOVERY_CONFLICT: "GOV_RECOVERY_CONFLICT",
  ARCHIVE_NOT_READY: "GOV_ARCHIVE_NOT_READY",
  ARCHIVE_ACTIVE_BLOCKED: "GOV_ARCHIVE_ACTIVE_BLOCKED",
  ARCHIVE_SUSPENDED_BLOCKED: "GOV_ARCHIVE_SUSPENDED_BLOCKED",
  IMPORT_CHECKSUM_MISSING: "GOV_IMPORT_CHECKSUM_MISSING",
  IMPORT_SCHEMA_MISMATCH: "GOV_IMPORT_SCHEMA_MISMATCH",
  IMPORT_DUPLICATE_IDENTITY: "GOV_IMPORT_DUPLICATE_IDENTITY",
  EXPORT_PRIVATE_FIELD_RISK: "GOV_EXPORT_PRIVATE_FIELD_RISK",
  DEPENDENCY_UNAVAILABLE: "GOV_DEPENDENCY_UNAVAILABLE",
  DEGRADED_SAFE_PARTIAL: "GOV_DEGRADED_SAFE_PARTIAL",
  HARD_BLOCK: "GOV_HARD_BLOCK",
  CROSS_TENANT: "GOV_CROSS_TENANT",
  PERMISSION_DENIED: "GOV_PERMISSION_DENIED",
});

export const RELIABILITY_ISSUE_CODE_VALUES = Object.freeze(
  Object.values(RELIABILITY_ISSUE_CODE)
);

export const DEGRADED_CONTINUATION = Object.freeze({
  CONTINUE_SAFE: "CONTINUE_SAFE",
  READ_ONLY_FALLBACK: "READ_ONLY_FALLBACK",
  RETRY_REQUIRED: "RETRY_REQUIRED",
  MANUAL_INTERVENTION_REQUIRED: "MANUAL_INTERVENTION_REQUIRED",
  HARD_BLOCK: "HARD_BLOCK",
});

export const DEGRADED_CONTINUATION_VALUES = Object.freeze(
  Object.values(DEGRADED_CONTINUATION)
);

export const DEPENDENCY_STATUS = Object.freeze({
  AVAILABLE: "AVAILABLE",
  UNAVAILABLE: "UNAVAILABLE",
  PARTIAL: "PARTIAL",
  UNKNOWN: "UNKNOWN",
});

export const LIFECYCLE_PROJECTION = Object.freeze({
  ACTIVE: "ACTIVE",
  SUSPENDED: "SUSPENDED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
  ARCHIVED: "ARCHIVED",
});

export const GOVERNANCE_ERROR_CODE = Object.freeze({
  MISSING_TENANT: "E2E06_MISSING_TENANT",
  MISSING_COMPETITION: "E2E06_MISSING_COMPETITION",
  MISSING_IDENTITY: "E2E06_MISSING_IDENTITY",
  CROSS_TENANT_REJECTED: "E2E06_CROSS_TENANT_REJECTED",
  PERMISSION_DENIED: "E2E06_PERMISSION_DENIED",
  CLIENT_GRANT_TRUST_REJECTED: "E2E06_CLIENT_GRANT_TRUST_REJECTED",
  RECORD_NOT_FOUND: "E2E06_RECORD_NOT_FOUND",
  INVALID_INPUT: "E2E06_INVALID_INPUT",
  READINESS_BLOCKED: "E2E06_READINESS_BLOCKED",
  UNKNOWN: "E2E06_UNKNOWN",
});

export const GOVERNANCE_ERROR_CODE_VALUES = Object.freeze(
  Object.values(GOVERNANCE_ERROR_CODE)
);

export const GOVERNANCE_FORBIDDEN_PUBLIC_KEYS = Object.freeze([
  "grantedPermissions",
  "accessToken",
  "refreshToken",
  "password",
  "secret",
  "secrets",
  "authorization",
  "privateProfile",
  "rawPrivateProfile",
  "clientGrants",
  "binary",
  "base64",
  "token",
]);
