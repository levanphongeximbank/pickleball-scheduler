/**
 * CORE-17 Result Validation — capability identity, enums, and policy locks.
 *
 * Lifecycle gate values are anchored to CORE-15 public constants to prevent
 * string drift. CORE-17 still owns acceptance policy; it does not own lifecycle.
 */

import {
  MATCH_COMPLETION_REASON,
  MATCH_SIDE_KEY as CORE15_MATCH_SIDE_KEY,
  MATCH_STATUS,
} from "../matches/index.js";
import {
  SCORING_PROJECTION_SCHEMA_V1,
  SCORING_SIDE as CORE16_SCORING_SIDE,
} from "../scoring/index.js";

export const CORE17_ENGINE_ID = "competition-core.result-validation";
export const CORE17_ENGINE_VERSION = "1.0.0";

export const RESULT_VALIDATION_CONTRACT_ID =
  "competition-core.result-validation";
export const VALIDATED_RESULT_SCHEMA_V1 =
  "competition-core.validated-result.v1";
export const VALIDATED_RESULT_FINGERPRINT_V1 =
  "competition-core.validated-result.fp.v1";

/** CORE-16 projection schema expected by scoreSummaryRef (anchored). */
export const CORE16_PROJECTION_SCHEMA_V1 = SCORING_PROJECTION_SCHEMA_V1;

export const CORE16_PROJECTION_KIND = Object.freeze({
  CALCULATED_SCORE_ONLY: "CALCULATED_SCORE_ONLY",
});

/** Anchored to CORE-16 SCORING_SIDE — values only; scoring algorithms stay in CORE-16. */
export const SCORING_SIDE = Object.freeze({
  SIDE_A: CORE16_SCORING_SIDE.SIDE_A,
  SIDE_B: CORE16_SCORING_SIDE.SIDE_B,
});

/** Anchored to CORE-15 MATCH_SIDE_KEY. */
export const MATCH_SIDE_KEY = Object.freeze({
  A: CORE15_MATCH_SIDE_KEY.A,
  B: CORE15_MATCH_SIDE_KEY.B,
});

/**
 * Acceptance-gate slice of CORE-15 MATCH_STATUS.
 * COMPLETED lifecycle ≠ CORE-17 ACCEPTED acceptanceStatus.
 */
export const LIFECYCLE_STATUS = Object.freeze({
  COMPLETED: MATCH_STATUS.COMPLETED,
  CANCELLED: MATCH_STATUS.CANCELLED,
});

/**
 * Acceptance-gate slice of CORE-15 MATCH_COMPLETION_REASON (excludes NONE).
 * Mapping is value-compatible only — does not expand lifecycle ownership.
 */
export const LIFECYCLE_COMPLETION_REASON = Object.freeze({
  COMPLETED: MATCH_COMPLETION_REASON.COMPLETED,
  WALKOVER: MATCH_COMPLETION_REASON.WALKOVER,
  NO_SHOW: MATCH_COMPLETION_REASON.NO_SHOW,
  FORFEIT: MATCH_COMPLETION_REASON.FORFEIT,
  RETIREMENT: MATCH_COMPLETION_REASON.RETIREMENT,
  ABANDONED: MATCH_COMPLETION_REASON.ABANDONED,
  VOID: MATCH_COMPLETION_REASON.VOID,
  CANCELLED: MATCH_COMPLETION_REASON.CANCELLED,
});

export const RESULT_TYPE = Object.freeze({
  COMPLETED: "COMPLETED",
  WALKOVER: "WALKOVER",
  NO_SHOW: "NO_SHOW",
  RETIREMENT: "RETIREMENT",
  FORFEIT: "FORFEIT",
  ABANDONED: "ABANDONED",
  CANCELLED: "CANCELLED",
  VOID: "VOID",
});

/** @type {ReadonlySet<string>} */
export const RESULT_TYPE_VALUES = new Set(Object.values(RESULT_TYPE));

export const TECHNICAL_SUBTYPE = Object.freeze({
  FORFEIT_BEFORE_START: "FORFEIT_BEFORE_START",
  FORFEIT_AFTER_START: "FORFEIT_AFTER_START",
  ADMINISTRATIVE_FORFEIT: "ADMINISTRATIVE_FORFEIT",
  NO_CONTEST: "NO_CONTEST",
  INJURY: "INJURY",
  DISQUALIFICATION: "DISQUALIFICATION",
  OTHER: "OTHER",
});

/** @type {ReadonlySet<string>} */
export const TECHNICAL_SUBTYPE_VALUES = new Set(
  Object.values(TECHNICAL_SUBTYPE)
);

/** Required subtypes when resultType === FORFEIT. */
export const FORFEIT_TECHNICAL_SUBTYPES = Object.freeze([
  TECHNICAL_SUBTYPE.FORFEIT_BEFORE_START,
  TECHNICAL_SUBTYPE.FORFEIT_AFTER_START,
  TECHNICAL_SUBTYPE.ADMINISTRATIVE_FORFEIT,
]);

export const OUTCOME = Object.freeze({
  WIN_LOSS: "WIN_LOSS",
  NO_WINNER: "NO_WINNER",
  DOUBLE_LOSS: "DOUBLE_LOSS",
});

/** @type {ReadonlySet<string>} */
export const OUTCOME_VALUES = new Set(Object.values(OUTCOME));

export const ACCEPTANCE_STATUS = Object.freeze({
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  CORRECTION_REQUIRED: "CORRECTION_REQUIRED",
  SUPERSEDED: "SUPERSEDED",
});

/** @type {ReadonlySet<string>} */
export const ACCEPTANCE_STATUS_VALUES = new Set(
  Object.values(ACCEPTANCE_STATUS)
);

export const LINEAGE_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  SUPERSEDED: "SUPERSEDED",
});

/** @type {ReadonlySet<string>} */
export const LINEAGE_STATUS_VALUES = new Set(Object.values(LINEAGE_STATUS));

export const EVIDENCE_SEVERITY = Object.freeze({
  INFO: "INFO",
  WARNING: "WARNING",
  ERROR: "ERROR",
  CRITICAL: "CRITICAL",
});

export const ACTOR_TYPE = Object.freeze({
  SYSTEM: "SYSTEM",
  REFEREE: "REFEREE",
  ORGANIZER: "ORGANIZER",
  DIRECTOR: "DIRECTOR",
  ADMIN: "ADMIN",
  LEGACY_ADAPTER: "LEGACY_ADAPTER",
  UNKNOWN: "UNKNOWN",
});

/** @type {ReadonlySet<string>} */
export const ACTOR_TYPE_VALUES = new Set(Object.values(ACTOR_TYPE));

/** Actors allowed to submit/accept technical results. */
export const ELEVATED_ACTOR_TYPES = Object.freeze([
  ACTOR_TYPE.REFEREE,
  ACTOR_TYPE.ORGANIZER,
  ACTOR_TYPE.DIRECTOR,
  ACTOR_TYPE.ADMIN,
  ACTOR_TYPE.LEGACY_ADAPTER,
]);

export const SOURCE_TYPE = Object.freeze({
  CORE16_PROJECTION: "CORE16_PROJECTION",
  MANUAL_TECHNICAL: "MANUAL_TECHNICAL",
  LEGACY_INDIVIDUAL: "LEGACY_INDIVIDUAL",
  LEGACY_TEAM: "LEGACY_TEAM",
  IMPORT: "IMPORT",
  CORRECTION: "CORRECTION",
});

/** @type {ReadonlySet<string>} */
export const SOURCE_TYPE_VALUES = new Set(Object.values(SOURCE_TYPE));

/** Standings-eligible result types when ACCEPTED + ACTIVE. */
export const STANDINGS_ELIGIBLE_RESULT_TYPES = Object.freeze([
  RESULT_TYPE.COMPLETED,
  RESULT_TYPE.WALKOVER,
  RESULT_TYPE.NO_SHOW,
  RESULT_TYPE.RETIREMENT,
  RESULT_TYPE.FORFEIT,
]);

/** Never ACCEPTED in v1. */
export const ACCEPTANCE_FORBIDDEN_RESULT_TYPES = Object.freeze([
  RESULT_TYPE.ABANDONED,
  RESULT_TYPE.CANCELLED,
  RESULT_TYPE.VOID,
]);

/** Result types that require WIN_LOSS + winner/loser. */
export const WIN_LOSS_RESULT_TYPES = Object.freeze([
  RESULT_TYPE.COMPLETED,
  RESULT_TYPE.WALKOVER,
  RESULT_TYPE.NO_SHOW,
  RESULT_TYPE.RETIREMENT,
  RESULT_TYPE.FORFEIT,
]);

/** Result types that require elevated actors. */
export const TECHNICAL_RESULT_TYPES = Object.freeze([
  RESULT_TYPE.WALKOVER,
  RESULT_TYPE.NO_SHOW,
  RESULT_TYPE.RETIREMENT,
  RESULT_TYPE.FORFEIT,
  RESULT_TYPE.ABANDONED,
  RESULT_TYPE.CANCELLED,
  RESULT_TYPE.VOID,
]);

export const RESULT_EVIDENCE_CODE = Object.freeze({
  RESULT_EVIDENCE_SCHEMA_OK: "RESULT_EVIDENCE_SCHEMA_OK",
  RESULT_EVIDENCE_SIDE_BINDINGS_OK: "RESULT_EVIDENCE_SIDE_BINDINGS_OK",
  RESULT_EVIDENCE_SCORE_REF_PRESENT: "RESULT_EVIDENCE_SCORE_REF_PRESENT",
  RESULT_EVIDENCE_SCORE_TERMINAL_OK: "RESULT_EVIDENCE_SCORE_TERMINAL_OK",
  RESULT_EVIDENCE_WINNER_ALIGNED: "RESULT_EVIDENCE_WINNER_ALIGNED",
  RESULT_EVIDENCE_TECHNICAL_META_OK: "RESULT_EVIDENCE_TECHNICAL_META_OK",
  RESULT_EVIDENCE_ACTOR_OK: "RESULT_EVIDENCE_ACTOR_OK",
  RESULT_EVIDENCE_LIFECYCLE_HINT: "RESULT_EVIDENCE_LIFECYCLE_HINT",
  RESULT_EVIDENCE_STANDINGS_ELIGIBILITY:
    "RESULT_EVIDENCE_STANDINGS_ELIGIBILITY",
  RESULT_EVIDENCE_FINGERPRINT_INPUT_OK: "RESULT_EVIDENCE_FINGERPRINT_INPUT_OK",
});

export const CORE17_IDENTITY = Object.freeze({
  engineId: CORE17_ENGINE_ID,
  engineVersion: CORE17_ENGINE_VERSION,
  contractId: RESULT_VALIDATION_CONTRACT_ID,
  schemaVersion: VALIDATED_RESULT_SCHEMA_V1,
  fingerprintVersion: VALIDATED_RESULT_FINGERPRINT_V1,
});

/**
 * @param {string} resultType
 * @returns {string}
 */
export function requiredCompletionReasonForResultType(resultType) {
  switch (resultType) {
    case RESULT_TYPE.COMPLETED:
      return LIFECYCLE_COMPLETION_REASON.COMPLETED;
    case RESULT_TYPE.WALKOVER:
      return LIFECYCLE_COMPLETION_REASON.WALKOVER;
    case RESULT_TYPE.NO_SHOW:
      return LIFECYCLE_COMPLETION_REASON.NO_SHOW;
    case RESULT_TYPE.RETIREMENT:
      return LIFECYCLE_COMPLETION_REASON.RETIREMENT;
    case RESULT_TYPE.FORFEIT:
      return LIFECYCLE_COMPLETION_REASON.FORFEIT;
    case RESULT_TYPE.ABANDONED:
      return LIFECYCLE_COMPLETION_REASON.ABANDONED;
    case RESULT_TYPE.CANCELLED:
      return LIFECYCLE_COMPLETION_REASON.CANCELLED;
    case RESULT_TYPE.VOID:
      return LIFECYCLE_COMPLETION_REASON.VOID;
    default:
      return LIFECYCLE_COMPLETION_REASON.COMPLETED;
  }
}

/**
 * @param {string} resultType
 * @returns {boolean}
 */
export function isStandingsEligibleResultType(resultType) {
  return STANDINGS_ELIGIBLE_RESULT_TYPES.includes(resultType);
}

/**
 * Score differentials are standings-eligible only for COMPLETED in v1.
 * RETIREMENT may keep a partial snapshot for audit but not score-diff.
 * @param {string} resultType
 * @returns {boolean}
 */
export function isScoreDifferentialEligibleResultType(resultType) {
  return resultType === RESULT_TYPE.COMPLETED;
}
