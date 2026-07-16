import { GENDER_REQUIREMENT } from "../constants.js";
import {
  findTeam,
} from "../models/index.js";
import { isMlpFormat } from "./mlpPresetEngine.js";
import { updateTeamInTournament } from "./teamTournamentEngine.js";
import {
  collectHydratedMemberKeys,
  computeHydratedRosterStats,
  hydrateTeamRoster,
} from "./teamRosterHydration.js";

function normalizePlayerId(value) {
  return value ? String(value).trim() : "";
}

export function findPlayerTeam(teamData, playerId) {
  const normalized = normalizePlayerId(playerId);
  if (!normalized) {
    return null;
  }

  return (
    (teamData?.teams || []).find((team) =>
      (team.playerIds || []).includes(normalized)
    ) || null
  );
}

/**
 * Identity-aware find — resolves aliases via athlete pool.
 * @param {object} teamData
 * @param {string} playerId
 * @param {object[]} [athletePool]
 */
export function findPlayerTeamInPool(teamData, playerId, athletePool = []) {
  const normalized = normalizePlayerId(playerId);
  if (!normalized) {
    return null;
  }

  const direct = findPlayerTeam(teamData, normalized);
  if (direct) return direct;

  return (
    (teamData?.teams || []).find((team) => {
      const hydrated = hydrateTeamRoster({ team, athletePool });
      return collectHydratedMemberKeys(hydrated).has(normalized);
    }) || null
  );
}

export function computeTeamRosterStats(team, players = []) {
  const hydrated = hydrateTeamRoster({ team, athletePool: players });
  return computeHydratedRosterStats(hydrated);
}

export function getTeamRosterWarnings(team, teamData, players = []) {
  const stats = computeTeamRosterStats(team, players);
  const disciplines = teamData?.disciplines || [];
  const allowReuse = teamData?.settings?.allowPlayerReusePerMatchup === true;

  const maleDisciplines = disciplines.filter(
    (discipline) => discipline.genderRequirement === GENDER_REQUIREMENT.MALE
  );
  const femaleDisciplines = disciplines.filter(
    (discipline) => discipline.genderRequirement === GENDER_REQUIREMENT.FEMALE
  );
  const mixedDisciplines = disciplines.filter(
    (discipline) => discipline.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR
  );

  const requiredMales = allowReuse
    ? Math.max(
        0,
        ...maleDisciplines.map((discipline) => discipline.playerCount),
        mixedDisciplines.length > 0 ? 1 : 0
      )
    : maleDisciplines.reduce((sum, discipline) => sum + discipline.playerCount, 0) +
      mixedDisciplines.length;

  const requiredFemales = allowReuse
    ? Math.max(
        0,
        ...femaleDisciplines.map((discipline) => discipline.playerCount),
        mixedDisciplines.length > 0 ? 1 : 0
      )
    : femaleDisciplines.reduce((sum, discipline) => sum + discipline.playerCount, 0) +
      mixedDisciplines.length;

  const warnings = [];

  if (requiredMales > 0 && stats.males < requiredMales) {
    warnings.push(
      `Thiếu VĐV nam: cần tối thiểu ${requiredMales}, hiện có ${stats.males}.`
    );
  }

  if (requiredFemales > 0 && stats.females < requiredFemales) {
    warnings.push(
      `Thiếu VĐV nữ: cần tối thiểu ${requiredFemales}, hiện có ${stats.females}.`
    );
  }

  return warnings;
}

export function validateMlpRoster(team, players = [], teamData) {
  if (!isMlpFormat(teamData)) {
    return { ok: true };
  }

  const rules = teamData.settings?.rosterRules || {
    minPlayers: 4,
    maxPlayers: 4,
    requiredMales: 2,
    requiredFemales: 2,
  };

  const stats = computeTeamRosterStats(team, players);
  const errors = [];

  if (stats.total > rules.maxPlayers) {
    errors.push(`MLP cho phép tối đa ${rules.maxPlayers} VĐV/đội.`);
  }

  if (stats.males > rules.requiredMales) {
    errors.push(`MLP chỉ cho phép ${rules.requiredMales} VĐV nam.`);
  }

  if (stats.females > rules.requiredFemales) {
    errors.push(`MLP chỉ cho phép ${rules.requiredFemales} VĐV nữ.`);
  }

  if (stats.total === rules.maxPlayers) {
    if (stats.males !== rules.requiredMales || stats.females !== rules.requiredFemales) {
      errors.push(
        `MLP yêu cầu đúng ${rules.requiredMales} nam + ${rules.requiredFemales} nữ (hiện ${stats.males} nam, ${stats.females} nữ).`
      );
    }
  }

  return errors.length > 0 ? { ok: false, error: errors[0], errors } : { ok: true };
}

export function validateAddPlayerToTeam(teamData, teamId, playerId, players = []) {
  const team = findTeam(teamData, teamId);
  if (!team) {
    return { ok: false, error: "Không tìm thấy đội." };
  }

  const normalized = normalizePlayerId(playerId);
  if (!normalized) {
    return { ok: false, error: "Thiếu VĐV." };
  }

  if (team.playerIds.includes(normalized)) {
    return { ok: false, error: "VĐV đã có trong đội." };
  }

  const allowCrossTeam = teamData.settings?.allowPlayerCrossTeam === true;
  const existingTeam = findPlayerTeam(teamData, normalized);
  if (existingTeam && existingTeam.id !== team.id && !allowCrossTeam) {
    return {
      ok: false,
      error: `VĐV đã thuộc đội ${existingTeam.name}.`,
    };
  }

  const nextTeam = { ...team, playerIds: [...team.playerIds, normalized] };
  const mlpCheck = validateMlpRoster(nextTeam, players, teamData);
  if (!mlpCheck.ok) {
    return mlpCheck;
  }

  return { ok: true, team, playerId: normalized };
}

export function validateRemovePlayerFromTeam(team, playerId) {
  const normalized = normalizePlayerId(playerId);
  if (!team) {
    return { ok: false, error: "Không tìm thấy đội." };
  }

  if (!team.playerIds.includes(normalized)) {
    return { ok: false, error: "VĐV không thuộc đội." };
  }

  if (team.captainPlayerId === normalized) {
    return {
      ok: false,
      error: "Không thể xóa đội trưởng. Hãy chỉ định đội trưởng mới trước.",
    };
  }

  return { ok: true, playerId: normalized };
}

export function validateAssignCaptain(team, playerId) {
  const normalized = normalizePlayerId(playerId);
  if (!team) {
    return { ok: false, error: "Không tìm thấy đội." };
  }

  if (!normalized) {
    return { ok: false, error: "Chọn đội trưởng." };
  }

  if (!team.playerIds.includes(normalized)) {
    return {
      ok: false,
      error: "Đội trưởng phải là thành viên của đội.",
    };
  }

  return { ok: true, playerId: normalized };
}

export function validateAssignDeputies(team, deputyPlayerIds = []) {
  if (!team) {
    return { ok: false, error: "Không tìm thấy đội." };
  }

  const normalized = [...new Set(deputyPlayerIds.map(normalizePlayerId).filter(Boolean))];
  const invalid = normalized.filter((playerId) => !team.playerIds.includes(playerId));

  if (invalid.length > 0) {
    return { ok: false, error: "Đội phó phải là thành viên của đội." };
  }

  if (normalized.includes(team.captainPlayerId)) {
    return { ok: false, error: "Đội trưởng không thể là đội phó." };
  }

  return { ok: true, deputyPlayerIds: normalized };
}

export function addPlayerToTeam(teamData, teamId, playerId, players = []) {
  const validation = validateAddPlayerToTeam(teamData, teamId, playerId, players);
  if (!validation.ok) {
    return validation;
  }

  const team = validation.team;

  return {
    ok: true,
    teamData: updateTeamInTournament(teamData, teamId, {
      playerIds: [...team.playerIds, validation.playerId],
    }),
    playerId: validation.playerId,
    teamId,
  };
}

export function removePlayerFromTeam(teamData, teamId, playerId) {
  const team = findTeam(teamData, teamId);
  const validation = validateRemovePlayerFromTeam(team, playerId);
  if (!validation.ok) {
    return validation;
  }

  const nextPlayerIds = team.playerIds.filter(
    (id) => id !== validation.playerId
  );
  const nextDeputies = (team.deputyPlayerIds || []).filter(
    (id) => id !== validation.playerId
  );

  return {
    ok: true,
    teamData: updateTeamInTournament(teamData, teamId, {
      playerIds: nextPlayerIds,
      deputyPlayerIds: nextDeputies,
    }),
    playerId: validation.playerId,
    teamId,
  };
}

export function assignTeamCaptain(teamData, teamId, playerId) {
  const team = findTeam(teamData, teamId);
  const validation = validateAssignCaptain(team, playerId);
  if (!validation.ok) {
    return validation;
  }

  const previousCaptainId = team.captainPlayerId || "";
  const nextDeputies = (team.deputyPlayerIds || []).filter(
    (id) => id !== validation.playerId
  );

  return {
    ok: true,
    teamData: updateTeamInTournament(teamData, teamId, {
      captainPlayerId: validation.playerId,
      deputyPlayerIds: nextDeputies,
    }),
    playerId: validation.playerId,
    previousCaptainId,
    teamId,
    changed: previousCaptainId !== validation.playerId,
  };
}

export function assignTeamDeputies(teamData, teamId, deputyPlayerIds = []) {
  const team = findTeam(teamData, teamId);
  const validation = validateAssignDeputies(team, deputyPlayerIds);
  if (!validation.ok) {
    return validation;
  }

  return {
    ok: true,
    teamData: updateTeamInTournament(teamData, teamId, {
      deputyPlayerIds: validation.deputyPlayerIds,
    }),
    deputyPlayerIds: validation.deputyPlayerIds,
    teamId,
  };
}

export function updateTeamProfile(teamData, teamId, patch = {}) {
  const team = findTeam(teamData, teamId);
  if (!team) {
    return { ok: false, error: "Không tìm thấy đội." };
  }

  const nextPatch = { ...patch };
  if (nextPatch.name != null) {
    const trimmed = String(nextPatch.name).trim();
    if (!trimmed) {
      return { ok: false, error: "Tên đội không được để trống." };
    }
    nextPatch.name = trimmed;
  }

  return {
    ok: true,
    teamData: updateTeamInTournament(teamData, teamId, nextPatch),
    teamId,
  };
}

export function getVisibleTeams(
  teamData,
  { canManage = false, canViewAll = false, viewerPlayerId = null } = {}
) {
  const teams = teamData?.teams || [];
  if (canManage || canViewAll) {
    return teams;
  }

  if (!viewerPlayerId) {
    return [];
  }

  return teams.filter((team) => {
    if (team.captainPlayerId === String(viewerPlayerId)) {
      return true;
    }
    return (team.deputyPlayerIds || []).includes(String(viewerPlayerId));
  });
}
