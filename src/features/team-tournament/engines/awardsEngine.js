/**
 * S2-H — Team awards / podium (KO final when present, else standings).
 */

import { findTeam, normalizeTeamData } from "../models/index.js";
import { MATCHUP_STATUS } from "../constants.js";
import { computeTeamStandings, getStandingsTable } from "./teamStandingsEngine.js";
import {
  isKnockoutMatchup,
  listKnockoutMatchups,
} from "./teamKnockoutEngine.js";

export const DEFAULT_AWARDS_CONFIG = {
  champion: { enabled: true, label: "Vô địch" },
  runnerUp: { enabled: true, label: "Á quân" },
  thirdPlace: { enabled: true, label: "Hạng ba" },
  fairPlay: { enabled: false, label: "Giải fair-play" },
};

export const AWARD_KEY = Object.freeze({
  CHAMPION: "champion",
  RUNNER_UP: "runnerUp",
  THIRD_PLACE: "thirdPlace",
  FAIR_PLAY: "fairPlay",
});

function patchSettings(teamData, patch) {
  return normalizeTeamData({
    ...teamData,
    settings: {
      ...teamData.settings,
      ...patch,
    },
  });
}

export function normalizeAwardsConfig(config = {}) {
  const entries = Object.entries(DEFAULT_AWARDS_CONFIG);
  return entries.reduce((accumulator, [key, defaults]) => {
    const value = config[key] && typeof config[key] === "object" ? config[key] : {};
    accumulator[key] = {
      enabled: value.enabled !== undefined ? value.enabled === true : defaults.enabled,
      label: value.label ? String(value.label).trim() : defaults.label,
      teamId: value.teamId ? String(value.teamId).trim() : "",
    };
    return accumulator;
  }, {});
}

export function getAwardsConfig(teamData) {
  return normalizeAwardsConfig(teamData?.settings?.awardsConfig || {});
}

export function updateAwardsConfig(teamData, patch = {}) {
  if (isAwardsLocked(teamData)) {
    return { ok: false, error: "Giải đã đóng — không đổi cấu hình giải thưởng.", code: "CLOSED" };
  }
  const current = getAwardsConfig(teamData);
  const next = normalizeAwardsConfig({
    ...current,
    ...Object.fromEntries(
      Object.entries(patch).map(([key, value]) => [
        key,
        { ...current[key], ...(value && typeof value === "object" ? value : {}) },
      ])
    ),
  });

  return {
    ok: true,
    teamData: patchSettings(teamData, { awardsConfig: next }),
    awardsConfig: next,
  };
}

export function getAwardsAssignments(teamData) {
  const raw =
    teamData?.settings?.awardsAssignments &&
    typeof teamData.settings.awardsAssignments === "object"
      ? teamData.settings.awardsAssignments
      : {};
  return {
    champion: raw.champion ? String(raw.champion).trim() : "",
    runnerUp: raw.runnerUp ? String(raw.runnerUp).trim() : "",
    thirdPlace: raw.thirdPlace ? String(raw.thirdPlace).trim() : "",
    fairPlay: raw.fairPlay ? String(raw.fairPlay).trim() : "",
  };
}

export function isAwardsLocked(teamData) {
  return teamData?.settings?.closed === true || teamData?.settings?.resultsLocked === true;
}

function standingAtRank(standings, rank) {
  return standings.find((item) => Number(item.rank) === Number(rank)) || null;
}

function findKnockoutFinal(teamData) {
  const knockout = listKnockoutMatchups(teamData);
  if (knockout.length === 0) return null;
  return (
    knockout.find((matchup) => !matchup.nextMatchupId) ||
    knockout
      .slice()
      .sort(
        (a, b) =>
          Number(b.roundNumber || 0) - Number(a.roundNumber || 0) ||
          Number(a.matchNumberInRound || 0) - Number(b.matchNumberInRound || 0)
      )[0] ||
    null
  );
}

function loserOf(matchup) {
  const winnerId = matchup?.result?.winnerTeamId
    ? String(matchup.result.winnerTeamId)
    : "";
  if (!winnerId) return "";
  if (String(matchup.teamAId) === winnerId) return String(matchup.teamBId || "");
  if (String(matchup.teamBId) === winnerId) return String(matchup.teamAId || "");
  return "";
}

/**
 * Final podium: KO final winner/runner-up when complete; else overall standings.
 */
export function buildTeamFinalRanking(teamData) {
  const data = teamData?.standings?.length
    ? teamData
    : computeTeamStandings(teamData);
  const standings = getStandingsTable(data);
  const ranking = [];

  const final = findKnockoutFinal(data);
  const finalDone =
    final &&
    (final.status === MATCHUP_STATUS.COMPLETED || final.result?.winnerTeamId) &&
    final.result?.winnerTeamId;

  if (finalDone) {
    const championId = String(final.result.winnerTeamId);
    const runnerId = loserOf(final);
    ranking.push({
      rank: 1,
      teamId: championId,
      teamName: findTeam(data, championId)?.name || championId,
      medal: "gold",
      source: "knockout_final",
    });
    if (runnerId) {
      ranking.push({
        rank: 2,
        teamId: runnerId,
        teamName: findTeam(data, runnerId)?.name || runnerId,
        medal: "silver",
        source: "knockout_final",
      });
    }

    const semiLosers = listKnockoutMatchups(data)
      .filter(
        (matchup) =>
          String(matchup.nextMatchupId || "") === String(final.id) &&
          matchup.result?.winnerTeamId
      )
      .map((matchup) => loserOf(matchup))
      .filter(Boolean);

    const standingsRank = new Map(
      standings.map((row) => [String(row.teamId), Number(row.rank) || 999])
    );
    semiLosers
      .slice()
      .sort(
        (a, b) =>
          (standingsRank.get(String(a)) || 999) -
            (standingsRank.get(String(b)) || 999) || String(a).localeCompare(String(b))
      )
      .forEach((teamId, index) => {
        ranking.push({
          rank: 3 + index,
          teamId: String(teamId),
          teamName: findTeam(data, teamId)?.name || teamId,
          medal: index === 0 ? "bronze" : null,
          source: "knockout_semi",
        });
      });
  }

  if (ranking.length === 0) {
    standings.slice(0, 4).forEach((row, index) => {
      ranking.push({
        rank: index + 1,
        teamId: String(row.teamId),
        teamName: row.teamName || findTeam(data, row.teamId)?.name || row.teamId,
        medal: index === 0 ? "gold" : index === 1 ? "silver" : index === 2 ? "bronze" : null,
        source: "standings",
      });
    });
  }

  return {
    ok: true,
    ranking,
    standings,
    source: ranking[0]?.source || "standings",
  };
}

export function buildAwardsSheet(teamData, options = {}) {
  const final = buildTeamFinalRanking(teamData);
  const config = normalizeAwardsConfig({
    ...getAwardsConfig(teamData),
    ...(options.awardsConfig || {}),
  });
  const assignments = {
    ...getAwardsAssignments(teamData),
    ...(options.assignments || {}),
  };
  const byRank = new Map((final.ranking || []).map((row) => [Number(row.rank), row]));

  const awards = [];

  const pushRanked = (key, rank) => {
    if (!config[key]?.enabled) return;
    const ranked = byRank.get(rank);
    const manualId = assignments[key] || config[key].teamId || "";
    const teamId = manualId || ranked?.teamId || "";
    awards.push({
      key,
      label: config[key].label,
      rank,
      teamId,
      teamName:
        findTeam(teamData, teamId)?.name || ranked?.teamName || "",
      medal: ranked?.medal || null,
      auto: !manualId,
      source: ranked?.source || "",
    });
  };

  pushRanked(AWARD_KEY.CHAMPION, 1);
  pushRanked(AWARD_KEY.RUNNER_UP, 2);
  pushRanked(AWARD_KEY.THIRD_PLACE, 3);

  if (config.fairPlay.enabled) {
    const manualTeamId = assignments.fairPlay || config.fairPlay.teamId || "";
    awards.push({
      key: AWARD_KEY.FAIR_PLAY,
      label: config.fairPlay.label,
      rank: null,
      teamId: manualTeamId,
      teamName: manualTeamId ? findTeam(teamData, manualTeamId)?.name || manualTeamId : "",
      medal: null,
      auto: !manualTeamId,
      source: "manual",
    });
  }

  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    standings: final.standings,
    ranking: final.ranking,
    awards: awards.filter((item) => item.teamId || item.auto),
    config,
    source: final.source,
  };
}

export function getAwardsPreview(teamData) {
  const sheet = buildAwardsSheet(teamData);
  return {
    ok: sheet.awards.length > 0,
    awards: sheet.awards,
    ranking: sheet.ranking,
    standings: sheet.standings,
    generatedAt: sheet.generatedAt,
    source: sheet.source,
  };
}

export function assignAward(teamData, awardKey, teamId, options = {}) {
  if (isAwardsLocked(teamData) && options.allowWhenClosed !== true) {
    return { ok: false, error: "Giải đã đóng — không gán lại giải thưởng.", code: "CLOSED" };
  }
  const key = String(awardKey || "").trim();
  if (!Object.values(AWARD_KEY).includes(key)) {
    return { ok: false, error: "Mã giải thưởng không hợp lệ.", code: "BAD_KEY" };
  }
  const nextId = teamId ? String(teamId).trim() : "";
  if (nextId && !findTeam(teamData, nextId)) {
    return { ok: false, error: "Không tìm thấy đội.", code: "TEAM_NOT_FOUND" };
  }
  const assignments = {
    ...getAwardsAssignments(teamData),
    [key]: nextId,
  };
  return {
    ok: true,
    teamData: patchSettings(teamData, { awardsAssignments: assignments }),
    assignments,
  };
}

export function autoAssignAwardsFromRanking(teamData, options = {}) {
  if (isAwardsLocked(teamData) && options.allowWhenClosed !== true) {
    return { ok: false, error: "Giải đã đóng — không gán tự động.", code: "CLOSED" };
  }
  const sheet = buildAwardsSheet(teamData, options);
  const assignments = { ...getAwardsAssignments(teamData) };
  sheet.awards.forEach((award) => {
    if (award.key === AWARD_KEY.FAIR_PLAY) return;
    if (award.teamId) {
      assignments[award.key] = String(award.teamId);
    }
  });
  const next = patchSettings(teamData, {
    awardsAssignments: assignments,
    awardsSheet: {
      generatedAt: sheet.generatedAt,
      awards: sheet.awards,
      ranking: sheet.ranking,
      source: sheet.source,
    },
  });
  return {
    ok: true,
    teamData: next,
    awards: sheet.awards,
    ranking: sheet.ranking,
  };
}

export function exportAwardsJson(teamData, options = {}) {
  const preview = getAwardsPreview(teamData);
  const payload = {
    generatedAt: preview.generatedAt,
    source: preview.source,
    awards: preview.awards,
    ranking: preview.ranking,
  };
  return {
    filename: options.filename || `team-awards-${Date.now()}.json`,
    mimeType: "application/json",
    content: JSON.stringify(payload, null, 2),
  };
}

export function exportAwardsCsv(teamData, options = {}) {
  const preview = getAwardsPreview(teamData);
  const header = "key,label,rank,teamId,teamName,medal,auto,source";
  const rows = (preview.awards || []).map((award) =>
    [
      award.key,
      JSON.stringify(award.label || ""),
      award.rank ?? "",
      award.teamId || "",
      JSON.stringify(award.teamName || ""),
      award.medal || "",
      award.auto ? "1" : "0",
      award.source || "",
    ].join(",")
  );
  return {
    filename: options.filename || `team-awards-${Date.now()}.csv`,
    mimeType: "text/csv",
    content: [header, ...rows].join("\n"),
  };
}

/** @deprecated helper kept for standings-only callers */
export function standingRankHelper(teamData, rank) {
  const data = teamData?.standings?.length
    ? teamData
    : computeTeamStandings(teamData);
  return standingAtRank(getStandingsTable(data), rank);
}

export function hasKnockoutPodium(teamData) {
  const final = findKnockoutFinal(teamData);
  return Boolean(
    final &&
      isKnockoutMatchup(final) &&
      final.result?.winnerTeamId
  );
}
