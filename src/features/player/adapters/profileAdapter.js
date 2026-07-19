/**
 * Adapt Identity `profiles` row → player profile partial (read-only).
 * Account fields remain owned by Identity; Player Management only normalizes reads.
 * Phase 1C foundation columns map onto Player Management camelCase fields.
 */
import { normalizeActivityRegion } from "./activityRegionAdapter.js";
import { normalizePlayerGender } from "./genderAdapter.js";
import { normalizeHandedness } from "./handednessAdapter.js";
import { normalizeVerificationStatus } from "./verificationAdapter.js";
import { normalizePrivacySettings } from "../constants/privacy.js";

/**
 * @param {object|null|undefined} profile
 * @returns {object|null}
 */
export function adaptProfileRow(profile) {
  if (!profile || typeof profile !== "object") return null;

  const authUserId = String(profile.id || profile.user_id || profile.userId || "").trim() || null;
  const mappedPlayerId =
    String(profile.player_id || profile.playerId || "").trim() || null;

  const genderRaw = profile.gender;
  const hasGender = genderRaw !== undefined && genderRaw !== null && String(genderRaw).trim() !== "";

  const handednessRaw = profile.handedness;
  const hasHandedness =
    handednessRaw !== undefined && handednessRaw !== null && String(handednessRaw).trim() !== "";

  const verificationRaw =
    profile.identity_verification_status ??
    profile.identityVerificationStatus ??
    profile.verificationStatus;
  const hasVerification =
    verificationRaw !== undefined && verificationRaw !== null && String(verificationRaw).trim() !== "";

  const hasPrivacy =
    profile.privacy_settings !== undefined || profile.privacySettings !== undefined;
  const privacyRaw = profile.privacy_settings ?? profile.privacySettings;

  const hasRegion =
    profile.activity_region !== undefined || profile.activityRegion !== undefined;

  return {
    source: "profiles",
    playerId: mappedPlayerId,
    authUserId,
    displayName: profile.display_name || profile.displayName || null,
    phone: profile.phone ?? null,
    email: profile.email ?? null,
    avatarUrl: profile.avatar_url || profile.avatarUrl || null,
    gender: hasGender ? normalizePlayerGender(genderRaw) : null,
    birthDate: profile.birth_date ?? profile.birthDate ?? null,
    birthYear: profile.birth_year ?? profile.birthYear ?? null,
    handedness: hasHandedness ? normalizeHandedness(handednessRaw) : null,
    activityRegion: hasRegion
      ? normalizeActivityRegion(profile.activity_region ?? profile.activityRegion)
      : null,
    privacySettings: (() => {
      if (!hasPrivacy || !privacyRaw) return null;
      try {
        return normalizePrivacySettings(privacyRaw);
      } catch {
        return null;
      }
    })(),
    verificationStatus: hasVerification ? normalizeVerificationStatus(verificationRaw) : null,
    accountStatus: profile.status ?? null,
    // profiles.status is account status — not profileStatus
    profileStatus: null,
    createdAt: profile.created_at ?? profile.createdAt ?? null,
    updatedAt: profile.updated_at ?? profile.updatedAt ?? null,
    sourceReferences: [
      {
        source: "profiles",
        id: authUserId,
        playerId: mappedPlayerId,
      },
    ],
  };
}
