import {
  ACTIVATION_RULE,
  DISCIPLINE_KIND,
  FORMAT_PRESET,
  GENDER_REQUIREMENT,
  SCORING_SYSTEM,
} from "../constants.js";
import { DISCIPLINE_CATEGORY } from "../constants.js";
import { createDisciplineRecord } from "../models/index.js";

export const MLP_REGULATIONS_BODY = `GIẢI ĐỒNG ĐỘI PICKLEBALL MLP 4 NGƯỜI

I. Đội hình: Mỗi đội đúng 4 VĐV (2 nam + 2 nữ). Mỗi VĐV đánh đúng 2 trận đôi trong một lượt trận (1 đồng giới + 1 mixed).

II. Lượt trận (Tie): 4 trận đôi theo thứ tự — Đôi nữ → Đôi nam → Đôi nam nữ 1 → Đôi nam nữ 2. Nếu hòa 2-2: Dreambreaker (đơn luân lưu).

III. Ghi điểm: Rally Scoring đến 21, thắng cách 2 điểm. Đổi sân khi một đội đạt 11 điểm (trận đôi) hoặc tổng điểm 20 (Dreambreaker). Freeze @20: đội dẫn 20 chỉ ghi điểm 21 khi đang giao bóng và thắng rally.

IV. Đội hình kín: Nộp chậm nhất 15 phút trước giờ thi đấu. Cặp mixed giữ kín đến khi BTC công bố.

V. Chấn thương: Trận đôi — thua trận, tỷ số giữ nguyên, đối thủ cộng tối đa lên 21. Dreambreaker — VĐV tiếp theo trong thứ tự thay thế.`;

const MLP_RALLY_SCORING = {
  scoringSystem: SCORING_SYSTEM.RALLY,
  matchFormat: "rally_single",
  targetScore: 21,
  winBy: 2,
  freezeAt: 20,
  sideSwitchAt: 11,
  winPoints: 1,
};

const MLP_DREAMBREAKER_SCORING = {
  ...MLP_RALLY_SCORING,
  sideSwitchAt: 20,
  rotationPoints: 4,
};

export function createMlpDisciplines() {
  return [
    createDisciplineRecord({
      name: "Đôi nữ",
      categoryType: DISCIPLINE_CATEGORY.DOUBLES,
      genderRequirement: GENDER_REQUIREMENT.FEMALE,
      playerCount: 2,
      sortOrder: 1,
      disciplineKind: DISCIPLINE_KIND.DOUBLES,
      activationRule: ACTIVATION_RULE.ALWAYS,
      scoringFormat: { ...MLP_RALLY_SCORING },
    }),
    createDisciplineRecord({
      name: "Đôi nam",
      categoryType: DISCIPLINE_CATEGORY.DOUBLES,
      genderRequirement: GENDER_REQUIREMENT.MALE,
      playerCount: 2,
      sortOrder: 2,
      disciplineKind: DISCIPLINE_KIND.DOUBLES,
      activationRule: ACTIVATION_RULE.ALWAYS,
      scoringFormat: { ...MLP_RALLY_SCORING },
    }),
    createDisciplineRecord({
      name: "Đôi nam nữ 1",
      categoryType: DISCIPLINE_CATEGORY.MIXED,
      genderRequirement: GENDER_REQUIREMENT.MIXED_PAIR,
      playerCount: 2,
      sortOrder: 3,
      disciplineKind: DISCIPLINE_KIND.DOUBLES,
      activationRule: ACTIVATION_RULE.ALWAYS,
      scoringFormat: { ...MLP_RALLY_SCORING },
    }),
    createDisciplineRecord({
      name: "Đôi nam nữ 2",
      categoryType: DISCIPLINE_CATEGORY.MIXED,
      genderRequirement: GENDER_REQUIREMENT.MIXED_PAIR,
      playerCount: 2,
      sortOrder: 4,
      disciplineKind: DISCIPLINE_KIND.DOUBLES,
      activationRule: ACTIVATION_RULE.ALWAYS,
      scoringFormat: { ...MLP_RALLY_SCORING },
    }),
    createDisciplineRecord({
      name: "Dreambreaker",
      categoryType: DISCIPLINE_CATEGORY.SINGLES,
      genderRequirement: GENDER_REQUIREMENT.ANY,
      playerCount: 1,
      sortOrder: 5,
      disciplineKind: DISCIPLINE_KIND.DREAMBREAKER,
      activationRule: ACTIVATION_RULE.TIE_AT_2_2,
      scoringFormat: { ...MLP_DREAMBREAKER_SCORING },
      countsTowardResult: true,
    }),
  ];
}

export function createMlpSettings(overrides = {}) {
  return {
    formatPreset: FORMAT_PRESET.MLP_4,
    rosterRules: {
      minPlayers: 4,
      maxPlayers: 4,
      requiredMales: 2,
      requiredFemales: 2,
    },
    allowPlayerReusePerMatchup: true,
    allowPlayerCrossTeam: false,
    dreambreakerEnabled: true,
    lineupLockLeadMinutes: 15,
    missingLineupPolicy: overrides.missingLineupPolicy || "random",
    tiebreakOrder: overrides.tiebreakOrder || [
      "wins",
      "subMatchDiff",
      "pointsScored",
      "manual",
    ],
    regulations: {
      templateId: "mlp_4",
      body: MLP_REGULATIONS_BODY,
    },
    ...overrides,
  };
}

export function createMlpPreset(options = {}) {
  return {
    disciplines: createMlpDisciplines(),
    settings: createMlpSettings(options.settings || {}),
    teams: options.teams || [],
    matchups: options.matchups || [],
  };
}

export function isMlpFormat(teamData) {
  return teamData?.settings?.formatPreset === FORMAT_PRESET.MLP_4;
}

export function getActiveMatchDisciplines(disciplines = []) {
  return disciplines.filter(
    (discipline) => discipline.activationRule !== ACTIVATION_RULE.TIE_AT_2_2
  );
}

export function getDreambreakerDiscipline(disciplines = []) {
  return (
    disciplines.find(
      (discipline) =>
        discipline.disciplineKind === DISCIPLINE_KIND.DREAMBREAKER ||
        discipline.activationRule === ACTIVATION_RULE.TIE_AT_2_2
    ) || null
  );
}

export function computeLineupLockAt(scheduledAt, leadMinutes = 15) {
  if (!scheduledAt) {
    return null;
  }
  const date = new Date(scheduledAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return new Date(date.getTime() - leadMinutes * 60 * 1000).toISOString();
}
