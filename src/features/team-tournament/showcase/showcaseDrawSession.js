/**
 * P1.5A Showcase — fixed draw session.
 * Runs real engines once, freezes membership; animation must not mutate.
 */

import { getPlayerGenderKey } from "../../../models/player.js";
import { resolveCanonicalAthleteRating } from "../../pairing-candidates/canonicalAthleteRating.js";
import {
  applyTeamPairing,
  assignSeededTeamsToGroups,
  pairTeamsFromSelectedPlayers,
  suggestMlpTeamsFromPlayers,
} from "../engines/teamAutoDrawEngine.js";
import {
  buildGroupDivisionDiagnostics,
  listGroupDivisionOptions,
} from "../engines/teamGroupDivisionPolicy.js";
import { FORMAT_PRESET, TEAM_GROUP_SEEDING } from "../constants.js";
import { DEFAULT_ENGINE_VERSION } from "../canonical/teamTournamentMutationEnvelope.js";
import { SHOWCASE_DEFAULT_TEAM_COUNT } from "./showcaseConstants.js";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  Object.freeze(value);
  Object.getOwnPropertyNames(value).forEach((key) => {
    const child = value[key];
    if (child && typeof child === "object") {
      deepFreeze(child);
    }
  });
  return value;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildMembershipFingerprint(teams = []) {
  return JSON.stringify(
    [...(teams || [])]
      .map((t) => ({
        id: String(t.id),
        playerIds: [...(t.playerIds || [])].map(String).sort(),
        captainPlayerId: String(t.captainPlayerId || ""),
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  );
}

function buildGroupFingerprint(groups = []) {
  return JSON.stringify(
    [...(groups || [])]
      .map((g) => ({
        id: String(g.id),
        teamIds: [...(g.teamIds || [])].map(String).sort(),
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  );
}

function playerRating(player) {
  const canonical = resolveCanonicalAthleteRating(player);
  if (Number.isFinite(canonical?.ratingValue) && canonical.ratingValue > 0) {
    return canonical.ratingValue;
  }
  const legacy = Number(player?.rating ?? player?.level ?? player?.ratingValue);
  return Number.isFinite(legacy) ? legacy : 0;
}

/**
 * Assign captain using the same highest-rating rule as the auto-draw engine,
 * only when the engine left captain empty (pairTeams path).
 * Does not re-pick when captain already set (replay / frozen session).
 */
function ensureCaptainsFromRoster(teams, playersById) {
  return (teams || []).map((team) => {
    if (String(team.captainPlayerId || "").trim()) {
      return team;
    }
    const roster = (team.playerIds || [])
      .map((id) => playersById.get(String(id)))
      .filter(Boolean);
    if (!roster.length) {
      return { ...team, captainPlayerId: "" };
    }
    const sorted = [...roster].sort((a, b) => playerRating(b) - playerRating(a));
    return { ...team, captainPlayerId: String(sorted[0].id) };
  });
}

function annotateAthletes(playersById, team) {
  return (team.playerIds || []).map((id) => {
    const player = playersById.get(String(id)) || { id };
    const rating = resolveCanonicalAthleteRating(player);
    const genderKey = getPlayerGenderKey(player.gender);
    return {
      id: String(id),
      name: player.name || player.displayName || String(id),
      gender: genderKey,
      genderLabel: genderKey === "male" ? "Nam" : genderKey === "female" ? "Nữ" : "—",
      ratingValue: rating.ratingValue ?? playerRating(player),
      ratingSource: rating.ratingSource || player.ratingSource || "legacy",
      isCaptain: String(team.captainPlayerId || "") === String(id),
    };
  });
}

function buildTeamRevealCards(teams, playersById) {
  return (teams || []).map((team, index) => {
    const athletes = annotateAthletes(playersById, team);
    const maleCount = athletes.filter((a) => a.gender === "male").length;
    const femaleCount = athletes.filter((a) => a.gender === "female").length;
    const avg =
      athletes.length > 0
        ? Math.round(
            (athletes.reduce((sum, a) => sum + (a.ratingValue || 0), 0) / athletes.length) *
              100
          ) / 100
        : Number(team.avgLevel) || 0;
    return {
      index,
      id: team.id,
      name: team.name || `Đội ${index + 1}`,
      seed: team.seed || index + 1,
      avgLevel: avg,
      captainPlayerId: team.captainPlayerId || "",
      athletes,
      genderOk: maleCount === 2 && femaleCount === 2,
      maleCount,
      femaleCount,
      balanced: Boolean(team.avgLevel != null),
    };
  });
}

/**
 * Generate fixed live draw (engine once).
 * @returns {{ ok: boolean, session?: object, error?: string }}
 */
export function generateShowcaseTeamDraw({
  players = [],
  selectedPlayerIds,
  teamCount = SHOWCASE_DEFAULT_TEAM_COUNT,
  teamNames = [],
  teamNamePrefix = "Đội",
  randomFn,
  baseTeamData = null,
  engineVersion = DEFAULT_ENGINE_VERSION,
  rulesVersion = "",
} = {}) {
  const pool = Array.isArray(players) ? players : [];
  const ids =
    Array.isArray(selectedPlayerIds) && selectedPlayerIds.length
      ? selectedPlayerIds
      : pool.map((p) => p.id);

  let teams;
  let waitingPlayerIds;
  let warnings;

  if (ids.length === pool.length && !teamNames.length) {
    const suggested = suggestMlpTeamsFromPlayers(pool, {
      teamNamePrefix,
      randomFn,
    });
    teams = suggested.teams || [];
    warnings = suggested.warnings || [];
    const used = new Set(teams.flatMap((t) => t.playerIds || []));
    waitingPlayerIds = pool.filter((p) => !used.has(p.id)).map((p) => p.id);
    if (teams.length > teamCount) {
      teams = teams.slice(0, teamCount);
    }
  } else {
    const paired = pairTeamsFromSelectedPlayers({
      players: pool,
      selectedPlayerIds: ids,
      teamCount,
      teamNames:
        teamNames.length > 0
          ? teamNames
          : Array.from({ length: teamCount }, (_, i) => `${teamNamePrefix} ${i + 1}`),
      formatPreset: FORMAT_PRESET.MLP_4,
      randomFn,
    });
    if (!paired.ok) {
      return {
        ok: false,
        error: paired.warnings?.[0] || "Không ghép được đội cho lễ bốc thăm.",
        privatePairingError: paired.privatePairingError || null,
      };
    }
    const playersById = new Map(pool.map((p) => [String(p.id), p]));
    teams = ensureCaptainsFromRoster(paired.teams, playersById);
    waitingPlayerIds = paired.waitingPlayerIds || [];
    warnings = paired.warnings || [];
  }

  if (!teams.length) {
    return { ok: false, error: warnings[0] || "Không ghép được đội." };
  }

  const applied = applyTeamPairing(baseTeamData || { teams: [], groups: [], matchups: [] }, {
    teams,
  });
  if (!applied.ok) {
    return { ok: false, error: applied.error || "Không áp dụng được đội." };
  }

  const playersById = new Map(pool.map((p) => [String(p.id), p]));
  const teamCards = buildTeamRevealCards(applied.teamData.teams, playersById);
  const membershipFingerprint = buildMembershipFingerprint(applied.teamData.teams);

  const session = deepFreeze({
    mode: "live",
    generatedAt: new Date().toISOString(),
    engineVersion,
    rulesVersion: String(rulesVersion || ""),
    engineRunCount: 1,
    writeCount: 0,
    players: cloneJson(pool),
    teamData: cloneJson(applied.teamData),
    waitingPlayerIds: [...waitingPlayerIds],
    warnings: [...warnings],
    teamCards,
    membershipFingerprint,
    groupOptions: listGroupDivisionOptions(applied.teamData.teams.length),
    groupSession: null,
  });

  return { ok: true, session };
}

/**
 * Build fixed group division on top of a frozen team session (engine once per format).
 */
export function generateShowcaseGroupDraw(session, {
  groupCount,
  seedingMode = TEAM_GROUP_SEEDING.AVG_LEVEL,
  randomFn,
  rulesVersion,
} = {}) {
  if (!session?.teamData?.teams?.length) {
    return { ok: false, error: "Chưa có kết quả đội cố định." };
  }

  const teamDataOnly = {
    ...cloneJson(session.teamData),
    groups: [],
    matchups: [],
  };

  const result = assignSeededTeamsToGroups(teamDataOnly, {
    groupCount: Number(groupCount),
    seedingMode,
    players: session.players,
    randomFn,
  });

  if (!result.ok) {
    return {
      ok: false,
      error: result.error || result.warnings?.[0] || "Không chia được bảng.",
      privatePairingError: result.privatePairingError || null,
    };
  }

  const diagnostics = buildGroupDivisionDiagnostics(
    result.teamData,
    result.teamData.groups || []
  );
  const playersById = new Map((session.players || []).map((p) => [String(p.id), p]));
  const teamCards = buildTeamRevealCards(result.teamData.teams, playersById);

  const groupCards = (result.teamData.groups || []).map((group, index) => {
    const teams = (group.teamIds || [])
      .map((id) => teamCards.find((t) => String(t.id) === String(id)))
      .filter(Boolean);
    const ratings = teams.map((t) => t.avgLevel).filter((v) => v > 0);
    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
        : 0;
    return {
      index,
      id: group.id,
      name: group.name || `Bảng ${String.fromCharCode(65 + index)}`,
      teamCount: teams.length,
      teams,
      avgRating,
    };
  });

  const groupFingerprint = buildGroupFingerprint(result.teamData.groups || []);

  const next = deepFreeze({
    ...cloneJson(session),
    rulesVersion: String(rulesVersion || session.rulesVersion || ""),
    teamData: cloneJson(result.teamData),
    teamCards,
    // Keep order-independent membership fingerprint from frozen teams.
    membershipFingerprint: buildMembershipFingerprint(result.teamData.teams),
    groupSession: {
      groupCount: Number(groupCount),
      seedingMode,
      balance: result.balance || null,
      diagnostics,
      groupCards,
      groupFingerprint,
      engineRunCount: 1,
    },
  });

  return { ok: true, session: next };
}

/**
 * Replay session from persisted get_setup v7 teamData (no engine).
 */
export function buildReplayShowcaseSession({
  teamData,
  players = [],
  engineVersion = DEFAULT_ENGINE_VERSION,
  rulesVersion = "",
  generatedAt = null,
} = {}) {
  const td = cloneJson(teamData || { teams: [], groups: [] });
  const pool = Array.isArray(players) ? players : [];
  const playersById = new Map(pool.map((p) => [String(p.id), p]));
  const teamCards = buildTeamRevealCards(td.teams || [], playersById);
  const groupCards = (td.groups || []).map((group, index) => {
    const teams = (group.teamIds || [])
      .map((id) => teamCards.find((t) => String(t.id) === String(id)))
      .filter(Boolean);
    const ratings = teams.map((t) => t.avgLevel).filter((v) => v > 0);
    const avgRating =
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100
        : 0;
    return {
      index,
      id: group.id,
      name: group.name || `Bảng ${String.fromCharCode(65 + index)}`,
      teamCount: teams.length,
      teams,
      avgRating,
    };
  });

  return deepFreeze({
    mode: "replay",
    generatedAt: generatedAt || new Date().toISOString(),
    engineVersion,
    rulesVersion: String(rulesVersion || ""),
    engineRunCount: 0,
    writeCount: 0,
    players: cloneJson(pool),
    teamData: td,
    waitingPlayerIds: [],
    warnings: [],
    teamCards,
    membershipFingerprint: buildMembershipFingerprint(td.teams || []),
    groupOptions: listGroupDivisionOptions((td.teams || []).length),
    groupSession: {
      groupCount: (td.groups || []).length,
      seedingMode: TEAM_GROUP_SEEDING.AVG_LEVEL,
      balance: null,
      diagnostics: buildGroupDivisionDiagnostics(td, td.groups || []),
      groupCards,
      groupFingerprint: buildGroupFingerprint(td.groups || []),
      engineRunCount: 0,
    },
  });
}

export function assertMembershipUnchanged(session, previousFingerprint) {
  return session?.membershipFingerprint === previousFingerprint;
}

export function assertGroupMembershipUnchanged(session, previousFingerprint) {
  return session?.groupSession?.groupFingerprint === previousFingerprint;
}

export function cloneShowcaseSession(session) {
  return session ? cloneJson(session) : null;
}
