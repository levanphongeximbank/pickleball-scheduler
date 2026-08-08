/**
 * Live eligibility re-checks for Operation B1B identities.
 * Injected adapters keep this unit-testable without Production I/O.
 */

import { isCertifiedQaEmail } from "../../../../src/features/player/utils/qaTestIdentityFilter.js";
import {
  B2_EXCLUDED_LABELS,
  FORBIDDEN_REAL_USER_EMAIL,
  ZERO_REFERENCE_KEYS,
} from "./constants.js";

export function hasBusinessReferences(referenceCounts = {}) {
  for (const key of ZERO_REFERENCE_KEYS) {
    if (Number(referenceCounts?.[key] || 0) !== 0) return true;
  }
  return false;
}

/**
 * Evaluate one allowlisted identity against live adapters.
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

  const emailOverride = adapters.emailOverrides?.[authUserId];
  let email;
  if (emailOverride != null && String(emailOverride).trim()) {
    email = String(emailOverride).trim().toLowerCase();
  } else if (typeof adapters.fetchAuthUser === "function") {
    try {
      const authUser = await adapters.fetchAuthUser(authUserId);
      email = authUser?.email
        ? String(authUser.email).trim().toLowerCase()
        : null;
    } catch {
      result.reasons.push("auth_lookup_failed");
      return result;
    }
  } else {
    result.reasons.push("auth_lookup_unavailable");
    return result;
  }

  result.email = email;
  if (!email) {
    result.reasons.push("email_absent");
    return result;
  }
  if (email === FORBIDDEN_REAL_USER_EMAIL) {
    result.reasons.push("forbidden_real_user_email");
    return result;
  }
  if (!isCertifiedQaEmail(email)) {
    result.reasons.push("email_not_certified_qa");
    return result;
  }

  const expected = String(allowlistRow.expected_email || "")
    .trim()
    .toLowerCase();
  if (expected && expected !== email) {
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
  const profileEmail = String(profile.email || "")
    .trim()
    .toLowerCase();
  if (profileEmail && profileEmail !== email) {
    result.reasons.push("profile_email_mismatch");
    return result;
  }
  result.profileStatus = profile.status ?? null;

  if (typeof adapters.fetchReferenceCounts !== "function") {
    result.reasons.push("reference_lookup_unavailable");
    return result;
  }
  const refs = await adapters.fetchReferenceCounts(profileId);
  result.references = refs || {};
  if (hasBusinessReferences(refs)) {
    result.reasons.push("business_references_present");
    return result;
  }

  if (typeof adapters.fetchAuthBanState !== "function") {
    result.reasons.push("auth_ban_state_unreadable");
    return result;
  }
  const banned = await adapters.fetchAuthBanState(authUserId);
  if (banned !== true && banned !== false) {
    result.reasons.push("auth_ban_state_unreadable");
    return result;
  }
  result.authBanned = banned;

  result.ok = result.reasons.length === 0;
  return result;
}
