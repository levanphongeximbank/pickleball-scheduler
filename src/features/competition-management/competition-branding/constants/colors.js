/**
 * CM-05 color palette contract.
 * Canonical format: uppercase #RRGGBB only (no alpha, no CSS functions).
 */

export const COMPETITION_BRAND_COLOR_FORMAT = Object.freeze({
  id: "hex-rrggbb-uppercase-v1",
  pattern: /^#[0-9A-F]{6}$/,
  supportsAlpha: false,
});

/** Required palette keys when a palette object is provided. */
export const COMPETITION_BRAND_PALETTE_REQUIRED_KEYS = Object.freeze([
  "primary",
  "secondary",
  "accent",
  "background",
  "surface",
  "textPrimary",
]);

/** Optional palette keys. */
export const COMPETITION_BRAND_PALETTE_OPTIONAL_KEYS = Object.freeze([
  "textSecondary",
  "border",
]);

export const COMPETITION_BRAND_PALETTE_ALLOWED_KEYS = Object.freeze([
  ...COMPETITION_BRAND_PALETTE_REQUIRED_KEYS,
  ...COMPETITION_BRAND_PALETTE_OPTIONAL_KEYS,
]);
