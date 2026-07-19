/**
 * Phase 1E — Production preflight classification (pure, no DB I/O).
 *
 * Classifications:
 * - NOT_APPLIED
 * - PARTIALLY_APPLIED
 * - ALREADY_READY
 * - BLOCKED_UNSAFE
 */

export const PHASE_1E_PREFLIGHT_CLASSIFICATIONS = Object.freeze([
  "NOT_APPLIED",
  "PARTIALLY_APPLIED",
  "ALREADY_READY",
  "BLOCKED_UNSAFE",
]);

export const PHASE_1E_REQUIRED_COLUMNS = Object.freeze([
  "birth_date",
  "handedness",
  "activity_region",
  "privacy_settings",
  "identity_verification_status",
  "birth_year",
]);

export const PHASE_1E_REQUIRED_CONSTRAINTS = Object.freeze([
  "profiles_birth_date_not_future_check",
  "profiles_handedness_check",
  "profiles_identity_verification_status_check",
  "profiles_privacy_settings_object_check",
  "profiles_privacy_settings_booleans_check",
  "profiles_activity_region_object_check",
]);

export const PHASE_1E_REQUIRED_INDEX = "profiles_identity_verification_status_partial_idx";
export const PHASE_1E_GUARD_FN = "profiles_guard_privileged_update";
export const PHASE_1E_GUARD_TRIGGER = "profiles_guard_privileged_update_trg";

/**
 * @param {object} snapshot — read-only inventory from Production
 * @returns {{ classification: string, reasons: string[], blockers: string[] }}
 */
export function classifyPhase1eProductionPreflight(snapshot = {}) {
  const reasons = [];
  const blockers = [];

  const columns = new Set(snapshot.columns || []);
  const constraints = new Set(snapshot.constraints || []);
  const indexes = new Set(snapshot.indexes || []);
  const triggers = new Set(snapshot.triggers || []);

  const missingColumns = PHASE_1E_REQUIRED_COLUMNS.filter((c) => !columns.has(c));
  const missingConstraints = PHASE_1E_REQUIRED_CONSTRAINTS.filter((c) => !constraints.has(c));
  const hasIndex = indexes.has(PHASE_1E_REQUIRED_INDEX);
  const hasGuardFn = Boolean(snapshot.guardFunctionExists);
  const hasTrigger = triggers.has(PHASE_1E_GUARD_TRIGGER);
  const privacyNull = Number(snapshot.privacyNullCount ?? 0);
  const verificationNull = Number(snapshot.verificationNullCount ?? 0);
  const invalidHandedness = Number(snapshot.invalidHandednessCount ?? 0);
  const invalidVerification = Number(snapshot.invalidVerificationCount ?? 0);
  const duplicateConstraints = Number(snapshot.duplicateConstraintCount ?? 0);
  const conflictingTriggers = Number(snapshot.conflictingTriggerCount ?? 0);
  const hasUnsafeBypass = snapshot.guardHasCurrentUserPostgresBypass === true;
  const missingSelfBlock = snapshot.guardHasSelfVerificationBlock === false;
  const rlsWeakened = snapshot.rlsPoliciesMatchBaseline === false;
  const grantsWeakened = snapshot.grantsMatchBaseline === false;

  if (hasUnsafeBypass) {
    blockers.push("Guard contains current_user=postgres SECURITY DEFINER bypass");
  }
  if (missingSelfBlock && hasGuardFn) {
    blockers.push("Guard missing self identity_verification_status block");
  }
  if (duplicateConstraints > 0) {
    blockers.push(`Duplicate/conflicting constraints detected: ${duplicateConstraints}`);
  }
  if (conflictingTriggers > 0) {
    blockers.push(`Conflicting legacy triggers detected: ${conflictingTriggers}`);
  }
  if (invalidHandedness > 0) {
    blockers.push(`Invalid handedness values present: ${invalidHandedness}`);
  }
  if (invalidVerification > 0) {
    blockers.push(`Invalid identity_verification_status values present: ${invalidVerification}`);
  }
  if (rlsWeakened) {
    blockers.push("RLS policies do not match expected safe baseline");
  }
  if (grantsWeakened) {
    blockers.push("Grants do not match expected safe baseline");
  }

  if (blockers.length > 0) {
    return {
      classification: "BLOCKED_UNSAFE",
      reasons: [...reasons, ...blockers],
      blockers,
    };
  }

  const foundationColumns = PHASE_1E_REQUIRED_COLUMNS.filter((c) => c !== "birth_year");
  const missingFoundation = foundationColumns.filter((c) => !columns.has(c));
  const presentFoundation = foundationColumns.filter((c) => columns.has(c));

  if (missingFoundation.length === foundationColumns.length && !hasGuardFn && !hasTrigger && !hasIndex) {
    reasons.push("No Phase 1D foundation columns/index/guard detected");
    return { classification: "NOT_APPLIED", reasons, blockers };
  }

  const ready =
    missingColumns.length === 0 &&
    missingConstraints.length === 0 &&
    hasIndex &&
    hasGuardFn &&
    hasTrigger &&
    privacyNull === 0 &&
    verificationNull === 0 &&
    snapshot.guardHasCurrentUserPostgresBypass === false &&
    snapshot.guardHasSelfVerificationBlock === true;

  if (ready) {
    reasons.push("All required columns, constraints, index, guard, and trigger present");
    reasons.push("privacy_null=0 and verification_null=0");
    reasons.push("Guard has self verification block and no current_user=postgres bypass");
    return { classification: "ALREADY_READY", reasons, blockers };
  }

  if (presentFoundation.length > 0 || hasGuardFn || hasIndex || hasTrigger) {
    if (missingFoundation.length) {
      reasons.push(`Missing foundation columns: ${missingFoundation.join(", ")}`);
    }
    if (missingConstraints.length) {
      reasons.push(`Missing constraints: ${missingConstraints.join(", ")}`);
    }
    if (!hasIndex) reasons.push("Missing partial verification index");
    if (!hasGuardFn) reasons.push("Missing profiles_guard_privileged_update");
    if (!hasTrigger) reasons.push("Missing profiles_guard_privileged_update_trg");
    if (privacyNull > 0) reasons.push(`privacy_settings null rows: ${privacyNull}`);
    if (verificationNull > 0) {
      reasons.push(`identity_verification_status null rows: ${verificationNull}`);
    }
    return { classification: "PARTIALLY_APPLIED", reasons, blockers };
  }

  reasons.push("Unable to classify as ready; treating as not applied");
  return { classification: "NOT_APPLIED", reasons, blockers };
}
