/**
 * Experience Channel surface classifications (EC-00).
 * Audit labels only — not runtime feature flags.
 */

export const EXPERIENCE_CHANNEL_CLASSIFICATION = Object.freeze({
  CANONICAL_CHANNEL_SURFACE: "CANONICAL_CHANNEL_SURFACE",
  LEGACY_ACTIVE: "LEGACY_ACTIVE",
  MOCK_OR_PREVIEW: "MOCK_OR_PREVIEW",
  DUPLICATED: "DUPLICATED",
  COMPETITION_E2E_OWNED: "COMPETITION_E2E_OWNED",
  GLOBAL_SHARED_HIGH_COLLISION: "GLOBAL_SHARED_HIGH_COLLISION",
  SAFE_CHANNEL_FOUNDATION: "SAFE_CHANNEL_FOUNDATION",
  DEFERRED: "DEFERRED",
});

export const EXPERIENCE_CHANNEL_CLASSIFICATION_VALUES = Object.freeze(
  Object.values(EXPERIENCE_CHANNEL_CLASSIFICATION)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isExperienceChannelClassification(value) {
  return EXPERIENCE_CHANNEL_CLASSIFICATION_VALUES.includes(
    /** @type {string} */ (value)
  );
}
