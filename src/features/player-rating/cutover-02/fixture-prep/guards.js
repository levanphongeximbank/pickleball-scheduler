/**
 * A3c project / caller / target / cohort / value guards (local authoritative rules).
 * Database SQL mirrors these; frontend flags alone are insufficient.
 */

import {
  CUTOVER_02_PRODUCTION_PROJECT_REF,
  CUTOVER_02_STAGING_PROJECT_REF,
  extractSupabaseProjectRef,
  isProductionDenyActive,
} from "../config/environmentGuards.js";
import {
  FIXTURE_CALIBRATION_PERMISSION,
  FIXTURE_COHORT_LABEL,
  FIXTURE_PREP_OUTCOME,
} from "./constants.js";
import {
  getFixtureByHash,
  getFixtureByLabel,
  isApprovedFixtureHash,
  profileIdHash12,
} from "./fixtureManifest.js";

/**
 * @param {Record<string, unknown>|null|undefined} env
 * @param {{ projectRef?: string|null, supabaseUrl?: string|null }} [opts]
 */
export function evaluateProjectGuard(env = {}, opts = {}) {
  const bag = env && typeof env === "object" ? env : {};
  if (isProductionDenyActive(bag)) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.WRONG_PROJECT,
      reason: "PRODUCTION_DENY",
      projectRef: CUTOVER_02_PRODUCTION_PROJECT_REF,
    };
  }

  const url = String(
    opts.supabaseUrl ||
      bag.SUPABASE_URL ||
      bag.VITE_SUPABASE_URL ||
      ""
  ).trim();
  const explicit = String(opts.projectRef || "").trim().toLowerCase();
  const ref = explicit || extractSupabaseProjectRef(url);

  if (!ref) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.WRONG_PROJECT,
      reason: "MISSING_PROJECT_IDENTITY",
      projectRef: null,
    };
  }
  if (ref === CUTOVER_02_PRODUCTION_PROJECT_REF) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.WRONG_PROJECT,
      reason: "PRODUCTION_PROJECT",
      projectRef: ref,
    };
  }
  if (ref !== CUTOVER_02_STAGING_PROJECT_REF) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.WRONG_PROJECT,
      reason: "WRONG_STAGING_OR_UNKNOWN_PROJECT",
      projectRef: ref,
      expected: CUTOVER_02_STAGING_PROJECT_REF,
    };
  }
  return {
    ok: true,
    code: "PROJECT_OK",
    projectRef: ref,
    expected: CUTOVER_02_STAGING_PROJECT_REF,
  };
}

/**
 * @param {{
 *   authenticated?: boolean,
 *   callerId?: string|null,
 *   isSuperAdmin?: boolean,
 *   permissions?: string[]|Set<string>|null,
 *   isAnonymous?: boolean,
 *   isServiceRoleOnlyAnonymous?: boolean,
 * }} caller
 */
export function evaluateCallerGuard(caller = {}) {
  if (caller.isServiceRoleOnlyAnonymous) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.UNAUTHORIZED_CALLER,
      reason: "SERVICE_ROLE_ANONYMOUS_FORBIDDEN",
    };
  }
  if (caller.isAnonymous || caller.authenticated === false) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.UNAUTHORIZED_CALLER,
      reason: "ANONYMOUS",
    };
  }
  const callerId = String(caller.callerId || "").trim();
  if (!callerId) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.UNAUTHORIZED_CALLER,
      reason: "MISSING_CALLER_ID",
    };
  }
  const perms = caller.permissions
    ? caller.permissions instanceof Set
      ? caller.permissions
      : new Set(caller.permissions)
    : new Set();
  const hasCalibration = perms.has(FIXTURE_CALIBRATION_PERMISSION);
  if (caller.isSuperAdmin === true || hasCalibration) {
    return {
      ok: true,
      code: "CALLER_OK",
      callerId,
      via: caller.isSuperAdmin ? "SUPER_ADMIN" : "CALIBRATION_MANAGE",
    };
  }
  return {
    ok: false,
    code: FIXTURE_PREP_OUTCOME.UNAUTHORIZED_CALLER,
    reason: "ORDINARY_OR_INSUFFICIENT_PERMISSION",
    callerId,
  };
}

/**
 * @param {string|null|undefined} cohortLabel
 */
export function evaluateCohortGuard(cohortLabel) {
  const label = String(cohortLabel || "").trim();
  if (label !== FIXTURE_COHORT_LABEL) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.WRONG_COHORT,
      reason: "COHORT_MISMATCH",
      expected: FIXTURE_COHORT_LABEL,
      received: label || null,
    };
  }
  return { ok: true, code: "COHORT_OK", cohortLabel: label };
}

/**
 * @param {{
 *   profileId?: string|null,
 *   authUserId?: string|null,
 *   active?: boolean,
 *   existsInAuth?: boolean,
 *   existsInProfiles?: boolean,
 *   emailLooksLikeWave1Fixture?: boolean,
 *   idHash?: string|null,
 *   candidateLabel?: string|null,
 *   isProductionIdentity?: boolean,
 * }} target
 */
export function evaluateTargetGuard(target = {}) {
  if (target.isProductionIdentity) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.TARGET_NOT_APPROVED,
      reason: "PRODUCTION_IDENTITY",
    };
  }
  if (!target.existsInAuth || !target.existsInProfiles) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.TARGET_NOT_APPROVED,
      reason: "MISSING_AUTH_OR_PROFILE",
    };
  }
  if (target.active !== true) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.TARGET_NOT_APPROVED,
      reason: "INACTIVE",
    };
  }
  const profileId = String(target.profileId || "").trim();
  const authUserId = String(target.authUserId || "").trim();
  if (!profileId || !authUserId || profileId !== authUserId) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.TARGET_NOT_APPROVED,
      reason: "PROFILE_AUTH_MISMATCH",
    };
  }
  if (target.emailLooksLikeWave1Fixture !== true) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.TARGET_NOT_APPROVED,
      reason: "MISSING_FIXTURE_DOMAIN_EVIDENCE",
    };
  }

  const hash =
    String(target.idHash || "").trim().toLowerCase() ||
    profileIdHash12(profileId);
  if (!isApprovedFixtureHash(hash)) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.TARGET_NOT_APPROVED,
      reason: "NOT_IN_FIXED_FIVE",
      idHash: hash,
    };
  }

  const fixture = getFixtureByHash(hash);
  if (target.candidateLabel) {
    const byLabel = getFixtureByLabel(target.candidateLabel);
    if (!byLabel || byLabel.idHash !== hash) {
      return {
        ok: false,
        code: FIXTURE_PREP_OUTCOME.TARGET_NOT_APPROVED,
        reason: "LABEL_HASH_MISMATCH",
        idHash: hash,
      };
    }
  }

  return {
    ok: true,
    code: "TARGET_OK",
    idHash: hash,
    label: fixture.label,
    fixture,
  };
}

/**
 * @param {{ v2Raw?: unknown, v5TargetDisplay?: unknown, fixture?: import('./fixtureManifest.js').FixtureCandidateSpec|null }} input
 */
export function evaluateValueGuard(input = {}) {
  const fixture = input.fixture;
  if (!fixture) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.INVALID_V5_FIXTURE_INPUT,
      reason: "MISSING_FIXTURE",
    };
  }
  const v2 = Number(input.v2Raw);
  if (!Number.isFinite(v2) || Math.abs(v2 - fixture.v2Raw) > 1e-9) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.INVALID_V2_VALUE,
      reason: "V2_NOT_IN_APPROVED_FIXTURE_BUNDLE",
      expected: fixture.v2Raw,
      received: input.v2Raw ?? null,
    };
  }
  const v5 = Number(input.v5TargetDisplay);
  if (!Number.isFinite(v5) || Math.abs(v5 - fixture.v5TargetDisplay) > 1e-9) {
    return {
      ok: false,
      code: FIXTURE_PREP_OUTCOME.INVALID_V5_FIXTURE_INPUT,
      reason: "V5_NOT_IN_APPROVED_FIXTURE_BUNDLE",
      expected: fixture.v5TargetDisplay,
      received: input.v5TargetDisplay ?? null,
    };
  }
  return {
    ok: true,
    code: "VALUE_OK",
    v2Raw: fixture.v2Raw,
    v5TargetDisplay: fixture.v5TargetDisplay,
  };
}
