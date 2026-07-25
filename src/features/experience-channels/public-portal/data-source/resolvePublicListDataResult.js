/**
 * Resolve a public list against live loader + optional mock fallback with honesty metadata.
 * Does not fetch remotely, retry, or mutate backend payloads.
 */

import { PUBLIC_PORTAL_DATA_SOURCE } from "../constants/dataSources.js";
import { PUBLIC_DATA_FALLBACK_REASON, PUBLIC_DATA_RESULT_STATUS } from "./constants.js";
import {
  createErrorResult,
  createLiveResult,
  createMixedResult,
  normalizePublicDataError,
} from "./publicDataResult.js";
import { certifyPublicDataResult } from "./certifyPublicDataResult.js";

/**
 * @param {{
 *   ownerSurface: string,
 *   loadLive: () => unknown[],
 *   mockData: unknown[],
 *   minLength?: number,
 *   allowMockFallback?: boolean,
 * }} options
 * @returns {Readonly<import("./publicDataResult.js").PublicDataResult>}
 */
export function resolvePublicListDataResult(options) {
  const ownerSurface = String(options.ownerSurface || "").trim();
  const minLength = Number.isFinite(options.minLength) ? Number(options.minLength) : 1;
  const allowMockFallback = options.allowMockFallback !== false;
  const mockData = Array.isArray(options.mockData) ? options.mockData : [];

  let live = null;
  /** @type {ReturnType<typeof normalizePublicDataError>} */
  let liveError = null;

  try {
    const loaded = options.loadLive();
    live = Array.isArray(loaded) ? loaded : null;
    if (live == null) {
      liveError = normalizePublicDataError(
        { code: "PUBLIC_DATA_MALFORMED", message: "Live loader did not return an array" },
        "PUBLIC_DATA_MALFORMED"
      );
    }
  } catch (error) {
    liveError = normalizePublicDataError(error, "PUBLIC_DATA_LOAD_FAILED");
  }

  if (liveError == null && Array.isArray(live) && live.length >= minLength) {
    const result = createLiveResult({ data: live, ownerSurface });
    const certified = certifyPublicDataResult(result);
    if (!certified.ok) {
      return createErrorResult({
        ownerSurface,
        source: PUBLIC_PORTAL_DATA_SOURCE.LIVE,
        error: {
          code: "PUBLIC_DATA_CERTIFICATION_FAILED",
          message: "Live public data result failed certification",
        },
      });
    }
    return result;
  }

  if (!allowMockFallback) {
    if (liveError) {
      return createErrorResult({
        ownerSurface,
        source: PUBLIC_PORTAL_DATA_SOURCE.LIVE,
        error: liveError,
        data: Array.isArray(live) ? live : null,
      });
    }
    return createLiveResult({ data: live || [], ownerSurface });
  }

  const fallbackReason = liveError
    ? PUBLIC_DATA_FALLBACK_REASON.LIVE_LOAD_FAILED_USING_MOCK
    : Array.isArray(live) && live.length === 0
      ? PUBLIC_DATA_FALLBACK_REASON.LIVE_EMPTY_USING_MOCK
      : PUBLIC_DATA_FALLBACK_REASON.LIVE_BELOW_MINIMUM_USING_MOCK;

  const mixed = createMixedResult({
    data: mockData,
    ownerSurface,
    fallbackReason,
    error: liveError,
    status:
      mockData.length > 0
        ? PUBLIC_DATA_RESULT_STATUS.SUCCESS
        : liveError
          ? PUBLIC_DATA_RESULT_STATUS.ERROR
          : PUBLIC_DATA_RESULT_STATUS.EMPTY,
  });

  const certified = certifyPublicDataResult(mixed);
  if (!certified.ok) {
    return createErrorResult({
      ownerSurface,
      source: PUBLIC_PORTAL_DATA_SOURCE.MIXED,
      fallbackUsed: true,
      fallbackReason,
      error: {
        code: "PUBLIC_DATA_CERTIFICATION_FAILED",
        message: "Mixed public data result failed certification",
      },
      data: mockData,
    });
  }

  return mixed;
}
