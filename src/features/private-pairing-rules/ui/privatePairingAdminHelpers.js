import {
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
  PRIVATE_PAIRING_SCOPE,
  REASON_CATEGORY,
  RELATION_MODE,
  RULE_PRIORITY,
  RULE_VISIBILITY,
} from "../index.js";

export const CONSTRAINT_TYPE_LABELS = Object.freeze({
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER]: "Ưu tiên đôi cùng",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER]: "Bắt buộc đôi cùng",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER]: "Tránh đôi cùng",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER]: "Không được đôi cùng",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_OPPONENT]: "Ưu tiên đối thủ",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_OPPONENT]: "Bắt buộc đối thủ",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT]: "Tránh đối thủ",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT]: "Không được đối thủ",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT]: "Giới hạn lặp đôi",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT]: "Giới hạn lặp đối thủ",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_PARTNER_REPEAT]: "Tối thiểu lặp đôi",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_OPPONENT_REPEAT]: "Tối thiểu lặp đối thủ",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_GROUP]: "Cùng bảng",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP]: "Khác bảng",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_TEAM]: "Cùng đội",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_TEAM]: "Khác đội",
});

export const SCOPE_LABELS = Object.freeze({
  [PRIVATE_PAIRING_SCOPE.GLOBAL]: "Toàn hệ thống",
  [PRIVATE_PAIRING_SCOPE.TENANT]: "Tenant",
  [PRIVATE_PAIRING_SCOPE.CLUB]: "CLB",
  [PRIVATE_PAIRING_SCOPE.VENUE]: "Sân / Venue",
  [PRIVATE_PAIRING_SCOPE.TOURNAMENT]: "Giải",
  [PRIVATE_PAIRING_SCOPE.TOURNAMENT_EVENT]: "Nội dung giải",
  [PRIVATE_PAIRING_SCOPE.DAILY_PLAY_SESSION]: "Daily Play",
  [PRIVATE_PAIRING_SCOPE.ROUND]: "Vòng",
  [PRIVATE_PAIRING_SCOPE.MATCH_DAY]: "Ngày thi đấu",
});

export const SEVERITY_OPTIONS = [
  { value: "hard", label: "Hard" },
  { value: "soft", label: "Soft" },
];

export const STATUS_CHIP_COLOR = Object.freeze({
  draft: "default",
  active: "success",
  archived: "warning",
});

export function playerLabel(playersById, id) {
  if (!id) return "—";
  const p = playersById.get(String(id));
  return p?.name ? `${p.name} (${id})` : String(id);
}

export function filterRules(rules, filters = {}) {
  const q = String(filters.search || "").trim().toLowerCase();
  return (rules || []).filter((rule) => {
    if (filters.severity && String(rule.severity) !== filters.severity) return false;
    if (filters.constraintType && String(rule.constraintType) !== filters.constraintType) {
      return false;
    }
    if (filters.activeOnly && rule.active === false) return false;
    if (filters.primaryPlayerId && String(rule.primaryPlayerId) !== String(filters.primaryPlayerId)) {
      return false;
    }
    if (!q) return true;
    const hay = [
      rule.primaryPlayerId,
      rule.constraintType,
      CONSTRAINT_TYPE_LABELS[rule.constraintType],
      ...(rule.targetPlayerIds || []),
      rule.reasonText,
      rule.id,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export function filterRuleSets(ruleSets, filters = {}) {
  const q = String(filters.search || "").trim().toLowerCase();
  return (ruleSets || []).filter((rs) => {
    if (filters.status && String(rs.status) !== filters.status) return false;
    if (filters.scopeType && String(rs.scope_type || rs.scopeType) !== filters.scopeType) {
      return false;
    }
    if (!q) return true;
    const hay = [rs.name, rs.id, rs.scope_id || rs.scopeId, rs.description]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

export const REASON_CATEGORY_OPTIONS = Object.values(REASON_CATEGORY);
export const RELATION_MODE_OPTIONS = Object.values(RELATION_MODE);
export const VISIBILITY_OPTIONS = Object.values(RULE_VISIBILITY);
export const PRIORITY_OPTIONS = Object.values(RULE_PRIORITY);
export const SCOPE_OPTIONS = Object.values(PRIVATE_PAIRING_SCOPE);
export const CONSTRAINT_TYPE_OPTIONS = Object.values(PRIVATE_PAIRING_CONSTRAINT_TYPE);

export function emptyRuleDraft() {
  return {
    primaryPlayerId: "",
    constraintType: PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER,
    severity: "hard",
    weight: "",
    priority: RULE_PRIORITY.MEDIUM,
    relationMode: RELATION_MODE.ANY_OF,
    targetPlayerIds: [],
    reasonCategory: REASON_CATEGORY.OTHER,
    reasonText: "",
    visibility: RULE_VISIBILITY.PRIVATE,
    startAt: "",
    endAt: "",
    reason: "",
  };
}
