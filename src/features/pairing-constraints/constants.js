export const CONSTRAINT_TYPE = Object.freeze({
  PREFER_PARTNER: "prefer_partner",
  AVOID_PARTNER: "avoid_partner",
  AVOID_SAME_GROUP: "avoid_same_group",
});

export const CONSTRAINT_MODE = Object.freeze({
  HARD: "hard",
  SOFT: "soft",
});

export const CONSTRAINT_TYPE_LABELS = Object.freeze({
  [CONSTRAINT_TYPE.PREFER_PARTNER]: "Ưu tiên cùng cặp/đội",
  [CONSTRAINT_TYPE.AVOID_PARTNER]: "Tránh cùng cặp/đội",
  [CONSTRAINT_TYPE.AVOID_SAME_GROUP]: "Tránh cùng bảng",
});

export const CONSTRAINT_SCORE = Object.freeze({
  preferMatchBonus: 120,
  preferMissPenalty: 40,
  avoidViolationPenalty: 200,
  groupAvoidPenalty: 250,
});
