import {
  DEFAULT_SCORING_RULE,
  LEGACY_GROUP_TIEBREAK_ORDER,
  LEGACY_TEAM_TIEBREAK_ORDER,
  STANDINGS_SCOPE,
  TIEBREAK_TYPE,
} from "./standingsConstants.js";
import {
  createDefaultTieBreakRuleSet,
  createScoringRule,
  createStandingsConfiguration,
  createStandingsEntry,
  createStandingsMatchRecord,
  createStandingsRequest,
} from "./standingsContracts.js";
import { normalizeLegacyGroupMatch } from "./matchResultPolicy.js";

/**
 * @typedef {Object} LegacyGroupStandingsPayload
 * @property {string} [tournamentId]
 * @property {string} [eventId]
 * @property {Object} [group]
 * @property {Array<Record<string, unknown>>} [entries]
 * @property {Array<Record<string, unknown>>} [matches]
 * @property {Record<string, number>} [pointsConfig]
 * @property {number} [qualifiersCount]
 * @property {boolean} [groupComplete]
 * @property {Array<Record<string, unknown>>} [manualOverrides]
 */

/**
 * @typedef {Object} LegacyTeamStandingsPayload
 * @property {string} [tournamentId]
 * @property {Array<Record<string, unknown>>} [teams]
 * @property {Array<Record<string, unknown>>} [matchups]
 * @property {Object} [settings]
 * @property {Array<Record<string, unknown>>} [manualOverrides]
 */

/**
 * @param {LegacyGroupStandingsPayload} payload
 */
export function mapLegacyGroupStandingsPayloadToRequest(payload = {}) {
  const warnings = [];
  const matches = [];
  const excluded = [];

  (payload.matches || []).forEach((match) => {
    const normalized = normalizeLegacyGroupMatch(match);
    if (normalized.warning) {
      warnings.push(normalized.warning);
    }
    if (normalized.record) {
      matches.push(createStandingsMatchRecord(normalized.record));
    } else if (normalized.excludedReason) {
      excluded.push({ matchId: String(match.id || ""), reason: normalized.excludedReason });
    }
  });

  const pointsConfig = payload.pointsConfig || {};
  const tieBreakRules = createDefaultTieBreakRuleSet(
    LEGACY_GROUP_TIEBREAK_ORDER.map((type, index) => ({
      id: `legacy-group-${type}`,
      type,
      priority: index + 1,
      legacyKey:
        type === TIEBREAK_TYPE.CUSTOM
          ? index === 3
            ? "won"
            : undefined
          : undefined,
    }))
  );

  return {
    request: createStandingsRequest({
      tournamentId: payload.tournamentId,
      eventId: payload.eventId,
      groupId: payload.group?.id,
      scope: STANDINGS_SCOPE.INDIVIDUAL_GROUP,
      entries: (payload.entries || payload.group?.entryIds?.map((id) => ({ entryId: id })) || []).map(
        (entry) =>
          createStandingsEntry({
            entryId: entry.id || entry.entryId,
            name: entry.name,
            seed: entry.seed,
          })
      ),
      matches,
      configuration: createStandingsConfiguration({
        scoringRule: createScoringRule({
          scoringRuleId: DEFAULT_SCORING_RULE.scoringRuleId,
          scoringRuleVersion: DEFAULT_SCORING_RULE.scoringRuleVersion,
          winPoints: pointsConfig.win ?? 2,
          lossPoints: pointsConfig.loss ?? 1,
          drawPoints: pointsConfig.draw ?? pointsConfig.loss ?? 1,
          forfeitPoints: pointsConfig.forfeit ?? 0,
        }),
        tieBreakRules,
        qualificationRule: payload.qualifiersCount
          ? { qualifiersCount: Number(payload.qualifiersCount) }
          : undefined,
        drawLotSeed: payload.drawLotSeed || payload.group?.id || payload.tournamentId || "group-default",
      }),
      manualOverrides: payload.manualOverrides,
      metadata: { legacyConsumer: "rankingEngine" },
    }),
    warnings,
    excluded,
  };
}

/**
 * @param {LegacyTeamStandingsPayload} payload
 */
export function mapLegacyTeamStandingsPayloadToRequest(payload = {}) {
  const tiebreakOrder = payload.settings?.tiebreakOrder || ["wins", "subMatchDiff", "pointsScored", "manual"];
  const tieBreakRules = tiebreakOrder.map((key, index) => {
    if (key === "headToHead") {
      return { id: `team-${key}`, type: TIEBREAK_TYPE.HEAD_TO_HEAD, priority: index + 1, legacyKey: key };
    }
    if (key === "wins") {
      return { id: `team-${key}`, type: TIEBREAK_TYPE.CUSTOM, priority: index + 1, legacyKey: "wins" };
    }
    if (key === "subMatchDiff") {
      return { id: `team-${key}`, type: TIEBREAK_TYPE.CUSTOM, priority: index + 1, legacyKey: "subMatchDiff" };
    }
    if (key === "pointsScored") {
      return { id: `team-${key}`, type: TIEBREAK_TYPE.SCORE_FOR, priority: index + 1, legacyKey: key };
    }
    return { id: `team-${key}`, type: TIEBREAK_TYPE.CUSTOM, priority: index + 1, legacyKey: "manual" };
  });

  const matches = (payload.matchups || [])
    .filter((matchup) => matchup?.result?.winnerTeamId)
    .map((matchup) =>
      createStandingsMatchRecord({
        matchId: String(matchup.id),
        entryAId: String(matchup.teamAId),
        entryBId: String(matchup.teamBId),
        resultType: "COMPLETED",
        winnerEntryId: String(matchup.result.winnerTeamId),
        scoreA: Number(matchup.result.teamAPoints ?? 0),
        scoreB: Number(matchup.result.teamBPoints ?? 0),
        gamesA: Number(matchup.result.teamAWins ?? 0),
        gamesB: Number(matchup.result.teamBWins ?? 0),
      })
    );

  return createStandingsRequest({
    tournamentId: payload.tournamentId,
    scope: STANDINGS_SCOPE.TEAM_TOURNAMENT,
    entries: (payload.teams || []).map((team) =>
      createStandingsEntry({
        entryId: team.id,
        teamId: team.id,
        name: team.name,
        seed: team.seed,
      })
    ),
    matches,
    configuration: createStandingsConfiguration({
      scoringRule: createScoringRule({
        scoringRuleId: "legacy-team-default",
        winPoints: 2,
        lossPoints: 1,
        forfeitPoints: 0,
      }),
      tieBreakRules: tieBreakRules.length ? tieBreakRules : createDefaultTieBreakRuleSet(LEGACY_TEAM_TIEBREAK_ORDER),
      drawLotSeed: payload.tournamentId || "team-default",
    }),
    manualOverrides: payload.manualOverrides,
    metadata: { legacyConsumer: "teamStandingsEngine" },
  });
}

/**
 * @param {import('../standingsTypes.js').StandingsResult} canonical
 */
export function mapStandingsResultToLegacyGroupRows(canonical) {
  return (canonical.rows || []).map((row) => ({
    id: row.entryId,
    name: row.name,
    played: row.played,
    won: row.wins,
    lost: row.losses,
    draw: row.draws,
    pointsFor: row.scoreFor,
    pointsAgainst: row.scoreAgainst,
    scoreDiff: row.scoreDifference,
    matchPoints: row.points,
    rank: row.rank,
    qualificationStatus: row.qualificationStatus,
  }));
}

/**
 * @param {import('../standingsTypes.js').StandingsResult} canonical
 */
export function mapStandingsResultToLegacyTeamRows(canonical) {
  return (canonical.rows || []).map((row) => ({
    teamId: row.teamId || row.entryId,
    rank: row.rank,
    played: row.played,
    wins: row.wins,
    losses: row.losses,
    subMatchWins: row.gamesFor,
    subMatchLosses: row.gamesAgainst,
    subMatchDiff: row.gameDifference,
    pointsScored: row.scoreFor,
    pointsConceded: row.scoreAgainst,
    rankingPoints: row.points,
    manualOverrideApplied: row.manualOverrideApplied,
  }));
}

/**
 * @param {LegacyGroupStandingsPayload|LegacyTeamStandingsPayload} payload
 */
export function cloneLegacyStandingsPayload(payload = {}) {
  return JSON.parse(JSON.stringify(payload));
}
