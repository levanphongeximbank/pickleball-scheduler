/**
 * Phase 1C privacy settings — fail-closed defaults.
 * New contract keys are canonical; legacy *Public aliases map in.
 */

export const DEFAULT_PRIVACY_SETTINGS = Object.freeze({
  version: 1,
  publicProfileEnabled: false,
  showPhone: false,
  showEmail: false,
  showBirthDate: false,
  showBirthYear: false,
  showActivityRegion: false,
  showClubMemberships: false,
  // Non-sensitive sport attributes — still gated by publicProfileEnabled for public surface
  showGender: true,
  showHandedness: true,
});

export const PRIVACY_CLASS = Object.freeze({
  PUBLIC: "public",
  INTERNAL: "internal",
  RESTRICTED: "restricted",
  SYSTEM: "system",
});

const BOOL_KEYS = [
  "publicProfileEnabled",
  "showPhone",
  "showEmail",
  "showBirthDate",
  "showBirthYear",
  "showActivityRegion",
  "showClubMemberships",
  "showGender",
  "showHandedness",
];

/**
 * Map legacy Phase 1A/1B key names onto Phase 1C canonical keys.
 * @param {object} raw
 */
function mapLegacyPrivacyKeys(raw = {}) {
  const out = { ...raw };
  const legacy = [
    ["showPhonePublic", "showPhone"],
    ["showEmailPublic", "showEmail"],
    ["showBirthDatePublic", "showBirthDate"],
    ["showBirthYearPublic", "showBirthYear"],
    ["showActivityRegionPublic", "showActivityRegion"],
    ["showClubMembershipPublic", "showClubMemberships"],
    ["showGenderPublic", "showGender"],
    ["showHandednessPublic", "showHandedness"],
  ];
  for (const [from, to] of legacy) {
    if (out[to] === undefined && out[from] !== undefined) {
      out[to] = out[from];
    }
    delete out[from];
  }
  // Drop rating/ranking public toggles from Player privacy object (owned elsewhere)
  delete out.showRatingSummaryPublic;
  delete out.showRankingSummaryPublic;
  return out;
}

/**
 * Always returns a complete privacy object with fail-closed defaults.
 * @param {unknown} value
 * @returns {object}
 */
export function normalizePrivacySettings(value) {
  const raw =
    value && typeof value === "object" && !Array.isArray(value)
      ? mapLegacyPrivacyKeys(value)
      : {};

  const result = { ...DEFAULT_PRIVACY_SETTINGS, version: Number(raw.version) || 1 };

  for (const key of BOOL_KEYS) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] !== "boolean") {
      const err = new Error(`privacySettings.${key} must be boolean`);
      err.code = "INVALID_PRIVACY_VALUE";
      err.field = key;
      throw err;
    }
    result[key] = raw[key];
  }

  return result;
}

/**
 * Validation-only: returns { ok, errors, value }.
 * @param {unknown} value
 */
export function validatePrivacySettings(value) {
  try {
    return { ok: true, value: normalizePrivacySettings(value), errors: [] };
  } catch (error) {
    return {
      ok: false,
      value: null,
      errors: [
        {
          code: error.code || "INVALID_PRIVACY_VALUE",
          field: error.field || "privacySettings",
          message: error.message,
        },
      ],
    };
  }
}
