import { GENDER_REQUIREMENT } from "../../team-tournament/constants.js";
import { getPlayerGenderKey } from "../../../models/player.js";

/**
 * Validate a lineup selections candidate against format invariants.
 *
 * @param {object} input
 * @param {Record<string, string[]>} input.selections
 * @param {Array} input.disciplines
 * @param {object} input.team
 * @param {Map<string, object>|Record<string, object>} input.playersById
 * @param {boolean} [input.allowReuse]
 * @param {Set<string>|string[]} [input.lockedPlayerIds]
 * @returns {{ ok: boolean, rejectionCodes: string[], errors: string[] }}
 */
export function validateLineupStructure(input = {}) {
  const {
    selections = {},
    disciplines = [],
    team = null,
    playersById = {},
    allowReuse = false,
  } = input;

  const rejectionCodes = [];
  const errors = [];
  const getPlayer = (id) =>
    playersById instanceof Map
      ? playersById.get(String(id))
      : playersById[String(id)];

  if (!team) {
    return {
      ok: false,
      rejectionCodes: ["TEAM_REQUIRED"],
      errors: ["Thiếu đội."],
    };
  }

  const teamSet = new Set((team.playerIds || []).map(String));
  const absent = new Set(
    [
      ...(team.absentPlayerIds || []),
      ...(team.lockedPlayerIds || []),
      ...(team.suspendedPlayerIds || []),
    ].map(String)
  );
  const used = new Set();

  for (const discipline of disciplines) {
    const disciplineId = String(discipline.id);
    const playerIds = (selections[disciplineId] || []).map(String);
    const need = Math.max(1, Number(discipline.playerCount) || 1);

    if (playerIds.length !== need) {
      rejectionCodes.push("WRONG_PLAYER_COUNT");
      errors.push(`${discipline.name || disciplineId}: sai số VĐV.`);
      continue;
    }

    if (new Set(playerIds).size !== playerIds.length) {
      rejectionCodes.push("DUPLICATE_SLOT");
      errors.push(`${discipline.name || disciplineId}: trùng VĐV trong slot.`);
    }

    for (const playerId of playerIds) {
      if (!teamSet.has(playerId)) {
        rejectionCodes.push("PLAYER_NOT_ON_TEAM");
        errors.push(`${discipline.name || disciplineId}: VĐV không thuộc đội.`);
      }
      if (absent.has(playerId)) {
        rejectionCodes.push("PLAYER_INELIGIBLE");
        errors.push(`${discipline.name || disciplineId}: VĐV không đủ điều kiện.`);
      }
      const player = getPlayer(playerId);
      if (!player) {
        rejectionCodes.push("PLAYER_MISSING");
        errors.push(`${discipline.name || disciplineId}: thiếu dữ liệu VĐV.`);
        continue;
      }
      if (!matchesGender(player, discipline.genderRequirement)) {
        rejectionCodes.push("GENDER_MISMATCH");
        errors.push(`${discipline.name || disciplineId}: sai giới tính.`);
      }
      if (!allowReuse && used.has(playerId)) {
        rejectionCodes.push("PLAYER_REUSE");
        errors.push(`${discipline.name || disciplineId}: VĐV đã dùng ở nội dung khác.`);
      }
      used.add(playerId);
    }

    if (discipline.genderRequirement === GENDER_REQUIREMENT.MIXED_PAIR && need >= 2) {
      const genders = playerIds.map((id) => getPlayerGenderKey(getPlayer(id)?.gender));
      if (!(genders.includes("male") && genders.includes("female"))) {
        rejectionCodes.push("MIXED_PAIR_REQUIRED");
        errors.push(`${discipline.name || disciplineId}: cần 1 nam + 1 nữ.`);
      }
    }
  }

  return {
    ok: rejectionCodes.length === 0,
    rejectionCodes: [...new Set(rejectionCodes)],
    errors,
  };
}

function matchesGender(player, requirement) {
  const gender = getPlayerGenderKey(player?.gender);
  if (requirement === GENDER_REQUIREMENT.MALE) return gender === "male";
  if (requirement === GENDER_REQUIREMENT.FEMALE) return gender === "female";
  return true;
}

/**
 * Clone selections map immutably.
 * @param {Record<string, string[]>} selections
 */
export function cloneLineupSelections(selections = {}) {
  const next = {};
  for (const [key, value] of Object.entries(selections || {})) {
    next[String(key)] = [...(value || [])].map(String);
  }
  return next;
}
