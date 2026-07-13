import { MATCH_RESULT_TYPE } from "./standingsConstants.js";
import { createStandingsRow } from "./standingsContracts.js";
import { getMatchStandingsPolicy } from "./matchResultPolicy.js";

/**
 * @param {import('./standingsTypes.js').StandingsEntry[]} entries
 */
export function buildInitialStandingsRows(entries = []) {
  return entries.map((entry) =>
    createStandingsRow({
      entryId: entry.entryId,
      teamId: entry.teamId,
      playerId: entry.playerId,
      name: entry.name,
      seed: entry.seed,
      rank: 0,
    })
  );
}

/**
 * @param {Map<string, import('./standingsTypes.js').StandingsRow>} rowMap
 * @param {import('./standingsTypes.js').StandingsMatchRecord} match
 * @param {import('./standingsTypes.js').ScoringRule} scoringRule
 * @param {string[]} warnings
 */
function applyMatchToRows(rowMap, match, scoringRule, warnings) {
  const policy = getMatchStandingsPolicy(match, scoringRule);
  warnings.push(...(policy.warnings || []));
  if (!policy.includeInStandings) {
    return { applied: false, excludedReason: policy.excludedReason };
  }

  const rowA = rowMap.get(String(match.entryAId));
  const rowB = rowMap.get(String(match.entryBId));
  if (!rowA || !rowB) {
    warnings.push(`Missing entry for match ${match.matchId}`);
    return { applied: false, excludedReason: "missing_entry" };
  }

  if (policy.countsBye) {
    rowA.byes += 1;
    rowB.byes += 1;
    if (policy.awardPoints) {
      rowA.points += Number(policy.awardPoints);
      rowB.points += Number(policy.awardPoints);
    }
    return { applied: true };
  }

  if (policy.countsAsPlayed) {
    rowA.played += 1;
    rowB.played += 1;
  }

  const winnerId = match.winnerEntryId ? String(match.winnerEntryId) : "";
  const scoreA = Number(match.scoreA ?? 0);
  const scoreB = Number(match.scoreB ?? 0);
  const gamesA = Number(match.gamesA ?? match.scoreA ?? 0);
  const gamesB = Number(match.gamesB ?? match.scoreB ?? 0);
  const setsA = Number(match.setsA ?? 0);
  const setsB = Number(match.setsB ?? 0);

  if (policy.includeScoreDiff) {
    rowA.scoreFor += scoreA;
    rowA.scoreAgainst += scoreB;
    rowB.scoreFor += scoreB;
    rowB.scoreAgainst += scoreA;
    rowA.gamesFor += gamesA;
    rowA.gamesAgainst += gamesB;
    rowB.gamesFor += gamesB;
    rowB.gamesAgainst += gamesA;
    rowA.setsFor += setsA;
    rowA.setsAgainst += setsB;
    rowB.setsFor += setsB;
    rowB.setsAgainst += setsA;
  }

  if (policy.isForfeit) {
    if (winnerId === rowA.entryId) {
      rowA.wins += 1;
      rowB.losses += 1;
      rowB.forfeits += 1;
      rowA.points += scoringRule.winPoints;
      rowB.points += scoringRule.forfeitPoints;
    } else if (winnerId === rowB.entryId) {
      rowB.wins += 1;
      rowA.losses += 1;
      rowA.forfeits += 1;
      rowB.points += scoringRule.winPoints;
      rowA.points += scoringRule.forfeitPoints;
    }
    return { applied: true };
  }

  if (policy.isWalkover) {
    if (winnerId === rowA.entryId) {
      rowA.wins += 1;
      rowB.losses += 1;
      rowA.walkovers += 1;
      rowA.points += scoringRule.walkoverPoints;
      rowB.points += scoringRule.lossPoints;
    } else if (winnerId === rowB.entryId) {
      rowB.wins += 1;
      rowA.losses += 1;
      rowB.walkovers += 1;
      rowB.points += scoringRule.walkoverPoints;
      rowA.points += scoringRule.lossPoints;
    }
    return { applied: true };
  }

  if (match.resultType === MATCH_RESULT_TYPE.COMPLETED || match.resultType === MATCH_RESULT_TYPE.UNVERIFIED) {
    if (scoreA > scoreB || winnerId === rowA.entryId) {
      rowA.wins += 1;
      rowB.losses += 1;
      rowA.points += scoringRule.winPoints;
      rowB.points += scoringRule.lossPoints;
    } else if (scoreB > scoreA || winnerId === rowB.entryId) {
      rowB.wins += 1;
      rowA.losses += 1;
      rowB.points += scoringRule.winPoints;
      rowA.points += scoringRule.lossPoints;
    } else {
      rowA.draws += 1;
      rowB.draws += 1;
      rowA.points += scoringRule.drawPoints;
      rowB.points += scoringRule.drawPoints;
    }
  }

  return { applied: true };
}

/**
 * @param {import('./standingsTypes.js').StandingsRequest} request
 * @param {{ excludedMatches?: Array<{ matchId: string, reason: string }>, warnings?: string[] }} [traceSink]
 */
export function accumulateStandingsRows(request, traceSink = {}) {
  const warnings = traceSink.warnings || [];
  const excludedMatches = traceSink.excludedMatches || [];
  const rowMap = new Map(
    buildInitialStandingsRows(request.entries).map((row) => [String(row.entryId), row])
  );
  const seenMatchIds = new Set();

  (request.matches || []).forEach((match) => {
    if (seenMatchIds.has(match.matchId)) {
      warnings.push(`Duplicate match ignored: ${match.matchId}`);
      excludedMatches.push({ matchId: match.matchId, reason: "duplicate_match" });
      return;
    }
    seenMatchIds.add(match.matchId);

    const result = applyMatchToRows(rowMap, match, request.configuration.scoringRule, warnings);
    if (!result.applied) {
      excludedMatches.push({ matchId: match.matchId, reason: result.excludedReason || "excluded" });
    }
  });

  const rows = [...rowMap.values()].map((row) =>
    createStandingsRow({
      ...row,
      scoreDifference: row.scoreFor - row.scoreAgainst,
      gameDifference: row.gamesFor - row.gamesAgainst,
      setDifference: row.setsFor - row.setsAgainst,
    })
  );

  return { rows, warnings, excludedMatches, seenMatchIds: [...seenMatchIds] };
}
