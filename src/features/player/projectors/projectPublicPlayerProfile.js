/**
 * Phase 1F-B1 — Canonical public player profile projector (pure policy).
 *
 * Deterministic, side-effect free. Does not mutate input.
 * Does not import UI or database clients.
 *
 * Contract SSOT: src/features/player/constants/privacy.js
 * Visibility: docs/player-management/phase-1a/05_PRIVACY_AND_PROFILE_VISIBILITY.md
 */
import {
  DEFAULT_PRIVACY_SETTINGS,
  normalizePrivacySettings,
  validatePrivacySettings,
} from "../constants/privacy.js";

export const PUBLIC_PROFILE_HIDE_REASON = Object.freeze({
  PUBLIC_PROFILE_DISABLED: "PUBLIC_PROFILE_DISABLED",
  PRIVACY_MISSING: "PRIVACY_MISSING",
  PRIVACY_MALFORMED: "PRIVACY_MALFORMED",
  INVALID_PROFILE: "INVALID_PROFILE",
});

/**
 * Opaque public DTO — no profile fields.
 * @param {string} reason
 * @returns {{ visible: false, reason: string }}
 */
export function buildOpaquePublicPlayerProfile(reason) {
  return Object.freeze({
    visible: false,
    reason: String(reason || PUBLIC_PROFILE_HIDE_REASON.PUBLIC_PROFILE_DISABLED),
  });
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

/**
 * Resolve privacy for projection. Fail closed — never throw to callers.
 * @param {unknown} privacySettings
 * @returns {{ ok: true, privacy: object, missing: boolean } | { ok: false, reason: string }}
 */
function resolvePrivacyForProjection(privacySettings) {
  if (privacySettings == null) {
    return {
      ok: true,
      privacy: { ...DEFAULT_PRIVACY_SETTINGS },
      missing: true,
    };
  }

  if (!isPlainObject(privacySettings)) {
    return { ok: false, reason: PUBLIC_PROFILE_HIDE_REASON.PRIVACY_MALFORMED };
  }

  const validated = validatePrivacySettings(privacySettings);
  if (!validated.ok || !validated.value) {
    return { ok: false, reason: PUBLIC_PROFILE_HIDE_REASON.PRIVACY_MALFORMED };
  }

  // Re-normalize through SSOT (strips unknown keys; does not expand output surface).
  try {
    return {
      ok: true,
      privacy: normalizePrivacySettings(validated.value),
      missing: false,
    };
  } catch {
    return { ok: false, reason: PUBLIC_PROFILE_HIDE_REASON.PRIVACY_MALFORMED };
  }
}

function copyIfPresent(target, source, key) {
  if (!hasOwn(source, key)) return;
  const value = source[key];
  if (value == null) return;
  if (typeof value === "string" && value.trim() === "") return;
  target[key] = value;
}

function copyActivityRegion(target, region) {
  if (!isPlainObject(region)) return;
  const next = {};
  for (const key of ["countryCode", "provinceCode", "provinceName", "city", "district"]) {
    if (!hasOwn(region, key)) continue;
    const value = region[key];
    if (value == null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    next[key] = value;
  }
  if (Object.keys(next).length === 0) return;
  target.activityRegion = next;
}

function copyClubMemberships(target, refs) {
  if (!Array.isArray(refs) || refs.length === 0) return;
  // Shallow-copy entries; omit nothing nested beyond a plain clone of enumerable own props.
  target.clubMembershipReferences = refs.map((entry) => {
    if (!isPlainObject(entry)) return entry;
    return { ...entry };
  });
}

/**
 * Project a normalized (or partial) player profile to a public DTO.
 *
 * @param {object|null|undefined} profile
 * @param {object} [options]
 * @param {unknown} [options.privacySettings] — override; defaults to profile.privacySettings
 * @returns {Readonly<{ visible: false, reason: string } | { visible: true, playerId?: string, displayName?: string, avatarUrl?: string, phone?: string, email?: string, birthDate?: string, birthYear?: number, gender?: string, handedness?: string, activityRegion?: object, clubMembershipReferences?: object[] }>}
 */
export function projectPublicPlayerProfile(profile, options = {}) {
  if (!isPlainObject(profile)) {
    return buildOpaquePublicPlayerProfile(PUBLIC_PROFILE_HIDE_REASON.INVALID_PROFILE);
  }

  const privacyInput =
    options.privacySettings !== undefined ? options.privacySettings : profile.privacySettings;

  const privacyResult = resolvePrivacyForProjection(privacyInput);
  if (!privacyResult.ok) {
    return buildOpaquePublicPlayerProfile(privacyResult.reason);
  }

  const { privacy, missing } = privacyResult;

  // Missing/null privacy → fail closed (opaque), even though defaults are publicProfileEnabled=false.
  if (missing) {
    return buildOpaquePublicPlayerProfile(PUBLIC_PROFILE_HIDE_REASON.PRIVACY_MISSING);
  }

  if (privacy.publicProfileEnabled !== true) {
    return buildOpaquePublicPlayerProfile(PUBLIC_PROFILE_HIDE_REASON.PUBLIC_PROFILE_DISABLED);
  }

  /** @type {Record<string, unknown>} */
  const dto = { visible: true };

  // Always-public identity fields when public profile is enabled (Phase 1A allow-list).
  copyIfPresent(dto, profile, "playerId");
  copyIfPresent(dto, profile, "displayName");
  copyIfPresent(dto, profile, "avatarUrl");

  // Flag-controlled fields — omit key entirely when disallowed or empty.
  if (privacy.showPhone === true) {
    copyIfPresent(dto, profile, "phone");
  }
  if (privacy.showEmail === true) {
    copyIfPresent(dto, profile, "email");
  }
  if (privacy.showBirthDate === true) {
    copyIfPresent(dto, profile, "birthDate");
  }
  if (privacy.showBirthYear === true) {
    // Do not invent birthYear from birthDate in this projector.
    if (hasOwn(profile, "birthYear") && profile.birthYear != null && profile.birthYear !== "") {
      const year = Number(profile.birthYear);
      if (Number.isFinite(year)) dto.birthYear = year;
    }
  }
  if (privacy.showGender === true) {
    copyIfPresent(dto, profile, "gender");
  }
  if (privacy.showHandedness === true) {
    copyIfPresent(dto, profile, "handedness");
  }
  if (privacy.showActivityRegion === true) {
    copyActivityRegion(dto, profile.activityRegion);
  }
  if (privacy.showClubMemberships === true) {
    copyClubMemberships(dto, profile.clubMembershipReferences);
  }

  // Explicitly never project (even if present on input):
  // authUserId, athleteId, accountStatus, profileStatus, verificationStatus,
  // privacySettings, roles, sourceReferences, rating/ranking refs, timestamps, fullName, ageGroup, …

  return Object.freeze(dto);
}
