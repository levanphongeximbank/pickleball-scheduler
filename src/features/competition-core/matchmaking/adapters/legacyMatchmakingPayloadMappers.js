import { createMatchmakingPolicy } from "../matchmakingContracts.js";
import { mapLegacyMatchmakingPayloadToMatchmakingRequest } from "../matchmakingMappers.js";
import { mapLegacyMatchmakingStrategyToCanonical } from "../legacyMatchmakingMapping.js";

/**
 * @typedef {Object} LegacyMatchmakingPayload
 * @property {string} [strategyKey]
 * @property {Array<Record<string, unknown>>} [players]
 * @property {Array<Record<string, unknown>>} [courts]
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

export function mapLegacyMatchmakingPayloadToCanonicalRequest(payload = {}) {
  return mapLegacyMatchmakingPayloadToMatchmakingRequest(payload);
}

export function mapLegacyMatchmakingPayloadToPolicy(payload = {}) {
  const strategyKey = resolveStrategyKey(payload);
  const strategyId = mapLegacyMatchmakingStrategyToCanonical(strategyKey);
  const options = payload.options || {};

  return createMatchmakingPolicy({
    strategy: strategyId,
    competitionType: options.competitionType ?? null,
    persist: options.persist === true,
    courtCount: options.courtCount ?? (payload.courts || options.enabledCourts || []).length,
    params: { legacyStrategyKey: strategyKey },
  });
}

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

export function resolveLegacyMatchmakingRandomFn(payload = {}) {
  if (typeof payload.randomFn === "function") {
    return payload.randomFn;
  }
  if (typeof payload.options?.randomFn === "function") {
    return payload.options.randomFn;
  }
  return undefined;
}

export function buildLegacyRunAIOptions(payload = {}) {
  const options = payload.options || {};
  return {
    enabledCourts: payload.courts || options.enabledCourts || [],
    competitionType: options.competitionType,
    persist: options.persist === true,
    lockedCourts: options.lockedCourts || [],
    lockedPlayers: options.lockedPlayers || [],
    currentResult: options.currentResult,
    topCandidates: options.topCandidates,
    templateId: options.templateId,
    schedulingMode: options.schedulingMode,
    founderCourtPolicies: options.founderCourtPolicies,
    randomFn: resolveLegacyMatchmakingRandomFn(payload),
    ...options,
  };
}
