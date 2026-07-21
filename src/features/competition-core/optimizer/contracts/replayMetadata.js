/**
 * CORE-10 — ReplayMetadata contract.
 * Timing / machine fields are excluded from replay-determining material.
 */

import {
  CORE10_COMPARATOR_VERSION,
  CORE10_ENGINE_VERSION,
  CORE10_FINGERPRINT_VERSION,
  CORE10_PRNG_VERSION,
  CORE10_SCHEMA_VERSION,
} from "../constants/versions.js";
import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { createDeterministicBudget } from "./optimizationRequest.js";
import {
  cloneFreezeObject,
  rejectUnknownFields,
  requireStableId,
} from "./shared.js";

const ALLOWED = Object.freeze([
  "engineVersion",
  "contractSchemaVersion",
  "policyId",
  "policyVersion",
  "comparatorVersion",
  "fingerprintAlgorithmVersion",
  "inputSnapshotFingerprints",
  "seed",
  "prngVersion",
  "operationId",
  "deterministicBudget",
  "resultFingerprint",
]);

/** Fields that must never appear on ReplayMetadata. */
export const REPLAY_METADATA_FORBIDDEN_FIELDS = Object.freeze([
  "wallClockDurationMs",
  "machineIdentity",
  "timestamp",
  "processId",
  "memoryUsage",
  "runtimeTiming",
  "durationMs",
  "generatedAt",
]);

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createReplayMetadata(partial = {}) {
  rejectUnknownFields(
    /** @type {Record<string, unknown>} */ (partial),
    ALLOWED,
    "ReplayMetadata",
    OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
  );

  for (const forbidden of REPLAY_METADATA_FORBIDDEN_FIELDS) {
    if (
      Object.prototype.hasOwnProperty.call(partial, forbidden) &&
      /** @type {Record<string, unknown>} */ (partial)[forbidden] != null
    ) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.NON_DETERMINISTIC_INPUT,
        `ReplayMetadata must not include ${forbidden}`,
        { field: forbidden }
      );
    }
  }

  if (
    !Array.isArray(partial.inputSnapshotFingerprints) ||
    partial.inputSnapshotFingerprints.length === 0
  ) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      "inputSnapshotFingerprints must be a non-empty array of strings",
      {}
    );
  }

  const inputSnapshotFingerprints = partial.inputSnapshotFingerprints.map(
    (fp, i) =>
      requireStableId(
        fp,
        `inputSnapshotFingerprints[${i}]`,
        OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
      )
  );

  if (!partial.deterministicBudget || typeof partial.deterministicBudget !== "object") {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST,
      "ReplayMetadata.deterministicBudget is required",
      {}
    );
  }

  const seed =
    partial.seed == null
      ? null
      : requireStableId(
          String(partial.seed),
          "ReplayMetadata.seed",
          OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
        );

  const prngVersion =
    partial.prngVersion == null
      ? seed
        ? CORE10_PRNG_VERSION
        : null
      : requireStableId(
          partial.prngVersion,
          "ReplayMetadata.prngVersion",
          OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
        );

  return Object.freeze({
    engineVersion: requireStableId(
      partial.engineVersion ?? CORE10_ENGINE_VERSION,
      "engineVersion",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
    contractSchemaVersion: requireStableId(
      partial.contractSchemaVersion ?? CORE10_SCHEMA_VERSION,
      "contractSchemaVersion",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
    policyId: requireStableId(
      partial.policyId,
      "policyId",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
    policyVersion: requireStableId(
      partial.policyVersion,
      "policyVersion",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
    comparatorVersion: requireStableId(
      partial.comparatorVersion ?? CORE10_COMPARATOR_VERSION,
      "comparatorVersion",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
    fingerprintAlgorithmVersion: requireStableId(
      partial.fingerprintAlgorithmVersion ?? CORE10_FINGERPRINT_VERSION,
      "fingerprintAlgorithmVersion",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
    inputSnapshotFingerprints: Object.freeze(inputSnapshotFingerprints),
    seed,
    prngVersion,
    operationId: requireStableId(
      partial.operationId,
      "operationId",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
    deterministicBudget: createDeterministicBudget(partial.deterministicBudget),
    resultFingerprint: requireStableId(
      partial.resultFingerprint,
      "resultFingerprint",
      OPTIMIZATION_FAILURE_CODE.INVALID_REQUEST
    ),
  });
}

/**
 * Project replay-determining material (excludes non-replay diagnostics).
 * @param {ReturnType<typeof createReplayMetadata>} metadata
 * @returns {Readonly<object>}
 */
export function projectReplayFingerprintMaterial(metadata) {
  return cloneFreezeObject(
    {
      engineVersion: metadata.engineVersion,
      contractSchemaVersion: metadata.contractSchemaVersion,
      policyId: metadata.policyId,
      policyVersion: metadata.policyVersion,
      comparatorVersion: metadata.comparatorVersion,
      fingerprintAlgorithmVersion: metadata.fingerprintAlgorithmVersion,
      inputSnapshotFingerprints: metadata.inputSnapshotFingerprints,
      seed: metadata.seed,
      prngVersion: metadata.prngVersion,
      operationId: metadata.operationId,
      deterministicBudget: metadata.deterministicBudget,
      resultFingerprint: metadata.resultFingerprint,
    },
    "replayFingerprintMaterial"
  );
}
