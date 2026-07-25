/**
 * Deterministic certification for Public Portal data results (EC-03).
 */

import { deepFreeze, isNonEmptyString } from "../../contracts/shared.js";
import { PUBLIC_PORTAL_DATA_SOURCE, isPublicPortalDataSource } from "../constants/dataSources.js";
import {
  PUBLIC_DATA_RESULT_STATUS,
  isPublicDataFallbackReason,
  isPublicDataResultStatus,
} from "./constants.js";
import { sanitizePublicDataErrorMessage } from "./publicDataResult.js";

/**
 * @param {unknown} result
 * @returns {{ ok: true, value: Readonly<Record<string, unknown>> } | { ok: false, issues: ReadonlyArray<{ code: string, message: string }> }}
 */
export function certifyPublicDataResult(result) {
  /** @type {Array<{ code: string, message: string }>} */
  const issues = [];

  if (!result || typeof result !== "object") {
    return deepFreeze({
      ok: false,
      issues: [{ code: "RESULT_REQUIRED", message: "Public data result is required" }],
    });
  }

  const source = /** @type {any} */ (result).source;
  const status = /** @type {any} */ (result).status;
  const ownerSurface = /** @type {any} */ (result).ownerSurface;
  const fallbackUsed = Boolean(/** @type {any} */ (result).fallbackUsed);
  const fallbackReason = /** @type {any} */ (result).fallbackReason ?? null;
  const productionReady = Boolean(/** @type {any} */ (result).productionReady);
  const isStale = /** @type {any} */ (result).isStale;
  const error = /** @type {any} */ (result).error;
  const data = /** @type {any} */ (result).data;

  if (!isPublicPortalDataSource(source)) {
    issues.push({ code: "INVALID_DATA_SOURCE", message: `Invalid source: ${source}` });
  }
  if (!isPublicDataResultStatus(status)) {
    issues.push({ code: "INVALID_DATA_STATUS", message: `Invalid status: ${status}` });
  }
  if (!isNonEmptyString(ownerSurface)) {
    issues.push({ code: "OWNER_SURFACE_REQUIRED", message: "ownerSurface is required" });
  }

  if (source === PUBLIC_PORTAL_DATA_SOURCE.UNKNOWN && productionReady) {
    issues.push({
      code: "UNKNOWN_NOT_PRODUCTION_READY",
      message: "UNKNOWN source cannot be productionReady or treated as LIVE",
    });
  }

  if (
    source === PUBLIC_PORTAL_DATA_SOURCE.MOCK ||
    source === PUBLIC_PORTAL_DATA_SOURCE.PREVIEW
  ) {
    if (productionReady) {
      issues.push({
        code: "MOCK_PREVIEW_NOT_PRODUCTION_READY",
        message: `${source} cannot be productionReady`,
      });
    }
  }

  if (source === PUBLIC_PORTAL_DATA_SOURCE.MIXED) {
    if (!fallbackUsed) {
      issues.push({
        code: "MIXED_REQUIRES_FALLBACK",
        message: "MIXED requires fallbackUsed=true",
      });
    }
    if (!fallbackReason || !isPublicDataFallbackReason(fallbackReason)) {
      issues.push({
        code: "MIXED_REQUIRES_REASON",
        message: "MIXED requires a known fallbackReason",
      });
    }
    if (productionReady) {
      issues.push({
        code: "MIXED_NOT_PRODUCTION_READY",
        message: "MIXED cannot be productionReady",
      });
    }
  }

  if (source === PUBLIC_PORTAL_DATA_SOURCE.LIVE) {
    if (fallbackUsed || fallbackReason) {
      issues.push({
        code: "LIVE_CANNOT_FALLBACK",
        message: "LIVE must not declare fallback metadata",
      });
    }
  }

  if (status === PUBLIC_DATA_RESULT_STATUS.ERROR) {
    if (!error || !isNonEmptyString(error.code) || !isNonEmptyString(error.message)) {
      issues.push({
        code: "ERROR_REQUIRES_METADATA",
        message: "ERROR status requires error.code and error.message",
      });
    } else if (
      sanitizePublicDataErrorMessage(error.message) !== String(error.message).trim()
    ) {
      issues.push({
        code: "ERROR_MESSAGE_UNSAFE",
        message: "error.message must not expose secrets or oversized internals",
      });
    }
  }

  if (status === PUBLIC_DATA_RESULT_STATUS.EMPTY) {
    if (error != null) {
      issues.push({
        code: "EMPTY_DISTINCT_FROM_ERROR",
        message: "EMPTY must not carry error metadata",
      });
    }
    if (Array.isArray(data) && data.length > 0) {
      issues.push({
        code: "EMPTY_WITH_DATA",
        message: "EMPTY cannot include non-empty array data",
      });
    }
  }

  if (status === PUBLIC_DATA_RESULT_STATUS.UNAVAILABLE) {
    if (status === PUBLIC_DATA_RESULT_STATUS.EMPTY) {
      issues.push({
        code: "UNAVAILABLE_DISTINCT_FROM_EMPTY",
        message: "UNAVAILABLE must remain distinct from EMPTY",
      });
    }
  }

  if (isStale === true && /** @type {any} */ (result).isStale !== true) {
    issues.push({
      code: "STALE_WITHOUT_EVIDENCE",
      message: "isStale may only be true with explicit evidence",
    });
  }

  if (fallbackUsed && source === PUBLIC_PORTAL_DATA_SOURCE.LIVE) {
    issues.push({
      code: "FALLBACK_NOT_LIVE",
      message: "fallbackUsed cannot be presented as LIVE",
    });
  }

  if (issues.length) {
    return deepFreeze({ ok: false, issues });
  }

  return deepFreeze({
    ok: true,
    value: /** @type {Readonly<Record<string, unknown>>} */ (result),
  });
}
