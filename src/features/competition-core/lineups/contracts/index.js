export {
  LINEUP_IDENTITY_KIND,
  buildLineupIdentityKey,
  buildLineupSlotId,
  createLineupIdentity,
  identityFromCompetitionLineup,
} from "./lineupIdentity.js";

export {
  LINEUP_ADAPTER_ID,
  isLineupAdapter,
} from "./adapterContract.js";

export {
  createLineupPolicyResult,
  isLineupPolicy,
} from "./lineupPolicy.js";

export {
  isLineupRandomPolicy,
  createPermissiveLineupRandomPolicy,
  createFixedStrategyLineupRandomPolicy,
} from "./lineupRandomPolicy.js";

export {
  createLineupRandomSelectRequest,
  createLineupRandomSelectResult,
} from "./lineupRandomRequest.js";

export { createLineupResolveRequest } from "./resolveRequest.js";

export {
  createLineupResolveResult,
  lineupResolveOk,
  lineupResolveFail,
} from "./resolveResult.js";

export {
  createLineupVisibilityGrant,
} from "./visibilityGrant.js";

export {
  LINEUP_VISIBILITY_STATE,
  LINEUP_VISIBILITY_STATE_VALUES,
  LINEUP_VISIBILITY_RANK,
  isLineupVisibilityState,
  normalizeLineupVisibilityState,
  compareVisibilityRank,
} from "./lineupVisibilityState.js";

export {
  LINEUP_DEADLINE_PHASE,
  LINEUP_DEADLINE_PHASE_VALUES,
  isLineupDeadlinePhase,
  createLineupDeadlineTimestamps,
} from "./lineupDeadlinePhase.js";

export {
  createLineupVisibilityProjection,
  LINEUP_PROJECTION_FIELD,
} from "./visibilityProjection.js";

export {
  isLineupHardeningPolicy,
  createDefaultLineupHardeningPolicy,
  createLineupHardeningPolicy,
} from "./lineupHardeningPolicy.js";

export { createLineupAuditMetadata } from "./auditMetadata.js";

export { createLineupIdempotencyRecord } from "./idempotencyRecord.js";

export {
  MISSING_LINEUP_POLICY,
  MISSING_LINEUP_POLICY_VALUES,
  MISSING_LINEUP_OUTCOME,
  MISSING_LINEUP_OUTCOME_VALUES,
  createMissingLineupResolution,
} from "./missingLineupResolution.js";

/** CORE-06 Phase 1F */
export {
  LINEUP_FORMAT_ADAPTER_KIND,
  LINEUP_FORMAT_ADAPTER_METHODS,
  isLineupFormatAdapter,
} from "./lineupFormatAdapter.js";

export { lineupMappingOk, lineupMappingFail } from "./mappingResult.js";

export {
  LINEUP_PERSISTENCE_TX_METHODS,
  LINEUP_PERSISTENCE_GUARANTEES,
  matchesLineupPersistenceTransactionPort,
} from "./persistenceTransaction.js";

export {
  LINEUP_SHADOW_CLASSIFICATION,
  LINEUP_SHADOW_CLASSIFICATION_VALUES,
  LINEUP_SHADOW_DIMENSIONS,
  isLineupShadowClassification,
  createShadowDimensionResult,
} from "./shadowComparison.js";

export {
  LINEUP_CERTIFICATION_VERDICT,
  LINEUP_CERT_AXIS,
  createLineupCertificationReport,
} from "./certificationReport.js";

export {
  LINEUP_ACCEPTED_DIFFERENCE_CODE,
  LINEUP_ACCEPTED_DIFFERENCE_CODE_VALUES,
  LINEUP_ACCEPTED_DIFFERENCE_REGISTRY,
  isLineupAcceptedDifferenceCode,
} from "./acceptedDifferences.js";