import { AI_CONFIG } from "../ai/config.js";

export function getRuleLabel(rule = {}) {
  if (rule.type === "team_level_diff_limit") {
    return "Giới hạn chênh lệch level";
  }

  if (rule.type === "max_partner_repeat") {
    return "Giới hạn lặp đồng đội";
  }

  if (rule.type === "max_opponent_repeat") {
    return "Giới hạn lặp đối thủ";
  }

  return rule.type || "Rule tùy chỉnh";
}

export function getRuleTooltip(rule = {}) {
  if (rule.type === "team_level_diff_limit") {
    const defaults = AI_CONFIG.ruleDefaults.team_level_diff_limit;
    return `Không cho chênh level vượt ${rule.maxDiff ?? defaults.maxDiff}. Penalty: ${rule.penalty ?? defaults.penalty}.`;
  }

  if (rule.type === "max_partner_repeat") {
    const defaults = AI_CONFIG.ruleDefaults.max_partner_repeat;
    return `Không cho 2 người làm đồng đội quá ${rule.maxTimes ?? defaults.maxTimes} lần. Penalty: ${rule.penalty ?? defaults.penalty}.`;
  }

  if (rule.type === "max_opponent_repeat") {
    const defaults = AI_CONFIG.ruleDefaults.max_opponent_repeat;
    return `Không cho 2 người gặp nhau quá ${rule.maxTimes ?? defaults.maxTimes} lần. Penalty: ${rule.penalty ?? defaults.penalty}.`;
  }

  return "Rule do CLB cấu hình.";
}

export function getPolicyTooltip(policy = {}) {
  if (policy.type === "prefer_teammate") {
    return `Ưu tiên 2 người chơi cùng đội (+${AI_CONFIG.scoring.preferTeammateBonus}), trừ điểm nếu bị xếp đối đầu (-${AI_CONFIG.scoring.preferTeammatePenalty}).`;
  }

  return "Policy do Director cấu hình.";
}

export function countEnabledItems(items = []) {
  return items.filter((item) => item?.enabled !== false).length;
}

export function buildLockToggleState(lockedIds = [], id) {
  const isLocked = lockedIds.includes(id);

  if (isLocked) {
    return {
      isLocked: false,
      nextLockedIds: lockedIds.filter((item) => item !== id),
    };
  }

  return {
    isLocked: true,
    nextLockedIds: [...lockedIds, id],
  };
}
