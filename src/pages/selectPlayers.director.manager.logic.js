import { AI_CONFIG } from "../ai/config.js";

export const DIRECTOR_RULE_TYPES = [
  {
    id: "team_level_diff_limit",
    label: "Giới hạn chênh lệch level",
  },
  {
    id: "max_partner_repeat",
    label: "Giới hạn lặp đồng đội",
  },
  {
    id: "max_opponent_repeat",
    label: "Giới hạn lặp đối thủ",
  },
];

export const DIRECTOR_POLICY_TYPES = [
  {
    id: "prefer_teammate",
    label: "Ưu tiên cùng đội",
  },
];

export function buildDefaultRule(type) {
  const defaults = AI_CONFIG.ruleDefaults[type];

  if (!defaults) {
    return {
      type,
      enabled: true,
    };
  }

  return {
    type,
    enabled: true,
    ...defaults,
  };
}

export function buildDefaultPolicy(type, playerA, playerB) {
  if (type === "prefer_teammate") {
    return {
      type,
      playerA,
      playerB,
      enabled: true,
      priority: "HIGH",
      once: true,
    };
  }

  return {
    type,
    enabled: true,
    priority: "HIGH",
    once: true,
  };
}

export function formatPolicyLabel(policy = {}, players = []) {
  if (policy.type === "prefer_teammate") {
    const playerA = players.find((player) => player.id === policy.playerA);
    const playerB = players.find((player) => player.id === policy.playerB);

    if (playerA && playerB) {
      return `${playerA.name} + ${playerB.name}`;
    }
  }

  return policy.type || "Policy";
}

export function validatePolicyDraft({ type, playerA, playerB }) {
  if (type !== "prefer_teammate") {
    return null;
  }

  if (!playerA || !playerB) {
    return "Vui lòng chọn đủ 2 người cho policy ưu tiên cùng đội.";
  }

  if (playerA === playerB) {
    return "Hai người trong policy phải khác nhau.";
  }

  return null;
}
