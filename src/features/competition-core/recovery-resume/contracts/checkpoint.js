/**
 * CORE-23 — RecoveryCheckpoint + integrity helpers.
 */

import {
  RECOVERY_CHECKPOINT_SCHEMA_VERSION,
  CORE23_CHECKPOINT_FINGERPRINT_VERSION,
  CORE23_ENGINE_VERSION,
} from "../constants.js";
import { RecoveryError, RECOVERY_ERROR_CODE } from "../errors.js";
import { PARTIAL_OPERATION_STATUS, isPartialOperationStatus } from "../enums.js";
import {
  deepFreezeClone,
  isNonEmptyString,
  isPlainObject,
  normalizeIdList,
  requireNonEmptyString,
  requireNonNegativeInteger,
} from "../utils/helpers.js";
import { fingerprintValue } from "../utils/fingerprint.js";
import {
  createRecoveryOperationReference,
  createRecoverySubjectReference,
  createIdempotencyReference,
  createDuplicatePreventionReference,
} from "./references.js";

/**
 * Build the canonical integrity payload (excludes integrityFingerprint itself).
 * @param {object} fields
 * @returns {object}
 */
export function buildCheckpointIntegrityPayload(fields) {
  return {
    schemaVersion: fields.schemaVersion,
    checkpointId: fields.checkpointId,
    checkpointVersion: fields.checkpointVersion,
    createdAtEvidence: fields.createdAtEvidence,
    subject: fields.subject,
    operation: fields.operation,
    expectedSubjectVersion: fields.expectedSubjectVersion,
    completedStepIds: fields.completedStepIds,
    pendingStepIds: fields.pendingStepIds,
    completedEffectIds: fields.completedEffectIds,
    pendingEffectIds: fields.pendingEffectIds,
    lastKnownSafeState: fields.lastKnownSafeState,
    partialOperationStatus: fields.partialOperationStatus,
    idempotency: fields.idempotency,
    duplicatePrevention: fields.duplicatePrevention,
    dependencyEvidence: fields.dependencyEvidence,
    engineVersion: fields.engineVersion,
    fingerprintVersion: fields.fingerprintVersion,
  };
}

/**
 * @param {object} fields
 * @returns {string}
 */
export function computeCheckpointIntegrityFingerprint(fields) {
  return fingerprintValue(buildCheckpointIntegrityPayload(fields));
}

/**
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createLastKnownSafeState(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_CHECKPOINT,
      "LastKnownSafeState must be a plain object"
    );
  }
  return Object.freeze(
    deepFreezeClone({
      stateKind: requireNonEmptyString(
        partial.stateKind ?? "UNKNOWN",
        "stateKind"
      ),
      stateVersion:
        partial.stateVersion == null
          ? null
          : requireNonNegativeInteger(partial.stateVersion, "stateVersion"),
      stateFingerprint:
        partial.stateFingerprint == null || partial.stateFingerprint === ""
          ? null
          : String(partial.stateFingerprint).trim(),
      marker:
        partial.marker == null || partial.marker === ""
          ? null
          : String(partial.marker).trim(),
      details:
        partial.details == null
          ? null
          : deepFreezeClone(partial.details),
    })
  );
}

/**
 * @param {object} [partial]
 * @returns {Readonly<object>}
 */
export function createDependencyEvidence(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_CHECKPOINT,
      "DependencyEvidence must be a plain object"
    );
  }
  /** @type {Record<string, unknown>} */
  const refs = {};
  for (const key of Object.keys(partial).sort()) {
    const value = partial[key];
    if (value == null) continue;
    if (isPlainObject(value)) {
      refs[key] = deepFreezeClone(value);
    } else if (isNonEmptyString(value)) {
      refs[key] = String(value).trim();
    } else {
      throw new RecoveryError(
        RECOVERY_ERROR_CODE.INVALID_CHECKPOINT,
        `dependencyEvidence.${key} must be a string or plain object`,
        { field: key }
      );
    }
  }
  return Object.freeze(deepFreezeClone(refs));
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createRecoveryCheckpoint(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_CHECKPOINT,
      "RecoveryCheckpoint must be a plain object"
    );
  }

  const checkpointId = requireNonEmptyString(
    partial.checkpointId,
    "checkpointId"
  );
  const checkpointVersion = requireNonNegativeInteger(
    partial.checkpointVersion ?? 1,
    "checkpointVersion"
  );
  const createdAtEvidence = requireNonEmptyString(
    partial.createdAtEvidence,
    "createdAtEvidence"
  );

  if (partial.evidenceSource === "IN_MEMORY" || partial.evidenceSource === "UI") {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.IN_MEMORY_EVIDENCE_REJECTED,
      "In-memory or UI-only state is not valid recovery evidence",
      { evidenceSource: partial.evidenceSource }
    );
  }

  let completedStepIds;
  let pendingStepIds;
  let completedEffectIds;
  let pendingEffectIds;
  try {
    completedStepIds = Object.freeze(normalizeIdList(partial.completedStepIds));
    pendingStepIds = Object.freeze(normalizeIdList(partial.pendingStepIds));
    completedEffectIds = Object.freeze(
      normalizeIdList(partial.completedEffectIds)
    );
    pendingEffectIds = Object.freeze(normalizeIdList(partial.pendingEffectIds));
  } catch (err) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.CHECKPOINT_INCOMPLETE,
      err instanceof Error ? err.message : "Invalid step/effect id lists",
      {}
    );
  }

  const subject = createRecoverySubjectReference(partial.subject);
  const operation = createRecoveryOperationReference(partial.operation);
  const expectedSubjectVersion =
    partial.expectedSubjectVersion == null
      ? subject.subjectVersion
      : requireNonNegativeInteger(
          partial.expectedSubjectVersion,
          "expectedSubjectVersion"
        );

  const partialOperationStatus = isPartialOperationStatus(
    partial.partialOperationStatus
  )
    ? partial.partialOperationStatus
    : PARTIAL_OPERATION_STATUS.AMBIGUOUS;

  const lastKnownSafeState = createLastKnownSafeState(
    partial.lastKnownSafeState ?? { stateKind: "CHECKPOINT" }
  );

  const idempotency =
    partial.idempotency == null
      ? null
      : createIdempotencyReference(partial.idempotency);
  const duplicatePrevention =
    partial.duplicatePrevention == null
      ? null
      : createDuplicatePreventionReference(partial.duplicatePrevention);

  const dependencyEvidence = createDependencyEvidence(
    partial.dependencyEvidence ?? {}
  );

  const fields = {
    schemaVersion: RECOVERY_CHECKPOINT_SCHEMA_VERSION,
    checkpointId,
    checkpointVersion,
    createdAtEvidence,
    subject,
    operation,
    expectedSubjectVersion,
    completedStepIds,
    pendingStepIds,
    completedEffectIds,
    pendingEffectIds,
    lastKnownSafeState,
    partialOperationStatus,
    idempotency,
    duplicatePrevention,
    dependencyEvidence,
    engineVersion: CORE23_ENGINE_VERSION,
    fingerprintVersion: CORE23_CHECKPOINT_FINGERPRINT_VERSION,
  };

  const integrityFingerprint =
    isNonEmptyString(partial.integrityFingerprint)
      ? String(partial.integrityFingerprint).trim()
      : computeCheckpointIntegrityFingerprint(fields);

  return Object.freeze(
    deepFreezeClone({
      ...fields,
      integrityFingerprint,
    })
  );
}

/**
 * @param {object} checkpoint
 * @returns {Readonly<object>}
 */
export function assertRecoveryCheckpoint(checkpoint) {
  if (!isPlainObject(checkpoint)) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.CHECKPOINT_MISSING,
      "RecoveryCheckpoint is required"
    );
  }
  if (checkpoint.schemaVersion !== RECOVERY_CHECKPOINT_SCHEMA_VERSION) {
    throw new RecoveryError(
      RECOVERY_ERROR_CODE.INVALID_CHECKPOINT,
      "Unsupported recovery checkpoint schema version",
      { schemaVersion: checkpoint.schemaVersion }
    );
  }
  const rebuilt = createRecoveryCheckpoint({
    ...checkpoint,
    integrityFingerprint: checkpoint.integrityFingerprint,
  });
  return rebuilt;
}
