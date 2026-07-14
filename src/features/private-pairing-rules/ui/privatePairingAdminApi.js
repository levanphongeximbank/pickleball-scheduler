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
  runPrivatePairingRuntime,
} from "../index.js";
