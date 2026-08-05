/**
 * RATING-V5-CUTOVER-02 — Dual-read compare + Staging writer-freeze controls.
 *
 * Published authority remains V2. V5 is shadow/pilot durable only.
 * All flags default OFF. Production deny forces OFF.
 */

export {
  CUTOVER_02_STAGING_PROJECT_REF,
  CUTOVER_02_PRODUCTION_PROJECT_REF,
  extractSupabaseProjectRef,
  isProductionDenyActive,
  isStagingRehearsalEnvironmentAllowed,
  evaluateStagingEnvironmentProof,
  resolveAppEnvironmentLabel,
} from "./config/environmentGuards.js";

export {
  CUTOVER_02_ENV_NAMES,
  resolveCutover02Config,
  isDualReadCompareEnabled,
  getWriterFreezeMode,
  isPlayerInDualReadCohort,
  isTenantAllowedForCutover02,
} from "./config/featureFlags.js";

export {
  DUAL_READ_COMPARE_OUTCOME,
  isKnownDualReadCompareOutcome,
} from "./constants/compareOutcomes.js";

export {
  RATING_SCALE_ID,
  SCALE_MAPPING_STATUS,
  SCALE_MAPPING_STRATEGY,
  V2_SCALE_BOUNDS,
  V5_SCALE_BOUNDS,
} from "./constants/scaleIds.js";

export {
  CUTOVER_02_WRITER_ID,
  WRITER_FREEZE_MODE,
} from "./constants/writerIds.js";

export {
  SCALE_MAPPING_ALTERNATIVES,
  resolveScaleMappingPolicy,
  compareRawRatingPair,
  isRatingInScaleBounds,
} from "./dual-read/scaleMapping.js";

export { classifyDualReadCompareOutcome } from "./dual-read/classifyCompareOutcome.js";

export {
  comparePublishedRatingDualRead,
  getPublishedRatingWithOptionalCompare,
  readPublishedV2RatingValue,
  normalizeV5ShadowCandidate,
  __resetDualReadEvidenceForTests,
  __getDualReadEvidenceForTests,
} from "./dual-read/comparePublishedRatings.js";

export { CUTOVER_02_CONSUMER_MATRIX } from "./dual-read/consumerMatrix.js";

export {
  CUTOVER_02_WRITER_INVENTORY,
  getWriterInventoryRow,
  listStagingFreezeTargets,
} from "./writer-freeze/writerInventory.js";

export {
  evaluateWriterFreezeAttempt,
  withWriterFreezeGuard,
  WRITER_FREEZE_BLOCK_CODE,
  FREEZE_TARGET_SYNC_RPC,
  FREEZE_ALLOWED_V5_PERSIST,
  FREEZE_ALLOWED_CC02_ELO,
  __resetWriterFreezeAttemptsForTests,
  __getWriterFreezeAttemptsForTests,
} from "./writer-freeze/freezePolicy.js";

export {
  hashPlayerIdForEvidence,
  sanitizeEvidenceValue,
  evidenceContainsForbiddenPii,
} from "./evidence/sanitizeEvidence.js";

export {
  buildReconciliationReport,
  SUGGESTED_STAGING_THRESHOLDS,
  RECONCILIATION_OWNER_APPROVAL,
} from "./reconciliation/metrics.js";

// Browser-safe A3c surface only (trusted orchestrator: ./fixture-prep/index.js).
export {
  FIXTURE_PREP_ENV_NAME,
  isFixturePrepPathEnabled,
  FIXTURE_COHORT_LABEL,
  FIXTURE_PREP_OUTCOME,
  FIXTURE_PREP_VERSION,
  APPROVED_ID_HASHES,
  invokeFixturePrepFromBrowser,
  browserFixturePrepForbiddenPatterns,
  SELECTED_ARCHITECTURE,
  DIRECT_RPC_BYPASS_STATUS,
  MUTATION_BUDGET,
} from "./fixture-prep/public.js";
