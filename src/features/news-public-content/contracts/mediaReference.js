/**
 * Media reference contract (NEWS-01) — no upload implementation.
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

export const MEDIA_KIND = Object.freeze({
  IMAGE: "IMAGE",
  VIDEO: "VIDEO",
  DOCUMENT: "DOCUMENT",
  AUDIO: "AUDIO",
  OTHER: "OTHER",
});

export const MEDIA_KIND_VALUES = Object.freeze(Object.values(MEDIA_KIND));

/**
 * @param {Record<string, unknown>} input
 */
export function createMediaReference(input = {}) {
  const mediaId = requireOpaqueId(input.mediaId, "mediaId");
  const mediaKind = requireNonEmptyString(
    input.mediaKind ?? input.type,
    "mediaKind"
  );
  if (!MEDIA_KIND_VALUES.includes(mediaKind)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_REFERENCE,
      "Unsupported media kind",
      { field: "mediaKind", value: mediaKind }
    );
  }
  const urlOrStorageRef = requireNonEmptyString(
    input.url ?? input.storageReference,
    "url|storageReference"
  );
  const altText = optionalNonEmptyString(input.altText, "altText");
  const caption = optionalNonEmptyString(input.caption, "caption");
  const attribution = optionalNonEmptyString(input.attribution, "attribution");
  let locale = null;
  if (input.locale != null && input.locale !== "") {
    if (!isValidLocale(input.locale)) {
      failContract(
        NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_LOCALE,
        "Invalid media locale",
        { field: "locale", value: input.locale }
      );
    }
    locale = String(input.locale).trim();
  }

  return deepFreeze({
    mediaId,
    mediaKind,
    url: urlOrStorageRef,
    altText,
    caption,
    locale,
    attribution,
  });
}
