import { pairTeamsFromSelectedPlayers } from "../../../team-tournament/engines/teamAutoDrawEngine.js";
import { evaluateCanonicalFormation } from "./formationRuntimeAdapter.js";

/**
 * @typedef {Object} TeamFormationAdapterInput
 * @property {Array<Record<string, unknown>>} [players]
 * @property {string[]} [selectedPlayerIds]
 * @property {number} [teamCount]
 * @property {string[]} [teamNames]
 * @property {string} [formatPreset]
 * @property {() => number} [randomFn]
 * @property {Record<string, unknown>|undefined|null} [envSource]
 */

/**
 * Build canonical legacy payload for MLP team pairing wizard.
 *
 * @param {TeamFormationAdapterInput} input
 */
export function buildTeamFormationLegacyPayload(input = {}) {
  return {
    strategyKey: "mlp_team_pairing",
    legacyStrategyKey: "mlp_team_pairing",
    players: input.players || [],
    options: {
      selectedPlayerIds: input.selectedPlayerIds || [],
      teamCount: input.teamCount,
      teamNames: input.teamNames,
      formatPreset: input.formatPreset,
      randomFn: input.randomFn,
      privatePairingRules: input.privatePairingRules || [],
      competitionClass: input.competitionClass,
      clubId: input.clubId,
      tournamentId: input.tournamentId,
      eventId: input.eventId,
      envSource: input.envSource,
      seed: input.seed,
      maxCandidates: input.maxCandidates,
      pairingHistory: input.pairingHistory,
      allowedByPublishedRules: input.allowedByPublishedRules,
      contextTime: input.contextTime,
      requireFullFill: input.requireFullFill === true,
    },
    randomFn: input.randomFn,
  };
}

/**
 * CC-05B team formation runtime adapter.
 * Flag OFF → direct pairTeamsFromSelectedPlayers.
 * Flag ON → canonical adapter wraps same legacy executor.
 *
 * @param {TeamFormationAdapterInput} input
 * @returns {{ teams: Array<Record<string, unknown>>, waitingPlayerIds: string[], warnings: string[], bridge?: import('./formationRuntimeAdapter.js').CanonicalFormationBridgeResult }}
 */
export function runTeamFormationWithCanonicalAdapter(input = {}) {
  const bridge = evaluateCanonicalFormation({
    consumer: "team_mlp_pairing",
    legacyPayload: buildTeamFormationLegacyPayload(input),
    envSource: input.envSource,
    legacyExecutor: (payload) =>
      pairTeamsFromSelectedPlayers({
        players: payload.players || [],
        selectedPlayerIds: payload.options?.selectedPlayerIds || [],
        teamCount: payload.options?.teamCount,
        teamNames: payload.options?.teamNames,
        formatPreset: payload.options?.formatPreset,
        randomFn: payload.randomFn || payload.options?.randomFn,
        privatePairingRules: payload.options?.privatePairingRules || [],
        competitionClass: payload.options?.competitionClass,
        clubId: payload.options?.clubId,
        tournamentId: payload.options?.tournamentId,
        eventId: payload.options?.eventId,
        envSource: payload.options?.envSource ?? input.envSource,
        seed: payload.options?.seed,
        maxCandidates: payload.options?.maxCandidates,
        pairingHistory: payload.options?.pairingHistory,
        allowedByPublishedRules: payload.options?.allowedByPublishedRules,
        contextTime: payload.options?.contextTime,
        requireFullFill: payload.options?.requireFullFill === true,
      }),
  });

  return {
    ...bridge.legacyResult,
    bridge,
  };
}

/**
 * Direct legacy team formation without adapter (shadow comparison primary path).
 *
 * @param {TeamFormationAdapterInput} input
 */
export function runDirectTeamFormation(input = {}) {
  return pairTeamsFromSelectedPlayers({
    players: input.players || [],
    selectedPlayerIds: input.selectedPlayerIds || [],
    teamCount: input.teamCount,
    teamNames: input.teamNames,
    formatPreset: input.formatPreset,
    randomFn: input.randomFn,
    privatePairingRules: input.privatePairingRules || [],
    competitionClass: input.competitionClass,
    clubId: input.clubId,
    tournamentId: input.tournamentId,
    eventId: input.eventId,
    envSource: input.envSource,
    seed: input.seed,
    maxCandidates: input.maxCandidates,
    pairingHistory: input.pairingHistory,
    allowedByPublishedRules: input.allowedByPublishedRules,
    contextTime: input.contextTime,
    requireFullFill: input.requireFullFill === true,
  });
}
