import {
  createFormationAudit,
  createFormationCourt,
  createFormationPair,
  createFormationResult,
} from "../formationContracts.js";
import { buildFormationScoreBreakdown } from "../formationScoreModel.js";
import { FORMATION_RUNTIME_ADAPTER_VERSION } from "./formationRuntimeInventory.js";

/**
 * @typedef {Object} LegacyTeamPairingResult
 * @property {Array<Record<string, unknown>>} [teams]
 * @property {string[]} [waitingPlayerIds]
 * @property {string[]} [warnings]
 * @property {string[]} [errors]
 */

function teamToFormationPair(team, index = 0) {
  const playerIds = Array.isArray(team.playerIds)
    ? team.playerIds.map((id) => String(id))
    : Array.isArray(team.members)
      ? team.members.map((player) => String(player.id))
      : [];

  return createFormationPair({
    id: team.id != null ? String(team.id) : `team-${index + 1}`,
    playerIds,
    averageSkill: Number.isFinite(Number(team.avgLevel)) ? Number(team.avgLevel) : null,
    metadata: {
      name: team.name,
      seed: team.seed,
      legacyShape: "team-record",
    },
  });
}

/**
 * Legacy team pairing result → FormationResult.
 *
 * @param {LegacyTeamPairingResult} legacyResult
 * @param {import('../formationTypes.js').FormationRequest} [formationRequest]
 * @returns {import('../formationTypes.js').FormationResult}
 */
export function mapLegacyFormationResultToFormationResult(legacyResult = {}, formationRequest) {
  const teams = legacyResult.teams || [];
  const pairs = teams.map((team, index) => teamToFormationPair(team, index));

  const referenceScore = buildFormationScoreBreakdown({
    balanceScore: teams.length ? 1 : 0,
    finalScore: teams.length ? 1 : 0,
  });

  return createFormationResult({
    ok: teams.length > 0 || !(legacyResult.errors?.length),
    pairs,
    courts: [],
    rounds: [],
    explanations: [],
    audit: createFormationAudit({
      engineVersion: FORMATION_RUNTIME_ADAPTER_VERSION,
      strategy: formationRequest?.policy?.strategy || "unknown",
      seed: formationRequest?.randomSeed ?? null,
      constraints: {
        enabled: (formationRequest?.constraints || []).filter((item) => item.enabled !== false)
          .length,
        kinds: (formationRequest?.constraints || []).map((item) => item.kind),
      },
      scores: referenceScore,
      courtAllocation: { teamCount: teams.length },
      warnings: legacyResult.warnings || [],
    }),
    warnings: legacyResult.warnings || [],
    errors: legacyResult.errors || [],
    metadata: {
      mappedFrom: "legacy-team-pairing-result",
      teamCount: teams.length,
      waitingCount: legacyResult.waitingPlayerIds?.length || 0,
    },
  });
}

/**
 * FormationResult → legacy team pairing consumer shape.
 *
 * @param {import('../formationTypes.js').FormationResult} formationResult
 * @param {LegacyTeamPairingResult} [originalLegacyResult]
 * @returns {LegacyTeamPairingResult}
 */
export function adaptFormationResultForLegacyConsumer(formationResult, originalLegacyResult = {}) {
  const teams = (originalLegacyResult.teams || []).map((team) => ({ ...team }));

  return {
    ...originalLegacyResult,
    teams,
    waitingPlayerIds: [...(originalLegacyResult.waitingPlayerIds || [])].map(String),
    warnings: formationResult.warnings?.length
      ? formationResult.warnings
      : originalLegacyResult.warnings || [],
    errors: formationResult.errors?.length
      ? formationResult.errors
      : originalLegacyResult.errors || [],
  };
}

/**
 * @param {LegacyTeamPairingResult} directLegacy
 * @param {LegacyTeamPairingResult} adaptedLegacy
 * @returns {boolean}
 */
export function isLegacyFormationOutputPreserved(directLegacy, adaptedLegacy) {
  const directTeams = JSON.stringify(normalizeTeamsForCompare(directLegacy.teams));
  const adaptedTeams = JSON.stringify(normalizeTeamsForCompare(adaptedLegacy.teams));
  const directWaiting = JSON.stringify(
    [...(directLegacy.waitingPlayerIds || [])].map(String).sort()
  );
  const adaptedWaiting = JSON.stringify(
    [...(adaptedLegacy.waitingPlayerIds || [])].map(String).sort()
  );

  return directTeams === adaptedTeams && directWaiting === adaptedWaiting;
}

function normalizeTeamsForCompare(teams = []) {
  return (teams || []).map((team) => ({
    id: team.id != null ? String(team.id) : null,
    name: team.name ?? null,
    playerIds: [...(team.playerIds || team.members?.map((p) => p.id) || [])]
      .map(String)
      .sort(),
    seed: team.seed ?? null,
  }));
}

/**
 * Extract team membership for shadow parity checks.
 *
 * @param {Array<Record<string, unknown>>} [teams]
 * @returns {Array<{ teamIndex: number, teamId: string|null, name: string|null, playerIds: string[] }>}
 */
export function extractFormationTeamMembership(teams = []) {
  return (teams || []).map((team, teamIndex) => ({
    teamIndex,
    teamId: team.id != null ? String(team.id) : null,
    name: team.name != null ? String(team.name) : null,
    playerIds: [...(team.playerIds || team.members?.map((p) => p.id) || [])]
      .map(String)
      .sort(),
  }));
}

/**
 * Map formation pairs back to legacy team records when templates exist.
 *
 * @param {import('../formationTypes.js').FormationPair[]} pairs
 * @param {Array<Record<string, unknown>>} [legacyTemplates]
 * @returns {Array<Record<string, unknown>>}
 */
export function mapFormationPairsToLegacyTeams(pairs = [], legacyTemplates = []) {
  return pairs.map((pair, index) => {
    const template = legacyTemplates[index] || {};
    return {
      ...template,
      id: pair.id ?? template.id,
      playerIds: [...(pair.playerIds || template.playerIds || [])],
      avgLevel: pair.averageSkill ?? template.avgLevel,
    };
  });
}

/**
 * Build canonical court allocation metadata from legacy teams (foundation metadata only).
 *
 * @param {Array<Record<string, unknown>>} teams
 * @returns {import('../formationTypes.js').FormationCourt[]}
 */
export function mapLegacyTeamsToFormationCourts(teams = []) {
  return teams.map((team, index) =>
    createFormationCourt({
      id: team.id != null ? String(team.id) : `court-${index + 1}`,
      label: team.name != null ? String(team.name) : null,
      index,
      playerIds: [...(team.playerIds || [])].map(String),
    })
  );
}
