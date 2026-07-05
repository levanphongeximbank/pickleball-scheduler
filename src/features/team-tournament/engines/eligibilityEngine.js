import { getPlayerGenderKey, getPlayerRatingInternal } from "../../../models/player.js";
import { findTeam, normalizeTeamData } from "../models/index.js";

export const ELIGIBILITY_VIOLATION = {
  AGE_TOO_YOUNG: "age_too_young",
  AGE_TOO_OLD: "age_too_old",
  AGE_UNKNOWN: "age_unknown",
  GENDER_NOT_ALLOWED: "gender_not_allowed",
  SKILL_TOO_LOW: "skill_too_low",
  SKILL_TOO_HIGH: "skill_too_high",
};

export const DEFAULT_ELIGIBILITY_RULES = {
  age: { enabled: false, minAge: null, maxAge: null, asOfDate: null },
  gender: { enabled: false, allowedGenders: ["male", "female"] },
  skill: { enabled: false, minLevel: null, maxLevel: null },
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

export function normalizeEligibilityRules(rules = {}) {
  const age = rules.age && typeof rules.age === "object" ? rules.age : {};
  const gender = rules.gender && typeof rules.gender === "object" ? rules.gender : {};
  const skill = rules.skill && typeof rules.skill === "object" ? rules.skill : {};

  return {
    age: {
      enabled: age.enabled === true,
      minAge: Number.isFinite(Number(age.minAge)) ? Number(age.minAge) : null,
      maxAge: Number.isFinite(Number(age.maxAge)) ? Number(age.maxAge) : null,
      asOfDate: age.asOfDate ? String(age.asOfDate).trim() : null,
    },
    gender: {
      enabled: gender.enabled === true,
      allowedGenders: Array.isArray(gender.allowedGenders)
        ? gender.allowedGenders.map((value) => String(value).trim()).filter(Boolean)
        : [...DEFAULT_ELIGIBILITY_RULES.gender.allowedGenders],
    },
    skill: {
      enabled: skill.enabled === true,
      minLevel: Number.isFinite(Number(skill.minLevel)) ? Number(skill.minLevel) : null,
      maxLevel: Number.isFinite(Number(skill.maxLevel)) ? Number(skill.maxLevel) : null,
    },
  };
}

export function getEligibilityRules(teamData) {
  return normalizeEligibilityRules(teamData?.settings?.eligibilityRules || {});
}

export function updateEligibilityRules(teamData, patch = {}) {
  const current = getEligibilityRules(teamData);
  const next = normalizeEligibilityRules({
    age: { ...current.age, ...(patch.age || {}) },
    gender: { ...current.gender, ...(patch.gender || {}) },
    skill: { ...current.skill, ...(patch.skill || {}) },
  });

  return {
    ok: true,
    teamData: patchSettings(teamData, { eligibilityRules: next }),
    rules: next,
  };
}

export function getPlayerAge(player, asOfDate = null) {
  const birthYear = Number(player?.birthYear ?? player?.meta?.birthYear);
  if (!Number.isFinite(birthYear) || birthYear < 1900) {
    return null;
  }

  const reference = asOfDate ? new Date(asOfDate) : new Date();
  const year = reference.getFullYear();
  return Math.max(0, year - birthYear);
}

export function checkPlayerEligibility(player, rules, options = {}) {
  const normalized = normalizeEligibilityRules(rules);
  const violations = [];
  const asOfDate = options.asOfDate || normalized.age.asOfDate || null;

  if (normalized.age.enabled) {
    const age = getPlayerAge(player, asOfDate);
    if (age == null) {
      violations.push({
        code: ELIGIBILITY_VIOLATION.AGE_UNKNOWN,
        message: "Thiếu năm sinh để kiểm tra độ tuổi.",
      });
    } else {
      if (normalized.age.minAge != null && age < normalized.age.minAge) {
        violations.push({
          code: ELIGIBILITY_VIOLATION.AGE_TOO_YOUNG,
          message: `Tuổi ${age} nhỏ hơn mức tối thiểu ${normalized.age.minAge}.`,
        });
      }
      if (normalized.age.maxAge != null && age > normalized.age.maxAge) {
        violations.push({
          code: ELIGIBILITY_VIOLATION.AGE_TOO_OLD,
          message: `Tuổi ${age} vượt mức tối đa ${normalized.age.maxAge}.`,
        });
      }
    }
  }

  if (normalized.gender.enabled) {
    const genderKey = getPlayerGenderKey(player?.gender ?? player?.genderKey);
    if (!normalized.gender.allowedGenders.includes(genderKey)) {
      violations.push({
        code: ELIGIBILITY_VIOLATION.GENDER_NOT_ALLOWED,
        message: `Giới tính "${genderKey}" không được phép tham gia.`,
      });
    }
  }

  if (normalized.skill.enabled) {
    const level = getPlayerRatingInternal(player);
    if (normalized.skill.minLevel != null && level < normalized.skill.minLevel) {
      violations.push({
        code: ELIGIBILITY_VIOLATION.SKILL_TOO_LOW,
        message: `Trình độ ${level} thấp hơn mức tối thiểu ${normalized.skill.minLevel}.`,
      });
    }
    if (normalized.skill.maxLevel != null && level > normalized.skill.maxLevel) {
      violations.push({
        code: ELIGIBILITY_VIOLATION.SKILL_TOO_HIGH,
        message: `Trình độ ${level} vượt mức tối đa ${normalized.skill.maxLevel}.`,
      });
    }
  }

  return {
    ok: violations.length === 0,
    playerId: player?.id ? String(player.id) : "",
    playerName: player?.name || "",
    violations,
  };
}

export function checkTeamRosterEligibility(team, players = [], rules) {
  const playerMap = new Map(players.map((player) => [String(player.id), player]));
  const results = (team?.playerIds || []).map((playerId) => {
    const player = playerMap.get(String(playerId));
    if (!player) {
      return {
        ok: false,
        playerId: String(playerId),
        playerName: playerId,
        violations: [{ code: "player_not_found", message: "Không tìm thấy VĐV." }],
      };
    }
    return checkPlayerEligibility(player, rules);
  });

  return {
    ok: results.every((item) => item.ok),
    teamId: team?.id || "",
    teamName: team?.name || "",
    players: results,
  };
}

export function checkAllTeamsEligibility(teamData, players = []) {
  const rules = getEligibilityRules(teamData);
  const teams = (teamData?.teams || []).map((team) =>
    checkTeamRosterEligibility(team, players, rules)
  );

  return {
    ok: teams.every((team) => team.ok),
    rules,
    teams,
  };
}

export function listIneligiblePlayers(teamData, players = []) {
  const report = checkAllTeamsEligibility(teamData, players);
  const items = [];

  for (const team of report.teams) {
    for (const player of team.players) {
      if (!player.ok) {
        items.push({
          teamId: team.teamId,
          teamName: team.teamName,
          ...player,
        });
      }
    }
  }

  return items;
}

export function validateTeamEligibility(teamData, teamId, players = []) {
  const team = findTeam(teamData, teamId);
  if (!team) {
    return { ok: false, error: "Không tìm thấy đội." };
  }

  const result = checkTeamRosterEligibility(team, players, getEligibilityRules(teamData));
  return result.ok ? { ok: true, teamId, teamName: team.name } : { ...result, ok: false };
}
