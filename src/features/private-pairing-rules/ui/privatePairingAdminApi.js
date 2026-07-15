/**
 * PR-5 UI-facing API — RPC-only (no direct table access).
 */
export {
  listPrivatePairingRuleSets,
  getPrivatePairingRuleSet,
  createPrivatePairingRuleSet,
  createPrivatePairingRuleViaRpc as createPrivatePairingRule,
  updatePrivatePairingRuleViaRpc as updatePrivatePairingRule,
  disablePrivatePairingRuleViaRpc as disablePrivatePairingRule,
  clonePrivatePairingRuleSetVersion,
  archivePrivatePairingRuleSet,
  rollbackPrivatePairingRuleSet,
  listPrivatePairingAuditLogs,
  activatePrivatePairingRuleSetWithPreflight,
  PRIVATE_PAIRING_CONSTRAINT_TYPE,
  PRIVATE_PAIRING_CONSTRAINT_TYPE_VALUES,
  PRIVATE_PAIRING_SCOPE,
  PRIVATE_PAIRING_SCOPE_VALUES,
  SCOPES_REQUIRING_ID,
  RELATION_MODE,
  RULE_VISIBILITY,
  RULE_PRIORITY,
  REASON_CATEGORY,
  isPrivatePairingRulesEnabled,
  isPrivatePairingSimulationEnabled,
  runPrivatePairingRuntime,
  simulatePrivatePairing,
  detectPrivatePairingConflicts,
  validatePrivatePairingRules,
} from "../index.js";

export {
  canViewPrivatePairingRules,
  canManagePrivatePairingRules,
  canAuditPrivatePairingRules,
  canSimulatePrivatePairingRules,
  PRIVATE_PAIRING_UI_PERMISSIONS,
  privatePairingForbiddenResult,
} from "./privatePairingPermissions.js";
