import { MATCH_STATUS } from "../../../models/tournament/constants.js";
import { buildGroupStandingFromMatches } from "../../../tournament/engines/rankingEngine.js";
import {
  DEFAULT_RANKING_RULES,
  QUALIFIED_STATUS,
} from "../constants/defaults.js";
import { validateRankingInput } from "../validation/tournamentValidation.js";

function isFinishedMatch(match) {
  return match?.status === MATCH_STATUS.COMPLETED || match?.status === MATCH_STATUS.FORFEIT;
}

function headToHeadResult(entryAId, entryBId, matches) {
  const direct = matches.filter(
    (match) =>
      isFinishedMatch(match) &&
      ((String(match.entryAId) === String(entryAId) &&
        String(match.entryBId) === String(entryBId)) ||
        (String(match.entryAId) === String(entryBId) &&
          String(match.entryBId) === String(entryAId)))
  );

  if (direct.length === 0) {
    return 0;
  }

  let winsA = 0;
  let winsB = 0;
  direct.forEach((match) => {
    if (String(match.winnerId) === String(entryAId)) {
      winsA += 1;
    } else if (String(match.winnerId) === String(entryBId)) {
      winsB += 1;
    } else {
      const scoreA =
        String(match.entryAId) === String(entryAId) ? match.scoreA : match.scoreB;
      const scoreB =
        String(match.entryAId) === String(entryAId) ? match.scoreB : match.scoreA;
      if (Number(scoreA) > Number(scoreB)) {
        winsA += 1;
      } else if (Number(scoreB) > Number(scoreA)) {
        winsB += 1;
      }
    }
  });

  if (winsA > winsB) {
    return -1;
  }
  if (winsB > winsA) {
    return 1;
  }
  return 0;
}

function compareByCriteria(a, b, criterion, matches, entrySeedMap) {
  switch (criterion) {
    case "wins":
      return b.won - a.won;
    case "matchPoints":
      return b.matchPoints - a.matchPoints;
    case "pointDiff":
      return b.scoreDiff - a.scoreDiff;
    case "pointsFor":
      return b.pointsFor - a.pointsFor;
    case "headToHead":
      return headToHeadResult(a.id, b.id, matches);
    case "seed": {
      const seedA = Number(entrySeedMap.get(String(a.id)) ?? 999);
      const seedB = Number(entrySeedMap.get(String(b.id)) ?? 999);
      return seedA - seedB;
    }
    default:
      return 0;
  }
}

function sortStandings(rows, rules, matches, entrySeedMap) {
  const criteria = rules.criteria || DEFAULT_RANKING_RULES.criteria;
  return [...rows].sort((a, b) => {
    for (const criterion of criteria) {
      if (criterion === "manual") {
        break;
      }
      const diff = compareByCriteria(a, b, criterion, matches, entrySeedMap);
      if (diff !== 0) {
        return diff;
      }
    }
    return String(a.name).localeCompare(String(b.name), "vi");
  });
}

function detectTieGroups(sortedRows, rules, matches, entrySeedMap) {
  const ties = [];
  for (let i = 0; i < sortedRows.length - 1; i += 1) {
    const a = sortedRows[i];
    const b = sortedRows[i + 1];
    let allEqual = true;
    for (const criterion of rules.criteria || []) {
      if (criterion === "manual") {
        break;
      }
      if (compareByCriteria(a, b, criterion, matches, entrySeedMap) !== 0) {
        allEqual = false;
        break;
      }
    }
    if (allEqual) {
      ties.push([a.id, b.id]);
    }
  }
  return ties;
}

function rowToRankingOutput(row, rank, options = {}) {
  const qualifiedStatus = options.qualifiedStatus || QUALIFIED_STATUS.PENDING;
  return {
    rank,
    participantId: row.id,
    team: row.name,
    name: row.name,
    matchesPlayed: row.played,
    wins: row.won,
    losses: row.lost,
    pointsFor: row.pointsFor,
    pointsAgainst: row.pointsAgainst,
    pointDiff: row.scoreDiff,
    matchPoints: row.matchPoints,
    headToHeadNote: options.headToHeadNote || "",
    qualifiedStatus,
  };
}

/**
 * @param {import('../types/tournamentTypes.js').EngineContext} context
 */
export function computeRankings(context = {}) {
  const validation = validateRankingInput(context);
  if (!validation.ok) {
    return { ok: false, errors: validation.errors, warnings: validation.warnings };
  }

  const rules = { ...DEFAULT_RANKING_RULES, ...context.rankingRules };
  const warnings = [...validation.warnings];
  const explain = [];
  const groups = context.groups || [];
  const allMatches = context.matches || [];
  const entries = context.participants || [];
  const entrySeedMap = new Map(
    entries.map((entry) => [String(entry.id), entry.seed])
  );

  const groupRankings = groups.map((group) => {
    const groupMatches = [
      ...(group.matches || []),
      ...allMatches.filter((m) => String(m.groupId) === String(group.id)),
    ];

    const standingResult = buildGroupStandingFromMatches({
      group,
      entries: group.entries || entries,
      matches: groupMatches,
      pointsConfig: group.pointsConfig || context.pointsConfig,
    });

    const sorted = sortStandings(
      standingResult.standing,
      rules,
      groupMatches,
      entrySeedMap
    );

    const ties = detectTieGroups(sorted, rules, groupMatches, entrySeedMap);
    if (ties.length > 0) {
      warnings.push(`Bảng ${group.label}: ${ties.length} cặp hòa cần tie-break.`);
    }

    const qualifiersPerGroup = Number(rules.qualifiersPerGroup) || 2;
    const totalGroupMatches = (group.matches || groupMatches).filter(isFinishedMatch).length;
    const expectedMatches =
      ((group.entryIds?.length || 0) * ((group.entryIds?.length || 0) - 1)) / 2;
    const groupComplete = totalGroupMatches >= expectedMatches && expectedMatches > 0;

    const rankings = sorted.map((row, index) => {
      const rank = index + 1;
      let qualifiedStatus = QUALIFIED_STATUS.PENDING;

      if (groupComplete) {
        if (rank <= qualifiersPerGroup) {
          qualifiedStatus = QUALIFIED_STATUS.QUALIFIED;
        } else {
          qualifiedStatus = QUALIFIED_STATUS.ELIMINATED;
        }
      }

      const inTie = ties.some((pair) => pair.includes(row.id));
      if (inTie && groupComplete && rank <= qualifiersPerGroup + 1) {
        qualifiedStatus = QUALIFIED_STATUS.TIE_BREAK_REQUIRED;
      }

      return rowToRankingOutput(row, rank, {
        qualifiedStatus,
        headToHeadNote: inTie ? "Cần xét đối đầu / quyết định BTC" : "",
      });
    });

    return {
      groupId: group.id,
      groupLabel: group.label || group.name,
      rankings,
      ties,
      complete: groupComplete,
    };
  });

  const overall = [];
  groupRankings.forEach((groupRanking) => {
    groupRanking.rankings.forEach((row) => {
      overall.push({
        ...row,
        groupLabel: groupRanking.groupLabel,
      });
    });
  });

  explain.push(`${groupRankings.length} bảng được cập nhật xếp hạng.`);

  return {
    ok: true,
    data: {
      groupRankings,
      overall,
    },
    warnings,
    explain,
  };
}

/**
 * Cập nhật ranking sau một trận — wrapper nhẹ cho Director / score submit.
 */
export function computeRankingsAfterMatch(context = {}, completedMatchId) {
  const matches = (context.matches || []).map((match) => ({ ...match }));
  const result = computeRankings({ ...context, matches });
  if (!result.ok) {
    return result;
  }
  result.explain = [
    ...(result.explain || []),
    completedMatchId ? `Tính lại sau trận ${completedMatchId}.` : "Tính lại toàn bộ.",
  ];
  return result;
}

export { headToHeadResult, sortStandings };
