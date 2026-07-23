/**
 * CORE-17 Result Validation — capability-local public surface.
 *
 * Owns validated-result contract, validation, explicit acceptance,
 * correction/supersession, and CORE-16 projection adaptation for evidence.
 *
 * Does NOT own match lifecycle (CORE-15), scoring algorithms (CORE-16),
 * standings (CORE-18), legacy engines, UI, API, SQL, or production wiring.
 *
 * Integrator owns root competition-core/index.js — do not edit that here.
 */

export {
  CORE17_ENGINE_ID,
  CORE17_ENGINE_VERSION,
  RESULT_VALIDATION_CONTRACT_ID,
  VALIDATED_RESULT_SCHEMA_V1,
  VALIDATED_RESULT_FINGERPRINT_V1,
  CORE16_PROJECTION_SCHEMA_V1,
  CORE16_PROJECTION_KIND,
  SCORING_SIDE,
  MATCH_SIDE_KEY,
  LIFECYCLE_STATUS,
  LIFECYCLE_COMPLETION_REASON,
  RESULT_TYPE,
  RESULT_TYPE_VALUES,
  TECHNICAL_SUBTYPE,
  TECHNICAL_SUBTYPE_VALUES,
  FORFEIT_TECHNICAL_SUBTYPES,
  OUTCOME,
  OUTCOME_VALUES,
  ACCEPTANCE_STATUS,
  ACCEPTANCE_STATUS_VALUES,
  LINEAGE_STATUS,
  LINEAGE_STATUS_VALUES,
  EVIDENCE_SEVERITY,
  ACTOR_TYPE,
  ACTOR_TYPE_VALUES,
  ELEVATED_ACTOR_TYPES,
  SOURCE_TYPE,
  SOURCE_TYPE_VALUES,
  STANDINGS_ELIGIBLE_RESULT_TYPES,
  ACCEPTANCE_FORBIDDEN_RESULT_TYPES,
  WIN_LOSS_RESULT_TYPES,
  TECHNICAL_RESULT_TYPES,
  RESULT_EVIDENCE_CODE,
  CORE17_IDENTITY,
  requiredCompletionReasonForResultType,
  isStandingsEligibleResultType,
  isScoreDifferentialEligibleResultType,
} from "./resultValidationConstants.js";

export {
  RESULT_ERROR_CODE,
  RESULT_ERROR_CODE_VALUES,
  isResultErrorCode,
  ResultValidationError,
  isResultValidationError,
  createResultValidationError,
} from "./resultValidationErrors.js";

export {
  compareStableString,
  hashStringToUint32,
  canonicalizeJsonValue,
  serializeCanonical,
  deepFreezeClone,
  fingerprintCanonicalMaterial,
  computeProjectionInputDigest,
} from "./deterministicResultFingerprint.js";

export {
  adaptCore16Projection,
  assertScoreSnapshotConsistent,
  cloneProjectionForRead,
} from "./core16ProjectionAdapter.js";

export {
  oppositeSide,
  resolveSideIdentity,
  sortValidationEvidence,
  sortCorrectionRequiredCodes,
  createEvidenceItem,
  buildFingerprintMaterial,
  computeValidatedResultFingerprint,
  isStandingsSafe,
  isScoreDifferentialEligible,
  finalizeValidatedResult,
  markResultSuperseded,
} from "./validatedResult.js";

export {
  validateMatchResult,
  finalizeNonAcceptedResult,
} from "./validateMatchResult.js";

export { acceptMatchResult } from "./acceptMatchResult.js";
