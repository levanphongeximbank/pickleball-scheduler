import { createStandingsRequest } from "./standingsContracts.js";
import { accumulateStandingsRows } from "./scoringRules.js";
import { compareRowsByTieBreakRule } from "./tieBreakCompare.js";
import { compareCanonicalIdentity } from "./canonicalResultAdapter.js";

const MAX_MINI_TABLE_DEPTH = 8;

/**
 * Build mini-table for three or more tied entries.
 *
 * @param {string[]} entryIds
 * @param {import('./standingsTypes.js').StandingsRow[]} allRows
 * @param {import('./standingsTypes.js').StandingsMatchRecord[]} matches
 * @param {import('./standingsTypes.js').StandingsRequest} request
 * @param {number} [depth]
 */
export function computeMiniTableRanking(entryIds, allRows, matches, request, depth = 0) {
  if (depth > MAX_MINI_TABLE_DEPTH) {
    return {
      orderedEntryIds: [...entryIds].sort(),
      resolved: false,
      unresolvedReason: "max_mini_table_depth_exceeded",
      rows: [],
    };
  }

  const tiedSet = new Set(entryIds.map(String));
  const miniMatches = matches.filter(
    (match) => tiedSet.has(String(match.entryAId)) && tiedSet.has(String(match.entryBId))
  );

  const miniEntries = allRows
    .filter((row) => tiedSet.has(String(row.entryId)))
    .map((row) => ({
      entryId: row.entryId,
      teamId: row.teamId,
      playerId: row.playerId,
      name: row.name,
      seed: row.seed,
    }));

  const miniRequest = createStandingsRequest({
    ...request,
    entries: miniEntries,
    matches: miniMatches,
  });

  const { rows: miniRows } = accumulateStandingsRows(miniRequest);
  const enabledRules = (request.configuration.tieBreakRules || []).filter((rule) => rule.enabled);

  const sorted = [...miniRows].sort((left, right) => {
    for (const rule of enabledRules) {
      if (rule.type === "HEAD_TO_HEAD" || rule.type === "MINI_TABLE" || rule.type === "DRAW_LOT") {
        continue;
      }
      const delta = compareRowsByTieBreakRule(left, right, rule, matches, request.configuration);
      if (delta !== 0) {
        return delta;
      }
    }
    return compareCanonicalIdentity(left.entryId, right.entryId);
  });

  const orderedEntryIds = sorted.map((row) => row.entryId);
  const top = sorted[0];
  const unresolvedGroup = sorted.filter(
    (row) =>
      row.points === top.points &&
      row.scoreDifference === top.scoreDifference &&
      row.gameDifference === top.gameDifference &&
      row.setDifference === top.setDifference &&
      row.scoreFor === top.scoreFor &&
      row.forfeits === top.forfeits
  );

  if (unresolvedGroup.length > 1 && unresolvedGroup.length < entryIds.length) {
    const resolvedIds = sorted
      .filter((row) => !unresolvedGroup.some((item) => item.entryId === row.entryId))
      .map((row) => row.entryId);
    const remaining = unresolvedGroup.map((row) => row.entryId);
    const nested = computeMiniTableRanking(remaining, allRows, matches, request, depth + 1);
    return {
      orderedEntryIds: [...resolvedIds, ...nested.orderedEntryIds],
      resolved: nested.resolved,
      unresolvedReason: nested.unresolvedReason,
      rows: miniRows,
      partialResolution: true,
      remainingEntryIds: remaining,
    };
  }

  return {
    orderedEntryIds,
    resolved: unresolvedGroup.length === 1,
    unresolvedReason: unresolvedGroup.length > 1 ? "mini_table_subset_unresolved" : undefined,
    rows: miniRows,
  };
}

/**
 * @param {import('./standingsTypes.js').StandingsRow[]} rows
 * @param {import('./standingsTypes.js').TieBreakRule[]} tieBreakRules
 */
export function groupTiedRows(rows, tieBreakRules) {
  if (!rows.length) {
    return [];
  }

  const primaryRule =
    tieBreakRules.find((rule) => rule.enabled && rule.type === "TOTAL_POINTS") ||
    tieBreakRules.find((rule) => rule.enabled);

  /** @type {import('./standingsTypes.js').StandingsRow[][]} */
  const groups = [];
  let current = [rows[0]];

  for (let i = 1; i < rows.length; i += 1) {
    const prev = rows[i - 1];
    const next = rows[i];
    const sameGroup =
      !primaryRule ||
      compareRowsByTieBreakRule(prev, next, primaryRule, [], { drawLotSeed: "" }) === 0;

    if (sameGroup && prev.points === next.points) {
      current.push(next);
    } else {
      groups.push(current);
      current = [next];
    }
  }
  groups.push(current);
  return groups;
}
