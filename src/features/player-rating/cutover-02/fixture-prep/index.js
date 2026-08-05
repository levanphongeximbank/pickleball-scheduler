/**
 * A3c fixture preparation public exports.
 */

export {
  FIXTURE_PREP_VERSION,
  FIXTURE_COHORT_LABEL,
  PHASE4_PILOT_COHORT_LABEL,
  FIXTURE_PREP_OUTCOME,
  FIXTURE_CALIBRATION_PERMISSION,
  MAPPING_STATUS,
  NORMALIZED_EQUIVALENCE,
  MUTATION_BUDGET,
  ROLLBACK_TARGETS_EXACT_FIVE_CANDIDATES,
  SELECTED_ARCHITECTURE,
  DIRECT_RPC_BYPASS_STATUS,
  V2_SCALE_ID,
  V5_SCALE_ID,
} from "./constants.js";

export {
  FIXTURE_CANDIDATES,
  APPROVED_ID_HASHES,
  FIXTURE_MANIFEST_META,
  getFixtureByHash,
  getFixtureByLabel,
  isApprovedFixtureHash,
  buildFixtureAnswers,
  scoreFixtureAnswers,
  assertAllFixtureScoresMatchTargets,
  profileIdHash12,
  md5Hex,
} from "./fixtureManifest.js";

export {
  evaluateProjectGuard,
  evaluateCallerGuard,
  evaluateCohortGuard,
  evaluateTargetGuard,
  evaluateValueGuard,
} from "./guards.js";

export {
  buildPerCandidateWriteModel,
  buildCohortWriteModel,
  evaluateMutationBudget,
} from "./mutationBudget.js";

export {
  classifyPreparationState,
  buildIdempotencyKey,
} from "./idempotency.js";

export {
  buildRedactedPrepAudit,
  buildStateFingerprint,
} from "./auditEvidence.js";

export {
  buildRollbackRunbook,
  isRollbackTargetInScope,
} from "./rollbackPlan.js";

export {
  prepareStagingFixtureCandidate,
  resolveTargetIdHash,
} from "./prepareFixture.js";

export {
  isFixturePrepPathEnabled,
  FIXTURE_PREP_ENV_NAME,
} from "./featureFlag.js";

export {
  invokeFixturePrepFromBrowser,
  browserFixturePrepForbiddenPatterns,
} from "./clientInvoke.js";
