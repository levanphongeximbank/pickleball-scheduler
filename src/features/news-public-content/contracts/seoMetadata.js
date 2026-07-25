/**
 * SEO metadata contract (NEWS-01).
 */

import {
  deepFreeze,
  optionalNonEmptyString,
} from "./shared.js";

export const SEO_ROBOTS = Object.freeze({
  INDEX_FOLLOW: "INDEX_FOLLOW",
  NOINDEX_FOLLOW: "NOINDEX_FOLLOW",
  INDEX_NOFOLLOW: "INDEX_NOFOLLOW",
  NOINDEX_NOFOLLOW: "NOINDEX_NOFOLLOW",
});

export const SEO_ROBOTS_VALUES = Object.freeze(Object.values(SEO_ROBOTS));

/**
 * @param {Record<string, unknown>} [input]
 */
export function createSeoMetadata(input = {}) {
  const metaTitle = optionalNonEmptyString(input.metaTitle, "metaTitle");
  const metaDescription = optionalNonEmptyString(
    input.metaDescription,
    "metaDescription"
  );
  const canonicalPath = optionalNonEmptyString(
    input.canonicalPath ?? input.canonicalUrl,
    "canonicalPath|canonicalUrl"
  );
  let robots = null;
  if (input.robots != null && input.robots !== "") {
    const value = String(input.robots).trim();
    if (!SEO_ROBOTS_VALUES.includes(value)) {
      robots = value;
    } else {
      robots = value;
    }
  }
  const openGraphImageRef = optionalNonEmptyString(
    input.openGraphImageRef ?? input.socialImageRef,
    "openGraphImageRef"
  );

  return deepFreeze({
    metaTitle,
    metaDescription,
    canonicalPath,
    robots,
    openGraphImageRef,
  });
}
