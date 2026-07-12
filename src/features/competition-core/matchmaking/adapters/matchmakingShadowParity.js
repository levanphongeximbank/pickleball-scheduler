import { evaluateCanonicalMatchmaking } from "./matchmakingRuntimeAdapter.js";
import { buildMatchmakingParityComparison, verifyMatchmakingPayloadPreservation } from "./matchmakingPayloadPreservation.js";
import { buildCompleteMatchmakingTraceRecord } from "./matchmakingTraceVerification.js";

/**
 * Memoized executor — single legacy invocation per shadow comparison.
 */
export function createMemoizedMatchmakingExecutor(legacyExecutor, payload) {
  let cachedResult = null;
  let randomFnCallCount = 0;
  const originalRandomFn = payload.options?.randomFn || payload.randomFn;
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

  const players = payloadWithTracking.players || [];
  const options = payloadWithTracking.options || {};

  const run = () => {
    if (cachedResult === null) {
      cachedResult = legacyExecutor(players, {
        ...options,
        enabledCourts: payloadWithTracking.courts || options.enabledCourts || [],
        randomFn: trackingRandomFn || options.randomFn,
      });
    }
    return cachedResult;
  };

  return {
    run,
    getInvocationCount: () => (cachedResult === null ? 0 : 1),
    getRandomFnCallCount: () => randomFnCallCount,
    payloadWithTracking,
  };
}

/**
 * CC-06 shadow comparison — business output remains direct legacy.
 *
 * @param {Object} input
 * @param {string} input.strategy
 * @param {import('./legacyMatchmakingPayloadMappers.js').LegacyMatchmakingPayload} input.legacyPayload
 * @param {Record<string, unknown>|undefined|null} [input.envSource]
 * @param {Function} input.legacyExecutor
 */
export function runMatchmakingShadowComparison(input) {
  const memo = createMemoizedMatchmakingExecutor(input.legacyExecutor, input.legacyPayload);
  const primary = memo.run();

  const bridge = evaluateCanonicalMatchmaking({
    consumer: input.strategy,
    legacyPayload: memo.payloadWithTracking,
    envSource: input.envSource,
    legacyExecutor: (players, options) => {
      void players;
      void options;
      return memo.run();
    },
  });

  const payloadCheck = verifyMatchmakingPayloadPreservation(input.legacyPayload);
  const comparison = buildMatchmakingParityComparison({
    directLegacy: primary,
    adapterLegacy: bridge.legacyResult,
    randomFnPreserved: bridge.randomFnPreserved,
    payloadPreserved: payloadCheck.preserved,
    mismatches: payloadCheck.warnings,
  });

  const traceRecord = buildCompleteMatchmakingTraceRecord({
    bridge,
    parity: comparison,
    consumer: input.strategy,
  });

  return {
    primary,
    bridge,
    comparison,
    traceRecord,
    executorInvocationCount: memo.getInvocationCount(),
    randomFnCallCount: memo.getRandomFnCallCount(),
    sideEffectSafe: memo.getInvocationCount() <= 1,
  };
}

export function compareMatchmakingShadowParity(input = {}) {
  return buildMatchmakingParityComparison({
    directLegacy: input.directLegacy,
    adapterLegacy: input.adapterLegacy,
    randomFnPreserved: input.randomFnPreserved,
  });
}
