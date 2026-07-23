import { MATCH_RESULT_TYPE } from "./standingsConstants.js";
import { createStandingsRow } from "./standingsContracts.js";
import { getMatchStandingsPolicy } from "./matchResultPolicy.js";
import { standingsMatchOutcomeFingerprint } from "./canonicalResultAdapter.js";
import {
  STANDINGS_ERROR_CODE,
  STANDINGS_WARNING_CODE,
  createStandingsIssue,
} from "./standingsErrors.js";

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
 * @param {unknown} value
 * @returns {number|undefined}
 */
function finiteOrUndefined(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Apply optional differentials without inventing missing statistics as official zeros.
 * @param {import('./standingsTypes.js').StandingsRow} rowA
 * @param {import('./standingsTypes.js').StandingsRow} rowB
 * @param {import('./standingsTypes.js').StandingsMatchRecord} match
 */
function applyDifferentials(rowA, rowB, match) {
  const scoreA = finiteOrUndefined(match.scoreA);
  const scoreB = finiteOrUndefined(match.scoreB);
  if (scoreA !== undefined && scoreB !== undefined) {
    rowA.scoreFor += scoreA;
    rowA.scoreAgainst += scoreB;
    rowB.scoreFor += scoreB;
    rowB.scoreAgainst += scoreA;
  }

  // Games are distinct from points — never alias score → games.
  const gamesA = finiteOrUndefined(match.gamesA);
  const gamesB = finiteOrUndefined(match.gamesB);
  if (gamesA !== undefined && gamesB !== undefined) {
    rowA.gamesFor += gamesA;
    rowA.gamesAgainst += gamesB;
    rowB.gamesFor += gamesB;
    rowB.gamesAgainst += gamesA;
  }

  const setsA = finiteOrUndefined(match.setsA);
  const setsB = finiteOrUndefined(match.setsB);
  if (setsA !== undefined && setsB !== undefined) {
    rowA.setsFor += setsA;
    rowA.setsAgainst += setsB;
    rowB.setsFor += setsB;
    rowB.setsAgainst += setsA;
  }
}

/**
 * @param {Map<string, import('./standingsTypes.js').StandingsRow>} rowMap
 * @param {import('./standingsTypes.js').StandingsMatchRecord} match
 * @param {import('./standingsTypes.js').ScoringRule} scoringRule
 * @param {string[]} warnings
 * @param {ReturnType<typeof createStandingsIssue>[]} [typedWarnings]
 */
function applyMatchToRows(rowMap, match, scoringRule, warnings, typedWarnings = []) {
  const policy = getMatchStandingsPolicy(match, scoringRule);
  warnings.push(...(policy.warnings || []));
  if (!policy.includeInStandings) {
    typedWarnings.push(
      createStandingsIssue(
        STANDINGS_WARNING_CODE.STANDINGS_RESULT_EXCLUDED,
        `Match ${match.matchId} excluded: ${policy.excludedReason || "excluded"}.`,
        { matchId: match.matchId, reason: policy.excludedReason || "excluded" }
      )
    );
    return { applied: false, excludedReason: policy.excludedReason };
  }

  const rowA = rowMap.get(String(match.entryAId));
  const rowB = rowMap.get(String(match.entryBId));
  if (!rowA || !rowB) {
    warnings.push(`Missing entry for match ${match.matchId}`);
    typedWarnings.push(
      createStandingsIssue(
        STANDINGS_ERROR_CODE.STANDINGS_PARTICIPANT_OUTSIDE_GROUP,
        `Missing entry for match ${match.matchId}`,
        { matchId: match.matchId, entryAId: match.entryAId, entryBId: match.entryBId }
      )
    );
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

  if (policy.includeScoreDiff) {
    applyDifferentials(rowA, rowB, match);
  } else if (match.resultType === MATCH_RESULT_TYPE.RETIREMENT || match.canonicalSource) {
    typedWarnings.push(
      createStandingsIssue(
        STANDINGS_WARNING_CODE.STANDINGS_DIFFERENTIAL_SKIPPED,
        `Differential not applied for match ${match.matchId}.`,
        { matchId: match.matchId, resultType: match.resultType }
      )
    );
  }

  if (policy.isForfeit || policy.isRetirement) {
    if (!winnerId && match.canonicalSource) {
      return {
        applied: false,
        excludedReason: "missing_winner",
        fatalIssue: createStandingsIssue(
          STANDINGS_ERROR_CODE.STANDINGS_MISSING_WINNER_LOSER,
          `Canonical match ${match.matchId} missing winnerEntryId.`,
          { matchId: match.matchId }
        ),
      };
    }
    if (winnerId === rowA.entryId) {
      rowA.wins += 1;
      rowB.losses += 1;
      if (policy.isForfeit) rowB.forfeits += 1;
      rowA.points += scoringRule.winPoints;
      rowB.points += policy.isForfeit ? scoringRule.forfeitPoints : scoringRule.lossPoints;
    } else if (winnerId === rowB.entryId) {
      rowB.wins += 1;
      rowA.losses += 1;
      if (policy.isForfeit) rowA.forfeits += 1;
      rowB.points += scoringRule.winPoints;
      rowA.points += policy.isForfeit ? scoringRule.forfeitPoints : scoringRule.lossPoints;
    }
    return { applied: true };
  }

  if (policy.isWalkover) {
    if (!winnerId && match.canonicalSource) {
      return {
        applied: false,
        excludedReason: "missing_winner",
        fatalIssue: createStandingsIssue(
          STANDINGS_ERROR_CODE.STANDINGS_MISSING_WINNER_LOSER,
          `Canonical match ${match.matchId} missing winnerEntryId.`,
          { matchId: match.matchId }
        ),
      };
    }
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
    // Canonical CORE-17 path: winner/loser only from validated identities — never infer from scores.
    if (match.canonicalSource) {
      if (!winnerId) {
        return {
          applied: false,
          excludedReason: "missing_winner",
          fatalIssue: createStandingsIssue(
            STANDINGS_ERROR_CODE.STANDINGS_MISSING_WINNER_LOSER,
            `Canonical match ${match.matchId} missing winnerEntryId.`,
            { matchId: match.matchId }
          ),
        };
      }
      if (winnerId === rowA.entryId) {
        rowA.wins += 1;
        rowB.losses += 1;
        rowA.points += scoringRule.winPoints;
        rowB.points += scoringRule.lossPoints;
      } else if (winnerId === rowB.entryId) {
        rowB.wins += 1;
        rowA.losses += 1;
        rowB.points += scoringRule.winPoints;
        rowA.points += scoringRule.lossPoints;
      } else if (match.core17Outcome === "NO_WINNER" || match.core17Outcome === "DOUBLE_LOSS") {
        rowA.draws += 1;
        rowB.draws += 1;
        rowA.points += scoringRule.drawPoints;
        rowB.points += scoringRule.drawPoints;
      } else {
        return {
          applied: false,
          excludedReason: "winner_outside_match",
          fatalIssue: createStandingsIssue(
            STANDINGS_ERROR_CODE.STANDINGS_MISSING_WINNER_LOSER,
            `Canonical winner ${winnerId} is not a match participant.`,
            { matchId: match.matchId, winnerEntryId: winnerId }
          ),
        };
      }
      return { applied: true };
    }

    // Legacy adapter path (CC-08): may use scores when winner is absent.
    const scoreA = Number(match.scoreA ?? 0);
    const scoreB = Number(match.scoreB ?? 0);
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
 * @param {{
 *   excludedMatches?: Array<{ matchId: string, reason: string, code?: string }>,
 *   warnings?: string[],
 *   typedWarnings?: ReturnType<typeof createStandingsIssue>[],
 *   typedErrors?: ReturnType<typeof createStandingsIssue>[],
 * }} [traceSink]
 */
export function accumulateStandingsRows(request, traceSink = {}) {
  const warnings = traceSink.warnings || [];
  const typedWarnings = traceSink.typedWarnings || [];
  const typedErrors = traceSink.typedErrors || [];
  const excludedMatches = traceSink.excludedMatches || [];
  const rowMap = new Map(
    buildInitialStandingsRows(request.entries).map((row) => [String(row.entryId), row])
  );
  const seenMatchIds = new Map();

  const entryIds = (request.entries || []).map((entry) => String(entry.entryId));
  const entryIdSet = new Set(entryIds);
  if (entryIds.length !== entryIdSet.size) {
    typedErrors.push(
      createStandingsIssue(
        STANDINGS_ERROR_CODE.STANDINGS_DUPLICATE_ENTRY_IDENTITY,
        "Duplicate entry identity in standings roster.",
        { entryIds }
      )
    );
  }

  // Fail-closed pre-scan: duplicate/conflicting matchIds never contribute (no first-wins).
  /** @type {Map<string, import('./standingsTypes.js').StandingsMatchRecord[]>} */
  const groupedByMatchId = new Map();
  for (const match of request.matches || []) {
    const key = String(match.matchId);
    if (!groupedByMatchId.has(key)) groupedByMatchId.set(key, []);
    groupedByMatchId.get(key).push(match);
  }
  /** @type {Set<string>} */
  const blockedMatchIds = new Set();
  for (const [matchId, group] of groupedByMatchId.entries()) {
    if (group.length < 2) continue;
    blockedMatchIds.add(matchId);
    const fingerprints = new Set(group.map((item) => standingsMatchOutcomeFingerprint(item)));
    const conflict = fingerprints.size > 1;
    const issue = createStandingsIssue(
      conflict
        ? STANDINGS_ERROR_CODE.STANDINGS_CONFLICTING_ACCEPTED_RESULTS
        : STANDINGS_ERROR_CODE.STANDINGS_DUPLICATE_MATCH_IDENTITY,
      conflict
        ? `Conflicting accepted results for match ${matchId}.`
        : `Duplicate match identity ${matchId}.`,
      { matchId }
    );
    typedErrors.push(issue);
    warnings.push(
      conflict
        ? `Conflicting match results: ${matchId}`
        : `Duplicate match ignored: ${matchId}`
    );
    excludedMatches.push({
      matchId,
      reason: conflict ? "conflicting_accepted_results" : "duplicate_match",
      code: issue.code,
    });
  }

  (request.matches || []).forEach((match) => {
    if (blockedMatchIds.has(String(match.matchId))) {
      return;
    }
    if (seenMatchIds.has(match.matchId)) {
      return;
    }
    seenMatchIds.set(match.matchId, match);

    const result = applyMatchToRows(
      rowMap,
      match,
      request.configuration.scoringRule,
      warnings,
      typedWarnings
    );
    if (result.fatalIssue) {
      typedErrors.push(result.fatalIssue);
    }
    if (!result.applied) {
      excludedMatches.push({
        matchId: match.matchId,
        reason: result.excludedReason || "excluded",
        code: STANDINGS_WARNING_CODE.STANDINGS_RESULT_EXCLUDED,
      });
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

  return {
    rows,
    warnings,
    typedWarnings,
    typedErrors,
    excludedMatches,
    seenMatchIds: [...seenMatchIds.keys()],
    hasFatalErrors: typedErrors.length > 0,
  };
}
