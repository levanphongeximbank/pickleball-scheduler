/**
 * CORE-21 — ReplayInput / ReplayContext / mismatch report contracts.
 */

import {
  CORE21_COMPARATOR_VERSION,
  CORE21_ENGINE_VERSION,
  CORE21_FINGERPRINT_VERSION,
  CORE21_PRNG_VERSION,
  CORE21_REPLAY_CONTRACT_VERSION,
  CORE21_SEED_ALGORITHM_VERSION,
  CORE21_SERIALIZATION_VERSION,
  EXECUTION_MODE,
  EXECUTION_MODE_VALUES,
  REPLAY_FORBIDDEN_FIELDS,
  REPLAY_MISMATCH_CATEGORY,
  REPLAY_MISMATCH_CATEGORY_VALUES,
} from "../constants.js";
import { DETERMINISTIC_SEED_REPLAY_ERROR_CODE } from "../errors/errorCodes.js";
import { DeterministicSeedReplayError } from "../errors/DeterministicSeedReplayError.js";
import { deepFreezeCanonical, isPlainObject } from "../serialize/canonicalize.js";
import { normalizeSeed } from "../seed/normalize.js";

/**
 * @param {Record<string, unknown>} obj
 * @param {string} label
 */
function rejectForbiddenFields(obj, label) {
  for (const forbidden of REPLAY_FORBIDDEN_FIELDS) {
    if (
      Object.prototype.hasOwnProperty.call(obj, forbidden) &&
      obj[forbidden] != null
    ) {
      throw new DeterministicSeedReplayError(
        DETERMINISTIC_SEED_REPLAY_ERROR_CODE.NON_DETERMINISTIC_INPUT,
        `${label} must not include ${forbidden}`,
        { field: forbidden }
      );
    }
  }
}

/**
 * @param {unknown} value
 * @param {string} field
 * @returns {string}
 */
function requireNonEmptyString(value, field) {
  if (typeof value !== "string" || !value.trim()) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.REPLAY_INPUT_INVALID,
      `${field} must be a non-empty string`,
      { field }
    );
  }
  return value.trim();
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createReplayInput(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.REPLAY_INPUT_INVALID,
      "ReplayInput must be a plain object",
      {}
    );
  }
  rejectForbiddenFields(/** @type {Record<string, unknown>} */ (partial), "ReplayInput");

  const seedIdentity = normalizeSeed(partial.seedIdentity);
  const normalizedInputFingerprint = requireNonEmptyString(
    partial.normalizedInputFingerprint,
    "normalizedInputFingerprint"
  );

  const eventHistoryReference =
    partial.eventHistoryReference == null
      ? null
      : deepFreezeCanonical(partial.eventHistoryReference, "eventHistoryReference");

  const expectedOutputFingerprint =
    partial.expectedOutputFingerprint == null
      ? null
      : requireNonEmptyString(
          partial.expectedOutputFingerprint,
          "expectedOutputFingerprint"
        );

  return Object.freeze({
    replayContractVersion: CORE21_REPLAY_CONTRACT_VERSION,
    seedIdentity,
    seedAlgorithmVersion: requireNonEmptyString(
      partial.seedAlgorithmVersion ?? CORE21_SEED_ALGORITHM_VERSION,
      "seedAlgorithmVersion"
    ),
    normalizedInputFingerprint,
    algorithmVersion: requireNonEmptyString(
      partial.algorithmVersion,
      "algorithmVersion"
    ),
    ruleSetId: requireNonEmptyString(partial.ruleSetId, "ruleSetId"),
    ruleSetVersion: requireNonEmptyString(
      partial.ruleSetVersion,
      "ruleSetVersion"
    ),
    serializationVersion: requireNonEmptyString(
      partial.serializationVersion ?? CORE21_SERIALIZATION_VERSION,
      "serializationVersion"
    ),
    fingerprintAlgorithmVersion: requireNonEmptyString(
      partial.fingerprintAlgorithmVersion ?? CORE21_FINGERPRINT_VERSION,
      "fingerprintAlgorithmVersion"
    ),
    comparatorVersion: requireNonEmptyString(
      partial.comparatorVersion ?? CORE21_COMPARATOR_VERSION,
      "comparatorVersion"
    ),
    prngVersion: requireNonEmptyString(
      partial.prngVersion ?? CORE21_PRNG_VERSION,
      "prngVersion"
    ),
    eventHistoryReference,
    expectedOutputFingerprint,
  });
}

/**
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createReplayContext(partial = {}) {
  if (!isPlainObject(partial)) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.REPLAY_INPUT_INVALID,
      "ReplayContext must be a plain object",
      {}
    );
  }
  rejectForbiddenFields(
    /** @type {Record<string, unknown>} */ (partial),
    "ReplayContext"
  );

  const executionMode = partial.executionMode;
  if (!EXECUTION_MODE_VALUES.has(executionMode)) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.REPLAY_INPUT_INVALID,
      "executionMode must be REPLAY_VERIFY or DETERMINISTIC_EXECUTE",
      { executionMode }
    );
  }

  if (partial.dependencyVersions != null) {
    if (!isPlainObject(partial.dependencyVersions)) {
      throw new DeterministicSeedReplayError(
        DETERMINISTIC_SEED_REPLAY_ERROR_CODE.REPLAY_INPUT_INVALID,
        "dependencyVersions must be a plain object of string engine versions",
        {}
      );
    }
    for (const [key, value] of Object.entries(
      /** @type {Record<string, unknown>} */ (partial.dependencyVersions)
    )) {
      if (typeof value !== "string" || !value.trim()) {
        throw new DeterministicSeedReplayError(
          DETERMINISTIC_SEED_REPLAY_ERROR_CODE.REPLAY_INPUT_INVALID,
          "dependencyVersions values must be non-empty strings",
          { key }
        );
      }
    }
  }

  const dependencyVersions =
    partial.dependencyVersions == null
      ? Object.freeze({})
      : /** @type {Readonly<Record<string, string>>>} */ (
          deepFreezeCanonical(partial.dependencyVersions, "dependencyVersions")
        );

  let pinnedDomainTime = null;
  if (partial.pinnedDomainTime != null) {
    pinnedDomainTime = requireNonEmptyString(
      partial.pinnedDomainTime,
      "pinnedDomainTime"
    );
  }

  // Fail closed: ambient clock hints are never accepted.
  if (partial.useAmbientClock === true || partial.now != null) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.NON_DETERMINISTIC_INPUT,
      "Ambient clock is forbidden in ReplayContext",
      {}
    );
  }

  return Object.freeze({
    replayContractVersion: CORE21_REPLAY_CONTRACT_VERSION,
    engineVersion: requireNonEmptyString(
      partial.engineVersion ?? CORE21_ENGINE_VERSION,
      "engineVersion"
    ),
    executionMode,
    dependencyVersions,
    pinnedDomainTime,
  });
}

/**
 * @param {{
 *   category: string,
 *   path: string,
 *   expected?: unknown,
 *   actual?: unknown,
 *   message?: string,
 * }} partial
 * @returns {Readonly<object>}
 */
export function createReplayMismatch(partial) {
  if (!REPLAY_MISMATCH_CATEGORY_VALUES.has(partial.category)) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.REPLAY_INPUT_INVALID,
      "Unknown replay mismatch category",
      { category: partial.category }
    );
  }
  return Object.freeze({
    category: partial.category,
    path: requireNonEmptyString(partial.path, "path"),
    expected: partial.expected === undefined ? null : partial.expected,
    actual: partial.actual === undefined ? null : partial.actual,
    message: partial.message == null ? null : String(partial.message),
  });
}

/**
 * Redaction-safe evidence bundle for verification outcomes.
 * @param {object} partial
 * @returns {Readonly<object>}
 */
export function createReplayEvidence(partial = {}) {
  rejectForbiddenFields(
    /** @type {Record<string, unknown>} */ (partial),
    "ReplayEvidence"
  );
  return Object.freeze({
    replayContractVersion: CORE21_REPLAY_CONTRACT_VERSION,
    engineVersion: requireNonEmptyString(
      partial.engineVersion ?? CORE21_ENGINE_VERSION,
      "engineVersion"
    ),
    ok: Boolean(partial.ok),
    seedIdentity: partial.seedIdentity == null ? null : String(partial.seedIdentity),
    normalizedInputFingerprint:
      partial.normalizedInputFingerprint == null
        ? null
        : String(partial.normalizedInputFingerprint),
    expectedOutputFingerprint:
      partial.expectedOutputFingerprint == null
        ? null
        : String(partial.expectedOutputFingerprint),
    actualOutputFingerprint:
      partial.actualOutputFingerprint == null
        ? null
        : String(partial.actualOutputFingerprint),
    versions: deepFreezeCanonical(
      partial.versions ?? {
        seedAlgorithmVersion: CORE21_SEED_ALGORITHM_VERSION,
        prngVersion: CORE21_PRNG_VERSION,
        serializationVersion: CORE21_SERIALIZATION_VERSION,
        fingerprintAlgorithmVersion: CORE21_FINGERPRINT_VERSION,
        comparatorVersion: CORE21_COMPARATOR_VERSION,
        replayContractVersion: CORE21_REPLAY_CONTRACT_VERSION,
      },
      "versions"
    ),
    mismatches: Object.freeze(
      Array.isArray(partial.mismatches)
        ? partial.mismatches.map((m) =>
            createReplayMismatch(
              /** @type {{ category: string, path: string }} */ (m)
            )
          )
        : []
    ),
  });
}

export {
  EXECUTION_MODE,
  REPLAY_MISMATCH_CATEGORY,
  REPLAY_FORBIDDEN_FIELDS,
};
