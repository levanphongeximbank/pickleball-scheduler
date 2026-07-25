/**
 * Category reference contract (NEWS-01) — reference only, not category management.
 */

import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import {
  deepFreeze,
  failContract,
  isValidLocale,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "./shared.js";
import { requireOpaqueId } from "./identifiers.js";

/**
 * @param {Record<string, unknown>} input
 */
export function createCategoryReference(input = {}) {
  const categoryId = requireOpaqueId(input.categoryId, "categoryId");
  const slugOrKey = requireNonEmptyString(
    input.slug ?? input.canonicalKey,
    "slug|canonicalKey"
  );
  const displayLabel = optionalNonEmptyString(input.displayLabel, "displayLabel");
  let locale = null;
  if (input.locale != null && input.locale !== "") {
    if (!isValidLocale(input.locale)) {
      failContract(
        NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_LOCALE,
        "Invalid category locale",
        { field: "locale", value: input.locale }
      );
    }
    locale = String(input.locale).trim();
  }

  return deepFreeze({
    categoryId,
    slug: slugOrKey,
    displayLabel,
    locale,
  });
}
