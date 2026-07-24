/**
 * Ranking (VPR) → Platform Core integration adapter.
 *
 * Pure projections of caller-supplied identifiers into Platform Core contracts.
 * Does not calculate ranking points, change ordering or tie-breaks, change
 * ranking periods, infer player mapping, trigger recalculation, publish
 * rankings, generate IDs or timestamps, or access persistence / environment /
 * globals. Ranking formulas and publication remain Ranking-owned.
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

export const RANKING_PLATFORM_ADAPTER_ERROR = Object.freeze({
  INVALID: "RANKING_PLATFORM_ADAPTER_INVALID",
  ACTOR_ID_REQUIRED: "RANKING_PLATFORM_ADAPTER_ACTOR_ID_REQUIRED",
  TENANT_ID_REQUIRED: "RANKING_PLATFORM_ADAPTER_TENANT_ID_REQUIRED",
  SUBJECT_ID_REQUIRED: "RANKING_PLATFORM_ADAPTER_SUBJECT_ID_REQUIRED",
  OPERATION_ID_REQUIRED: "RANKING_PLATFORM_ADAPTER_OPERATION_ID_REQUIRED",
  VERSION_REQUIRED: "RANKING_PLATFORM_ADAPTER_VERSION_REQUIRED",
  EVENT_REQUIRED: "RANKING_PLATFORM_ADAPTER_EVENT_REQUIRED",
  ERROR_REQUIRED: "RANKING_PLATFORM_ADAPTER_ERROR_REQUIRED",
  CAPABILITY_REQUIRED: "RANKING_PLATFORM_ADAPTER_CAPABILITY_REQUIRED",
  COMPATIBILITY_REQUIRED: "RANKING_PLATFORM_ADAPTER_COMPATIBILITY_REQUIRED",
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
 * Project an already-resolved Ranking actor (user).
 *
 * @param {*} input
 */
export function projectRankingActor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        RANKING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Ranking actor input must be a plain object"
      )
    );
  }
  const actorId =
    "actorId" in input && input.actorId !== undefined
      ? input.actorId
      : "actorUserId" in input && input.actorUserId !== undefined
        ? input.actorUserId
        : "userId" in input && input.userId !== undefined
          ? input.userId
          : input.authUserId;
  if (actorId === undefined || actorId === null) {
    return fail(
      adapterError(
        RANKING_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED,
        "Ranking actor projection requires an explicit actorId, actorUserId, or userId",
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
 * Project a security context from an already-resolved Ranking actor.
 *
 * @param {*} input
 */
export function projectRankingSecurityContext(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        RANKING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Ranking security context input must be a plain object"
      )
    );
  }
  const actorResult = projectRankingActor(input.actor ?? input);
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
 * Project an explicit Ranking tenant scope. Does not infer tenant from club.
 *
 * @param {*} input
 */
export function projectRankingScope(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        RANKING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Ranking scope input must be a plain object"
      )
    );
  }
  if (!("tenantId" in input) || input.tenantId === undefined || input.tenantId === null) {
    return fail(
      adapterError(
        RANKING_PLATFORM_ADAPTER_ERROR.TENANT_ID_REQUIRED,
        "Ranking scope requires an explicit tenantId",
        "tenantId"
      )
    );
  }
  const scopeId =
    "scopeId" in input && input.scopeId !== undefined
      ? input.scopeId
      : input.clubId;
  return projectTenantScope({
    scopeType: typeof input.scopeType === "string" ? input.scopeType : "TENANT",
    tenantId: input.tenantId,
    ...(scopeId !== undefined ? { scopeId } : {}),
  });
}

/**
 * Project a Subject Reference for an explicit ranking entry / athlete / player.
 * Does not resolve athlete↔player mapping.
 *
 * @param {*} input
 */
export function projectRankingSubject(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        RANKING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Ranking subject input must be a plain object"
      )
    );
  }
  const subjectId =
    "subjectId" in input && input.subjectId !== undefined
      ? input.subjectId
      : "vprAthleteId" in input && input.vprAthleteId !== undefined
        ? input.vprAthleteId
        : "playerId" in input && input.playerId !== undefined
          ? input.playerId
          : input.rankingEntryId;
  if (subjectId === undefined || subjectId === null) {
    return fail(
      adapterError(
        RANKING_PLATFORM_ADAPTER_ERROR.SUBJECT_ID_REQUIRED,
        "Ranking subject requires an explicit subjectId, vprAthleteId, playerId, or rankingEntryId",
        "subjectId"
      )
    );
  }
  return createSubjectReference({
    subjectType:
      typeof input.subjectType === "string" ? input.subjectType : "RANKING_ENTRY",
    subjectId,
  });
}

/**
 * Project Operation Identity for an already-identified Ranking command.
 * Does not generate operationId.
 *
 * @param {*} input
 */
export function projectRankingOperation(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        RANKING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Ranking operation identity input must be a plain object"
      )
    );
  }
  if (!("operationId" in input) || input.operationId === undefined) {
    return fail(
      adapterError(
        RANKING_PLATFORM_ADAPTER_ERROR.OPERATION_ID_REQUIRED,
        "Ranking operation identity requires an explicit operationId",
        "operationId"
      )
    );
  }
  return projectOperationIdentity(input);
}

/**
 * Project Contract Version for an explicit Ranking contract or event version.
 *
 * @param {*} input
 */
export function projectRankingVersion(input) {
  if (typeof input === "string") {
    return projectContractVersion(input);
  }
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        RANKING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Ranking contract version input must be a string or plain object"
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
        RANKING_PLATFORM_ADAPTER_ERROR.VERSION_REQUIRED,
        "Ranking contract version requires an explicit version",
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
export function projectRankingCompatibility(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        RANKING_PLATFORM_ADAPTER_ERROR.COMPATIBILITY_REQUIRED,
        "Ranking compatibility decision input must be a plain object"
      )
    );
  }
  return projectCompatibilityDecision(input);
}

/**
 * Project a Common Event Envelope from explicit Ranking event fields.
 * Requires caller-supplied eventId and occurredAt. Does not publish rankings.
 *
 * @param {*} input
 */
export function projectRankingEvent(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        RANKING_PLATFORM_ADAPTER_ERROR.EVENT_REQUIRED,
        "Ranking event envelope input must be a plain object"
      )
    );
  }
  return projectCommonEventEnvelope(input);
}

/**
 * Project an already-resolved error at a stable Ranking boundary.
 *
 * @param {*} input
 */
export function projectRankingError(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        RANKING_PLATFORM_ADAPTER_ERROR.ERROR_REQUIRED,
        "Ranking error descriptor input must be a plain object"
      )
    );
  }
  return projectEventErrorDescriptor(input);
}

/**
 * Project a capability descriptor for an explicit Ranking public boundary.
 *
 * @param {*} input
 */
export function projectRankingCapability(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        RANKING_PLATFORM_ADAPTER_ERROR.CAPABILITY_REQUIRED,
        "Ranking capability descriptor input must be a plain object"
      )
    );
  }
  return projectPlatformCapabilityDescriptor(input);
}
