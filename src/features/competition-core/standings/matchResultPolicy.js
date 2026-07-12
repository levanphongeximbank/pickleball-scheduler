import { MATCH_RESULT_TYPE } from "./standingsConstants.js";

/**
 * @typedef {import('./standingsTypes.js').StandingsMatchRecord} StandingsMatchRecord
 * @typedef {import('./standingsTypes.js').MatchResultTypeValue} MatchResultTypeValue
 */

/**
 * @param {Record<string, unknown>} match
 * @returns {{ record: StandingsMatchRecord|null, excludedReason?: string, warning?: string }}
 */
export function normalizeLegacyGroupMatch(match = {}) {
  const matchId = String(match.id || match.matchId || "");
  const entryAId = String(match.entryAId || match.teamAId || "");
  const entryBId = String(match.entryBId || match.teamBId || "");
  if (!matchId || !entryAId || !entryBId) {
    return { record: null, excludedReason: "missing_entry_reference" };
  }

  const legacyStatus = String(match.status || match.legacyStatus || "").toLowerCase();
  let resultType = /** @type {MatchResultTypeValue} */ (MATCH_RESULT_TYPE.COMPLETED);
  let warning;

  if (legacyStatus === "forfeit") {
    resultType = MATCH_RESULT_TYPE.LEGACY_FORFEIT;
    warning = "Legacy FORFEIT mapped to LEGACY_FORFEIT — review canonical forfeit subtype.";
  } else if (legacyStatus === "bye") {
    resultType = MATCH_RESULT_TYPE.BYE;
  } else if (legacyStatus === "walkover") {
    resultType = MATCH_RESULT_TYPE.WALKOVER;
  } else if (legacyStatus === "cancelled" || legacyStatus === "void") {
    resultType = MATCH_RESULT_TYPE.CANCELLED;
  } else if (legacyStatus === "unverified") {
    resultType = MATCH_RESULT_TYPE.UNVERIFIED;
  } else if (legacyStatus !== "completed" && legacyStatus !== "") {
    return { record: null, excludedReason: `unsupported_status:${legacyStatus}` };
  }

  return {
    record: {
      matchId,
      entryAId,
      entryBId,
      resultType,
      winnerEntryId: match.winnerId != null ? String(match.winnerId) : undefined,
      scoreA: Number(match.scoreA),
      scoreB: Number(match.scoreB),
      verified: match.verified !== false,
      legacyStatus: match.status != null ? String(match.status) : undefined,
      groupId: match.groupId != null ? String(match.groupId) : undefined,
    },
    warning,
  };
}

/**
 * @param {StandingsMatchRecord} match
 * @param {import('./standingsTypes.js').ScoringRule} scoringRule
 */
export function getMatchStandingsPolicy(match, scoringRule) {
  const warnings = [];
  const type = match.resultType;

  if (type === MATCH_RESULT_TYPE.CANCELLED || type === MATCH_RESULT_TYPE.VOID) {
    return {
      includeInStandings: false,
      countsAsPlayed: false,
      headToHeadEligible: false,
      excludedReason: type,
      warnings,
    };
  }

  if (type === MATCH_RESULT_TYPE.BYE) {
    return {
      includeInStandings: true,
      countsAsPlayed: false,
      headToHeadEligible: false,
      awardPoints: scoringRule.byePoints,
      countsBye: true,
      warnings,
    };
  }

  if (type === MATCH_RESULT_TYPE.UNVERIFIED && scoringRule.verifiedResultRequired) {
    return {
      includeInStandings: false,
      countsAsPlayed: false,
      headToHeadEligible: false,
      excludedReason: "unverified_result",
      warnings: ["Unverified result excluded by scoring rule."],
    };
  }

  if (type === MATCH_RESULT_TYPE.LEGACY_FORFEIT) {
    warnings.push("Legacy ambiguous FORFEIT treated as completed forfeit in canonical mode.");
  }

  const forfeitTypes = new Set([
    MATCH_RESULT_TYPE.FORFEIT_BEFORE_START,
    MATCH_RESULT_TYPE.FORFEIT_AFTER_START,
    MATCH_RESULT_TYPE.ADMINISTRATIVE_FORFEIT,
    MATCH_RESULT_TYPE.LEGACY_FORFEIT,
  ]);

  if (forfeitTypes.has(type)) {
    return {
      includeInStandings: true,
      countsAsPlayed: true,
      headToHeadEligible: true,
      isForfeit: true,
      includeScoreDiff: false,
      warnings,
    };
  }

  if (type === MATCH_RESULT_TYPE.WALKOVER) {
    return {
      includeInStandings: true,
      countsAsPlayed: true,
      headToHeadEligible: true,
      isWalkover: true,
      includeScoreDiff: false,
      warnings,
    };
  }

  if (type === MATCH_RESULT_TYPE.COMPLETED || type === MATCH_RESULT_TYPE.UNVERIFIED) {
    if (!Number.isFinite(Number(match.scoreA)) || !Number.isFinite(Number(match.scoreB))) {
      if (scoringRule.completedMatchRequired) {
        warnings.push(`Match ${match.matchId} has score but incomplete numeric values.`);
      }
    }
    return {
      includeInStandings: true,
      countsAsPlayed: true,
      headToHeadEligible: true,
      includeScoreDiff: true,
      warnings,
    };
  }

  return {
    includeInStandings: false,
    countsAsPlayed: false,
    headToHeadEligible: false,
    excludedReason: `unsupported_result_type:${type}`,
    warnings,
  };
}
