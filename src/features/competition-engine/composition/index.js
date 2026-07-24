/**
 * E2E-02 composition barrel.
 */

export {
  E2E02_COMPOSITION_VERSION,
  E2E02_TEMPLATE_ID,
  E2E02_TEMPLATE_VERSION,
  E2E02_FORMAT_ID,
  E2E02_FORMAT_VERSION,
  E2E02_FORMAT_BLUEPRINT_ID,
  E2E02_STAGE,
  E2E02_STAGE_SEQUENCE,
  E2E02_PARTICIPANT_STRUCTURE,
  E2E02_QUALIFICATION_POLICY,
  E2E02_POOL_SIZING_POLICY,
  E2E02_GROUPING_STRATEGY,
  E2E02_UNRESOLVED_TIE_BEHAVIOR,
  E2E02_RULE_REFERENCES,
  E2E02_COMPOSITION_PHASE,
} from "./constants.js";

export {
  E2E02_ERROR_CODE,
  E2E02CompositionError,
  isE2E02CompositionError,
  failE2E02,
} from "./errors.js";

export {
  computeDeterministicFingerprint,
  stableStringify,
  deepFreeze,
  clonePlain,
} from "./fingerprint.js";

export { composePoolGrouping } from "./poolGrouping.js";
export { composePoolStage } from "./poolStage.js";
export { composeQualificationAdvancement } from "./qualification.js";
export { composeKnockoutStage } from "./knockoutStage.js";
export { composeIndividualPoolKnockout } from "./composePoolKnockout.js";

export { buildGroupDrawSnapshotFromPools } from "./adapters/drawSnapshotFromGroups.js";
export { buildKnockoutDrawSnapshotFromQualifiers } from "./adapters/drawSnapshotFromQualifiers.js";
export {
  createEvaluatedRulesForStrategy,
  createPoolStageEvaluatedRules,
  createKnockoutStageEvaluatedRules,
} from "./adapters/evaluatedRulesFromFormat.js";
