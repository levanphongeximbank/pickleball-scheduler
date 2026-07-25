/**
 * Sponsor content contract foundation (NEWS-01) — no advertising engine.
 */

import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import {
  deepFreeze,
  failContract,
  optionalNonEmptyString,
  requireNonEmptyString,
} from "./shared.js";
import { requireOpaqueId } from "./identifiers.js";
import { createMediaReference } from "./mediaReference.js";
import { createPublicationWindow } from "./publicationWindow.js";
import { isPublicVisibility, PUBLIC_VISIBILITY } from "../constants/publicVisibility.js";

/**
 * @param {Record<string, unknown>} input
 */
export function createSponsorContentContract(input = {}) {
  const sponsorId = requireOpaqueId(
    input.sponsorId ?? input.sponsorReference,
    "sponsorId"
  );
  const disclosureLabel = requireNonEmptyString(
    input.disclosureLabel ?? input.disclosure,
    "disclosureLabel"
  );
  const media =
    input.media == null
      ? null
      : createMediaReference(/** @type {Record<string, unknown>} */ (input.media));
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
      "Invalid sponsor publicVisibility",
      { field: "publicVisibility", value: publicVisibility }
    );
  }

  return deepFreeze({
    sponsorId,
    disclosureLabel,
    media,
    destination,
    publicationWindow,
    publicVisibility,
  });
}
