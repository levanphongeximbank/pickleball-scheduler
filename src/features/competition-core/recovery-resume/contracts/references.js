/**
 * CORE-23 — subject / operation / idempotency / duplicate-prevention references.
 */

import { RecoveryError, RECOVERY_ERROR_CODE } from "../errors.js";
import {
  deepFreezeClone,
  isNonEmptyString,
  isNonNegativeInteger,
  isPlainObject,
  requireNonEmptyString,
} from "../utils/helpers.js";

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createRecoverySubjectReference(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_REQUEST,
      "RecoverySubjectReference must be a plain object"
    );
  }
  const subjectId = requireNonEmptyString(partial.subjectId, "subjectId");
  const subjectType = requireNonEmptyString(partial.subjectType, "subjectType");
  const subjectVersion =
    partial.subjectVersion == null
      ? null
      : isNonNegativeInteger(partial.subjectVersion)
        ? partial.subjectVersion
        : (() => {
            throw new RecoveryError(
              RECOVERY_ERROR_CODE.INVALID_REQUEST,
              "subjectVersion must be a non-negative integer",
              { field: "subjectVersion" }
            );
          })();

  return Object.freeze(
    deepFreezeClone({
      subjectId,
      subjectType,
      subjectVersion,
      competitionId:
        partial.competitionId == null || partial.competitionId === ""
          ? null
          : String(partial.competitionId).trim(),
      tenantId:
        partial.tenantId == null || partial.tenantId === ""
          ? null
          : String(partial.tenantId).trim(),
    })
  );
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createRecoveryOperationReference(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_REQUEST,
      "RecoveryOperationReference must be a plain object"
    );
  }
  return Object.freeze(
    deepFreezeClone({
      operationId: requireNonEmptyString(partial.operationId, "operationId"),
      operationType: requireNonEmptyString(
        partial.operationType,
        "operationType"
      ),
      attemptNumber: isNonNegativeInteger(partial.attemptNumber)
        ? partial.attemptNumber
        : 1,
      correlationId:
        partial.correlationId == null || partial.correlationId === ""
          ? null
          : String(partial.correlationId).trim(),
      causationId:
        partial.causationId == null || partial.causationId === ""
          ? null
          : String(partial.causationId).trim(),
      requestId:
        partial.requestId == null || partial.requestId === ""
          ? null
          : String(partial.requestId).trim(),
    })
  );
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createIdempotencyReference(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.IDEMPOTENCY_INVALID,
      "IdempotencyReference must be a plain object"
    );
  }
  const idempotencyKey = requireNonEmptyString(
    partial.idempotencyKey,
    "idempotencyKey"
  );
  const payloadFingerprint =
    partial.payloadFingerprint == null || partial.payloadFingerprint === ""
      ? null
      : String(partial.payloadFingerprint).trim();

  return Object.freeze(
    deepFreezeClone({
      idempotencyKey,
      payloadFingerprint,
      scope:
        partial.scope == null || partial.scope === ""
          ? null
          : String(partial.scope).trim(),
    })
  );
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createDuplicatePreventionReference(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_REQUEST,
      "DuplicatePreventionReference must be a plain object"
    );
  }
  return Object.freeze(
    deepFreezeClone({
      duplicatePreventionKey: requireNonEmptyString(
        partial.duplicatePreventionKey,
        "duplicatePreventionKey"
      ),
      priorOutcomeFingerprint:
        partial.priorOutcomeFingerprint == null ||
        partial.priorOutcomeFingerprint === ""
          ? null
          : String(partial.priorOutcomeFingerprint).trim(),
      recoveredAtEvidence:
        partial.recoveredAtEvidence == null ||
        partial.recoveredAtEvidence === ""
          ? null
          : String(partial.recoveredAtEvidence).trim(),
    })
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRecoverySubjectReference(value) {
  return (
    isPlainObject(value) &&
    isNonEmptyString(/** @type {object} */ (value).subjectId) &&
    isNonEmptyString(/** @type {object} */ (value).subjectType)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRecoveryOperationReference(value) {
  return (
    isPlainObject(value) &&
    isNonEmptyString(/** @type {object} */ (value).operationId) &&
    isNonEmptyString(/** @type {object} */ (value).operationType)
  );
}
