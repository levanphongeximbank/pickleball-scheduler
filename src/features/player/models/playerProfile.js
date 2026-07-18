/**
 * Normalized Player Profile read model (Phase 1B + 1C field support).
 * Missing fields remain null — do not invent data.
 * ageGroup is derived on read when enough context exists.
 */
import { normalizePlayerGender } from "../adapters/genderAdapter.js";
import { normalizeHandedness } from "../adapters/handednessAdapter.js";
import { normalizeActivityRegion } from "../adapters/activityRegionAdapter.js";
import { normalizeVerificationStatus } from "../adapters/verificationAdapter.js";
import { DEFAULT_PRIVACY_SETTINGS, normalizePrivacySettings } from "../constants/privacy.js";
import {
  deriveAgeGroup,
  deriveBirthYearForRead,
  parseIsoDateOnly,
} from "../utils/birthDate.js";
import { trimId } from "../utils/playerId.js";

/**
 * @returns {object}
 */
export function emptyPlayerProfile() {
  return {
    playerId: null,
    authUserId: null,
    athleteId: null,
    displayName: null,
    fullName: null,
    phone: null,
    email: null,
    avatarUrl: null,
    gender: null,
    birthDate: null,
    birthYear: null,
    ageGroup: null,
    handedness: null,
    activityRegion: null,
    profileStatus: null,
    accountStatus: null,
    verificationStatus: null,
    privacySettings: null,
    clubMembershipReferences: [],
    ratingReferences: [],
    rankingReferences: [],
    sourceReferences: [],
    createdAt: null,
    updatedAt: null,
  };
}

function nullIfEmpty(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  return value;
}

function asNumberOrNull(value) {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {object} [partial]
 * @param {object} [options]
 * @param {boolean} [options.applyDefaultPrivacy=false]
 * @param {Date|string} [options.referenceDate] — ageGroup reference (UTC calendar day)
 * @param {boolean} [options.deriveAgeGroup=true]
 * @returns {object}
 */
export function normalizePlayerProfile(partial = {}, options = {}) {
  const base = emptyPlayerProfile();
  const genderRaw = partial.gender;
  const hasGender = genderRaw !== undefined && genderRaw !== null && String(genderRaw).trim() !== "";

  const handednessRaw = partial.handedness;
  const hasHandedness =
    handednessRaw !== undefined && handednessRaw !== null && String(handednessRaw).trim() !== "";

  const verificationRaw = partial.verificationStatus ?? partial.verification_status;
  const hasVerification =
    verificationRaw !== undefined && verificationRaw !== null && String(verificationRaw).trim() !== "";

  let privacySettings = null;
  if (partial.privacySettings && typeof partial.privacySettings === "object") {
    privacySettings = normalizePrivacySettings(partial.privacySettings);
  } else if (options.applyDefaultPrivacy) {
    privacySettings = { ...DEFAULT_PRIVACY_SETTINGS };
  }

  const birthDateRaw = nullIfEmpty(partial.birthDate ?? partial.birth_date) || null;
  // Never invent birthDate from birthYear; keep only valid ISO calendar dates
  const safeBirthDate = birthDateRaw && parseIsoDateOnly(birthDateRaw) ? birthDateRaw : null;
  const rawBirthYear = asNumberOrNull(partial.birthYear ?? partial.birth_year);
  const birthYear = deriveBirthYearForRead(safeBirthDate, rawBirthYear);

  const hasRegionField =
    partial.activityRegion !== undefined || partial.activity_region !== undefined;
  const activityRegion = hasRegionField
    ? normalizeActivityRegion(partial.activityRegion ?? partial.activity_region)
    : null;

  const derive = options.deriveAgeGroup !== false;
  const ageGroup = derive
    ? deriveAgeGroup({
        birthDate: safeBirthDate,
        birthYear,
        referenceDate: options.referenceDate,
      })
    : nullIfEmpty(partial.ageGroup ?? partial.age_group) || null;

  return {
    ...base,
    playerId: nullIfEmpty(partial.playerId ?? partial.id) || null,
    authUserId: nullIfEmpty(partial.authUserId ?? partial.auth_user_id ?? partial.userId) || null,
    athleteId: nullIfEmpty(partial.athleteId ?? partial.athlete_id) || null,
    displayName: nullIfEmpty(partial.displayName ?? partial.display_name ?? partial.name) || null,
    fullName: nullIfEmpty(partial.fullName ?? partial.full_name) || null,
    phone: nullIfEmpty(partial.phone) || null,
    email: nullIfEmpty(partial.email) || null,
    avatarUrl: nullIfEmpty(partial.avatarUrl ?? partial.avatar_url) || null,
    gender: hasGender ? normalizePlayerGender(genderRaw) : null,
    birthDate: safeBirthDate,
    birthYear,
    ageGroup,
    handedness: hasHandedness ? normalizeHandedness(handednessRaw) : null,
    activityRegion,
    profileStatus: nullIfEmpty(partial.profileStatus ?? partial.status) || null,
    accountStatus: nullIfEmpty(partial.accountStatus ?? partial.account_status) || null,
    verificationStatus: hasVerification ? normalizeVerificationStatus(verificationRaw) : null,
    privacySettings,
    clubMembershipReferences: Array.isArray(partial.clubMembershipReferences)
      ? partial.clubMembershipReferences
      : [],
    ratingReferences: Array.isArray(partial.ratingReferences) ? partial.ratingReferences : [],
    rankingReferences: Array.isArray(partial.rankingReferences) ? partial.rankingReferences : [],
    sourceReferences: Array.isArray(partial.sourceReferences) ? partial.sourceReferences : [],
    createdAt: nullIfEmpty(partial.createdAt ?? partial.created_at) || null,
    updatedAt: nullIfEmpty(partial.updatedAt ?? partial.updated_at) || null,
  };
}

/**
 * Merge multiple partial sources. Later sources fill only null/empty fields
 * (first non-empty wins) except arrays which concatenate unique refs.
 * @param {...object} parts
 */
export function mergePlayerProfileParts(...parts) {
  const merged = emptyPlayerProfile();
  const sourceReferences = [];

  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const normalized = normalizePlayerProfile(part, { deriveAgeGroup: false });
    for (const key of Object.keys(merged)) {
      if (key === "sourceReferences" || key.endsWith("References") || key === "ageGroup") continue;
      const current = merged[key];
      const next = normalized[key];
      if ((current == null || current === "") && next != null && next !== "") {
        merged[key] = next;
      }
    }
    for (const listKey of [
      "clubMembershipReferences",
      "ratingReferences",
      "rankingReferences",
      "sourceReferences",
    ]) {
      if (Array.isArray(normalized[listKey]) && normalized[listKey].length) {
        merged[listKey] = [...merged[listKey], ...normalized[listKey]];
      }
    }
    if (part.source) {
      sourceReferences.push({
        source: String(part.source),
        playerId: trimId(part.playerId || part.id) || null,
      });
    }
  }

  if (sourceReferences.length) {
    merged.sourceReferences = [...merged.sourceReferences, ...sourceReferences];
  }

  return normalizePlayerProfile(merged);
}
