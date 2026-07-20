/**
 * Phase 1E — Core-03 sibling adapters public surface (capability-local).
 */

export {
  CORE03_SIBLING_ADAPTER_NAME,
  CORE03_SIBLING_CAPABILITY,
  CORE03_SIBLING_ADAPTER_VERSION,
  createSiblingAdapterMetadata,
  defensiveCopy,
  orderReasonCodes,
} from "./adapterMetadata.js";

export {
  RULE_EVALUATION_ADAPTER_CONTRACT_VERSION,
  mapCore03RequestToCore01RuleEvaluation,
  normalizeCore01RuleResult,
  toEligibilityCheckResultFromRuleNormalization,
  createCore01RuleEvaluationAdapter,
} from "./ruleEvaluationAdapter.js";

export {
  PARTICIPANT_LOOKUP_ADAPTER_CONTRACT_VERSION,
  normalizeParticipantRecord,
  createCore02ParticipantLookupAdapter,
} from "./participantLookupAdapter.js";

export {
  ENTRY_LOOKUP_ADAPTER_CONTRACT_VERSION,
  CORE02_ACTIVE_ENTRY_STATUSES,
  normalizeCore02EntryStatus,
  normalizeEntryRecord,
  buildEntryLookupIdentityKey,
  createCore02EntryLookupAdapter,
} from "./entryLookupAdapter.js";

export {
  ENTRY_CREATION_ADAPTER_CONTRACT_VERSION,
  ENTRY_CREATION_COMPATIBILITY_GAP,
  createCore02EntryCreationAdapter,
} from "./entryCreationAdapter.js";

export {
  DIVISION_ELIGIBILITY_ADAPTER_CONTRACT_VERSION,
  normalizeCore04DivisionResult,
  toEligibilityCheckResultFromDivisionNormalization,
  createCore04DivisionEligibilityAdapter,
} from "./divisionEligibilityAdapter.js";

export {
  TEAM_ROSTER_VALIDATION_ADAPTER_CONTRACT_VERSION,
  TEAM_ROSTER_NOT_APPLICABLE_CODE,
  normalizeCore05RosterResult,
  toEligibilityCheckResultFromRosterNormalization,
  createCore05TeamRosterValidationAdapter,
} from "./teamRosterValidationAdapter.js";

export {
  CORE03_SIBLING_COMPATIBILITY_MATRIX,
  getCore03SiblingCompatibilityMatrix,
} from "./compatibilityMatrix.js";

export { createCore03SiblingAdapters } from "./createCore03SiblingAdapters.js";
