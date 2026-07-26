/**
 * Canonical Public Portal data-result / provenance contract (EC-03).
 *
 * Pure factories only — no fetch, retry, router, provider, or page imports.
 * Reuses PUBLIC_PORTAL_DATA_SOURCE (EC-01). Does not encode business rules.
 */

import {
  deepFreeze,
  failContract,
  isNonEmptyString,
  isPlainObject,
} from "../../contracts/shared.js";
import { PUBLIC_PORTAL_DATA_SOURCE, isPublicPortalDataSource } from "../constants/dataSources.js";
import {
  PUBLIC_DATA_FALLBACK_REASON,
  PUBLIC_DATA_RESULT_STATUS,
  isPublicDataFallbackReason,
  isPublicDataResultStatus,
} from "./constants.js";

/**
 * @typedef {Object} PublicDataError
 * @property {string} code
 * @property {string} message
 */

/**
 * @typedef {Object} PublicDataResult
 * @property {string} source
 * @property {string} status
 * @property {unknown} data
 * @property {PublicDataError|null} error
 * @property {boolean} fallbackUsed
 * @property {string|null} fallbackReason
 * @property {boolean|null} isStale
 * @property {boolean} productionReady
 * @property {string} ownerSurface
 */

const SECRET_LEAK_PATTERN =
  /(service_role|eyJ[A-Za-z0-9_-]{20,}|password\s*=|api[_-]?key|authorization:\s*bearer|postgres(ql)?:\/\/|stack\s*trace)/i;

/**
 * @param {unknown} message
 * @returns {string}
 */
export function sanitizePublicDataErrorMessage(message) {
  const text = String(message ?? "").trim() || "Public data request failed";
  if (SECRET_LEAK_PATTERN.test(text) || text.length > 280) {
    return "Public data request failed";
  }
  return text;
}

/**
 * @param {unknown} error
 * @param {string} [fallbackCode]
 * @returns {PublicDataError|null}
 */
export function normalizePublicDataError(error, fallbackCode = "PUBLIC_DATA_ERROR") {
  if (error == null) return null;
  if (isPlainObject(error) && isNonEmptyString(error.code) && isNonEmptyString(error.message)) {
    return deepFreeze({
      code: String(error.code).trim(),
      message: sanitizePublicDataErrorMessage(error.message),
    });
  }
  if (error instanceof Error) {
    return deepFreeze({
      code: isNonEmptyString(/** @type {any} */ (error).code)
        ? String(/** @type {any} */ (error).code).trim()
        : fallbackCode,
      message: sanitizePublicDataErrorMessage(error.message),
    });
  }
  return deepFreeze({
    code: fallbackCode,
    message: sanitizePublicDataErrorMessage(error),
  });
}

/**
 * @param {Partial<PublicDataResult> & {
 *   source: string,
 *   status: string,
 *   ownerSurface: string,
 * }} input
 * @returns {Readonly<PublicDataResult>}
 */
function buildResult(input) {
  const source = String(input.source || "").trim();
  const status = String(input.status || "").trim();
  const ownerSurface = String(input.ownerSurface || "").trim();
  const fallbackUsed = Boolean(input.fallbackUsed);
  const fallbackReason =
    input.fallbackReason == null || input.fallbackReason === ""
      ? null
      : String(input.fallbackReason).trim();
  const productionReady = Boolean(input.productionReady);
  const isStale = input.isStale == null ? null : Boolean(input.isStale);
  const error = normalizePublicDataError(input.error);
  const data = input.data === undefined ? null : input.data;

  if (!isPublicPortalDataSource(source)) {
    failContract("INVALID_DATA_SOURCE", `Invalid source: ${source}`, { ownerSurface });
  }
  if (!isPublicDataResultStatus(status)) {
    failContract("INVALID_DATA_STATUS", `Invalid status: ${status}`, { ownerSurface });
  }
  if (!isNonEmptyString(ownerSurface)) {
    failContract("OWNER_SURFACE_REQUIRED", "ownerSurface is required", { source, status });
  }
  if (fallbackReason != null && !isPublicDataFallbackReason(fallbackReason)) {
    failContract("INVALID_FALLBACK_REASON", `Invalid fallbackReason: ${fallbackReason}`, {
      ownerSurface,
    });
  }

  if (source === PUBLIC_PORTAL_DATA_SOURCE.LIVE && fallbackUsed) {
    failContract("LIVE_CANNOT_FALLBACK", "LIVE results cannot declare fallbackUsed", {
      ownerSurface,
    });
  }
  if (source === PUBLIC_PORTAL_DATA_SOURCE.LIVE && fallbackReason != null) {
    failContract("LIVE_CANNOT_FALLBACK", "LIVE results cannot declare fallbackReason", {
      ownerSurface,
    });
  }
  if (source === PUBLIC_PORTAL_DATA_SOURCE.MIXED && !fallbackUsed) {
    failContract("MIXED_REQUIRES_FALLBACK", "MIXED requires fallbackUsed=true", {
      ownerSurface,
    });
  }
  if (source === PUBLIC_PORTAL_DATA_SOURCE.MIXED && !fallbackReason) {
    failContract("MIXED_REQUIRES_REASON", "MIXED requires fallbackReason", { ownerSurface });
  }
  if (
    (source === PUBLIC_PORTAL_DATA_SOURCE.MOCK ||
      source === PUBLIC_PORTAL_DATA_SOURCE.PREVIEW ||
      source === PUBLIC_PORTAL_DATA_SOURCE.UNKNOWN ||
      source === PUBLIC_PORTAL_DATA_SOURCE.MIXED) &&
    productionReady
  ) {
    failContract(
      "NON_LIVE_NOT_PRODUCTION_READY",
      "Only LIVE results may set productionReady=true",
      { ownerSurface, source }
    );
  }
  if (status === PUBLIC_DATA_RESULT_STATUS.ERROR && error == null) {
    failContract("ERROR_REQUIRES_METADATA", "ERROR status requires error metadata", {
      ownerSurface,
    });
  }
  if (status === PUBLIC_DATA_RESULT_STATUS.EMPTY && error != null) {
    failContract("EMPTY_CANNOT_CARRY_ERROR", "EMPTY must not carry error metadata", {
      ownerSurface,
    });
  }
  if (
    status === PUBLIC_DATA_RESULT_STATUS.EMPTY &&
    Array.isArray(data) &&
    data.length > 0
  ) {
    failContract("EMPTY_WITH_DATA", "EMPTY status cannot include non-empty array data", {
      ownerSurface,
    });
  }
  if (isStale === true && input.isStale !== true) {
    failContract("STALE_WITHOUT_EVIDENCE", "isStale requires explicit evidence", {
      ownerSurface,
    });
  }

  return deepFreeze({
    source,
    status,
    data,
    error,
    fallbackUsed,
    fallbackReason,
    isStale,
    productionReady,
    ownerSurface,
  });
}

/**
 * @param {{
 *   data?: unknown,
 *   ownerSurface: string,
 *   error?: unknown,
 *   isStale?: boolean|null,
 *   productionReady?: boolean,
 * }} input
 * Explicit `productionReady: false` keeps Staging LIVE empty/success non-production
 * until a separate Production rollout certification.
 */
export function createLiveResult(input) {
  const data = input.data === undefined ? null : input.data;
  const isEmptyArray = Array.isArray(data) && data.length === 0;
  return buildResult({
    source: PUBLIC_PORTAL_DATA_SOURCE.LIVE,
    status: isEmptyArray
      ? PUBLIC_DATA_RESULT_STATUS.EMPTY
      : PUBLIC_DATA_RESULT_STATUS.SUCCESS,
    data,
    error: null,
    fallbackUsed: false,
    fallbackReason: null,
    isStale: input.isStale == null ? null : input.isStale,
    productionReady: input.productionReady === false ? false : !isEmptyArray,
    ownerSurface: input.ownerSurface,
  });
}

/**
 * @param {{ data?: unknown, ownerSurface: string, fallbackReason?: string, isStale?: boolean|null }} input
 */
export function createMockResult(input) {
  const data = input.data === undefined ? null : input.data;
  const isEmptyArray = Array.isArray(data) && data.length === 0;
  return buildResult({
    source: PUBLIC_PORTAL_DATA_SOURCE.MOCK,
    status: isEmptyArray
      ? PUBLIC_DATA_RESULT_STATUS.EMPTY
      : PUBLIC_DATA_RESULT_STATUS.SUCCESS,
    data,
    error: null,
    fallbackUsed: false,
    fallbackReason:
      input.fallbackReason || PUBLIC_DATA_FALLBACK_REASON.EXPLICIT_MOCK_ONLY,
    isStale: input.isStale == null ? null : input.isStale,
    productionReady: false,
    ownerSurface: input.ownerSurface,
  });
}

/**
 * @param {{ data?: unknown, ownerSurface: string, fallbackReason?: string, isStale?: boolean|null }} input
 */
export function createPreviewResult(input) {
  const data = input.data === undefined ? null : input.data;
  const isEmptyArray = Array.isArray(data) && data.length === 0;
  return buildResult({
    source: PUBLIC_PORTAL_DATA_SOURCE.PREVIEW,
    status: isEmptyArray
      ? PUBLIC_DATA_RESULT_STATUS.EMPTY
      : PUBLIC_DATA_RESULT_STATUS.SUCCESS,
    data,
    error: null,
    fallbackUsed: false,
    fallbackReason:
      input.fallbackReason || PUBLIC_DATA_FALLBACK_REASON.EXPLICIT_PREVIEW_ONLY,
    isStale: input.isStale == null ? null : input.isStale,
    productionReady: false,
    ownerSurface: input.ownerSurface,
  });
}

/**
 * @param {{
 *   data?: unknown,
 *   ownerSurface: string,
 *   fallbackReason: string,
 *   error?: unknown,
 *   isStale?: boolean|null,
 *   status?: string,
 * }} input
 */
export function createMixedResult(input) {
  const data = input.data === undefined ? null : input.data;
  const error = normalizePublicDataError(input.error);
  let status = input.status;
  if (!status) {
    if (error && (!Array.isArray(data) || data.length === 0)) {
      status = PUBLIC_DATA_RESULT_STATUS.ERROR;
    } else if (Array.isArray(data) && data.length === 0) {
      status = PUBLIC_DATA_RESULT_STATUS.EMPTY;
    } else {
      status = PUBLIC_DATA_RESULT_STATUS.SUCCESS;
    }
  }
  return buildResult({
    source: PUBLIC_PORTAL_DATA_SOURCE.MIXED,
    status,
    data,
    error,
    fallbackUsed: true,
    fallbackReason: input.fallbackReason,
    isStale: input.isStale == null ? null : input.isStale,
    productionReady: false,
    ownerSurface: input.ownerSurface,
  });
}

/**
 * @param {{
 *   source?: string,
 *   data?: unknown,
 *   ownerSurface: string,
 *   fallbackUsed?: boolean,
 *   fallbackReason?: string|null,
 * }} input
 */
export function createEmptyResult(input) {
  const source = input.source || PUBLIC_PORTAL_DATA_SOURCE.LIVE;
  const fallbackUsed = Boolean(input.fallbackUsed);
  return buildResult({
    source,
    status: PUBLIC_DATA_RESULT_STATUS.EMPTY,
    data: Array.isArray(input.data) ? input.data : [],
    error: null,
    fallbackUsed,
    fallbackReason: fallbackUsed ? input.fallbackReason : null,
    isStale: null,
    productionReady: false,
    ownerSurface: input.ownerSurface,
  });
}

/**
 * @param {{
 *   ownerSurface: string,
 *   error: unknown,
 *   source?: string,
 *   data?: unknown,
 *   fallbackUsed?: boolean,
 *   fallbackReason?: string|null,
 * }} input
 */
export function createErrorResult(input) {
  const source = input.source || PUBLIC_PORTAL_DATA_SOURCE.LIVE;
  const fallbackUsed = Boolean(input.fallbackUsed);
  return buildResult({
    source,
    status: PUBLIC_DATA_RESULT_STATUS.ERROR,
    data: input.data === undefined ? null : input.data,
    error: input.error,
    fallbackUsed,
    fallbackReason: fallbackUsed ? input.fallbackReason : null,
    isStale: null,
    productionReady: false,
    ownerSurface: input.ownerSurface,
  });
}

/**
 * @param {{
 *   ownerSurface: string,
 *   source?: string,
 *   data?: unknown,
 *   message?: string,
 *   fallbackUsed?: boolean,
 *   fallbackReason?: string|null,
 * }} input
 */
export function createUnavailableResult(input) {
  const source = input.source || PUBLIC_PORTAL_DATA_SOURCE.UNKNOWN;
  const fallbackUsed = Boolean(input.fallbackUsed);
  return buildResult({
    source,
    status: PUBLIC_DATA_RESULT_STATUS.UNAVAILABLE,
    data: input.data === undefined ? null : input.data,
    error: {
      code: "PUBLIC_DATA_UNAVAILABLE",
      message: sanitizePublicDataErrorMessage(
        input.message || "Public data is temporarily unavailable"
      ),
    },
    fallbackUsed,
    fallbackReason: fallbackUsed ? input.fallbackReason : null,
    isStale: null,
    productionReady: false,
    ownerSurface: input.ownerSurface,
  });
}
