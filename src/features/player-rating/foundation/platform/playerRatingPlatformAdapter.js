/**
 * Player Rating Foundation → Platform Core integration adapter.
 *
 * Pure projections of caller-supplied identifiers into Platform Core contracts.
 * Does not calculate ratings, modify snapshots, change history, verify
 * adjustments, infer participant→playerId mapping, or access persistence.
 */

import {
  fail,
  createSubjectReference,
  projectOperationIdentity,
  projectContractVersion,
  projectCompatibilityDecision,
  projectEventErrorDescriptor,
} from "../../../../core/platform/index.js";

export const PLAYER_RATING_PLATFORM_ADAPTER_ERROR = Object.freeze({
  INVALID: "PLAYER_RATING_PLATFORM_ADAPTER_INVALID",
  PLAYER_ID_REQUIRED: "PLAYER_RATING_PLATFORM_ADAPTER_PLAYER_ID_REQUIRED",
  OPERATION_ID_REQUIRED: "PLAYER_RATING_PLATFORM_ADAPTER_OPERATION_ID_REQUIRED",
  VERSION_REQUIRED: "PLAYER_RATING_PLATFORM_ADAPTER_VERSION_REQUIRED",
  COMPATIBILITY_REQUIRED:
    "PLAYER_RATING_PLATFORM_ADAPTER_COMPATIBILITY_REQUIRED",
  ERROR_REQUIRED: "PLAYER_RATING_PLATFORM_ADAPTER_ERROR_REQUIRED",
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
 * Project a Subject Reference for an explicit playerId.
 *
 * @param {*} input
 */
export function projectPlayerRatingSubject(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        PLAYER_RATING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Player Rating subject input must be a plain object"
      )
    );
  }
  if (!("playerId" in input) || input.playerId === undefined || input.playerId === null) {
    return fail(
      adapterError(
        PLAYER_RATING_PLATFORM_ADAPTER_ERROR.PLAYER_ID_REQUIRED,
        "Player Rating subject projection requires an explicit playerId",
        "playerId"
      )
    );
  }
  return createSubjectReference({
    subjectType: "PLAYER",
    subjectId: input.playerId,
  });
}

/**
 * Project Operation Identity for an already-identified rating operation.
 * Does not generate operationId.
 *
 * @param {*} input
 */
export function projectPlayerRatingOperationIdentity(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        PLAYER_RATING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Player Rating operation identity input must be a plain object"
      )
    );
  }
  if (!("operationId" in input) || input.operationId === undefined) {
    return fail(
      adapterError(
        PLAYER_RATING_PLATFORM_ADAPTER_ERROR.OPERATION_ID_REQUIRED,
        "Player Rating operation identity requires an explicit operationId",
        "operationId"
      )
    );
  }
  return projectOperationIdentity(input);
}

/**
 * Project Contract Version for an explicit rating contract or snapshot version.
 *
 * @param {*} input
 */
export function projectPlayerRatingContractVersion(input) {
  if (typeof input === "string") {
    return projectContractVersion(input);
  }
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        PLAYER_RATING_PLATFORM_ADAPTER_ERROR.INVALID,
        "Player Rating contract version input must be a string or plain object"
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
        PLAYER_RATING_PLATFORM_ADAPTER_ERROR.VERSION_REQUIRED,
        "Player Rating contract version requires an explicit version",
        "version"
      )
    );
  }
  return projectContractVersion(version);
}

/**
 * Project Compatibility Decision when an outcome is already resolved externally.
 * Does not compare versions or infer compatibility.
 *
 * @param {*} input
 */
export function projectPlayerRatingCompatibilityDecision(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        PLAYER_RATING_PLATFORM_ADAPTER_ERROR.COMPATIBILITY_REQUIRED,
        "Player Rating compatibility decision input must be a plain object"
      )
    );
  }
  return projectCompatibilityDecision(input);
}

/**
 * Project an already-resolved error at a stable rating boundary.
 *
 * @param {*} input
 */
export function projectPlayerRatingErrorDescriptor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        PLAYER_RATING_PLATFORM_ADAPTER_ERROR.ERROR_REQUIRED,
        "Player Rating error descriptor input must be a plain object"
      )
    );
  }
  return projectEventErrorDescriptor(input);
}
