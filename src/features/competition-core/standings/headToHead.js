import { getMatchStandingsPolicy } from "./matchResultPolicy.js";

/**
 * @param {string} entryAId
 * @param {string} entryBId
 * @param {import('./standingsTypes.js').StandingsMatchRecord[]} matches
 * @param {import('./standingsTypes.js').ScoringRule} scoringRule
 */
export function computeTwoEntryHeadToHead(entryAId, entryBId, matches = [], scoringRule) {
  const considered = [];
  let winsA = 0;
  let winsB = 0;

  matches.forEach((match) => {
    const pair =
      (match.entryAId === entryAId && match.entryBId === entryBId) ||
      (match.entryAId === entryBId && match.entryBId === entryAId);
    if (!pair) {
      return;
    }

    const policy = getMatchStandingsPolicy(match, scoringRule);
    if (!policy.headToHeadEligible) {
      return;
    }

    considered.push(match.matchId);

    const winnerId = match.winnerEntryId ? String(match.winnerEntryId) : "";
    if (winnerId === entryAId) {
      winsA += 1;
    } else if (winnerId === entryBId) {
      winsB += 1;
    } else if (match.canonicalSource) {
      // Canonical results must carry winner identity — do not infer from scores.
      return;
    } else {
      const scoreA = match.entryAId === entryAId ? Number(match.scoreA ?? 0) : Number(match.scoreB ?? 0);
      const scoreB = match.entryAId === entryAId ? Number(match.scoreB ?? 0) : Number(match.scoreA ?? 0);
      if (scoreA > scoreB) {
        winsA += 1;
      } else if (scoreB > scoreA) {
        winsB += 1;
      }
    }
  });

  let winnerEntryId;
  let resolved = false;
  let unresolvedReason;

  if (considered.length === 0) {
    unresolvedReason = "no_eligible_head_to_head_matches";
  } else if (winsA > winsB) {
    winnerEntryId = entryAId;
    resolved = true;
  } else if (winsB > winsA) {
    winnerEntryId = entryBId;
    resolved = true;
  } else {
    unresolvedReason = "head_to_head_tied";
  }

  return {
    entryIds: [entryAId, entryBId],
    matchesConsidered: considered,
    winsByEntry: { [entryAId]: winsA, [entryBId]: winsB },
    winnerEntryId,
    resolved,
    unresolvedReason,
    explanation: resolved
      ? `Head-to-head resolved in favor of ${winnerEntryId} (${winsA}-${winsB}).`
      : `Head-to-head unresolved: ${unresolvedReason}.`,
  };
}

/**
 * @param {import('./standingsTypes.js').StandingsRow} left
 * @param {import('./standingsTypes.js').StandingsRow} right
 * @param {import('./standingsTypes.js').StandingsMatchRecord[]} matches
 * @param {import('./standingsTypes.js').ScoringRule} scoringRule
 */
export function compareHeadToHeadRows(left, right, matches, scoringRule) {
  const result = computeTwoEntryHeadToHead(left.entryId, right.entryId, matches, scoringRule);
  if (!result.resolved) {
    return 0;
  }
  if (result.winnerEntryId === left.entryId) {
    return -1;
  }
  if (result.winnerEntryId === right.entryId) {
    return 1;
  }
  return 0;
}
