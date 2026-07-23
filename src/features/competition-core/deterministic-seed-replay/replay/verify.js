/**
 * CORE-21 — replay verification (fingerprint / version mismatch report).
 *
 * Does not execute domain solvers. Consumers supply actual fingerprints and
 * version observations; CORE-21 compares against pinned ReplayInput.
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
  REPLAY_MISMATCH_CATEGORY,
} from "../constants.js";
import {
  createReplayEvidence,
  createReplayMismatch,
} from "../contracts/replay.js";
import { DETERMINISTIC_SEED_REPLAY_ERROR_CODE } from "../errors/errorCodes.js";
import { DeterministicSeedReplayError } from "../errors/DeterministicSeedReplayError.js";
import { serializeCanonical } from "../serialize/canonicalize.js";

/**
 * @param {ReturnType<import("../contracts/replay.js").createReplayInput>} input
 * @param {ReturnType<import("../contracts/replay.js").createReplayContext>} context
 * @param {{
 *   actualOutputFingerprint?: unknown,
 *   actualNormalizedInputFingerprint?: unknown,
 *   actualSeedIdentity?: unknown,
 *   actualAlgorithmVersion?: unknown,
 *   actualRuleSetId?: unknown,
 *   actualRuleSetVersion?: unknown,
 *   actualSerializationVersion?: unknown,
 *   actualFingerprintAlgorithmVersion?: unknown,
 *   actualComparatorVersion?: unknown,
 *   actualPrngVersion?: unknown,
 *   actualEventHistoryReference?: unknown,
 *   actualPrngConsumptionFingerprint?: unknown,
 *   expectedPrngConsumptionFingerprint?: unknown,
 * }} [observed]
 * @returns {Readonly<{
 *   ok: boolean,
 *   mismatches: ReadonlyArray<object>,
 *   evidence: Readonly<object>,
 * }>}
 */
export function verifyReplay(input, context, observed = {}) {
  if (!input || typeof input !== "object" || !context || typeof context !== "object") {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.REPLAY_INPUT_INVALID,
      "verifyReplay requires ReplayInput and ReplayContext",
      {}
    );
  }

  if (
    context.executionMode !== EXECUTION_MODE.REPLAY_VERIFY &&
    context.executionMode !== EXECUTION_MODE.DETERMINISTIC_EXECUTE
  ) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.REPLAY_INPUT_INVALID,
      "Invalid executionMode on ReplayContext",
      { executionMode: context.executionMode }
    );
  }

  /** @type {object[]} */
  const mismatches = [];

  function push(category, path, expected, actual, message) {
    mismatches.push(
      createReplayMismatch({ category, path, expected, actual, message })
    );
  }

  if (
    observed.actualSeedIdentity != null &&
    String(observed.actualSeedIdentity) !== input.seedIdentity
  ) {
    push(
      REPLAY_MISMATCH_CATEGORY.SEED,
      "seedIdentity",
      input.seedIdentity,
      observed.actualSeedIdentity,
      "Seed identity mismatch"
    );
  }

  if (
    observed.actualNormalizedInputFingerprint != null &&
    String(observed.actualNormalizedInputFingerprint) !==
      input.normalizedInputFingerprint
  ) {
    push(
      REPLAY_MISMATCH_CATEGORY.INPUT,
      "normalizedInputFingerprint",
      input.normalizedInputFingerprint,
      observed.actualNormalizedInputFingerprint,
      "Normalized input fingerprint mismatch"
    );
  }

  if (
    observed.actualAlgorithmVersion != null &&
    String(observed.actualAlgorithmVersion) !== input.algorithmVersion
  ) {
    push(
      REPLAY_MISMATCH_CATEGORY.ALGORITHM_VERSION,
      "algorithmVersion",
      input.algorithmVersion,
      observed.actualAlgorithmVersion,
      "Algorithm version mismatch"
    );
  }

  if (
    observed.actualRuleSetId != null &&
    String(observed.actualRuleSetId) !== input.ruleSetId
  ) {
    push(
      REPLAY_MISMATCH_CATEGORY.RULE_SET,
      "ruleSetId",
      input.ruleSetId,
      observed.actualRuleSetId,
      "Rule set id mismatch"
    );
  }

  if (
    observed.actualRuleSetVersion != null &&
    String(observed.actualRuleSetVersion) !== input.ruleSetVersion
  ) {
    push(
      REPLAY_MISMATCH_CATEGORY.RULE_SET,
      "ruleSetVersion",
      input.ruleSetVersion,
      observed.actualRuleSetVersion,
      "Rule set version mismatch"
    );
  }

  if (
    observed.actualSerializationVersion != null &&
    String(observed.actualSerializationVersion) !== input.serializationVersion
  ) {
    push(
      REPLAY_MISMATCH_CATEGORY.SERIALIZATION,
      "serializationVersion",
      input.serializationVersion,
      observed.actualSerializationVersion,
      "Serialization version mismatch"
    );
  }

  if (
    observed.actualFingerprintAlgorithmVersion != null &&
    String(observed.actualFingerprintAlgorithmVersion) !==
      input.fingerprintAlgorithmVersion
  ) {
    push(
      REPLAY_MISMATCH_CATEGORY.SERIALIZATION,
      "fingerprintAlgorithmVersion",
      input.fingerprintAlgorithmVersion,
      observed.actualFingerprintAlgorithmVersion,
      "Fingerprint algorithm version mismatch"
    );
  }

  if (
    observed.actualComparatorVersion != null &&
    String(observed.actualComparatorVersion) !== input.comparatorVersion
  ) {
    push(
      REPLAY_MISMATCH_CATEGORY.ORDERING,
      "comparatorVersion",
      input.comparatorVersion,
      observed.actualComparatorVersion,
      "Comparator version mismatch"
    );
  }

  if (
    observed.actualPrngVersion != null &&
    String(observed.actualPrngVersion) !== input.prngVersion
  ) {
    push(
      REPLAY_MISMATCH_CATEGORY.ALGORITHM_VERSION,
      "prngVersion",
      input.prngVersion,
      observed.actualPrngVersion,
      "PRNG version mismatch"
    );
  }

  if (input.eventHistoryReference != null) {
    if (observed.actualEventHistoryReference == null) {
      push(
        REPLAY_MISMATCH_CATEGORY.EVENT_HISTORY,
        "eventHistoryReference",
        input.eventHistoryReference,
        null,
        "Expected event history reference missing on observation"
      );
    } else {
      const expectedSer = serializeCanonical(input.eventHistoryReference);
      const actualSer = serializeCanonical(observed.actualEventHistoryReference);
      if (expectedSer !== actualSer) {
        push(
          REPLAY_MISMATCH_CATEGORY.EVENT_HISTORY,
          "eventHistoryReference",
          input.eventHistoryReference,
          observed.actualEventHistoryReference,
          "Event history reference mismatch"
        );
      }
    }
  }

  if (
    observed.expectedPrngConsumptionFingerprint != null ||
    observed.actualPrngConsumptionFingerprint != null
  ) {
    if (
      String(observed.expectedPrngConsumptionFingerprint ?? "") !==
      String(observed.actualPrngConsumptionFingerprint ?? "")
    ) {
      push(
        REPLAY_MISMATCH_CATEGORY.PRNG_CONSUMPTION,
        "prngConsumptionFingerprint",
        observed.expectedPrngConsumptionFingerprint ?? null,
        observed.actualPrngConsumptionFingerprint ?? null,
        "PRNG consumption fingerprint mismatch"
      );
    }
  }

  const actualOutput =
    observed.actualOutputFingerprint == null
      ? null
      : String(observed.actualOutputFingerprint);

  if (input.expectedOutputFingerprint != null) {
    if (actualOutput == null) {
      push(
        REPLAY_MISMATCH_CATEGORY.OUTPUT,
        "outputFingerprint",
        input.expectedOutputFingerprint,
        null,
        "Expected output fingerprint missing on observation"
      );
    } else if (actualOutput !== input.expectedOutputFingerprint) {
      push(
        REPLAY_MISMATCH_CATEGORY.OUTPUT,
        "outputFingerprint",
        input.expectedOutputFingerprint,
        actualOutput,
        "Output fingerprint mismatch"
      );
    }
  }

  const ok = mismatches.length === 0;
  const evidence = createReplayEvidence({
    ok,
    engineVersion: context.engineVersion ?? CORE21_ENGINE_VERSION,
    seedIdentity: input.seedIdentity,
    normalizedInputFingerprint: input.normalizedInputFingerprint,
    expectedOutputFingerprint: input.expectedOutputFingerprint,
    actualOutputFingerprint: actualOutput,
    versions: {
      seedAlgorithmVersion: input.seedAlgorithmVersion ?? CORE21_SEED_ALGORITHM_VERSION,
      prngVersion: input.prngVersion ?? CORE21_PRNG_VERSION,
      serializationVersion:
        input.serializationVersion ?? CORE21_SERIALIZATION_VERSION,
      fingerprintAlgorithmVersion:
        input.fingerprintAlgorithmVersion ?? CORE21_FINGERPRINT_VERSION,
      comparatorVersion: input.comparatorVersion ?? CORE21_COMPARATOR_VERSION,
      replayContractVersion: CORE21_REPLAY_CONTRACT_VERSION,
      algorithmVersion: input.algorithmVersion,
      ruleSetId: input.ruleSetId,
      ruleSetVersion: input.ruleSetVersion,
    },
    mismatches,
  });

  // In REPLAY_VERIFY mode, surface version/output mismatch as typed error option
  // is left to caller; verifyReplay itself always returns a structured report.
  if (
    !ok &&
    context.executionMode === EXECUTION_MODE.REPLAY_VERIFY &&
    observed.throwOnMismatch === true
  ) {
    const hasOutput = mismatches.some(
      (m) => m.category === REPLAY_MISMATCH_CATEGORY.OUTPUT
    );
    throw new DeterministicSeedReplayError(
      hasOutput
        ? DETERMINISTIC_SEED_REPLAY_ERROR_CODE.REPLAY_OUTPUT_MISMATCH
        : DETERMINISTIC_SEED_REPLAY_ERROR_CODE.REPLAY_VERSION_MISMATCH,
      "Replay verification failed",
      { mismatchCount: mismatches.length, categories: mismatches.map((m) => m.category) }
    );
  }

  return Object.freeze({
    ok,
    mismatches: Object.freeze([...mismatches]),
    evidence,
  });
}
