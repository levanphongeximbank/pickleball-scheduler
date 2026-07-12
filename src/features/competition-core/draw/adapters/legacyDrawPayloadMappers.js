import { CANONICAL_DRAW_MODE } from "../drawConstants.js";
import { createDrawRequest } from "../drawContracts.js";
import { mapLegacyDrawModeToCanonical } from "../legacyDrawMapping.js";
import {
  createSeedPolicy,
  createStrategyDrawConfiguration,
  createStrategyDrawRequest,
} from "../strategy/strategyContracts.js";
import { selectDrawStrategy } from "../strategy/strategySelection.js";

/**
 * @typedef {Object} LegacyDrawPayload
 * @property {string} [strategyKey]
 * @property {string} [legacyStrategyKey]
 * @property {string} [drawMode]
 * @property {string} [tournamentId]
 * @property {string} [eventId]
 * @property {string} [clubId]
 * @property {number} [groupCount]
 * @property {Array<Record<string, unknown>>} [entries]
 * @property {Array<Record<string, unknown>>} [players]
 * @property {Array<Record<string, unknown>>} [seeds]
 * @property {Array<Record<string, unknown>>} [constraints]
 * @property {unknown} [randomSeed]
 * @property {Record<string, unknown>} [options]
 */

function resolveStrategyKey(payload = {}) {
  return (
    payload.strategyKey ||
    payload.legacyStrategyKey ||
    payload.drawMode ||
    payload.options?.legacyStrategyKey ||
    payload.options?.strategyKey ||
    "unknown"
  );
}

/**
 * Legacy tournament draw payload → CC-04A DrawRequest.
 *
 * @param {LegacyDrawPayload} payload
 * @returns {import('../drawTypes.js').DrawRequest}
 */
export function mapLegacyDrawPayloadToDrawRequest(payload = {}) {
  const strategyKey = resolveStrategyKey(payload);
  const drawMode = mapLegacyDrawModeToCanonical(strategyKey, payload.options?.contextHint);

  return createDrawRequest({
    tournamentId: payload.tournamentId ?? null,
    eventId: payload.eventId ?? null,
    clubId: payload.clubId ?? null,
    drawMode: drawMode === CANONICAL_DRAW_MODE.UNKNOWN ? payload.drawMode : drawMode,
    groupCount: payload.groupCount ?? null,
    entries: payload.entries || [],
    players: payload.players || [],
    seeds: payload.seeds || [],
    constraints: payload.constraints || [],
    options: {
      legacyStrategyKey: strategyKey,
      ...(payload.options || {}),
    },
    metadata: {
      mappedFrom: "legacy-draw-payload",
      strategyKey,
    },
  });
}

/**
 * Legacy draw payload → CC-04C StrategyDrawRequest.
 *
 * @param {LegacyDrawPayload} payload
 * @returns {import('../strategy/strategyTypes.js').StrategyDrawRequest}
 */
export function mapLegacyDrawPayloadToStrategyDrawRequest(payload = {}) {
  const strategyKey = resolveStrategyKey(payload);
  const baseRequest = createStrategyDrawRequest({
    tournamentId: payload.tournamentId ?? null,
    eventId: payload.eventId ?? null,
    clubId: payload.clubId ?? null,
    configuration: createStrategyDrawConfiguration({
      drawMode: strategyKey,
      groupCount: payload.groupCount ?? null,
      randomSeed: payload.randomSeed ?? payload.options?.randomSeed ?? null,
      options: payload.options,
    }),
    entries: payload.entries || [],
    seeds: payload.seeds || [],
    seedPolicy: createSeedPolicy({
      required: (payload.seeds || []).length > 0,
      sourcePreference: payload.options?.seedSource ?? null,
    }),
    options: {
      legacyStrategyKey: strategyKey,
      ...(payload.options || {}),
    },
  });

  const selection = selectDrawStrategy(baseRequest);
  return {
    ...baseRequest,
    selection,
  };
}

/**
 * CompetitionEngineInput payload → DrawRequest.
 *
 * @param {import('../../types/index.js').CompetitionEngineInput} input
 * @returns {import('../drawTypes.js').DrawRequest}
 */
export function mapCompetitionEngineInputToDrawRequest(input = {}) {
  const payload = input.payload && typeof input.payload === "object" ? input.payload : {};
  return mapLegacyDrawPayloadToDrawRequest({
    ...payload,
    tournamentId: input.tournamentId ?? payload.tournamentId,
    clubId: input.clubId ?? payload.clubId,
    eventId: input.eventId ?? payload.eventId,
  });
}

/**
 * @param {LegacyDrawPayload} payload
 * @returns {LegacyDrawPayload}
 */
export function cloneLegacyDrawPayload(payload = {}) {
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
    teamData:
      payload.teamData && typeof payload.teamData === "object"
        ? {
            ...payload.teamData,
            teams: Array.isArray(payload.teamData.teams)
              ? payload.teamData.teams.map((team) => ({ ...team }))
              : [],
            groups: Array.isArray(payload.teamData.groups)
              ? payload.teamData.groups.map((group) => ({ ...group }))
              : [],
            settings: payload.teamData.settings ? { ...payload.teamData.settings } : undefined,
          }
        : undefined,
    entries: Array.isArray(payload.entries) ? payload.entries.map((entry) => ({ ...entry })) : [],
    players: Array.isArray(payload.players) ? payload.players.map((player) => ({ ...player })) : [],
    seeds: Array.isArray(payload.seeds) ? payload.seeds.map((seed) => ({ ...seed })) : [],
    constraints: Array.isArray(payload.constraints)
      ? payload.constraints.map((constraint) => ({ ...constraint }))
      : [],
    options,
  };
}

/**
 * @param {LegacyDrawPayload} left
 * @param {LegacyDrawPayload} right
 * @returns {boolean}
 */
export function isLegacyDrawPayloadPreserved(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
