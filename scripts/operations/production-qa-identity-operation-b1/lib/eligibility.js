/**
 * Live eligibility re-checks for Operation B1 identities.
 * Injected adapters keep this unit-testable without Production I/O.
 */

import { isCertifiedQaEmail } from "../../../../src/features/player/utils/qaTestIdentityFilter.js";
import {
  B2_EXCLUDED_LABELS,
  FORBIDDEN_REAL_USER_EMAIL,
  ZERO_REFERENCE_KEYS,
} from "./constants.js";
import { resolveAuthUserEmailForQuarantine } from "../../../lib/prod-smoke-identity-hygiene.mjs";

/**
 * Normalize reference counts to integers.
 */
export function hasBusinessReferences(referenceCounts = {}) {
  for (const key of ZERO_REFERENCE_KEYS) {
    if (Number(referenceCounts?.[key] || 0) !== 0) return true;
  }
  return false;
}

/**
 * Evaluate one allowlisted identity against live adapters.
 *
 * @param {object} allowlistRow
 * @param {{
 *   admin?: any,
 *   fetchAuthUser?: (id: string) => Promise<{id:string,email?:string|null,banned_until?:string|null}|null>,
 *   emailOverrides?: Record<string, string>,
 *   fetchProfile?: (id: string) => Promise<{id:string,email:string,status:string}|null>,
 *   fetchReferenceCounts?: (id: string) => Promise<Record<string, number>>,
 *   fetchAuthBanState?: (id: string) => Promise<boolean|null>,
 * }} adapters
 */
export async function evaluateIdentityEligibility(allowlistRow, adapters = {}) {
  const result = {
    label: allowlistRow.label || null,
    ok: false,
    reasons: [],
    email: null,
    profileStatus: null,
    authBanned: null,
    references: null,
    mutations: 0,
  };

  if (B2_EXCLUDED_LABELS.includes(String(allowlistRow.label || ""))) {
    result.reasons.push("b2_excluded_label");
    return result;
  }

  const authUserId = String(allowlistRow.auth_user_id || "").trim();
  const profileId = String(allowlistRow.profile_id || "").trim();
  if (!authUserId || !profileId) {
    result.reasons.push("missing_ids");
    return result;
  }
  if (authUserId !== profileId) {
    result.reasons.push("ambiguous_auth_profile_mapping");
    return result;
  }

  // Auth ID alone is never enough — email must resolve and be certified.
  // Prefer narrow fetchAuthUser (no raw admin on live adapter surface).
  let resolved;
  const emailOverride = adapters.emailOverrides?.[authUserId];
  if (emailOverride != null && String(emailOverride).trim()) {
    resolved = await resolveAuthUserEmailForQuarantine({
      userId: authUserId,
      emailOverride,
    });
  } else if (typeof adapters.fetchAuthUser === "function") {
    try {
      const authUser = await adapters.fetchAuthUser(authUserId);
      const email = authUser?.email
        ? String(authUser.email).trim().toLowerCase()
        : null;
      resolved = email
        ? { ok: true, email }
        : { ok: false, email: null, reason: "email_absent" };
    } catch (err) {
      resolved = {
        ok: false,
        email: null,
        reason: String(err?.message || err || "auth_lookup_failed"),
      };
    }
  } else {
    resolved = await resolveAuthUserEmailForQuarantine({
      admin: adapters.admin,
      userId: authUserId,
    });
  }
  result.email = resolved.email;

  if (!resolved.ok || !resolved.email) {
    result.reasons.push(resolved.reason || "email_absent");
    return result;
  }
  if (resolved.email === FORBIDDEN_REAL_USER_EMAIL) {
    result.reasons.push("forbidden_real_user_email");
    return result;
  }
  if (!isCertifiedQaEmail(resolved.email)) {
    result.reasons.push("email_not_certified_qa");
    return result;
  }

  const expected = String(allowlistRow.expected_email || "")
    .trim()
    .toLowerCase();
  if (expected && expected !== resolved.email) {
    result.reasons.push("email_mismatch_vs_allowlist");
    return result;
  }

  if (typeof adapters.fetchProfile !== "function") {
    result.reasons.push("profile_lookup_unavailable");
    return result;
  }
  const profile = await adapters.fetchProfile(profileId);
  if (!profile) {
    result.reasons.push("profile_missing");
    return result;
  }
  if (String(profile.id) !== profileId) {
    result.reasons.push("ambiguous_identity");
    return result;
  }
  const profileEmail = String(profile.email || "")
    .trim()
    .toLowerCase();
  if (!profileEmail) {
    result.reasons.push("profile_email_missing");
    return result;
  }
  if (profileEmail !== resolved.email) {
    result.reasons.push("profile_auth_email_mismatch");
    return result;
  }
  result.profileStatus = profile.status ?? null;

  if (typeof adapters.fetchReferenceCounts !== "function") {
    result.reasons.push("reference_lookup_unavailable");
    return result;
  }
  const refs = await adapters.fetchReferenceCounts(profileId);
  result.references = refs || {};
  if (hasBusinessReferences(result.references)) {
    result.reasons.push("business_reference_present");
    return result;
  }

  // Optional live ban state probe
  if (typeof adapters.fetchAuthBanState === "function") {
    result.authBanned = await adapters.fetchAuthBanState(authUserId);
  }

  result.ok = result.reasons.length === 0;
  return result;
}

/**
 * Evaluate all eight identities; fail closed if any reject.
 */
export async function evaluateAllowlistEligibility(identities, adapters = {}) {
  const results = [];
  for (const row of identities) {
    results.push(await evaluateIdentityEligibility(row, adapters));
  }
  const failed = results.filter((r) => !r.ok);
  return {
    ok: failed.length === 0 && results.length === identities.length,
    results,
    failedCount: failed.length,
  };
}
