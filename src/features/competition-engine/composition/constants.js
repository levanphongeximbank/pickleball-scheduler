/**
 * E2E-02 — Individual Pool + Knockout composition constants.
 */

export const E2E02_COMPOSITION_VERSION = "1.0.0";

export const E2E02_TEMPLATE_ID = "ce-e2e02-individual-pool-knockout";
export const E2E02_TEMPLATE_VERSION = 1;

export const E2E02_FORMAT_ID = "individual-pool-knockout";
export const E2E02_FORMAT_VERSION = "1.0.0";

export const E2E02_FORMAT_BLUEPRINT_ID = "individual_pool_knockout";

export const E2E02_STAGE = Object.freeze({
  POOL: "POOL",
  QUALIFICATION: "QUALIFICATION",
  KNOCKOUT: "KNOCKOUT",
});

export const E2E02_STAGE_SEQUENCE = Object.freeze([
  E2E02_STAGE.POOL,
  E2E02_STAGE.QUALIFICATION,
  E2E02_STAGE.KNOCKOUT,
]);

export const E2E02_PARTICIPANT_STRUCTURE = Object.freeze({
  SINGLES: "singles",
  DOUBLES: "doubles",
});

export const E2E02_QUALIFICATION_POLICY = Object.freeze({
  TOP_N_PER_POOL: "TOP_N_PER_POOL",
  GLOBAL_TOP_N: "GLOBAL_TOP_N",
});

export const E2E02_POOL_SIZING_POLICY = Object.freeze({
  FIXED_POOL_COUNT: "FIXED_POOL_COUNT",
  TARGET_POOL_SIZE: "TARGET_POOL_SIZE",
});

export const E2E02_GROUPING_STRATEGY = Object.freeze({
  SNAKE: "SNAKE",
  SEEDED: "SEEDED",
  SERPENTINE: "SERPENTINE",
});

export const E2E02_UNRESOLVED_TIE_BEHAVIOR = Object.freeze({
  FAIL_CLOSED: "FAIL_CLOSED",
});

export const E2E02_RULE_REFERENCES = Object.freeze({
  registrationPolicyId: "core-registration-eligibility-default",
  eligibilityPolicyId: "core-registration-eligibility-default",
  seedingStrategyId: "core-07-seeding-default",
  standingsStrategyId: "core-18-standings-default",
  schedulingPolicyId: "core-11-schedule-input-default",
  courtAssignmentPolicyId: "core-12-court-assignment-default",
  scoringPolicyId: "core-16-scoring-default",
  resultValidationPolicyId: "core-17-result-validation-default",
  workflowId: "e2e02-pool-qualification-knockout-v1",
  divisionCategoryPolicyId: "core-division-category-default",
});

export const E2E02_COMPOSITION_PHASE = Object.freeze({
  id: "E2E-02",
  name: "individual-pool-knockout-composition",
  wiredToProductionRuntime: false,
  hasUi: false,
  hasPersistence: false,
  reusesCoreMatchGeneration: true,
  reusesCoreStandings: true,
  reusesCoreDrawGrouping: true,
  reusesE2e01Ports: true,
});
