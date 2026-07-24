/**
 * CM-05 presentation metadata limits and enums.
 * Presentation-only — does not replace CM-01 canonical name/description.
 */

export const COMPETITION_BRAND_SHORT_LABEL_MAX_LENGTH = 48;
export const COMPETITION_BRAND_TAGLINE_MAX_LENGTH = 120;
export const COMPETITION_BRAND_ALT_TEXT_MAX_LENGTH = 200;
export const COMPETITION_BRAND_TYPOGRAPHY_TOKEN_MAX_LENGTH = 64;

export const COMPETITION_BRAND_LOCKUP_VARIANT = Object.freeze({
  LOGO_ONLY: "logo_only",
  LOGO_WORDMARK: "logo_wordmark",
  WORDMARK_ONLY: "wordmark_only",
  STACKED: "stacked",
});

export const COMPETITION_BRAND_LOCKUP_VARIANT_VALUES = Object.freeze(
  Object.values(COMPETITION_BRAND_LOCKUP_VARIANT)
);

export const COMPETITION_BRAND_THEME_MODE = Object.freeze({
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
});

export const COMPETITION_BRAND_THEME_MODE_VALUES = Object.freeze(
  Object.values(COMPETITION_BRAND_THEME_MODE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionBrandLockupVariant(value) {
  return (
    typeof value === "string" &&
    COMPETITION_BRAND_LOCKUP_VARIANT_VALUES.includes(value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionBrandThemeMode(value) {
  return (
    typeof value === "string" &&
    COMPETITION_BRAND_THEME_MODE_VALUES.includes(value)
  );
}
