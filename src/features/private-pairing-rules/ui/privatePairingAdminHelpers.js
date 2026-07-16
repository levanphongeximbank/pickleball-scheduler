import {
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
  PRIVATE_PAIRING_SCOPE,
  REASON_CATEGORY,
  RELATION_MODE,
  RULE_PRIORITY,
  RULE_VISIBILITY,
} from "../index.js";

export const CONSTRAINT_TYPE_LABELS = Object.freeze({
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER]: "Ưu tiên đứng cùng",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER]: "Bắt buộc đứng cùng",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER]: "Ưu tiên tránh đứng cùng",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER]: "Tuyệt đối không đứng cùng",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_OPPONENT]: "Ưu tiên đối đầu",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_OPPONENT]: "Bắt buộc đối đầu",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT]: "Ưu tiên tránh đối đầu",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT]: "Tuyệt đối không đối đầu",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT]: "Giới hạn lặp đứng cùng",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT]: "Giới hạn lặp đối đầu",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_PARTNER_REPEAT]: "Tối thiểu lặp đứng cùng",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_OPPONENT_REPEAT]: "Tối thiểu lặp đối đầu",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_GROUP]: "Cùng bảng",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP]: "Khác bảng",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_TEAM]: "Cùng đội",
  [PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_TEAM]: "Khác đội",
});

/** Grouped options for rule form UX. */
export const CONSTRAINT_TYPE_GROUPS = Object.freeze([
  {
    id: "partner",
    label: "Cùng đội",
    types: [
      PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_PARTNER,
      PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_PARTNER,
      PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_PARTNER,
      PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_PARTNER,
    ],
  },
  {
    id: "opponent",
    label: "Đối đầu",
    types: [
      PRIVATE_PAIRING_CONSTRAINT_TYPE.PREFER_OPPONENT,
      PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_OPPONENT,
      PRIVATE_PAIRING_CONSTRAINT_TYPE.AVOID_OPPONENT,
      PRIVATE_PAIRING_CONSTRAINT_TYPE.MUST_NOT_OPPONENT,
    ],
  },
  {
    id: "repeat",
    label: "Lặp lại",
    types: [
      PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_PARTNER_REPEAT,
      PRIVATE_PAIRING_CONSTRAINT_TYPE.MAX_OPPONENT_REPEAT,
      PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_PARTNER_REPEAT,
      PRIVATE_PAIRING_CONSTRAINT_TYPE.MIN_OPPONENT_REPEAT,
    ],
  },
  {
    id: "group",
    label: "Nhóm",
    types: [
      PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_GROUP,
      PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_GROUP,
    ],
  },
]);

/**
 * Types listed in Admin historically but not evaluated by private pairing hard/soft runtime.
 * Existing saved rules are kept; activate / create treat them as unsupported.
 * Competition Core may still define these — do not invent new private types here.
 */
export const RUNTIME_UNSUPPORTED_PRIVATE_CONSTRAINT_TYPES = Object.freeze([
  PRIVATE_PAIRING_CONSTRAINT_TYPE.SAME_TEAM,
  PRIVATE_PAIRING_CONSTRAINT_TYPE.DIFFERENT_TEAM,
]);

export const RUNTIME_UNSUPPORTED_PRIVATE_CONSTRAINT_TYPE_SET = new Set(
  RUNTIME_UNSUPPORTED_PRIVATE_CONSTRAINT_TYPES
);

/** Selectable types when creating a new rule (unsupported types excluded). */
export const CONSTRAINT_TYPE_OPTIONS_FOR_CREATE = Object.freeze(
  Object.values(PRIVATE_PAIRING_CONSTRAINT_TYPE).filter(
    (type) => !RUNTIME_UNSUPPORTED_PRIVATE_CONSTRAINT_TYPE_SET.has(type)
  )
);

export function isRuntimeUnsupportedPrivateConstraintType(constraintType) {
  return RUNTIME_UNSUPPORTED_PRIVATE_CONSTRAINT_TYPE_SET.has(String(constraintType || ""));
}

/**
 * @param {Array<{ constraintType?: string, active?: boolean }>} [rules]
 * @returns {Array<{ constraintType: string, label: string, message: string }>}
 */
export function listUnsupportedRuntimeRules(rules = []) {
  return (rules || [])
    .filter((rule) => isRuntimeUnsupportedPrivateConstraintType(rule?.constraintType))
    .map((rule) => ({
      id: rule.id,
      constraintType: rule.constraintType,
      label: CONSTRAINT_TYPE_LABELS[rule.constraintType] || rule.constraintType,
      active: rule.active !== false,
      message: `Loại "${CONSTRAINT_TYPE_LABELS[rule.constraintType] || rule.constraintType}" chưa được runtime hỗ trợ — không được kích hoạt như rule hoạt động.`,
    }));
}

/**
 * Types safe to treat as executable for activate preflight.
 */
export function getRuntimeSupportedPrivateConstraintTypes() {
  return [...CONSTRAINT_TYPE_OPTIONS_FOR_CREATE];
}

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
    if (
      filters.hideArchived &&
      filters.status !== "archived" &&
      String(rs.status) === "archived"
    ) {
      return false;
    }
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
