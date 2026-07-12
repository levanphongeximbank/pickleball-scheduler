import { evaluateCanonicalMatchmaking } from "./matchmakingRuntimeAdapter.js";
import { buildLegacyRunAIOptions } from "./legacyMatchmakingPayloadMappers.js";

/**
 * Build legacy payload for runAI / Daily matchmaking consumers.
 *
 * @param {Object} input
 * @param {Array<Record<string, unknown>>} [input.players]
 * @param {Array<Record<string, unknown>>} [input.courts]
 * @param {Record<string, unknown>} [input.options]
 * @param {Record<string, unknown>|undefined|null} [input.envSource]
 */
export function buildDailyMatchmakingLegacyPayload(input = {}) {
  return {
    strategyKey: input.strategyKey || input.options?.strategyKey || "ai_balance",
    legacyStrategyKey: input.legacyStrategyKey || "ai_balance",
    players: input.players || [],
    courts: input.courts || input.options?.enabledCourts || [],
    sessionId: input.sessionId,
    clubId: input.clubId,
    tournamentId: input.tournamentId,
    options: input.options || {},
    randomFn: input.randomFn || input.options?.randomFn,
  };
}

/**
 * CC-06 daily matchmaking adapter wrapper.
 * Flag OFF → direct legacyExecutor. Flag ON → canonical adapter → same executor.
 *
 * @param {Object} input
 * @param {Array<Record<string, unknown>>} input.players
 * @param {Record<string, unknown>} input.options
 * @param {Function} input.legacyExecutor - typically runAI
 * @param {Record<string, unknown>|undefined|null} [input.envSource]
 */
export function runDailyMatchmakingWithCanonicalAdapter(input = {}) {
  const payload = buildDailyMatchmakingLegacyPayload(input);
  const bridge = evaluateCanonicalMatchmaking({
    consumer: "daily_matchmaking",
    legacyPayload: payload,
    envSource: input.envSource,
    legacyExecutor: (players, options) => input.legacyExecutor(players, options),
  });

  return {
    ...bridge.legacyResult,
    bridge,
  };
}

/**
 * Direct legacy path for shadow comparison primary output.
 */
export function runDirectDailyMatchmaking(input = {}) {
  const payload = buildDailyMatchmakingLegacyPayload(input);
  return input.legacyExecutor(payload.players || [], buildLegacyRunAIOptions(payload));
}
