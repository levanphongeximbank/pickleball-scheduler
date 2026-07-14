/** Stable RPC / database error codes for Private Pairing Rules V2 (PR-4). */
export const PRIVATE_PAIRING_DB_CODE = Object.freeze({
  PERMISSION_DENIED: "PERMISSION_DENIED",
  CROSS_TENANT_ACCESS: "CROSS_TENANT_ACCESS",
  NOT_FOUND: "NOT_FOUND",
  RULE_SET_NOT_EDITABLE: "RULE_SET_NOT_EDITABLE",
  RULE_SET_CONFLICT: "RULE_SET_CONFLICT",
  SELF_TARGET_NOT_ALLOWED: "SELF_TARGET_NOT_ALLOWED",
  DUPLICATE_TARGET: "DUPLICATE_TARGET",
  EMPTY_TARGET_LIST: "EMPTY_TARGET_LIST",
  INVALID_TIME_RANGE: "INVALID_TIME_RANGE",
  SCOPE_ID_REQUIRED: "SCOPE_ID_REQUIRED",
  SOFT_WEIGHT_REQUIRED: "SOFT_WEIGHT_REQUIRED",
  INVALID_SOFT_WEIGHT: "INVALID_SOFT_WEIGHT",
  HARD_WEIGHT_NOT_ALLOWED: "HARD_WEIGHT_NOT_ALLOWED",
  UNSUPPORTED_CONSTRAINT_TYPE: "UNSUPPORTED_CONSTRAINT_TYPE",
  ALL_OF_EXCEEDS_TEAM_CAPACITY: "ALL_OF_EXCEEDS_TEAM_CAPACITY",
  PRIVATE_RULE_NOT_ALLOWED_IN_CERTIFIED_EVENT: "PRIVATE_RULE_NOT_ALLOWED_IN_CERTIFIED_EVENT",
  REASON_TEXT_REQUIRED: "REASON_TEXT_REQUIRED",
  MISSING_PRIMARY_PLAYER: "MISSING_PRIMARY_PLAYER",
  HARD_DELETE_FORBIDDEN: "HARD_DELETE_FORBIDDEN",
  AUDIT_APPEND_ONLY: "AUDIT_APPEND_ONLY",
  FEATURE_DISABLED: "FEATURE_DISABLED",
  RPC_UNAVAILABLE: "RPC_UNAVAILABLE",
});

export const PRIVATE_PAIRING_TABLES = Object.freeze([
  "private_pairing_rule_sets",
  "private_pairing_rules",
  "private_pairing_rule_targets",
  "private_pairing_rule_audit_logs",
]);

export const PRIVATE_PAIRING_RPC = Object.freeze({
  LIST_RULE_SETS: "private_pairing_list_rule_sets",
  GET_RULE_SET: "private_pairing_get_rule_set",
  CREATE_RULE_SET: "private_pairing_create_rule_set",
  CREATE_RULE: "private_pairing_create_rule",
  UPDATE_RULE: "private_pairing_update_rule",
  DISABLE_RULE: "private_pairing_disable_rule",
  CLONE_RULE_SET: "private_pairing_clone_rule_set_version",
  ACTIVATE_RULE_SET: "private_pairing_activate_rule_set",
  ROLLBACK_RULE_SET: "private_pairing_rollback_rule_set",
  LIST_AUDIT_LOGS: "private_pairing_list_audit_logs",
  GET_ACTIVE_FOR_SCOPE: "private_pairing_get_active_rules_for_scope",
});
