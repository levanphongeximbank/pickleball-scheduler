/**
 * Rollback design for A3c — exact five candidates / cohort / prep version / Staging only.
 */

import {
  CUTOVER_02_PRODUCTION_PROJECT_REF,
  CUTOVER_02_STAGING_PROJECT_REF,
} from "../config/environmentGuards.js";
import {
  FIXTURE_COHORT_LABEL,
  FIXTURE_PREP_VERSION,
  PHASE4_PILOT_COHORT_LABEL,
  ROLLBACK_TARGETS_EXACT_FIVE_CANDIDATES,
} from "./constants.js";
import { APPROVED_ID_HASHES } from "./fixtureManifestMeta.js";

export function buildRollbackRunbook() {
  return Object.freeze({
    ROLLBACK_TARGETS_EXACT_FIVE_CANDIDATES,
    scope: Object.freeze({
      projectRef: CUTOVER_02_STAGING_PROJECT_REF,
      denyProjectRef: CUTOVER_02_PRODUCTION_PROJECT_REF,
      cohortLabel: FIXTURE_COHORT_LABEL,
      preparationVersion: FIXTURE_PREP_VERSION,
      idHashes: APPROVED_ID_HASHES,
    }),
    enrollment: Object.freeze({
      action: "deactivate_or_remove_only_new_cohort_enrollment",
      preserve: [PHASE4_PILOT_COHORT_LABEL, "any_pre_existing_other_cohort"],
    }),
    v2: Object.freeze({
      action: "restore_snapshot_or_delete_only_rehearsal_created_row_when_prior_count_zero",
      never: "blanket_delete_rating_rows",
    }),
    v5: Object.freeze({
      action:
        "canonical_invalidate_or_quarantine_fixture_assessments_profiles_for_prep_run",
      preserveImmutableAuditEvents: true,
      markPrepRolledBack: true,
      doNotTouchOutsidePrepRun: true,
    }),
    rollout: Object.freeze({
      action: "confirm_unchanged",
      allowedChanges: 0,
    }),
    freeze: Object.freeze({
      writerFreezeMode: "OFF",
      sqlWriterFreezeGuardApplied: false,
      note: "SQL writer-freeze guard remains unapplied during A3 preparation",
    }),
  });
}

/**
 * Classify whether a rollback target is in scope.
 * @param {{
 *   projectRef?: string,
 *   cohortLabel?: string,
 *   preparationVersion?: string,
 *   idHash?: string,
 * }} target
 */
export function isRollbackTargetInScope(target = {}) {
  const projectOk = target.projectRef === CUTOVER_02_STAGING_PROJECT_REF;
  const cohortOk = target.cohortLabel === FIXTURE_COHORT_LABEL;
  const versionOk =
    !target.preparationVersion ||
    target.preparationVersion === FIXTURE_PREP_VERSION;
  const hashOk = APPROVED_ID_HASHES.includes(
    String(target.idHash || "").toLowerCase()
  );
  return {
    ok: projectOk && cohortOk && versionOk && hashOk,
    projectOk,
    cohortOk,
    versionOk,
    hashOk,
  };
}
