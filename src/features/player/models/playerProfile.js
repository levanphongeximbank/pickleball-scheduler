/**
 * Normalized Player Profile read model (Phase 1B).
 * Missing fields remain null — do not invent data.
 */
import { normalizePlayerGender } from "../adapters/genderAdapter.js";
import { DEFAULT_PRIVACY_SETTINGS } from "../constants/privacy.js";
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
 * Normalize a partial profile from adapters. Does not invent missing values.
 * Gender is always canonical when present (including unknown).
 *
 * @param {object} [partial]
 * @param {object} [options]
 * @param {boolean} [options.applyDefaultPrivacy=false] — Phase 1B default false (null until stored)
 * @returns {object}
 */
export function normalizePlayerProfile(partial = {}, options = {}) {
  const base = emptyPlayerProfile();
  const genderRaw = partial.gender;
  const hasGender = genderRaw !== undefined && genderRaw !== null && String(genderRaw).trim() !== "";

  const privacySettings =
    partial.privacySettings && typeof partial.privacySettings === "object"
      ? { ...DEFAULT_PRIVACY_SETTINGS, ...partial.privacySettings }
      : options.applyDefaultPrivacy
        ? { ...DEFAULT_PRIVACY_SETTINGS }
        : null;

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
    birthDate: nullIfEmpty(partial.birthDate ?? partial.birth_date) || null,
    birthYear: asNumberOrNull(partial.birthYear ?? partial.birth_year),
    ageGroup: nullIfEmpty(partial.ageGroup ?? partial.age_group) || null,
    handedness: nullIfEmpty(partial.handedness) || null,
    activityRegion: nullIfEmpty(partial.activityRegion ?? partial.activity_region) || null,
    profileStatus: nullIfEmpty(partial.profileStatus ?? partial.status) || null,
    accountStatus: nullIfEmpty(partial.accountStatus ?? partial.account_status) || null,
    verificationStatus: nullIfEmpty(partial.verificationStatus ?? partial.verification_status) || null,
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
    const normalized = normalizePlayerProfile(part);
    for (const key of Object.keys(merged)) {
      if (key === "sourceReferences" || key.endsWith("References")) continue;
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
