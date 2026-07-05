import { getPlayerGenderKey } from "../../../models/player.js";
import {
  DISCIPLINE_CATEGORY,
  GENDER_REQUIREMENT,
} from "../constants.js";
import { findTeam } from "../models/index.js";

function playerMap(players = []) {
  return new Map(players.map((player) => [String(player.id), player]));
}

function isPlayerAvailable(team, playerId) {
  const absent = new Set((team.absentPlayerIds || []).map(String));
  const locked = new Set((team.lockedPlayerIds || []).map(String));
  return !absent.has(String(playerId)) && !locked.has(String(playerId));
}

function validateGenderRequirement(playerIds, playersById, requirement) {
  const members = playerIds
    .map((id) => playersById.get(String(id)))
    .filter(Boolean);

  if (members.length !== playerIds.length) {
    return "Có VĐV không tồn tại trong danh sách.";
  }

  if (requirement === GENDER_REQUIREMENT.MALE) {
    return members.every((player) => getPlayerGenderKey(player.gender) === "male")
      ? null
      : "Nội dung yêu cầu VĐV nam.";
  }

  if (requirement === GENDER_REQUIREMENT.FEMALE) {
    return members.every((player) => getPlayerGenderKey(player.gender) === "female")
      ? null
      : "Nội dung yêu cầu VĐV nữ.";
  }

  if (requirement === GENDER_REQUIREMENT.MIXED_PAIR) {
    const males = members.filter((player) => getPlayerGenderKey(player.gender) === "male");
    const females = members.filter((player) => getPlayerGenderKey(player.gender) === "female");
    return members.length === 2 && males.length === 1 && females.length === 1
      ? null
      : "Nội dung mixed cần 1 nam + 1 nữ.";
  }

  return null;
}

export function validateDisciplineSelection({
  team,
  discipline,
  playerIds,
  players = [],
  usedPlayerIds = new Set(),
  allowReuse = false,
  partial = false,
}) {
  if (!team || !discipline) {
    return { ok: false, error: "Thiếu đội hoặc nội dung thi đấu." };
  }

  const normalizedIds = playerIds.map((id) => String(id).trim()).filter(Boolean);
  const expectedCount = discipline.playerCount;

  if (normalizedIds.length === 0) {
    return partial
      ? { ok: true, playerIds: [] }
      : { ok: false, error: `${discipline.name} cần ${expectedCount} VĐV.` };
  }

  if (partial && normalizedIds.length > expectedCount) {
    return {
      ok: false,
      error: `${discipline.name}: tối đa ${expectedCount} VĐV.`,
    };
  }

  if (!partial && normalizedIds.length !== expectedCount) {
    return {
      ok: false,
      error: `${discipline.name} cần ${expectedCount} VĐV.`,
    };
  }

  const uniqueIds = new Set(normalizedIds);
  if (uniqueIds.size !== normalizedIds.length) {
    return { ok: false, error: `${discipline.name}: không được trùng VĐV.` };
  }

  for (const playerId of normalizedIds) {
    if (!team.playerIds.includes(playerId)) {
      return {
        ok: false,
        error: `${discipline.name}: VĐV ${playerId} không thuộc đội.`,
      };
    }

    if (!isPlayerAvailable(team, playerId)) {
      return {
        ok: false,
        error: `${discipline.name}: VĐV ${playerId} vắng mặt hoặc bị khóa.`,
      };
    }

    if (!allowReuse && usedPlayerIds.has(playerId)) {
      return {
        ok: false,
        error: `${discipline.name}: VĐV ${playerId} đã được chọn ở nội dung khác.`,
      };
    }
  }

  const playersById = playerMap(players);
  const shouldValidateGender = !partial || normalizedIds.length === expectedCount;

  if (shouldValidateGender) {
    const genderError = validateGenderRequirement(
      normalizedIds,
      playersById,
      discipline.genderRequirement
    );

    if (genderError) {
      return { ok: false, error: `${discipline.name}: ${genderError}` };
    }

    if (
      discipline.categoryType === DISCIPLINE_CATEGORY.MIXED &&
      discipline.genderRequirement === GENDER_REQUIREMENT.ANY
    ) {
      const mixedError = validateGenderRequirement(
        normalizedIds,
        playersById,
        GENDER_REQUIREMENT.MIXED_PAIR
      );
      if (mixedError) {
        return { ok: false, error: `${discipline.name}: ${mixedError}` };
      }
    }
  }

  return { ok: true, playerIds: normalizedIds };
}

export function validateLineupSelections({
  teamData,
  teamId,
  selections = {},
  players = [],
  partial = false,
}) {
  const team = findTeam(teamData, teamId);
  if (!team) {
    return { ok: false, error: "Không tìm thấy đội." };
  }

  const allowReuse = teamData.settings?.allowPlayerReusePerMatchup === true;
  const usedPlayerIds = new Set();
  const errors = [];
  const normalizedSelections = {};

  for (const discipline of teamData.disciplines) {
    const playerIds = selections[discipline.id] || [];
    const result = validateDisciplineSelection({
      team,
      discipline,
      playerIds,
      players,
      usedPlayerIds,
      allowReuse,
      partial,
    });

    if (!result.ok) {
      errors.push(result.error);
      continue;
    }

    result.playerIds.forEach((playerId) => usedPlayerIds.add(playerId));
    normalizedSelections[discipline.id] = result.playerIds;
  }

  return {
    ok: errors.length === 0,
    errors,
    selections: normalizedSelections,
  };
}

export function filterEligiblePlayersForDiscipline({
  team,
  discipline,
  players = [],
  usedPlayerIds = new Set(),
  allowReuse = false,
}) {
  if (!team || !discipline) {
    return [];
  }

  const playersById = playerMap(players);
  const absent = new Set((team.absentPlayerIds || []).map(String));
  const locked = new Set((team.lockedPlayerIds || []).map(String));

  return team.playerIds
    .map((id) => playersById.get(String(id)))
    .filter(Boolean)
    .filter((player) => !absent.has(String(player.id)) && !locked.has(String(player.id)))
    .filter((player) => {
      if (allowReuse || !usedPlayerIds.has(String(player.id))) {
        return true;
      }
      return false;
    })
    .filter((player) => {
      const genderKey = getPlayerGenderKey(player.gender);
      if (discipline.genderRequirement === GENDER_REQUIREMENT.MALE) {
        return genderKey === "male";
      }
      if (discipline.genderRequirement === GENDER_REQUIREMENT.FEMALE) {
        return genderKey === "female";
      }
      if (
        discipline.categoryType === DISCIPLINE_CATEGORY.MIXED ||
        discipline.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR
      ) {
        return genderKey === "male" || genderKey === "female";
      }
      return true;
    });
}
