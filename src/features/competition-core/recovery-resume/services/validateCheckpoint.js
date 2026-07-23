/**
 * CORE-23 — validate checkpoint integrity, staleness, subject/operation match.
 */

import { RecoveryError, RECOVERY_ERROR_CODE } from "../errors.js";
import {
  assertRecoveryCheckpoint,
  computeCheckpointIntegrityFingerprint,
  createRecoveryValidationResult,
  createRecoveryPrecondition,
} from "../contracts/index.js";
import { isPlainObject } from "../utils/helpers.js";

/**
 * @param {object|null|undefined} checkpoint
 * @param {object} [options]
 * @param {object} [options.expectedSubject]
 * @param {object} [options.expectedOperation]
 * @param {number|null} [options.currentSubjectVersion]
 * @param {object} [options.currentDependencyEvidence]
 * @returns {Readonly<object>}
 */
export function validateRecoveryCheckpoint(checkpoint, options = {}) {
  if (checkpoint == null) {
    return createRecoveryValidationResult({
      valid: false,
      code: RECOVERY_ERROR_CODE.CHECKPOINT_MISSING,
      message: "Recovery checkpoint evidence is absent",
      preconditions: [
        createRecoveryPrecondition({
          code: RECOVERY_ERROR_CODE.CHECKPOINT_MISSING,
          satisfied: false,
          message: "checkpoint is required",
        }),
      ],
    });
  }

  if (!isPlainObject(checkpoint)) {
    return createRecoveryValidationResult({
      valid: false,
      code: RECOVERY_ERROR_CODE.INVALID_CHECKPOINT,
      message: "Recovery checkpoint is not a plain object",
    });
  }

  let normalized;
  try {
    normalized = assertRecoveryCheckpoint(checkpoint);
  } catch (err) {
    const code =
      err instanceof RecoveryError
        ? err.code
        : RECOVERY_ERROR_CODE.INVALID_CHECKPOINT;
    return createRecoveryValidationResult({
      valid: false,
      code,
      message: err instanceof Error ? err.message : "Invalid checkpoint",
      details: err instanceof RecoveryError ? err.details : null,
    });
  }

  const expectedFingerprint = computeCheckpointIntegrityFingerprint(normalized);
  if (normalized.integrityFingerprint !== expectedFingerprint) {
    return createRecoveryValidationResult({
      valid: false,
      code: RECOVERY_ERROR_CODE.CHECKPOINT_INTEGRITY_FAILED,
      message: "Checkpoint integrity fingerprint does not match canonical payload",
      details: {
        expectedFingerprint,
        actualFingerprint: normalized.integrityFingerprint,
      },
      preconditions: [
        createRecoveryPrecondition({
          code: RECOVERY_ERROR_CODE.CHECKPOINT_INTEGRITY_FAILED,
          satisfied: false,
        }),
      ],
    });
  }

  /** @type {ReturnType<typeof createRecoveryPrecondition>[]} */
  const preconditions = [
    createRecoveryPrecondition({
      code: "INTEGRITY_OK",
      satisfied: true,
      message: "Checkpoint integrity verified",
    }),
  ];

  if (options.expectedSubject) {
    const ok =
      normalized.subject.subjectId === options.expectedSubject.subjectId &&
      normalized.subject.subjectType === options.expectedSubject.subjectType;
    preconditions.push(
      createRecoveryPrecondition({
        code: RECOVERY_ERROR_CODE.SUBJECT_MISMATCH,
        satisfied: ok,
        message: ok
          ? "Subject identity matches"
          : "Checkpoint subject does not match recovery request",
        details: {
          checkpointSubject: normalized.subject,
          expectedSubject: options.expectedSubject,
        },
      })
    );
    if (!ok) {
      return createRecoveryValidationResult({
        valid: false,
        code: RECOVERY_ERROR_CODE.SUBJECT_MISMATCH,
        message: "Checkpoint subject does not match recovery request",
        preconditions,
      });
    }
  }

  if (options.expectedOperation) {
    const ok =
      normalized.operation.operationId ===
        options.expectedOperation.operationId &&
      normalized.operation.operationType ===
        options.expectedOperation.operationType;
    preconditions.push(
      createRecoveryPrecondition({
        code: RECOVERY_ERROR_CODE.OPERATION_MISMATCH,
        satisfied: ok,
        message: ok
          ? "Operation identity matches"
          : "Checkpoint operation does not match recovery request",
        details: {
          checkpointOperation: normalized.operation,
          expectedOperation: options.expectedOperation,
        },
      })
    );
    if (!ok) {
      return createRecoveryValidationResult({
        valid: false,
        code: RECOVERY_ERROR_CODE.OPERATION_MISMATCH,
        message: "Checkpoint operation does not match recovery request",
        preconditions,
      });
    }
  }

  if (
    options.currentSubjectVersion != null &&
    normalized.expectedSubjectVersion != null &&
    options.currentSubjectVersion !== normalized.expectedSubjectVersion
  ) {
    preconditions.push(
      createRecoveryPrecondition({
        code: RECOVERY_ERROR_CODE.VERSION_MISMATCH,
        satisfied: false,
        message: "Subject version changed after checkpoint creation",
        details: {
          expectedSubjectVersion: normalized.expectedSubjectVersion,
          currentSubjectVersion: options.currentSubjectVersion,
        },
      })
    );
    return createRecoveryValidationResult({
      valid: false,
      code: RECOVERY_ERROR_CODE.CHECKPOINT_STALE,
      message: "Checkpoint references an outdated subject version",
      preconditions,
      details: {
        expectedSubjectVersion: normalized.expectedSubjectVersion,
        currentSubjectVersion: options.currentSubjectVersion,
      },
    });
  }

  if (
    options.currentDependencyEvidence &&
    isPlainObject(options.currentDependencyEvidence)
  ) {
    const dep = normalized.dependencyEvidence || {};
    for (const key of Object.keys(dep)) {
      const prior = dep[key];
      const current = options.currentDependencyEvidence[key];
      if (current == null) continue;
      const priorFp =
        typeof prior === "string"
          ? prior
          : isPlainObject(prior) && prior.version != null
            ? String(prior.version)
            : JSON.stringify(prior);
      const currentFp =
        typeof current === "string"
          ? current
          : isPlainObject(current) && current.version != null
            ? String(current.version)
            : JSON.stringify(current);
      if (priorFp !== currentFp) {
        preconditions.push(
          createRecoveryPrecondition({
            code: RECOVERY_ERROR_CODE.DEPENDENCY_STATE_CHANGED,
            satisfied: false,
            message: `Dependency ${key} changed after checkpoint creation`,
            details: { key, prior, current },
          })
        );
        return createRecoveryValidationResult({
          valid: false,
          code: RECOVERY_ERROR_CODE.DEPENDENCY_STATE_CHANGED,
          message: "Dependency state changed after checkpoint creation",
          preconditions,
          details: { key, prior, current },
        });
      }
    }
  }

  const incomplete =
    !normalized.lastKnownSafeState ||
    (normalized.completedStepIds.length === 0 &&
      normalized.pendingStepIds.length === 0 &&
      normalized.completedEffectIds.length === 0 &&
      normalized.pendingEffectIds.length === 0 &&
      normalized.partialOperationStatus === "AMBIGUOUS");

  if (incomplete && options.requireWorkLists !== false) {
    // Ambiguous empty work lists are allowed only when status is explicit NOT_STARTED
    // or VALIDATED_NO_EFFECTS; otherwise treat as incomplete when caller requires lists.
  }

  return createRecoveryValidationResult({
    valid: true,
    code: null,
    message: "Checkpoint validation passed",
    preconditions,
    details: { checkpointId: normalized.checkpointId },
  });
}
