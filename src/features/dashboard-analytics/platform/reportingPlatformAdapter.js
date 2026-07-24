/**
 * Reporting & Analytics (dashboard-analytics) → Platform Core integration adapter.
 *
 * Canonical Reporting & Analytics home for this wave: src/features/dashboard-analytics.
 * Pure projections of caller-supplied identifiers into Platform Core contracts.
 * Does not calculate metrics, execute queries, aggregate data, change access
 * control or export formats, create analytics pipelines, generate IDs or
 * timestamps, or access persistence / environment / globals. Metric definitions
 * and query execution remain Reporting-owned.
 */

import {
  fail,
  createSubjectReference,
  projectIdentityActor,
  projectSecurityContext,
  projectTenantScope,
  projectOperationIdentity,
  projectContractVersion,
  projectCompatibilityDecision,
  projectCommonEventEnvelope,
  projectEventErrorDescriptor,
  projectPlatformCapabilityDescriptor,
} from "../../../core/platform/index.js";

export const REPORTING_PLATFORM_ADAPTER_ERROR = Object.freeze({
  INVALID: "REPORTING_PLATFORM_ADAPTER_INVALID",
  ACTOR_ID_REQUIRED: "REPORTING_PLATFORM_ADAPTER_ACTOR_ID_REQUIRED",
  TENANT_ID_REQUIRED: "REPORTING_PLATFORM_ADAPTER_TENANT_ID_REQUIRED",
  SUBJECT_ID_REQUIRED: "REPORTING_PLATFORM_ADAPTER_SUBJECT_ID_REQUIRED",
  OPERATION_ID_REQUIRED: "REPORTING_PLATFORM_ADAPTER_OPERATION_ID_REQUIRED",
  VERSION_REQUIRED: "REPORTING_PLATFORM_ADAPTER_VERSION_REQUIRED",
  EVENT_REQUIRED: "REPORTING_PLATFORM_ADAPTER_EVENT_REQUIRED",
  ERROR_REQUIRED: "REPORTING_PLATFORM_ADAPTER_ERROR_REQUIRED",
  CAPABILITY_REQUIRED: "REPORTING_PLATFORM_ADAPTER_CAPABILITY_REQUIRED",
  COMPATIBILITY_REQUIRED: "REPORTING_PLATFORM_ADAPTER_COMPATIBILITY_REQUIRED",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 */
function adapterError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * @param {*} input
 * @returns {input is Record<string, *>}
 */
function isPlainObject(input) {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}

/**
 * Project an already-resolved Reporting actor (user).
 *
 * @param {*} input
 */
export function projectReportingActor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        REPORTING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Reporting actor input must be a plain object"
      )
    );
  }
  const actorId =
    "actorId" in input && input.actorId !== undefined
      ? input.actorId
      : "userId" in input && input.userId !== undefined
        ? input.userId
        : input.authUserId;
  if (actorId === undefined || actorId === null) {
    return fail(
      adapterError(
        REPORTING_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED,
        "Reporting actor projection requires an explicit actorId, userId, or authUserId",
        "actorId"
      )
    );
  }
  return projectIdentityActor({
    actorType: typeof input.actorType === "string" ? input.actorType : "USER",
    actorId,
  });
}

/**
 * Project a security context from an already-resolved Reporting actor.
 *
 * @param {*} input
 */
export function projectReportingSecurityContext(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        REPORTING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Reporting security context input must be a plain object"
      )
    );
  }
  const actorResult = projectReportingActor(input.actor ?? input);
  if (!actorResult.ok) {
    return actorResult;
  }
  /** @type {{ actor: *, tenantId?: *, sessionId?: *, requestId?: *, correlationId?: * }} */
  const payload = { actor: actorResult.value };
  if ("tenantId" in input && input.tenantId !== undefined) {
    payload.tenantId = input.tenantId;
  }
  if ("sessionId" in input && input.sessionId !== undefined) {
    payload.sessionId = input.sessionId;
  }
  if ("requestId" in input && input.requestId !== undefined) {
    payload.requestId = input.requestId;
  }
  if ("correlationId" in input && input.correlationId !== undefined) {
    payload.correlationId = input.correlationId;
  }
  return projectSecurityContext(payload);
}

/**
 * Project an explicit Reporting tenant/report scope. Does not infer tenant.
 *
 * @param {*} input
 */
export function projectReportingScope(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        REPORTING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Reporting scope input must be a plain object"
      )
    );
  }
  if (!("tenantId" in input) || input.tenantId === undefined || input.tenantId === null) {
    return fail(
      adapterError(
        REPORTING_PLATFORM_ADAPTER_ERROR.TENANT_ID_REQUIRED,
        "Reporting scope requires an explicit tenantId",
        "tenantId"
      )
    );
  }
  const scopeId =
    "scopeId" in input && input.scopeId !== undefined
      ? input.scopeId
      : "clubId" in input && input.clubId !== undefined
        ? input.clubId
        : input.venueId;
  return projectTenantScope({
    scopeType: typeof input.scopeType === "string" ? input.scopeType : "TENANT",
    tenantId: input.tenantId,
    ...(scopeId !== undefined ? { scopeId } : {}),
  });
}

/**
 * Project a Subject Reference for an explicit report id.
 * Does not execute the report.
 *
 * @param {*} input
 */
export function projectReportingSubject(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        REPORTING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Reporting subject input must be a plain object"
      )
    );
  }
  const subjectId =
    "subjectId" in input && input.subjectId !== undefined
      ? input.subjectId
      : "reportId" in input && input.reportId !== undefined
        ? input.reportId
        : input.dashboardId;
  if (subjectId === undefined || subjectId === null) {
    return fail(
      adapterError(
        REPORTING_PLATFORM_ADAPTER_ERROR.SUBJECT_ID_REQUIRED,
        "Reporting subject requires an explicit subjectId, reportId, or dashboardId",
        "subjectId"
      )
    );
  }
  return createSubjectReference({
    subjectType:
      typeof input.subjectType === "string" ? input.subjectType : "REPORT",
    subjectId,
  });
}

/**
 * Project Operation Identity for an already-identified Reporting request.
 * Does not generate operationId.
 *
 * @param {*} input
 */
export function projectReportingOperation(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        REPORTING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Reporting operation identity input must be a plain object"
      )
    );
  }
  if (!("operationId" in input) || input.operationId === undefined) {
    return fail(
      adapterError(
        REPORTING_PLATFORM_ADAPTER_ERROR.OPERATION_ID_REQUIRED,
        "Reporting operation identity requires an explicit operationId",
        "operationId"
      )
    );
  }
  return projectOperationIdentity(input);
}

/**
 * Project Contract Version for an explicit Reporting contract or event version.
 *
 * @param {*} input
 */
export function projectReportingVersion(input) {
  if (typeof input === "string") {
    return projectContractVersion(input);
  }
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        REPORTING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Reporting contract version input must be a string or plain object"
      )
    );
  }
  const version =
    "version" in input && input.version !== undefined
      ? input.version
      : input.contractVersion;
  if (version === undefined || version === null) {
    return fail(
      adapterError(
        REPORTING_PLATFORM_ADAPTER_ERROR.VERSION_REQUIRED,
        "Reporting contract version requires an explicit version",
        "version"
      )
    );
  }
  return projectContractVersion(version);
}

/**
 * Project Compatibility Decision when an outcome is already resolved externally.
 *
 * @param {*} input
 */
export function projectReportingCompatibility(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        REPORTING_PLATFORM_ADAPTER_ERROR.COMPATIBILITY_REQUIRED,
        "Reporting compatibility decision input must be a plain object"
      )
    );
  }
  return projectCompatibilityDecision(input);
}

/**
 * Project a Common Event Envelope from explicit Reporting event fields.
 * Requires caller-supplied eventId and occurredAt. Does not emit analytics.
 *
 * @param {*} input
 */
export function projectReportingEvent(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        REPORTING_PLATFORM_ADAPTER_ERROR.EVENT_REQUIRED,
        "Reporting event envelope input must be a plain object"
      )
    );
  }
  return projectCommonEventEnvelope(input);
}

/**
 * Project an already-resolved error at a stable Reporting boundary.
 *
 * @param {*} input
 */
export function projectReportingError(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        REPORTING_PLATFORM_ADAPTER_ERROR.ERROR_REQUIRED,
        "Reporting error descriptor input must be a plain object"
      )
    );
  }
  return projectEventErrorDescriptor(input);
}

/**
 * Project a capability descriptor for an explicit Reporting public boundary.
 *
 * @param {*} input
 */
export function projectReportingCapability(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        REPORTING_PLATFORM_ADAPTER_ERROR.CAPABILITY_REQUIRED,
        "Reporting capability descriptor input must be a plain object"
      )
    );
  }
  return projectPlatformCapabilityDescriptor(input);
}
