/**
 * Explicit field-level privacy policy for Player Rating projections (Phase 1I).
 */

import { clonePlain, deepFreeze } from "../contracts/shared.js";
import { PLAYER_RATING_PRIVACY_PROJECTION_LEVEL } from "./privacyProjectionLevels.js";

/** Warning codes safe for PUBLIC / PLAYER_SELF consumers. */
export const DEFAULT_PUBLIC_WARNING_ALLOWLIST = Object.freeze([
  "SOURCE_SCALE_PICK_VN_V2_1_0_TO_8_0_PRESERVED",
  "SOURCE_SCALE_PICK_VN_V5_1_5_TO_6_0_PRESERVED",
  "SOURCE_SCALE_LEGACY_UNKNOWN_PRESERVED",
  "NO_SCALE_CONVERSION_APPLIED",
  "V5_TABLE_NOT_DECLARED_RUNTIME_SSOT",
  "V2_TABLE_NOT_DECLARED_RUNTIME_SSOT",
  "LEGACY_NOT_DECLARED_RUNTIME_SSOT",
  "CANONICAL_PLAYER_ID_UNRESOLVED",
  "PROFILES_ID_IS_ALIAS_OR_UNRESOLVED_UNLESS_CANONICAL_SUPPLIED",
  "PARTIAL_DATA",
  "NO_RATING_DATA",
  "IDENTITY_CONFLICT",
]);

/**
 * Keys that must never appear in any projection (unrelated PM / secrets).
 * @type {ReadonlyArray<string>}
 */
export const ALWAYS_EXCLUDED_PROFILE_KEYS = Object.freeze([
  "email",
  "phone",
  "password",
  "token",
  "secret",
  "accessToken",
  "refreshToken",
  "apiKey",
  "authToken",
  "sessionToken",
  "fullName",
  "displayName",
  "firstName",
  "lastName",
  "avatarUrl",
  "dateOfBirth",
  "address",
  "nationalId",
]);

/**
 * @param {Partial<{
 *   exposePublicPlayerId: boolean,
 *   exposePublicVerifiedRating: boolean,
 *   exposeSelfConfidenceSummary: boolean,
 *   exposeSelfReliabilityInternals: boolean,
 *   exposeSelfDeviationInternals: boolean,
 *   publicWarningAllowlist: string[],
 * }>} [overrides]
 */
export function createPlayerRatingPrivacyPolicy(overrides = {}) {
  const publicWarningAllowlist = Array.isArray(overrides.publicWarningAllowlist)
    ? [...overrides.publicWarningAllowlist]
    : [...DEFAULT_PUBLIC_WARNING_ALLOWLIST];

  const policy = {
    exposePublicPlayerId: overrides.exposePublicPlayerId !== false,
    exposePublicVerifiedRating: overrides.exposePublicVerifiedRating === true,
    exposeSelfConfidenceSummary: overrides.exposeSelfConfidenceSummary === true,
    exposeSelfReliabilityInternals:
      overrides.exposeSelfReliabilityInternals === true,
    exposeSelfDeviationInternals:
      overrides.exposeSelfDeviationInternals === true,
    publicWarningAllowlist: Object.freeze(publicWarningAllowlist),
    alwaysExcludedProfileKeys: ALWAYS_EXCLUDED_PROFILE_KEYS,
    projectionLevels: PLAYER_RATING_PRIVACY_PROJECTION_LEVEL,
  };

  return deepFreeze(clonePlain(policy));
}
