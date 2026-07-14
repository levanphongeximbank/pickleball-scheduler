/**
 * S2-H — Close team tournament: lock results, freeze standings, auto awards, summary.
 */

import { MATCHUP_STATUS } from "../constants.js";
import { normalizeTeamData } from "../models/index.js";
import { computeTeamStandings, getStandingsTable } from "./teamStandingsEngine.js";
import {
  autoAssignAwardsFromRanking,
  buildAwardsSheet,
  getAwardsPreview,
} from "./awardsEngine.js";
import { listGroupStageMatchups, listKnockoutMatchups } from "./teamKnockoutEngine.js";

export function isTeamTournamentClosed(teamData) {
  return teamData?.settings?.closed === true;
}

export function canCloseTeamTournament(teamData) {
  if (!teamData) {
    return { ok: false, error: "Thiếu dữ liệu giải đồng đội.", code: "MISSING" };
  }
  if (isTeamTournamentClosed(teamData)) {
    return { ok: false, error: "Giải đã được đóng.", code: "ALREADY_CLOSED" };
  }
  return { ok: true };
}

function freezeStandingsSnapshot(teamData) {
  const computed = computeTeamStandings(teamData);
  return {
    updatedAt: new Date().toISOString(),
    standings: getStandingsTable(computed),
    groups: (teamData.groups || []).map((group) => ({
      groupId: group.id,
      groupName: group.name || group.id,
      teamIds: [...(group.teamIds || [])],
    })),
    knockout: teamData.knockout
      ? JSON.parse(JSON.stringify(teamData.knockout))
      : null,
  };
}

function lockMatchups(teamData) {
  const matchups = (teamData.matchups || []).map((matchup) => ({
    ...matchup,
    locked: true,
    resultsLocked: true,
  }));
  return normalizeTeamData({ ...teamData, matchups });
}

export function buildTeamTournamentSummary(teamData, options = {}) {
  const awards = getAwardsPreview(teamData);
  const matchups = teamData?.matchups || [];
  const completed = matchups.filter(
    (matchup) =>
      matchup.status === MATCHUP_STATUS.COMPLETED ||
      Boolean(matchup.result?.winnerTeamId)
  );
  const champion =
    (awards.awards || []).find((item) => item.key === "champion") || null;

  return {
    tournamentId: options.tournamentId || "",
    tournamentName: options.tournamentName || "",
    closedAt: teamData?.settings?.closedAt || null,
    teamCount: (teamData?.teams || []).length,
    matchupCount: matchups.length,
    completedMatchupCount: completed.length,
    groupMatchupCount: listGroupStageMatchups(teamData).length,
    knockoutMatchupCount: listKnockoutMatchups(teamData).length,
    awards: awards.awards || [],
    ranking: awards.ranking || [],
    champion,
    awardsSource: awards.source || "",
  };
}

/**
 * Close: optional auto awards, lock matchups, freeze standings, mark closed.
 */
export function closeTeamTournament(teamData, options = {}) {
  const check = canCloseTeamTournament(teamData);
  if (!check.ok) return check;

  let next = normalizeTeamData(teamData);

  if (options.autoAwards !== false) {
    const assigned = autoAssignAwardsFromRanking(next, {
      allowWhenClosed: false,
      generatedAt: options.now || new Date().toISOString(),
    });
    if (assigned.ok) {
      next = assigned.teamData;
    }
  }

  next = lockMatchups(next);
  const frozen = freezeStandingsSnapshot(next);
  const closedAt = options.now || new Date().toISOString();

  next = normalizeTeamData({
    ...next,
    standings: frozen.standings,
    settings: {
      ...next.settings,
      closed: true,
      closedAt,
      closedBy: options.actor?.id || options.userId || "",
      resultsLocked: true,
      frozenStandings: frozen,
      tiebreakFrozen: true,
      tiebreakFrozenAt: closedAt,
      tiebreakFrozenReason: "tournament_closed",
    },
  });

  const summary = buildTeamTournamentSummary(next, options);
  next = normalizeTeamData({
    ...next,
    settings: {
      ...next.settings,
      summary,
      awardsSheet: {
        generatedAt: closedAt,
        awards: summary.awards,
        ranking: summary.ranking,
        source: summary.awardsSource,
      },
    },
  });

  return {
    ok: true,
    teamData: next,
    summary,
  };
}

export function getTeamTournamentSummary(teamData) {
  if (!teamData) return null;
  if (teamData.settings?.summary && typeof teamData.settings.summary === "object") {
    return teamData.settings.summary;
  }
  if (!isTeamTournamentClosed(teamData)) return null;
  return buildTeamTournamentSummary(teamData);
}

export function assertTeamTournamentOpen(teamData, actionLabel = "thao tác này") {
  if (isTeamTournamentClosed(teamData)) {
    return {
      ok: false,
      error: `Giải đã đóng — không thể ${actionLabel}.`,
      code: "CLOSED",
    };
  }
  return { ok: true };
}

export function previewCloseReadiness(teamData) {
  const sheet = buildAwardsSheet(teamData);
  const matchups = teamData?.matchups || [];
  const pending = matchups.filter(
    (matchup) =>
      matchup.status !== MATCHUP_STATUS.COMPLETED && !matchup.result?.winnerTeamId
  );
  return {
    ok: true,
    pendingMatchupCount: pending.length,
    awardPreviewCount: sheet.awards.length,
    canClose: !isTeamTournamentClosed(teamData),
    awardsSource: sheet.source,
  };
}
