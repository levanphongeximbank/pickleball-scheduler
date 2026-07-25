/**
 * Banner content contract foundation (NEWS-01) — no advertising engine.
 */

import {
  deepFreeze,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "./shared.js";
import { createMediaReference } from "./mediaReference.js";
import { createPublicationWindow } from "./publicationWindow.js";
import { isPublicVisibility, PUBLIC_VISIBILITY } from "../constants/publicVisibility.js";
import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import { failContract } from "./shared.js";

/**
 * @param {Record<string, unknown>} input
 */
export function createBannerContentContract(input = {}) {
  const placement = requireNonEmptyString(
    input.placement ?? input.bannerPlacement,
    "placement"
  );
  const media = createMediaReference(/** @type {Record<string, unknown>} */ (input.media || {}));
  const destination = optionalNonEmptyString(
    input.destination ?? input.actionReference,
    "destination"
  );
  const publicationWindow = createPublicationWindow(
    /** @type {Record<string, unknown>} */ (input.publicationWindow || {})
  );
  const publicVisibility = input.publicVisibility || PUBLIC_VISIBILITY.PUBLIC;
  if (!isPublicVisibility(publicVisibility)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_CONTENT_FIELD,
      "Invalid banner publicVisibility",
      { field: "publicVisibility", value: publicVisibility }
    );
  }

  return deepFreeze({
    placement,
    media,
    destination,
    publicationWindow,
    publicVisibility,
  });
}
