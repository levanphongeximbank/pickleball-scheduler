/**
 * CORE-22 import/export governance readiness — no file I/O backend.
 */

import { fingerprintValue } from "../../../../competition-core/deterministic-seed-replay/index.js";
import {
  ISSUE_SEVERITY,
  ISSUE_SOURCE_OWNER,
  RELIABILITY_ISSUE_CODE,
} from "../constants.js";
import {
  computeGovernanceFingerprint,
  deepFreeze,
  isNonEmptyString,
  stripForbiddenKeys,
} from "../fingerprint.js";
import { GOVERNANCE_FORBIDDEN_PUBLIC_KEYS } from "../constants.js";

/**
 * @param {object} record
 * @param {object} [query]
 */
export function evaluateImportReadiness(record, query = {}) {
  const ie = record?.importExport && typeof record.importExport === "object"
    ? record.importExport
    : {};
  const issues = [];

  const tenantId = String(query.tenantId || record.tenantId || "").trim();
  const competitionId = String(
    query.competitionId || record.competitionId || ""
  ).trim();
  if (!tenantId || !competitionId) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.MISSING_TENANT,
        severity: ISSUE_SEVERITY.CRITICAL,
        message: "Import requires tenant/competition scope",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE22,
      })
    );
  }

  if (
    isNonEmptyString(query.packageTenantId) &&
    query.packageTenantId !== tenantId
  ) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.CROSS_TENANT,
        severity: ISSUE_SEVERITY.CRITICAL,
        message: "Import package tenant mismatch",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE22,
      })
    );
  }

  const checksum =
    query.checksum || ie.importChecksum || ie.checksum || null;
  if (!isNonEmptyString(checksum)) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.IMPORT_CHECKSUM_MISSING,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Import checksum/integrity required",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE22,
      })
    );
  }

  const expectedSchema =
    query.expectedSchemaVersion || ie.schemaVersion || "core22-v1";
  const packageSchema = query.packageSchemaVersion || ie.packageSchemaVersion;
  if (
    isNonEmptyString(packageSchema) &&
    String(packageSchema) !== String(expectedSchema)
  ) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.IMPORT_SCHEMA_MISMATCH,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Import schema/version incompatible",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE22,
        details: Object.freeze({
          expectedSchema,
          packageSchema,
        }),
      })
    );
  }

  if (query.duplicateIdentity === true || ie.duplicateIdentity === true) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.IMPORT_DUPLICATE_IDENTITY,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Duplicate identity detected in import package",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE22,
      })
    );
  }

  const dryRun = query.dryRun !== false;
  const ready = issues.length === 0;
  const fingerprint = computeGovernanceFingerprint(
    {
      ready,
      tenantId,
      competitionId,
      checksum,
      expectedSchema,
      dryRun,
      conflictStrategy: query.conflictStrategy || ie.conflictStrategy || "REJECT",
      issues: issues.map((i) => i.code),
    },
    "e2e06-import"
  );

  return deepFreeze({
    ready,
    blocked: !ready,
    issues,
    dryRun,
    conflictStrategy: query.conflictStrategy || ie.conflictStrategy || "REJECT",
    auditIntent: true,
    rollbackRequired: true,
    ownsFileBackend: false,
    core22Handoff: true,
    fingerprint,
  });
}

/**
 * @param {object} record
 * @param {object} [query]
 */
export function evaluateExportReadiness(record, query = {}) {
  const ie = record?.importExport && typeof record.importExport === "object"
    ? record.importExport
    : {};
  const issues = [];

  const visibilityScope =
    query.visibilityScope || ie.visibilityScope || "ORGANIZER";
  const privateFields = Array.isArray(query.privateFields)
    ? query.privateFields
    : Array.isArray(ie.privateFields)
      ? ie.privateFields
      : [];

  if (visibilityScope === "PUBLIC" && privateFields.length > 0) {
    issues.push(
      Object.freeze({
        code: RELIABILITY_ISSUE_CODE.EXPORT_PRIVATE_FIELD_RISK,
        severity: ISSUE_SEVERITY.BLOCKING,
        message: "Public export must exclude private fields",
        sourceOwner: ISSUE_SOURCE_OWNER.CORE22,
      })
    );
  }

  const payload = stripForbiddenKeys(
    {
      tenantId: record.tenantId,
      competitionId: record.competitionId,
      sourceRevision: record?.definition?.version || null,
      publicationState: record?.publication?.state || null,
      lifecycleState: record?.lifecycle?.state || null,
      standingsFingerprint: record?.standings?.fingerprint || null,
      visibilityScope,
    },
    GOVERNANCE_FORBIDDEN_PUBLIC_KEYS
  );

  const exportChecksum =
    ie.exportChecksum ||
    fingerprintValue(payload);

  const ready = issues.length === 0;
  const fingerprint = computeGovernanceFingerprint(
    {
      ready,
      payload,
      exportChecksum,
      issues: issues.map((i) => i.code),
    },
    "e2e06-export"
  );

  return deepFreeze({
    ready,
    blocked: !ready,
    issues,
    visibilityScope,
    privateFieldsExcluded: true,
    deterministicOutput: true,
    exportChecksum,
    sourceRevision: record?.definition?.version || null,
    publicationState: record?.publication?.state || null,
    archiveState: record?.lifecycle?.state || null,
    ownsFileBackend: false,
    core22Handoff: true,
    fingerprint,
  });
}
