import { assignSeededTeamsToGroups } from "../../../team-tournament/engines/teamAutoDrawEngine.js";
import { evaluateCanonicalDraw } from "./drawRuntimeAdapter.js";

/**
 * @typedef {Object} TeamDrawAdapterInput
 * @property {Record<string, unknown>} teamData
 * @property {Array<Record<string, unknown>>} [players]
 * @property {string} [seedingMode]
 * @property {number} [groupCount]
 * @property {() => number} [randomFn]
 * @property {Record<string, unknown>|undefined|null} [envSource]
 */

/**
 * Wrap team draw engine output for canonical adapter envelope.
 *
 * @param {{ teamData?: Record<string, unknown>, balance?: Record<string, unknown>|null, warnings?: string[] }} result
 */
export function wrapTeamDrawLegacyResult(result = {}) {
  return {
    ok: Boolean(result.teamData?.groups?.length),
    groups: result.teamData?.groups || [],
    teamData: result.teamData,
    balance: result.balance ?? null,
    warnings: result.warnings || [],
  };
}

/**
 * Restore team draw consumer shape from adapter legacy envelope.
 *
 * @param {import('./legacyDrawResultMappers.js').LegacyGroupDrawResult} legacyResult
 */
export function unwrapTeamDrawLegacyResult(legacyResult = {}) {
  return {
    teamData: legacyResult.teamData,
    balance: legacyResult.balance ?? null,
    warnings: legacyResult.warnings || [],
  };
}

/**
 * Build canonical legacy payload for team group draw.
 *
 * @param {TeamDrawAdapterInput} input
 */
export function buildTeamDrawLegacyPayload(input = {}) {
  return {
    strategyKey: "mlp_auto_draw",
    legacyStrategyKey: "mlp_auto_draw",
    teamData: input.teamData,
    players: input.players || [],
    options: {
      groupCount: input.groupCount,
      players: input.players || [],
      seedingMode: input.seedingMode,
      randomFn: input.randomFn,
    },
  };
}

/**
 * CC-04E team draw runtime adapter.
 * Flag OFF → direct assignSeededTeamsToGroups.
 * Flag ON → canonical adapter wraps same legacy executor.
 *
 * @param {TeamDrawAdapterInput} input
 * @returns {{ teamData: Record<string, unknown>|undefined, balance: Record<string, unknown>|null, warnings: string[], bridge?: import('./drawRuntimeAdapter.js').CanonicalDrawBridgeResult }}
 */
export function runTeamDrawWithCanonicalAdapter(input = {}) {
  const bridge = evaluateCanonicalDraw({
    consumer: "team_group",
    legacyPayload: buildTeamDrawLegacyPayload(input),
    envSource: input.envSource,
    legacyExecutor: (payload) =>
      wrapTeamDrawLegacyResult(
        assignSeededTeamsToGroups(payload.teamData, {
          groupCount: payload.options?.groupCount,
          players: payload.options?.players || payload.players || [],
          seedingMode: payload.options?.seedingMode,
          randomFn: payload.options?.randomFn,
        })
      ),
  });

  const result = unwrapTeamDrawLegacyResult(bridge.legacyResult);
  return {
    ...result,
    bridge,
  };
}

/**
 * Direct legacy team draw without adapter (for shadow comparison primary path).
 *
 * @param {TeamDrawAdapterInput} input
 */
export function runDirectTeamDraw(input = {}) {
  return assignSeededTeamsToGroups(input.teamData, {
    groupCount: input.groupCount,
    players: input.players || [],
    seedingMode: input.seedingMode,
    randomFn: input.randomFn,
  });
}
