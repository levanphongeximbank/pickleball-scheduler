/**
 * Competition brand asset kinds (CM-05).
 * Presentation references only — no binary / upload ownership.
 */

export const COMPETITION_BRAND_ASSET_KIND = Object.freeze({
  PRIMARY_LOGO: "PRIMARY_LOGO",
  SECONDARY_LOGO: "SECONDARY_LOGO",
  ICON: "ICON",
  COVER: "COVER",
  BANNER: "BANNER",
  BACKGROUND: "BACKGROUND",
  SOCIAL_PREVIEW: "SOCIAL_PREVIEW",
});

export const COMPETITION_BRAND_ASSET_KIND_VALUES = Object.freeze(
  Object.values(COMPETITION_BRAND_ASSET_KIND)
);

/** Asset kinds that require non-empty alt text when present. */
export const COMPETITION_BRAND_ASSET_KINDS_REQUIRING_ALT = Object.freeze([
  COMPETITION_BRAND_ASSET_KIND.PRIMARY_LOGO,
  COMPETITION_BRAND_ASSET_KIND.SECONDARY_LOGO,
  COMPETITION_BRAND_ASSET_KIND.ICON,
  COMPETITION_BRAND_ASSET_KIND.COVER,
  COMPETITION_BRAND_ASSET_KIND.BANNER,
  COMPETITION_BRAND_ASSET_KIND.SOCIAL_PREVIEW,
]);

/** Access classification for asset references. */
export const COMPETITION_BRAND_ASSET_ACCESS = Object.freeze({
  PUBLIC: "public",
  PRIVATE: "private",
  UNKNOWN: "unknown",
});

export const COMPETITION_BRAND_ASSET_ACCESS_VALUES = Object.freeze(
  Object.values(COMPETITION_BRAND_ASSET_ACCESS)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionBrandAssetKind(value) {
  return (
    typeof value === "string" &&
    COMPETITION_BRAND_ASSET_KIND_VALUES.includes(value)
  );
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isCompetitionBrandAssetAccess(value) {
  return (
    typeof value === "string" &&
    COMPETITION_BRAND_ASSET_ACCESS_VALUES.includes(value)
  );
}
