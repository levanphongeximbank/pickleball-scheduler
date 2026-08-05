/**
 * Idempotency / collision classification for A3c preparation.
 * Partial state is never silently repaired.
 */

import {
  FIXTURE_COHORT_LABEL,
  FIXTURE_PREP_OUTCOME,
  FIXTURE_PREP_VERSION,
} from "./constants.js";

/**
 * @param {{
 *   prepAuditStatus?: string|null,
 *   prepVersion?: string|null,
 *   cohortLabel?: string|null,
 *   hasEnrollment?: boolean,
 *   hasV2Row?: boolean,
 *   hasDraftAssessment?: boolean,
 *   hasCompletedAssessment?: boolean,
 *   hasV5ShadowProfile?: boolean,
 *   hasConflictingCompletedV5OutsidePrep?: boolean,
 *   fingerprintMatch?: boolean,
 * }} state
 */
export function classifyPreparationState(state = {}) {
  const cohort = String(state.cohortLabel || "").trim();
  if (cohort && cohort !== FIXTURE_COHORT_LABEL) {
    return {
      outcome: FIXTURE_PREP_OUTCOME.WRONG_COHORT,
      proceed: false,
    };
  }

  if (state.hasConflictingCompletedV5OutsidePrep) {
    return {
      outcome: FIXTURE_PREP_OUTCOME.COLLISION_BLOCKED,
      proceed: false,
      reason: "CONFLICTING_COMPLETED_V5",
    };
  }

  const version = String(state.prepVersion || FIXTURE_PREP_VERSION);
  const auditPrepared =
    state.prepAuditStatus === "PREPARED" ||
    state.prepAuditStatus === "ALREADY_PREPARED";

  if (
    auditPrepared &&
    version === FIXTURE_PREP_VERSION &&
    state.hasEnrollment &&
    state.hasV2Row &&
    state.hasCompletedAssessment &&
    state.hasV5ShadowProfile &&
    state.fingerprintMatch !== false
  ) {
    return {
      outcome: FIXTURE_PREP_OUTCOME.ALREADY_PREPARED,
      proceed: false,
      idempotent: true,
    };
  }

  const any =
    state.hasEnrollment ||
    state.hasV2Row ||
    state.hasDraftAssessment ||
    state.hasCompletedAssessment ||
    state.hasV5ShadowProfile ||
    Boolean(state.prepAuditStatus);

  const all =
    state.hasEnrollment &&
    state.hasV2Row &&
    state.hasCompletedAssessment &&
    state.hasV5ShadowProfile;

  if (any && !all) {
    return {
      outcome: FIXTURE_PREP_OUTCOME.PARTIAL_STATE_BLOCKED,
      proceed: false,
      reason: "PARTIAL_PREP_STATE",
    };
  }

  if (all && !auditPrepared) {
    // Complete data without matching prep audit → collision / unknown provenance
    return {
      outcome: FIXTURE_PREP_OUTCOME.COLLISION_BLOCKED,
      proceed: false,
      reason: "COMPLETE_WITHOUT_PREP_AUDIT",
    };
  }

  return {
    outcome: FIXTURE_PREP_OUTCOME.PREPARED,
    proceed: true,
    idempotent: false,
  };
}

export function buildIdempotencyKey({
  projectRef,
  cohortLabel,
  targetIdHash,
  preparationVersion = FIXTURE_PREP_VERSION,
}) {
  return [
    String(projectRef || "").trim().toLowerCase(),
    String(cohortLabel || "").trim(),
    String(targetIdHash || "").trim().toLowerCase(),
    String(preparationVersion || "").trim(),
  ].join("|");
}
