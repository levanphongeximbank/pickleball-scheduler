/**
 * Phase 1E — Production preflight classification + column-aware count helpers.
 * Pure logic (no DB I/O) except callers that supply inventory snapshots.
 */

export const PHASE_1E_PREFLIGHT_CLASSIFICATIONS = Object.freeze([
  "NOT_APPLIED",
  "PARTIALLY_APPLIED",
  "ALREADY_READY",
  "BLOCKED_UNSAFE",
]);

export const NOT_APPLICABLE_COLUMN_MISSING = "NOT_APPLICABLE_COLUMN_MISSING";

export const PHASE_1E_REQUIRED_COLUMNS = Object.freeze([
  "birth_date",
  "handedness",
  "activity_region",
  "privacy_settings",
  "identity_verification_status",
  "birth_year",
]);

export const PHASE_1E_FOUNDATION_COLUMNS = Object.freeze(
  PHASE_1E_REQUIRED_COLUMNS.filter((c) => c !== "birth_year")
);

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
 * @param {string} status
 * @param {number|null} [value]
 */
export function countField(status, value = null) {
  return { status, value };
}

/**
 * Build structured null/invalid counts from a known column set + optional numeric map.
 * Never invents counts for missing columns.
 *
 * @param {Iterable<string>} presentColumns
 * @param {object} [numeric]
 */
export function buildConditionalProfileCounts(presentColumns, numeric = {}) {
  const cols = new Set(presentColumns || []);

  const field = (columnName, key) => {
    if (!cols.has(columnName)) {
      return countField(NOT_APPLICABLE_COLUMN_MISSING, null);
    }
    const raw = numeric[key];
    return countField("OK", raw == null ? 0 : Number(raw));
  };

  return {
    total: countField("OK", Number(numeric.total ?? 0)),
    privacy_null: field("privacy_settings", "privacy_null"),
    verification_null: field("identity_verification_status", "verification_null"),
    invalid_handedness: field("handedness", "invalid_handedness"),
    invalid_verification: field("identity_verification_status", "invalid_verification"),
  };
}

/**
 * Classifier uses numeric null/invalid only when status is OK; missing columns → 0
 * (schema gaps are handled via missingColumns, not fake nulls).
 * @param {{ status: string, value: number|null }|number|null|undefined} field
 */
export function numericCountForClassifier(field) {
  if (field == null) return 0;
  if (typeof field === "number") return field;
  if (field.status === NOT_APPLICABLE_COLUMN_MISSING) return 0;
  return Number(field.value ?? 0);
}

/**
 * Build SELECT list fragments for profile counts — only for columns that exist.
 * Returns null selectSql when only total is available.
 *
 * @param {Iterable<string>} presentColumns
 * @returns {{ selectSql: string, keys: string[] }}
 */
export function buildProfileCountsSelectSql(presentColumns) {
  const cols = new Set(presentColumns || []);
  const parts = ["count(*)::int as total"];
  const keys = ["total"];

  if (cols.has("privacy_settings")) {
    parts.push("count(*) filter (where privacy_settings is null)::int as privacy_null");
    keys.push("privacy_null");
  }
  if (cols.has("identity_verification_status")) {
    parts.push(
      "count(*) filter (where identity_verification_status is null)::int as verification_null"
    );
    parts.push(`count(*) filter (
        where identity_verification_status is not null
          and identity_verification_status not in ('unverified', 'pending', 'verified', 'rejected')
      )::int as invalid_verification`);
    keys.push("verification_null", "invalid_verification");
  }
  if (cols.has("handedness")) {
    parts.push(`count(*) filter (
        where handedness is not null
          and handedness not in ('right', 'left', 'ambidextrous', 'unknown')
      )::int as invalid_handedness`);
    keys.push("invalid_handedness");
  }

  return {
    selectSql: `select ${parts.join(",\n      ")} from public.profiles`,
    keys,
  };
}

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

  const privacyNull = numericCountForClassifier(
    snapshot.counts?.privacy_null ?? snapshot.privacyNullCount
  );
  const verificationNull = numericCountForClassifier(
    snapshot.counts?.verification_null ?? snapshot.verificationNullCount
  );
  const invalidHandedness = numericCountForClassifier(
    snapshot.counts?.invalid_handedness ?? snapshot.invalidHandednessCount
  );
  const invalidVerification = numericCountForClassifier(
    snapshot.counts?.invalid_verification ?? snapshot.invalidVerificationCount
  );
  const duplicateConstraints = Number(snapshot.duplicateConstraintCount ?? 0);
  const conflictingTriggers = Number(snapshot.conflictingTriggerCount ?? 0);
  const hasUnsafeBypass = snapshot.guardHasCurrentUserPostgresBypass === true;
  const missingSelfBlock = snapshot.guardHasSelfVerificationBlock === false;
  const rlsWeakened = snapshot.rlsPoliciesMatchBaseline === false;
  const grantsWeakened = snapshot.grantsMatchBaseline === false;

  // Unsafe guard / conflicts always win — even when Phase 1D columns are absent.
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
  if (columns.has("handedness") && invalidHandedness > 0) {
    blockers.push(`Invalid handedness values present: ${invalidHandedness}`);
  }
  if (columns.has("identity_verification_status") && invalidVerification > 0) {
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

  const missingFoundation = PHASE_1E_FOUNDATION_COLUMNS.filter((c) => !columns.has(c));
  const presentFoundation = PHASE_1E_FOUNDATION_COLUMNS.filter((c) => columns.has(c));

  if (
    missingFoundation.length === PHASE_1E_FOUNDATION_COLUMNS.length &&
    !hasGuardFn &&
    !hasTrigger &&
    !hasIndex
  ) {
    reasons.push("No Phase 1D foundation columns/index/guard detected");
    return { classification: "NOT_APPLIED", reasons, blockers };
  }

  const privacyOk =
    !columns.has("privacy_settings") || privacyNull === 0;
  const verificationOk =
    !columns.has("identity_verification_status") || verificationNull === 0;

  const ready =
    missingColumns.length === 0 &&
    missingConstraints.length === 0 &&
    hasIndex &&
    hasGuardFn &&
    hasTrigger &&
    privacyOk &&
    verificationOk &&
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
    if (columns.has("privacy_settings") && privacyNull > 0) {
      reasons.push(`privacy_settings null rows: ${privacyNull}`);
    }
    if (columns.has("identity_verification_status") && verificationNull > 0) {
      reasons.push(`identity_verification_status null rows: ${verificationNull}`);
    }
    return { classification: "PARTIALLY_APPLIED", reasons, blockers };
  }

  reasons.push("Unable to classify as ready; treating as not applied");
  return { classification: "NOT_APPLIED", reasons, blockers };
}

/**
 * Simulate current Production Gate A shape (only birth_year + unsafe legacy guard).
 * Used by tests to lock BLOCKED_UNSAFE precedence.
 */
export function classifyKnownProductionPreMigrationShape() {
  return classifyPhase1eProductionPreflight({
    columns: ["birth_year"],
    constraints: [],
    indexes: [],
    triggers: [PHASE_1E_GUARD_TRIGGER],
    guardFunctionExists: true,
    guardHasCurrentUserPostgresBypass: true,
    guardHasSelfVerificationBlock: false,
    counts: buildConditionalProfileCounts(["birth_year"], { total: 61 }),
    duplicateConstraintCount: 0,
    conflictingTriggerCount: 0,
    rlsPoliciesMatchBaseline: true,
    grantsMatchBaseline: true,
  });
}
