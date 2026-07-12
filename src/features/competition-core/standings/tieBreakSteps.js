import { TIEBREAK_TYPE } from "./standingsConstants.js";
import { computeTwoEntryHeadToHead } from "./headToHead.js";
import { computeMiniTableRanking } from "./miniTable.js";
import { orderRowsByDrawLot } from "./drawLot.js";
import { compareRowsByTieBreakRule } from "./tieBreakCompare.js";

/**
 * @param {import('./standingsTypes.js').StandingsRow[]} tiedRows
 * @param {import('./standingsTypes.js').StandingsRequest} request
 * @param {import('./standingsTypes.js').StandingsMatchRecord[]} matches
 * @param {{ tieBreakSteps?: import('./standingsTypes.js').TieBreakStep[], headToHeadCalculations?: Array<Record<string, unknown>>, miniTableCalculations?: Array<Record<string, unknown>> }} traceSink
 */
export function resolveTiedGroup(tiedRows, request, matches, traceSink = {}) {
  const tieBreakSteps = traceSink.tieBreakSteps || [];
  const entryIds = tiedRows.map((row) => row.entryId);

  if (entryIds.length <= 1) {
    return { orderedRows: tiedRows, resolved: true, steps: tieBreakSteps };
  }

  let working = [...tiedRows];
  const enabledRules = (request.configuration.tieBreakRules || [])
    .filter((rule) => rule.enabled)
    .sort((a, b) => a.priority - b.priority);

  for (const rule of enabledRules) {
    if (entryIds.length === 2 && rule.type === TIEBREAK_TYPE.HEAD_TO_HEAD) {
      const h2hResult = computeTwoEntryHeadToHead(
        working[0].entryId,
        working[1].entryId,
        matches,
        request.configuration.scoringRule
      );
      (traceSink.headToHeadCalculations || []).push(h2hResult);
      const h2h = h2hResult.resolved
        ? h2hResult.winnerEntryId === working[0].entryId
          ? -1
          : 1
        : 0;
      tieBreakSteps.push({
        ruleId: rule.id,
        type: rule.type,
        entryIds,
        resolved: h2h !== 0,
        explanation: h2h !== 0 ? "Two-entry head-to-head resolved tie." : "Head-to-head unresolved.",
      });
      if (h2h !== 0) {
        working.sort((a, b) => compareRowsByTieBreakRule(a, b, rule, matches, request.configuration));
        return { orderedRows: working, resolved: true, steps: tieBreakSteps };
      }
      continue;
    }

    if (entryIds.length >= 3 && rule.type === TIEBREAK_TYPE.MINI_TABLE) {
      const mini = computeMiniTableRanking(entryIds, working, matches, request);
      (traceSink.miniTableCalculations || []).push({
        entryIds,
        ruleId: rule.id,
        orderedEntryIds: mini.orderedEntryIds,
        resolved: mini.resolved,
      });
      tieBreakSteps.push({
        ruleId: rule.id,
        type: rule.type,
        entryIds,
        resolved: mini.resolved,
        explanation: mini.resolved ? "Mini-table resolved tied subset." : mini.unresolvedReason,
        details: mini,
      });
      if (mini.resolved) {
        const orderMap = new Map(mini.orderedEntryIds.map((id, index) => [id, index]));
        working = [...working].sort(
          (a, b) => (orderMap.get(a.entryId) ?? 999) - (orderMap.get(b.entryId) ?? 999)
        );
        return { orderedRows: working, resolved: true, steps: tieBreakSteps };
      }
      continue;
    }

    const sorted = [...working].sort((a, b) =>
      compareRowsByTieBreakRule(a, b, rule, matches, request.configuration)
    );
    const first = sorted[0];
    const stillTied = sorted.filter((row) =>
      compareRowsByTieBreakRule(row, first, rule, matches, request.configuration) === 0
    );
    tieBreakSteps.push({
      ruleId: rule.id,
      type: rule.type,
      entryIds,
      resolved: stillTied.length === 1,
      explanation:
        stillTied.length === 1
          ? `${rule.type} resolved tie.`
          : `${rule.type} did not fully resolve ${stillTied.length} entries.`,
    });
    working = sorted;
    if (stillTied.length === 1) {
      return { orderedRows: working, resolved: true, steps: tieBreakSteps };
    }
  }

  const drawSorted = orderRowsByDrawLot(working, request.configuration.drawLotSeed || "cc08-default-seed");
  tieBreakSteps.push({
    ruleId: "draw-lot-fallback",
    type: TIEBREAK_TYPE.DRAW_LOT,
    entryIds,
    resolved: true,
    explanation: "Deterministic draw-lot applied as final tie-break.",
  });

  return { orderedRows: drawSorted, resolved: true, steps: tieBreakSteps };
}

/**
 * @param {import('./standingsTypes.js').StandingsRow[]} rows
 * @param {import('./standingsTypes.js').StandingsRequest} request
 * @param {import('./standingsTypes.js').StandingsMatchRecord[]} matches
 * @param {object} traceSink
 */
export function rankStandingsRows(rows, request, matches, traceSink = {}) {
  const enabledRules = (request.configuration.tieBreakRules || []).filter((rule) => rule.enabled);
  const primary = enabledRules.find((rule) => rule.type === TIEBREAK_TYPE.TOTAL_POINTS) || enabledRules[0];

  const preSorted = [...rows].sort((a, b) => {
    if (primary) {
      const delta = compareRowsByTieBreakRule(a, b, primary, matches, request.configuration);
      if (delta !== 0) {
        return delta;
      }
    }
    return String(a.name || a.entryId).localeCompare(String(b.name || b.entryId), "vi");
  });

  /** @type {import('./standingsTypes.js').StandingsRow[]} */
  const finalRows = [];
  let index = 0;
  while (index < preSorted.length) {
    let end = index + 1;
    while (
      end < preSorted.length &&
      preSorted[end].points === preSorted[index].points &&
      compareRowsByTieBreakRule(preSorted[index], preSorted[end], primary, matches, request.configuration) === 0
    ) {
      end += 1;
    }
    const group = preSorted.slice(index, end);
    if (group.length > 1) {
      (traceSink.tieGroups || []).push({ entryIds: group.map((row) => row.entryId) });
      const resolved = resolveTiedGroup(group, request, matches, traceSink);
      finalRows.push(...resolved.orderedRows);
    } else {
      finalRows.push(group[0]);
    }
    index = end;
  }

  return finalRows.map((row, rankIndex) => ({ ...row, rank: rankIndex + 1 }));
}

/**
 * @param {import('./standingsTypes.js').StandingsRow[]} rows
 * @param {import('./standingsTypes.js').StandingsRequest} request
 * @param {boolean} [groupComplete]
 */
export function applyQualificationDecisions(rows, request, groupComplete = true) {
  const qualifiersCount = Number(request.configuration.qualificationRule?.qualifiersCount ?? 0);
  if (!qualifiersCount) {
    return { rows, decisions: [] };
  }

  const decisions = [];
  const updated = rows.map((row) => {
    const qualificationStatus = !groupComplete
      ? "PENDING"
      : row.rank <= qualifiersCount
        ? "QUALIFIED"
        : "ELIMINATED";
    decisions.push({ entryId: row.entryId, rank: row.rank, qualificationStatus });
    return { ...row, qualificationStatus };
  });

  return { rows: updated, decisions };
}

/**
 * @param {import('./standingsTypes.js').StandingsRow[]} rows
 * @param {import('./standingsTypes.js').ManualStandingsOverride[]} overrides
 */
export function applyManualOverrides(rows, overrides = []) {
  if (!overrides.length) {
    return rows;
  }

  const byEntry = new Map(rows.map((row) => [String(row.entryId), { ...row }]));
  overrides.forEach((override) => {
    const row = byEntry.get(String(override.affectedEntryId));
    if (!row) {
      return;
    }
    row.rank = Number(override.afterRank);
    row.manualOverrideApplied = true;
    row.warnings = [...(row.warnings || []), `Manual override ${override.overrideId} applied.`];
    byEntry.set(String(override.affectedEntryId), row);
  });

  return [...byEntry.values()].sort((a, b) => a.rank - b.rank || a.points - b.points);
}
