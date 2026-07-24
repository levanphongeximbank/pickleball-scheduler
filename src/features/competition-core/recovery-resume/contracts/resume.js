/**
 * CORE-23 — ResumeToken + ResumeContext.
 */

import { RESUME_TOKEN_SCHEMA_VERSION } from "../constants.js";
import { RecoveryError, RECOVERY_ERROR_CODE } from "../errors.js";
import {
  deepFreezeClone,
  isNonEmptyString,
  isNonNegativeInteger,
  isPlainObject,
  requireNonEmptyString,
} from "../utils/helpers.js";
import { fingerprintValue } from "../utils/fingerprint.js";
import {
  createRecoveryOperationReference,
  createRecoverySubjectReference,
} from "./references.js";

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createResumeToken(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.RESUME_TOKEN_INVALID,
      "ResumeToken must be a plain object"
    );
  }

  const tokenId = requireNonEmptyString(partial.tokenId, "tokenId");
  const checkpointId = requireNonEmptyString(
    partial.checkpointId,
    "checkpointId"
  );
  const checkpointVersion = isNonNegativeInteger(partial.checkpointVersion)
    ? partial.checkpointVersion
    : 1;

  const subject = createRecoverySubjectReference(partial.subject);
  const operation = createRecoveryOperationReference(partial.operation);

  /** Single-use by default; idempotentRepeatEvaluation permits deterministic re-evaluation. */
  const reusable =
    partial.reusable === true
      ? true
      : partial.idempotentRepeatEvaluation === true
        ? true
        : false;
  const idempotentRepeatEvaluation =
    partial.idempotentRepeatEvaluation === true;

  const tokenFingerprint =
    isNonEmptyString(partial.tokenFingerprint)
      ? String(partial.tokenFingerprint).trim()
      : fingerprintValue({
          schemaVersion: RESUME_TOKEN_SCHEMA_VERSION,
          tokenId,
          checkpointId,
          checkpointVersion,
          subject,
          operation,
          reusable,
          idempotentRepeatEvaluation,
        });

  return Object.freeze(
    deepFreezeClone({
      schemaVersion: RESUME_TOKEN_SCHEMA_VERSION,
      tokenId,
      checkpointId,
      checkpointVersion,
      subject,
      operation,
      reusable,
      idempotentRepeatEvaluation,
      tokenFingerprint,
      consumedEvidence:
        partial.consumedEvidence == null || partial.consumedEvidence === ""
          ? null
          : String(partial.consumedEvidence).trim(),
    })
  );
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createResumeContext(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_REQUEST,
      "ResumeContext must be a plain object"
    );
  }

  return Object.freeze(
    deepFreezeClone({
      currentSubjectVersion:
        partial.currentSubjectVersion == null
          ? null
          : isNonNegativeInteger(partial.currentSubjectVersion)
            ? partial.currentSubjectVersion
            : (() => {
                throw new RecoveryError(
                  RECOVERY_ERROR_CODE.INVALID_REQUEST,
                  "currentSubjectVersion must be a non-negative integer"
                );
              })(),
      currentDependencyEvidence:
        partial.currentDependencyEvidence == null
          ? Object.freeze({})
          : deepFreezeClone(partial.currentDependencyEvidence),
      seenDuplicatePreventionKeys: Object.freeze(
        Array.isArray(partial.seenDuplicatePreventionKeys)
          ? [...partial.seenDuplicatePreventionKeys]
              .map((k) => String(k).trim())
              .filter(Boolean)
              .sort()
          : []
      ),
      seenResumeTokenIds: Object.freeze(
        Array.isArray(partial.seenResumeTokenIds)
          ? [...partial.seenResumeTokenIds]
              .map((k) => String(k).trim())
              .filter(Boolean)
              .sort()
          : []
      ),
      priorRecoveryOutcomeFingerprints: Object.freeze(
        isPlainObject(partial.priorRecoveryOutcomeFingerprints)
          ? { ...partial.priorRecoveryOutcomeFingerprints }
          : {}
      ),
      compensationCapability:
        partial.compensationCapability === true
          ? Object.freeze({
              available: true,
              contractId:
                isNonEmptyString(partial.compensationContractId)
                  ? String(partial.compensationContractId).trim()
                  : "caller-supplied-compensation",
            })
          : Object.freeze({ available: false, contractId: null }),
    })
  );
}
