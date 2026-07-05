import { findTeam, normalizeTeamData } from "../models/index.js";
import { computeTeamStandings, getStandingsTable } from "./teamStandingsEngine.js";

export const DEFAULT_AWARDS_CONFIG = {
  champion: { enabled: true, label: "Vô địch" },
  runnerUp: { enabled: true, label: "Á quân" },
  thirdPlace: { enabled: true, label: "Hạng ba" },
  fairPlay: { enabled: false, label: "Giải fair-play" },
};

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
  const current = getAwardsConfig(teamData);
  const next = normalizeAwardsConfig({
    ...current,
    ...patch,
  });

  return {
    ok: true,
    teamData: patchSettings(teamData, { awardsConfig: next }),
    awardsConfig: next,
  };
}

function standingAtRank(standings, rank) {
  return standings.find((item) => item.rank === rank) || null;
}

export function buildAwardsSheet(teamData, options = {}) {
  const data = teamData.standings?.length
    ? teamData
    : computeTeamStandings(teamData);
  const standings = getStandingsTable(data);
  const config = normalizeAwardsConfig({
    ...getAwardsConfig(teamData),
    ...(options.awardsConfig || {}),
  });

  const awards = [];

  if (config.champion.enabled) {
    const first = standingAtRank(standings, 1);
    awards.push({
      key: "champion",
      label: config.champion.label,
      rank: 1,
      teamId: config.champion.teamId || first?.teamId || "",
      teamName:
        findTeam(data, config.champion.teamId)?.name ||
        first?.teamName ||
        "",
      auto: !config.champion.teamId,
    });
  }

  if (config.runnerUp.enabled) {
    const second = standingAtRank(standings, 2);
    awards.push({
      key: "runnerUp",
      label: config.runnerUp.label,
      rank: 2,
      teamId: config.runnerUp.teamId || second?.teamId || "",
      teamName:
        findTeam(data, config.runnerUp.teamId)?.name ||
        second?.teamName ||
        "",
      auto: !config.runnerUp.teamId,
    });
  }

  if (config.thirdPlace.enabled) {
    const third = standingAtRank(standings, 3);
    awards.push({
      key: "thirdPlace",
      label: config.thirdPlace.label,
      rank: 3,
      teamId: config.thirdPlace.teamId || third?.teamId || "",
      teamName:
        findTeam(data, config.thirdPlace.teamId)?.name ||
        third?.teamName ||
        "",
      auto: !config.thirdPlace.teamId,
    });
  }

  if (config.fairPlay.enabled) {
    const manualTeamId = config.fairPlay.teamId || "";
    awards.push({
      key: "fairPlay",
      label: config.fairPlay.label,
      rank: null,
      teamId: manualTeamId,
      teamName: manualTeamId ? findTeam(data, manualTeamId)?.name || manualTeamId : "",
      auto: !manualTeamId,
    });
  }

  return {
    generatedAt: options.generatedAt || new Date().toISOString(),
    standings,
    awards: awards.filter((item) => item.teamId || item.auto),
    config,
  };
}

export function getAwardsPreview(teamData) {
  const sheet = buildAwardsSheet(teamData);
  return {
    ok: sheet.awards.length > 0,
    awards: sheet.awards,
    standings: sheet.standings,
    generatedAt: sheet.generatedAt,
  };
}
