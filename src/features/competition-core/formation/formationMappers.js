import { COMPETITION_ENGINE_TYPE } from "../constants/engineType.js";
import { createFormationRequest } from "./formationContracts.js";
import { mapLegacyFormationStrategyToCanonical } from "./legacyFormationMapping.js";

/**
 * @typedef {Object} LegacyFormationPayload
 * @property {string} [strategyKey]
 * @property {string} [legacyStrategyKey]
 * @property {string} [sessionId]
 * @property {string} [clubId]
 * @property {string} [eventId]
 * @property {Array<Record<string, unknown>>} [players]
 * @property {Array<Record<string, unknown>>} [constraints]
 * @property {unknown} [randomSeed]
 * @property {Record<string, unknown>} [options]
 */

/**
 * Legacy formation payload → FormationRequest (reference mapper, no runtime).
 *
 * @param {LegacyFormationPayload} payload
 * @returns {import('./formationTypes.js').FormationRequest}
 */
export function mapLegacyFormationPayloadToFormationRequest(payload = {}) {
  const strategyKey =
    payload.strategyKey || payload.legacyStrategyKey || payload.options?.strategyKey || "unknown";

  return createFormationRequest({
    sessionId: payload.sessionId ?? null,
    clubId: payload.clubId ?? null,
    eventId: payload.eventId ?? null,
    policy: {
      strategy: mapLegacyFormationStrategyToCanonical(strategyKey),
      allowRandomization: payload.options?.allowRandomization === true,
      maxSkillGap: payload.options?.maxSkillGap ?? null,
      targetCourtCount: payload.options?.targetCourtCount ?? null,
      params: payload.options?.policyParams,
    },
    players: payload.players || [],
    constraints: (payload.constraints || []).map((item, index) => ({
      id: item.id != null ? String(item.id) : `legacy-constraint-${index + 1}`,
      kind: item.kind || item.type,
      severity: item.severity || item.mode || "soft",
      enabled: item.enabled !== false,
      params: item.params || item,
      message: item.message,
    })),
    randomSeed: payload.randomSeed ?? payload.options?.randomSeed ?? null,
    options: {
      legacyStrategyKey: strategyKey,
      ...(payload.options || {}),
    },
  });
}

/**
 * CompetitionEngineInput → FormationRequest.
 *
 * @param {import('../types/index.js').CompetitionEngineInput} input
 * @returns {import('./formationTypes.js').FormationRequest}
 */
export function mapCompetitionEngineInputToFormationRequest(input = {}) {
  const payload = input.payload && typeof input.payload === "object" ? input.payload : {};
  return mapLegacyFormationPayloadToFormationRequest({
    ...payload,
    sessionId: input.sessionId ?? payload.sessionId,
    clubId: input.clubId ?? payload.clubId,
    eventId: input.eventId ?? payload.eventId,
  });
}

/**
 * @param {LegacyFormationPayload} payload
 * @returns {LegacyFormationPayload}
 */
export function cloneLegacyFormationPayload(payload = {}) {
  return {
    ...payload,
    players: Array.isArray(payload.players) ? payload.players.map((p) => ({ ...p })) : [],
    constraints: Array.isArray(payload.constraints)
      ? payload.constraints.map((c) => ({ ...c }))
      : [],
    options: payload.options ? { ...payload.options } : undefined,
  };
}

/**
 * @param {import('../types/engineType.js').CompetitionEngineTypeValue} engineType
 * @returns {boolean}
 */
export function isTeamFormationEngineType(engineType) {
  return engineType === COMPETITION_ENGINE_TYPE.TEAM_FORMATION;
}
