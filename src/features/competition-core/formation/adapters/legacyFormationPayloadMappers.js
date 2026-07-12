import { createFormationPolicy } from "../formationContracts.js";
import {
  mapLegacyFormationPayloadToFormationRequest,
} from "../formationMappers.js";
import {
  getFormationStrategyFromCatalog,
  mapLegacyFormationStrategyToCanonical,
} from "../legacyFormationMapping.js";

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
 * @property {() => number} [randomFn]
 * @property {Record<string, unknown>} [options]
 */

function resolveStrategyKey(payload = {}) {
  return (
    payload.strategyKey ||
    payload.legacyStrategyKey ||
    payload.options?.legacyStrategyKey ||
    payload.options?.strategyKey ||
    "unknown"
  );
}

/**
 * Legacy formation payload → FormationRequest with resolved policy.
 *
 * @param {LegacyFormationPayload} payload
 * @returns {import('../formationTypes.js').FormationRequest}
 */
export function mapLegacyFormationPayloadToCanonicalRequest(payload = {}) {
  return mapLegacyFormationPayloadToFormationRequest(payload);
}

/**
 * Legacy payload → FormationPolicy (explicit policy resolution).
 *
 * @param {LegacyFormationPayload} payload
 * @returns {import('../formationTypes.js').FormationPolicy}
 */
export function mapLegacyFormationPayloadToPolicy(payload = {}) {
  const strategyKey = resolveStrategyKey(payload);
  const strategyId = mapLegacyFormationStrategyToCanonical(strategyKey);
  const catalog = getFormationStrategyFromCatalog(strategyId);

  return createFormationPolicy({
    strategy: strategyId,
    allowRandomization: catalog?.supportsRandomization === true,
    maxSkillGap: payload.options?.maxSkillGap ?? null,
    targetCourtCount: payload.options?.targetCourtCount ?? null,
    params: {
      legacyStrategyKey: strategyKey,
      ...(payload.options?.policyParams || {}),
    },
  });
}

/**
 * @param {LegacyFormationPayload} payload
 * @returns {LegacyFormationPayload}
 */
export function cloneLegacyFormationPayload(payload = {}) {
  const options =
    payload.options && typeof payload.options === "object"
      ? {
          ...payload.options,
          playersById:
            payload.options.playersById instanceof Map
              ? payload.options.playersById
              : payload.options.playersById,
          randomFn:
            typeof payload.options.randomFn === "function"
              ? payload.options.randomFn
              : payload.options.randomFn,
        }
      : undefined;

  return {
    ...payload,
    players: Array.isArray(payload.players) ? payload.players.map((player) => ({ ...player })) : [],
    constraints: Array.isArray(payload.constraints)
      ? payload.constraints.map((constraint) => ({ ...constraint }))
      : [],
    randomFn: typeof payload.randomFn === "function" ? payload.randomFn : payload.randomFn,
    options,
  };
}

/**
 * Resolve randomFn from payload without generating a new one.
 *
 * @param {LegacyFormationPayload} payload
 * @returns {(() => number)|undefined}
 */
export function resolveLegacyFormationRandomFn(payload = {}) {
  if (typeof payload.randomFn === "function") {
    return payload.randomFn;
  }
  if (typeof payload.options?.randomFn === "function") {
    return payload.options.randomFn;
  }
  return undefined;
}

/**
 * @param {LegacyFormationPayload} left
 * @param {LegacyFormationPayload} right
 * @returns {boolean}
 */
export function isLegacyFormationPayloadPreserved(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
