/**
 * Publication window contract (NEWS-01).
 */

import { NEWS_PUBLIC_CONTENT_ERROR_CODE } from "../errors/errorCodes.js";
import {
  deepFreeze,
  failContract,
  isoInstantMs,
  optionalNonEmptyString,
  requireIsoInstant,
} from "./shared.js";

/**
 * @param {Record<string, unknown>} input
 */
export function createPublicationWindow(input = {}) {
  const publishAt =
    input.publishAt == null || input.publishAt === ""
      ? null
      : requireIsoInstant(input.publishAt, "publishAt");
  const unpublishAt =
    input.unpublishAt == null || input.unpublishAt === ""
      ? null
      : requireIsoInstant(input.unpublishAt, "unpublishAt");
  const timezone = optionalNonEmptyString(input.timezone, "timezone");

  if (publishAt && unpublishAt && isoInstantMs(unpublishAt) <= isoInstantMs(publishAt)) {
    failContract(
      NEWS_PUBLIC_CONTENT_ERROR_CODE.INVALID_PUBLICATION_WINDOW,
      "unpublishAt must be after publishAt",
      { publishAt, unpublishAt }
    );
  }

  return deepFreeze({
    publishAt,
    unpublishAt,
    timezone,
  });
}

/**
 * @param {{ publishAt: string|null, unpublishAt: string|null, timezone: string|null }} window
 * @param {string} nowIso
 * @returns {{ ok: boolean, reason?: string }}
 */
export function evaluatePublicationWindow(window, nowIso) {
  if (!window || typeof window !== "object") {
    return { ok: false, reason: "missing_window" };
  }
  if (!requireIsoInstantSafe(nowIso)) {
    return { ok: false, reason: "invalid_now" };
  }
  const nowMs = isoInstantMs(nowIso);
  if (window.publishAt) {
    if (nowMs < isoInstantMs(window.publishAt)) {
      return { ok: false, reason: "before_publish_at" };
    }
  }
  if (window.unpublishAt) {
    if (nowMs >= isoInstantMs(window.unpublishAt)) {
      return { ok: false, reason: "after_unpublish_at" };
    }
  }
  return { ok: true };
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function requireIsoInstantSafe(value) {
  try {
    requireIsoInstant(value, "now");
    return true;
  } catch {
    return false;
  }
}
