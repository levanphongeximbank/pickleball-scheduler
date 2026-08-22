/**
 * CORE-18 cross-group wildcard ranking execution.
 *
 * Competition Rules configures criteria; CORE-18 ranks.
 * CE composes selected wildcard entrants — does not own ranking.
 *
 * No Math.random. DRAW_LOTS uses deterministic drawLot tokens.
 */

import { CROSS_GROUP_RANKING_CRITERION } from "../competition-rules/constants/enums.js";
import { compareCanonicalIdentity } from "./canonicalResultAdapter.js";
import { buildDrawLotToken } from "./drawLot.js";
import { STANDINGS_ERROR_CODE, createStandingsIssue } from "./standingsErrors.js";

/**
 * @param {object} row
 * @param {boolean} normalizeByMatchesPlayed
 */
export function computeCrossGroupWildcardMetrics(row, normalizeByMatchesPlayed) {
  const played = Math.max(0, Number(row.played ?? row.matchesPlayed ?? 0));
  const wins = Math.max(0, Number(row.wins ?? 0));
  const scoreFor = Number(row.scoreFor ?? row.pointsScored ?? 0);
  const scoreDiff = Number(
    row.scoreDifference ??
      (Number(row.scoreFor ?? 0) - Number(row.scoreAgainst ?? 0))
  );
  const denom = normalizeByMatchesPlayed ? Math.max(played, 1) : 1;

  return Object.freeze({
    entryId: String(row.entryId),
    groupId: row.groupId != null ? String(row.groupId) : null,
    played,
    wins,
    winPercentage: played > 0 ? wins / played : 0,
    pointDifferentialPerMatch: scoreDiff / denom,
    pointsScoredPerMatch: scoreFor / denom,
    // Absolute fallbacks only when normalize is off and criteria need raw totals
    pointDifferential: scoreDiff,
    pointsScored: scoreFor,
    status: row.status,
    rank: Number.isFinite(Number(row.rank)) ? Number(row.rank) : null,
  });
}

/**
 * @param {ReturnType<typeof computeCrossGroupWildcardMetrics>} a
 * @param {ReturnType<typeof computeCrossGroupWildcardMetrics>} b
 * @param {string} criterion
 * @param {string} drawLotSeed
 * @returns {number}
 */
function compareByCriterion(a, b, criterion, drawLotSeed) {
  switch (criterion) {
    case CROSS_GROUP_RANKING_CRITERION.WIN_PERCENTAGE:
      return b.winPercentage - a.winPercentage;
    case CROSS_GROUP_RANKING_CRITERION.POINT_DIFFERENTIAL_PER_MATCH:
      return b.pointDifferentialPerMatch - a.pointDifferentialPerMatch;
    case CROSS_GROUP_RANKING_CRITERION.POINTS_SCORED_PER_MATCH:
      return b.pointsScoredPerMatch - a.pointsScoredPerMatch;
    case CROSS_GROUP_RANKING_CRITERION.DRAW_LOTS: {
      const leftToken = buildDrawLotToken(drawLotSeed, [a.entryId]);
      const rightToken = buildDrawLotToken(drawLotSeed, [b.entryId]);
      return (
        compareCanonicalIdentity(leftToken, rightToken) ||
        compareCanonicalIdentity(a.entryId, b.entryId)
      );
    }
    default:
      return 0;
  }
}

/**
 * Rank cross-group wildcard candidates using canonical criteria.
 *
 * @param {{
 *   rows: Array<object>,
 *   criteria?: string[],
 *   normalizeByMatchesPlayed?: boolean,
 *   drawLotSeed?: string,
 *   excludeEntryIds?: string[],
 * }} input
 */
export function rankCrossGroupWildcardCandidates(input = {}) {
  const criteria = Array.isArray(input.criteria) && input.criteria.length
    ? input.criteria.map(String)
    : [
        CROSS_GROUP_RANKING_CRITERION.WIN_PERCENTAGE,
        CROSS_GROUP_RANKING_CRITERION.POINT_DIFFERENTIAL_PER_MATCH,
        CROSS_GROUP_RANKING_CRITERION.POINTS_SCORED_PER_MATCH,
        CROSS_GROUP_RANKING_CRITERION.DRAW_LOTS,
      ];
  const allowed = new Set(Object.values(CROSS_GROUP_RANKING_CRITERION));
  const unknown = criteria.filter((c) => !allowed.has(c));
  if (unknown.length) {
    return Object.freeze({
      ok: false,
      code: STANDINGS_ERROR_CODE.STANDINGS_UNSUPPORTED_TIEBREAK_CRITERION,
      message: "Unknown cross-group wildcard ranking criterion",
      issues: Object.freeze([
        createStandingsIssue(
          STANDINGS_ERROR_CODE.STANDINGS_UNSUPPORTED_TIEBREAK_CRITERION,
          "Unknown cross-group wildcard ranking criterion",
          { unknown }
        ),
      ]),
      ranked: Object.freeze([]),
    });
  }

  const normalizeByMatchesPlayed = input.normalizeByMatchesPlayed !== false;
  const drawLotSeed = String(input.drawLotSeed || "cross-group-wildcard");
  const exclude = new Set(
    (input.excludeEntryIds || []).map((id) => String(id).trim()).filter(Boolean)
  );

  const metrics = (input.rows || [])
    .map((row) => computeCrossGroupWildcardMetrics(row, normalizeByMatchesPlayed))
    .filter((m) => m.entryId && !exclude.has(m.entryId));

  const seen = new Set();
  for (const m of metrics) {
    if (seen.has(m.entryId)) {
      return Object.freeze({
        ok: false,
        code: STANDINGS_ERROR_CODE.STANDINGS_DUPLICATE_ENTRY_IDENTITY,
        message: "Duplicate entryId in cross-group wildcard candidate set",
        issues: Object.freeze([
          createStandingsIssue(
            STANDINGS_ERROR_CODE.STANDINGS_DUPLICATE_ENTRY_IDENTITY,
            "Duplicate entryId in cross-group wildcard candidate set",
            { entryId: m.entryId }
          ),
        ]),
        ranked: Object.freeze([]),
      });
    }
    seen.add(m.entryId);
  }

  const rankedMetrics = [...metrics].sort((a, b) => {
    for (const criterion of criteria) {
      const cmp = compareByCriterion(a, b, criterion, drawLotSeed);
      if (cmp !== 0) return cmp;
    }
    return compareCanonicalIdentity(a.entryId, b.entryId);
  });

  const ranked = rankedMetrics.map((m, index) =>
    Object.freeze({
      entryId: m.entryId,
      groupId: m.groupId,
      crossGroupRank: index + 1,
      rank: index + 1,
      metrics: m,
      status: m.status,
    })
  );

  return Object.freeze({
    ok: true,
    criteria: Object.freeze([...criteria]),
    normalizeByMatchesPlayed,
    drawLotSeed,
    executionOwner: "CORE-18",
    policyOwner: "competition-core.competition-rules",
    ranked: Object.freeze(ranked),
    code: null,
    message: null,
  });
}
