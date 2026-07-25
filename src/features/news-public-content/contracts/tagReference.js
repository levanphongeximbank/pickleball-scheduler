/**
 * Tag reference contract (NEWS-01) — reference only.
 */

import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import {
  deepFreeze,
  failContract,
  isValidLocale,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "./shared.js";

/**
 * @param {Record<string, unknown>} input
 */
export function createTagReference(input = {}) {
  const tagId = requireNonEmptyString(
    input.tagId ?? input.canonicalKey,
    "tagId|canonicalKey"
  );
  const slugOrLabel = requireNonEmptyString(
    input.slug ?? input.label,
    "slug|label"
  );
  let locale = null;
  if (input.locale != null && input.locale !== "") {
    if (!isValidLocale(input.locale)) {
      failContract(
        NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_LOCALE,
        "Invalid tag locale",
        { field: "locale", value: input.locale }
      );
    }
    locale = String(input.locale).trim();
  }
  const label = optionalNonEmptyString(input.label, "label");

  return deepFreeze({
    tagId,
    slug: slugOrLabel,
    label,
    locale,
  });
}
