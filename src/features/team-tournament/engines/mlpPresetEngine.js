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

/** Deterministic catalog / synthetic Dreambreaker identity. */
export const CANONICAL_DREAMBREAKER_DISCIPLINE_ID = "dreambreaker";

/** Stable MLP_4 discipline ids — must match team_tournament_create seed. */
export const CANONICAL_MLP_DISCIPLINE_IDS = Object.freeze({
  WOMEN_DOUBLES: "mlp-wd",
  MEN_DOUBLES: "mlp-md",
  MIXED_1: "mlp-xd1",
  MIXED_2: "mlp-xd2",
  DREAMBREAKER: CANONICAL_DREAMBREAKER_DISCIPLINE_ID,
});

export const CANONICAL_MLP_NORMAL_DISCIPLINE_NAMES = Object.freeze([
  "Đôi nữ",
  "Đôi nam",
  "Đôi nam nữ 1",
  "Đôi nam nữ 2",
]);

export function createCanonicalDreambreakerDiscipline() {
  return createDisciplineRecord({
    id: CANONICAL_DREAMBREAKER_DISCIPLINE_ID,
    name: "Dreambreaker",
    categoryType: DISCIPLINE_CATEGORY.SINGLES,
    genderRequirement: GENDER_REQUIREMENT.ANY,
    playerCount: 1,
    sortOrder: 5,
    disciplineKind: DISCIPLINE_KIND.DREAMBREAKER,
    activationRule: ACTIVATION_RULE.TIE_AT_2_2,
    scoringFormat: { ...MLP_DREAMBREAKER_SCORING },
    countsTowardResult: true,
  });
}

export function dreambreakerDisciplineMatchRank(discipline) {
  if (!discipline) {
    return 99;
  }
  const kind = String(discipline.disciplineKind || "").toLowerCase();
  const rule = String(discipline.activationRule || "").toLowerCase();
  const name = String(discipline.name || "").toLowerCase();
  const id = String(discipline.id || "").toLowerCase();
  if (kind === DISCIPLINE_KIND.DREAMBREAKER) {
    return 1;
  }
  if (rule === ACTIVATION_RULE.TIE_AT_2_2) {
    return 2;
  }
  if (rule === "dreambreaker") {
    return 3;
  }
  if (
    name.includes("dreambreaker") ||
    id.includes("dreambreaker") ||
    kind.includes("dreambreaker")
  ) {
    return 4;
  }
  return 99;
}

export function isDreambreakerCatalogDiscipline(discipline) {
  return dreambreakerDisciplineMatchRank(discipline) < 99;
}

/** Lineup / main-tie only. Do not treat generic singles as Dreambreaker. */
export function isExplicitDreambreakerDiscipline(discipline) {
  const name = String(discipline?.name || "").toLowerCase();
  const id = String(discipline?.id || "").toLowerCase();
  return (
    id === CANONICAL_DREAMBREAKER_DISCIPLINE_ID ||
    id.includes("dreambreaker") ||
    name.includes("dreambreaker")
  );
}

export function createMlpDisciplines() {
  return [
    createDisciplineRecord({
      id: CANONICAL_MLP_DISCIPLINE_IDS.WOMEN_DOUBLES,
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
      id: CANONICAL_MLP_DISCIPLINE_IDS.MEN_DOUBLES,
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
      id: CANONICAL_MLP_DISCIPLINE_IDS.MIXED_1,
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
      id: CANONICAL_MLP_DISCIPLINE_IDS.MIXED_2,
      name: "Đôi nam nữ 2",
      categoryType: DISCIPLINE_CATEGORY.MIXED,
      genderRequirement: GENDER_REQUIREMENT.MIXED_PAIR,
      playerCount: 2,
      sortOrder: 4,
      disciplineKind: DISCIPLINE_KIND.DOUBLES,
      activationRule: ACTIVATION_RULE.ALWAYS,
      scoringFormat: { ...MLP_RALLY_SCORING },
    }),
    createCanonicalDreambreakerDiscipline(),
  ];
}

export function createMlpSettings(overrides = {}) {
  return {
    formatPreset: FORMAT_PRESET.MLP_4,
    rosterRules: {
      teamSize: 4,
      minPlayers: 4,
      maxPlayers: 4,
      requiredMales: 2,
      requiredFemales: 2,
    },
    allowPlayerReusePerMatchup: true,
    allowPlayerCrossTeam: false,
    dreambreakerEnabled: true,
    lineupLockLeadMinutes: 15,
    groupMode: overrides.groupMode || "single_pool",
    groupCount: overrides.groupCount != null ? overrides.groupCount : 1,
    qualificationCount:
      overrides.qualificationCount != null ? overrides.qualificationCount : 2,
    knockoutFormat: overrides.knockoutFormat || "top_n",
    selectedCourtIds: Array.isArray(overrides.selectedCourtIds)
      ? overrides.selectedCourtIds
      : [],
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

/** Honest empty collections matching get_setup before domain rows exist. */
export function buildEmptyCanonicalSetupTeamData(settings = {}) {
  return {
    settings: settings && typeof settings === "object" ? { ...settings } : {},
    disciplines: [],
    teams: [],
    groups: [],
    matchups: [],
  };
}

/**
 * Adopt create RPC teamData when present. Never synthesize a richer catalog
 * than a subsequent canonical get_setup would return.
 */
export function adoptCanonicalCreateTeamData(rpcTeamData, settings = {}) {
  if (rpcTeamData && typeof rpcTeamData === "object" && Array.isArray(rpcTeamData.disciplines)) {
    return {
      settings:
        rpcTeamData.settings && typeof rpcTeamData.settings === "object"
          ? rpcTeamData.settings
          : settings || {},
      disciplines: rpcTeamData.disciplines,
      teams: Array.isArray(rpcTeamData.teams) ? rpcTeamData.teams : [],
      groups: Array.isArray(rpcTeamData.groups) ? rpcTeamData.groups : [],
      matchups: Array.isArray(rpcTeamData.matchups) ? rpcTeamData.matchups : [],
    };
  }
  return buildEmptyCanonicalSetupTeamData(settings);
}

export function isMlpFormat(teamData) {
  return teamData?.settings?.formatPreset === FORMAT_PRESET.MLP_4;
}

/** Activation-only catalog row — not an ordinary pre-match lineup slot. */
export function isActivationOnlyDreambreakerDiscipline(discipline) {
  const kind = String(discipline?.disciplineKind || "").toLowerCase();
  const rule = String(discipline?.activationRule || "").toLowerCase();
  return (
    kind === DISCIPLINE_KIND.DREAMBREAKER ||
    rule === ACTIVATION_RULE.TIE_AT_2_2 ||
    rule === "dreambreaker" ||
    isExplicitDreambreakerDiscipline(discipline)
  );
}

export function getActiveMatchDisciplines(disciplines = []) {
  return (Array.isArray(disciplines) ? disciplines : []).filter(
    (discipline) => !isActivationOnlyDreambreakerDiscipline(discipline)
  );
}

export function getDreambreakerDiscipline(disciplines = []) {
  const list = Array.isArray(disciplines) ? disciplines : [];
  const ranked = list
    .map((discipline) => ({
      discipline,
      rank: dreambreakerDisciplineMatchRank(discipline),
    }))
    .filter((row) => row.rank < 99)
    .sort(
      (left, right) =>
        left.rank - right.rank ||
        Number(left.discipline?.sortOrder || 0) - Number(right.discipline?.sortOrder || 0)
    );
  return ranked[0]?.discipline || null;
}

export function resolveDreambreakerDisciplineForStart(disciplines = []) {
  return getDreambreakerDiscipline(disciplines) || createCanonicalDreambreakerDiscipline();
}

/**
 * MLP teamData must expose exactly one Dreambreaker catalog row.
 * Does not invent doubles rows. Custom presets are left unchanged.
 */
export function ensureCanonicalMlpDisciplines(disciplines = [], teamData = null) {
  const list = Array.isArray(disciplines) ? [...disciplines] : [];
  const mlp =
    isMlpFormat(teamData) ||
    teamData?.settings?.formatPreset === FORMAT_PRESET.MLP_4;
  if (!mlp) {
    return list;
  }

  const dreambreakers = list.filter((item) => isDreambreakerCatalogDiscipline(item));
  const others = list.filter((item) => !isDreambreakerCatalogDiscipline(item));
  if (dreambreakers.length === 0) {
    return [...others, createCanonicalDreambreakerDiscipline()];
  }
  return [...others, dreambreakers[0]];
}

export function ensureCanonicalMlpTeamData(teamData) {
  if (!teamData || typeof teamData !== "object") {
    return teamData;
  }
  if (!isMlpFormat(teamData) && teamData.settings?.formatPreset !== FORMAT_PRESET.MLP_4) {
    return teamData;
  }
  return {
    ...teamData,
    settings: {
      ...(teamData.settings || {}),
      formatPreset: FORMAT_PRESET.MLP_4,
      dreambreakerEnabled: teamData.settings?.dreambreakerEnabled !== false,
    },
    disciplines: ensureCanonicalMlpDisciplines(teamData.disciplines, teamData),
  };
}

export function planCanonicalMlpDreambreakerPersist({ previous = {}, next = {} } = {}) {
  const ensuredNext = ensureCanonicalMlpTeamData(next);
  const dreambreaker = getDreambreakerDiscipline(ensuredNext?.disciplines);
  const previousDreambreaker = getDreambreakerDiscipline(previous?.disciplines);
  return {
    nextTeamData: ensuredNext,
    persistDreambreakerFirst: Boolean(dreambreaker && !previousDreambreaker),
    dreambreaker,
  };
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
