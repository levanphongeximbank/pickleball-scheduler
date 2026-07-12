import { evaluateCanonicalFormation } from "./formationRuntimeAdapter.js";
import { compareFormationConstraintParity } from "./formationConstraintParity.js";
import { compareFormationCourtParity } from "./formationCourtParity.js";
import { buildFormationParityComparison } from "./formationParityModel.js";
import {
  verifyFormationPayloadPreservation,
} from "./formationPayloadPreservation.js";
import { compareFormationScoreParity } from "./formationScoreParity.js";
import { resolveLegacyFormationRandomFn } from "./legacyFormationPayloadMappers.js";
import { buildCompleteFormationTraceRecord } from "./formationTraceVerification.js";

/**
 * @typedef {Object} FormationShadowComparisonResult
 * @property {import('./legacyFormationResultMappers.js').LegacyTeamPairingResult} primary
 * @property {import('./formationRuntimeAdapter.js').CanonicalFormationBridgeResult} bridge
 * @property {import('./formationParityModel.js').FormationParityComparison} comparison
 * @property {import('./formationTraceVerification.js').CompleteFormationTraceRecord} traceRecord
 * @property {number} executorInvocationCount
 * @property {number} randomFnCallCount
 * @property {boolean} sideEffectSafe
 */

/**
 * Create a memoized legacy executor that runs at most once per shadow comparison.
 *
 * @param {(payload: import('./legacyFormationPayloadMappers.js').LegacyFormationPayload) => import('./legacyFormationResultMappers.js').LegacyTeamPairingResult} legacyExecutor
 * @param {import('./legacyFormationPayloadMappers.js').LegacyFormationPayload} payload
 */
export function createMemoizedFormationExecutor(legacyExecutor, payload) {
  let cachedResult = null;
  let randomFnCallCount = 0;

  const originalRandomFn = resolveLegacyFormationRandomFn(payload);
  const trackingRandomFn =
    typeof originalRandomFn === "function"
      ? () => {
          randomFnCallCount += 1;
          return originalRandomFn();
        }
      : undefined;

  const payloadWithTracking = trackingRandomFn
    ? {
        ...payload,
        randomFn: trackingRandomFn,
        options: { ...(payload.options || {}), randomFn: trackingRandomFn },
      }
    : payload;

  const memoized = () => {
    if (cachedResult === null) {
      cachedResult = legacyExecutor(payloadWithTracking);
    }
    return cachedResult;
  };

  return {
    run: memoized,
    getInvocationCount: () => (cachedResult === null ? 0 : 1),
    getRandomFnCallCount: () => randomFnCallCount,
    payloadWithTracking,
  };
}

/**
 * CC-05C shadow comparison — single legacy executor invocation, business output = direct legacy.
 *
 * @param {Object} input
 * @param {string} input.strategy
 * @param {import('./legacyFormationPayloadMappers.js').LegacyFormationPayload} input.legacyPayload
 * @param {Record<string, unknown>|undefined|null} [input.envSource]
 * @param {(payload: import('./legacyFormationPayloadMappers.js').LegacyFormationPayload) => import('./legacyFormationResultMappers.js').LegacyTeamPairingResult} input.legacyExecutor
 * @returns {FormationShadowComparisonResult}
 */
export function runFormationShadowComparison(input) {
  const memo = createMemoizedFormationExecutor(input.legacyExecutor, input.legacyPayload);

  const primary = memo.run();

  const bridge = evaluateCanonicalFormation({
    consumer: input.strategy,
    legacyPayload: memo.payloadWithTracking,
    envSource: input.envSource,
    legacyExecutor: () => memo.run(),
  });

  const payloadCheck = verifyFormationPayloadPreservation(input.legacyPayload);
  const constraintParity = compareFormationConstraintParity({
    legacyPayload: input.legacyPayload,
    formationRequest: bridge.formationRequest,
  });
  const scoreParity = compareFormationScoreParity({
    legacyResult: primary,
    formationResult: bridge.formationResult,
  });
  const courtParity = compareFormationCourtParity({
    directLegacy: primary,
    adapterLegacy: bridge.legacyResult,
    legacyPayload: input.legacyPayload,
  });

  const comparison = buildFormationParityComparison({
    strategy: input.strategy,
    directLegacy: primary,
    adapterLegacy: bridge.legacyResult,
    trace: bridge.trace,
    randomFnPreserved: bridge.randomFnPreserved,
    payloadPreserved: payloadCheck.preserved,
    scoreParity: scoreParity.ok || scoreParity.comparable === false,
    constraintParity: constraintParity.ok,
    courtAllocationParity: courtParity.ok,
    courtCount: courtParity.legacyCourts.length,
    mismatches: [
      ...payloadCheck.warnings.filter((w) => !w.startsWith("UNMAPPED_LEGACY_FIELD")),
      ...constraintParity.warnings,
      ...scoreParity.warnings,
      ...courtParity.warnings,
    ],
    unsupportedFields: payloadCheck.unmappedFields,
  });

  const comparisonWithAliases = {
    ...comparison,
    membershipParity: comparison.pairMembershipParity,
    waitingParity: comparison.waitingListParity,
    warningsParity: comparison.warningsParity,
    randomFnPreserved: comparison.randomParity,
  };

  const traceRecord = buildCompleteFormationTraceRecord({
    bridge,
    parity: comparison,
    consumer: input.strategy,
  });

  return {
    primary,
    bridge,
    comparison: comparisonWithAliases,
    traceRecord,
    executorInvocationCount: memo.getInvocationCount(),
    randomFnCallCount: memo.getRandomFnCallCount(),
    sideEffectSafe: memo.getInvocationCount() <= 1,
  };
}

/**
 * @deprecated Use buildFormationParityComparison via runFormationShadowComparison.
 */
export function compareFormationShadowParity(input = {}) {
  const comparison = buildFormationParityComparison({
    strategy: input.strategy,
    directLegacy: input.directLegacy,
    adapterLegacy: input.adapterLegacy,
    trace: input.trace,
    randomFnPreserved: input.randomFnPreserved,
  });
  return {
    ...comparison,
    membershipParity: comparison.pairMembershipParity,
    teamCount: comparison.legacyPairs?.length ?? 0,
  };
}

/**
 * Verify adapter does not inject a new randomFn when none was provided.
 */
export function verifyFormationRandomParity(payload, payloadAfterAdapter) {
  return resolveLegacyFormationRandomFn(payload) === resolveLegacyFormationRandomFn(payloadAfterAdapter);
}
