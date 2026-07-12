import { COMPETITION_ENGINE_TYPE } from "../constants/engineType.js";
import { createMatchmakingRequest } from "./matchmakingContracts.js";
import { mapLegacyMatchmakingStrategyToCanonical } from "./legacyMatchmakingMapping.js";

/**
 * @typedef {Object} LegacyMatchmakingPayload
 * @property {string} [strategyKey]
 * @property {string} [legacyStrategyKey]
 * @property {string} [sessionId]
 * @property {string} [clubId]
 * @property {string} [tournamentId]
 * @property {Array<Record<string, unknown>>} [players]
 * @property {Array<Record<string, unknown>>} [courts]
 * @property {unknown} [randomSeed]
 * @property {() => number} [randomFn]
 * @property {Record<string, unknown>} [options]
 */

function resolveStrategyKey(payload = {}) {
  return (
    payload.strategyKey ||
    payload.legacyStrategyKey ||
    payload.options?.legacyStrategyKey ||
    payload.options?.strategyKey ||
    (payload.options?.lockedCourts?.length ? "director_lock" : "ai_balance")
  );
}

/**
 * @param {LegacyMatchmakingPayload} payload
 */
export function mapLegacyMatchmakingPayloadToMatchmakingRequest(payload = {}) {
  const strategyKey = resolveStrategyKey(payload);
  const options = payload.options || {};

  return createMatchmakingRequest({
    sessionId: payload.sessionId ?? options.sessionId ?? null,
    clubId: payload.clubId ?? options.clubId ?? null,
    tournamentId: payload.tournamentId ?? options.tournamentId ?? null,
    policy: {
      strategy: mapLegacyMatchmakingStrategyToCanonical(strategyKey),
      competitionType: options.competitionType ?? null,
      persist: options.persist === true,
      courtCount: options.courtCount ?? (payload.courts || options.enabledCourts || []).length,
    },
    players: payload.players || [],
    courts: payload.courts || options.enabledCourts || [],
    lockedCourtIds: (options.lockedCourts || []).map(String),
    lockedPlayerIds: (options.lockedPlayers || []).map(String),
    randomSeed: payload.randomSeed ?? options.randomSeed ?? null,
    options: {
      legacyStrategyKey: strategyKey,
      ...options,
    },
  });
}

/**
 * @param {LegacyMatchmakingPayload} payload
 */
export function cloneLegacyMatchmakingPayload(payload = {}) {
  const options =
    payload.options && typeof payload.options === "object"
      ? {
          ...payload.options,
          randomFn:
            typeof payload.options.randomFn === "function"
              ? payload.options.randomFn
              : payload.options.randomFn,
        }
      : undefined;

  return {
    ...payload,
    players: Array.isArray(payload.players) ? payload.players.map((p) => ({ ...p })) : [],
    courts: Array.isArray(payload.courts) ? payload.courts.map((c) => ({ ...c })) : [],
    randomFn: typeof payload.randomFn === "function" ? payload.randomFn : payload.randomFn,
    options,
  };
}

export function isMatchmakingEngineType(engineType) {
  return engineType === COMPETITION_ENGINE_TYPE.MATCHMAKING;
}
