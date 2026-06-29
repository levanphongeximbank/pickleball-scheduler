const COMPETITION_DEFINITIONS = {
  open: {
    id: "open",
    label: "Giải Open",
    playersPerCourt: 4,
    teamSize: 2,
    minPlayers: 4,
    genderMode: "all",
    requiresMixedPairs: false,
  },
  singles_men: {
    id: "singles_men",
    label: "Đơn nam",
    playersPerCourt: 2,
    teamSize: 1,
    minPlayers: 2,
    genderMode: "male",
    requiresMixedPairs: false,
  },
  singles_women: {
    id: "singles_women",
    label: "Đơn nữ",
    playersPerCourt: 2,
    teamSize: 1,
    minPlayers: 2,
    genderMode: "female",
    requiresMixedPairs: false,
  },
  doubles_men: {
    id: "doubles_men",
    label: "Đôi nam",
    playersPerCourt: 4,
    teamSize: 2,
    minPlayers: 4,
    genderMode: "male",
    requiresMixedPairs: false,
  },
  doubles_women: {
    id: "doubles_women",
    label: "Đôi nữ",
    playersPerCourt: 4,
    teamSize: 2,
    minPlayers: 4,
    genderMode: "female",
    requiresMixedPairs: false,
  },
  doubles_mixed: {
    id: "doubles_mixed",
    label: "Đôi nam nữ",
    playersPerCourt: 4,
    teamSize: 2,
    minPlayers: 4,
    genderMode: "all",
    requiresMixedPairs: true,
  },
};

const DEFAULT_COMPETITION_TYPE = "open";

function normalizeGender(value) {
  const raw = String(value || "").trim().toLowerCase();

  if (["nam", "male", "m"].includes(raw)) {
    return "male";
  }

  if (["nữ", "nu", "female", "f"].includes(raw)) {
    return "female";
  }

  return "unknown";
}

export function getCompetitionTypeConfig(type) {
  return COMPETITION_DEFINITIONS[type] || COMPETITION_DEFINITIONS[DEFAULT_COMPETITION_TYPE];
}

export function getCompetitionTypeOptions() {
  return Object.values(COMPETITION_DEFINITIONS);
}

export function isPlayerEligibleForCompetition(player, competitionType) {
  const config = getCompetitionTypeConfig(competitionType);
  const normalizedGender = normalizeGender(player?.gender);

  if (config.genderMode === "male") {
    return normalizedGender === "male";
  }

  if (config.genderMode === "female") {
    return normalizedGender === "female";
  }

  return true;
}

export function getEligiblePlayersForCompetition(players = [], competitionType) {
  return players.filter((player) => isPlayerEligibleForCompetition(player, competitionType));
}

export function getGenderCounts(players = []) {
  return players.reduce(
    (acc, player) => {
      const gender = normalizeGender(player?.gender);
      if (gender === "male") {
        acc.male += 1;
      } else if (gender === "female") {
        acc.female += 1;
      } else {
        acc.unknown += 1;
      }
      return acc;
    },
    { male: 0, female: 0, unknown: 0 }
  );
}

export function validateCompetitionSelection(players = [], competitionType, options = {}) {
  const config = getCompetitionTypeConfig(competitionType);
  const errors = [];

  if (players.length < config.minPlayers) {
    errors.push(`Cần chọn ít nhất ${config.minPlayers} người cho ${config.label}.`);
  }

  const counts = getGenderCounts(players);

  if (config.requiresMixedPairs) {
    if (counts.male === 0 || counts.female === 0) {
      errors.push("Đôi nam nữ cần có cả nam và nữ trong danh sách được chọn.");
    }

    if (counts.male < 2 || counts.female < 2) {
      errors.push("Đôi nam nữ cần tối thiểu 2 nam và 2 nữ để tạo đủ 1 sân chuẩn.");
    }

    if ((counts.male + counts.female) < config.minPlayers) {
      errors.push("Một số người chơi chưa có giới tính hợp lệ cho giải đôi nam nữ.");
    }
  }

  const selectedCourtCount = Number(options.selectedCourtCount || 0);
  if (selectedCourtCount > 0 && config.requiresMixedPairs) {
    const requiredMale = selectedCourtCount * 2;
    const requiredFemale = selectedCourtCount * 2;

    if (counts.male < requiredMale || counts.female < requiredFemale) {
      errors.push(`Với ${selectedCourtCount} sân đôi nam nữ cần ít nhất ${requiredMale} nam và ${requiredFemale} nữ.`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    config,
    counts,
  };
}

export {
  COMPETITION_DEFINITIONS,
  DEFAULT_COMPETITION_TYPE,
  normalizeGender,
};
