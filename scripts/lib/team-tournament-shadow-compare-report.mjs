import { compareTeamTournamentSnapshots } from "../../src/features/team-tournament/repositories/teamTournamentCompare.js";
import { hashTeamTournamentCanonicalValue } from "../../src/features/team-tournament/repositories/teamTournamentCanonical.js";
import { normalizeTeamData } from "../../src/features/team-tournament/models/index.js";

function hashValue(value) {
  return hashTeamTournamentCanonicalValue(value ?? { __missing: true });
}

function compareArraysByKey(blobItems, cloudItems, entityType, keyFn, pick = (x) => x) {
  const mismatches = [];
  const blobMap = new Map((blobItems || []).map((item) => [String(keyFn(item)), item]));
  const cloudMap = new Map((cloudItems || []).map((item) => [String(keyFn(item)), item]));
  const keys = new Set([...blobMap.keys(), ...cloudMap.keys()]);

  for (const key of keys) {
    const blobHas = blobMap.has(key);
    const cloudHas = cloudMap.has(key);
    if (blobHas && !cloudHas) {
      mismatches.push({
        entityType,
        entityKey: key,
        mismatchType: "missing_in_cloud",
        blobHash: hashValue(pick(blobMap.get(key))),
        cloudHash: hashValue(undefined),
      });
      continue;
    }
    if (!blobHas && cloudHas) {
      mismatches.push({
        entityType,
        entityKey: key,
        mismatchType: "missing_in_blob",
        blobHash: hashValue(undefined),
        cloudHash: hashValue(pick(cloudMap.get(key))),
      });
      continue;
    }
    const blobHash = hashValue(pick(blobMap.get(key)));
    const cloudHash = hashValue(pick(cloudMap.get(key)));
    if (blobHash !== cloudHash) {
      mismatches.push({
        entityType,
        entityKey: key,
        mismatchType: "value_mismatch",
        blobHash,
        cloudHash,
      });
    }
  }

  return mismatches;
}

export function extractTeamMembers(teamData) {
  const members = [];
  for (const team of teamData?.teams || []) {
    for (const playerId of team.playerIds || []) {
      members.push({
        key: `${team.id}::${playerId}`,
        teamId: team.id,
        playerId: String(playerId),
        isCaptain: team.captainPlayerId === playerId,
        isDeputy: (team.deputyPlayerIds || []).includes(playerId),
      });
    }
  }
  return members;
}

export function extractSubMatches(teamData) {
  const rows = [];
  for (const matchup of teamData?.matchups || []) {
    for (const subMatch of matchup.subMatches || []) {
      rows.push({
        key: subMatch.id,
        matchupId: matchup.id,
        ...subMatch,
      });
    }
  }
  return rows;
}

export function extractScheduleRows(teamData) {
  return (teamData?.matchups || []).map((matchup) => ({
    key: matchup.id,
    matchupId: matchup.id,
    scheduledAt: matchup.scheduledAt || null,
    courtLabel: matchup.courtLabel || null,
    roundNumber: matchup.roundNumber ?? null,
  }));
}

export function extractDreambreakerRows(teamData) {
  return (teamData?.matchups || [])
    .filter((matchup) => matchup.dreambreaker)
    .map((matchup) => ({
      key: matchup.id,
      matchupId: matchup.id,
      dreambreaker: matchup.dreambreaker,
    }));
}

export function extractForfeitRows(teamData) {
  const rows = [];
  for (const matchup of teamData?.matchups || []) {
    for (const subMatch of matchup.subMatches || []) {
      if (subMatch.forfeit || subMatch.resultType === "forfeit") {
        rows.push({
          key: `${matchup.id}::${subMatch.id}`,
          matchupId: matchup.id,
          subMatchId: subMatch.id,
          forfeit: subMatch.forfeit || { resultType: subMatch.resultType },
        });
      }
    }
  }
  return rows;
}

/**
 * Full shadow compare report (requires both sides loaded successfully).
 * @param {object} blobTeamData
 * @param {object} cloudTeamData
 */
export function buildShadowCompareReport(blobTeamData, cloudTeamData) {
  const blob = normalizeTeamData(blobTeamData || {});
  const cloud = normalizeTeamData(cloudTeamData || {});

  const core = compareTeamTournamentSnapshots(blob, cloud);
  const sections = {
    teams: compareArraysByKey(blob.teams, cloud.teams, "team", (t) => t.id),
    members: compareArraysByKey(
      extractTeamMembers(blob),
      extractTeamMembers(cloud),
      "member",
      (m) => m.key,
      (m) => ({ teamId: m.teamId, playerId: m.playerId, isCaptain: m.isCaptain, isDeputy: m.isDeputy })
    ),
    matchups: compareArraysByKey(blob.matchups, cloud.matchups, "matchup", (m) => m.id),
    lineups: core.mismatches.filter((m) => m.entityType === "lineup"),
    disciplines: core.mismatches.filter((m) => m.entityType === "discipline"),
    subMatches: compareArraysByKey(
      extractSubMatches(blob),
      extractSubMatches(cloud),
      "sub_match",
      (s) => s.key,
      (s) => ({
        id: s.id,
        disciplineId: s.disciplineId,
        status: s.status,
        score: s.score,
        winnerTeamId: s.winnerTeamId,
      })
    ),
    standings: compareArraysByKey(blob.standings, cloud.standings, "standing", (s) => s.teamId),
    schedule: compareArraysByKey(
      extractScheduleRows(blob),
      extractScheduleRows(cloud),
      "schedule",
      (s) => s.key,
      (s) => ({
        scheduledAt: s.scheduledAt,
        courtLabel: s.courtLabel,
        roundNumber: s.roundNumber,
      })
    ),
    courtAssignment: compareArraysByKey(
      extractScheduleRows(blob),
      extractScheduleRows(cloud),
      "court_assignment",
      (s) => s.key,
      (s) => ({ courtLabel: s.courtLabel })
    ),
    forfeit: compareArraysByKey(
      extractForfeitRows(blob),
      extractForfeitRows(cloud),
      "forfeit",
      (f) => f.key
    ),
    dreambreaker: compareArraysByKey(
      extractDreambreakerRows(blob),
      extractDreambreakerRows(cloud),
      "dreambreaker",
      (d) => d.key,
      (d) => d.dreambreaker
    ),
  };

  const allMismatches = [
    ...sections.teams,
    ...sections.members,
    ...sections.matchups,
    ...sections.subMatches,
    ...sections.standings,
    ...sections.schedule,
    ...sections.courtAssignment,
    ...sections.forfeit,
    ...sections.dreambreaker,
    ...sections.lineups,
    ...sections.disciplines,
  ];

  const summaryByType = {};
  for (const m of allMismatches) {
    summaryByType[m.mismatchType] = (summaryByType[m.mismatchType] || 0) + 1;
  }

  const dreambreakerPilot = {
    blobHasDreambreaker: extractDreambreakerRows(blob).length > 0,
    cloudHasDreambreaker: extractDreambreakerRows(cloud).length > 0,
    pilotUsesDreambreaker:
      extractDreambreakerRows(blob).length > 0 || extractDreambreakerRows(cloud).length > 0,
  };

  return {
    ok: allMismatches.length === 0,
    mismatchCount: allMismatches.length,
    mismatches: allMismatches,
    sections: Object.fromEntries(
      Object.entries(sections).map(([name, items]) => [
        name,
        { ok: items.length === 0, mismatchCount: items.length, mismatches: items },
      ])
    ),
    summaryByType,
    dreambreakerPilot,
  };
}

export function classifyReadFailure(error, context = "cloud") {
  const message = String(error?.message || error || "").toLowerCase();
  const code = String(error?.code || "");

  if (
    code === "42501" ||
    message.includes("row-level security") ||
    message.includes("permission denied") ||
    message.includes("not authenticated") ||
    message.includes("forbidden") ||
    message.includes("jwt")
  ) {
    return {
      status: "BLOCKED",
      code: "authorization_error",
      error: String(error?.message || error),
      context,
    };
  }

  return {
    status: "ERROR",
    code: "cloud_read_error",
    error: String(error?.message || error),
    context,
  };
}
