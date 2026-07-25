/**
 * Competition analytics source adapter contracts (I&A-06).
 * Read-only — adapter.load(request) returns an analytical snapshot.
 * No Competition Engine / DB / Supabase imports.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import { createCompetitionAnalyticsContext } from "./context.js";
import { createCompetitionAnalyticsSnapshot } from "./snapshot.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionAnalyticsSourceRequest(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_QUERY_INVALID,
        "CompetitionAnalyticsSourceRequest must be a plain object",
        "request"
      )
    );
  }

  const contextResult = createCompetitionAnalyticsContext(
    input.context || {
      tenantScope: input.tenantScope,
      competitionId: input.competitionId,
      competitionVersion: input.competitionVersion,
    }
  );
  if (!contextResult.ok) return contextResult;

  /** @type {Record<string, unknown>} */
  const request = {
    context: contextResult.value,
  };

  if (input.executionId !== undefined) {
    if (!isNonEmptyString(input.executionId)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.COMPETITION_QUERY_INVALID,
          "executionId must be a non-empty string when provided",
          "executionId"
        )
      );
    }
    request.executionId = String(input.executionId).trim();
  }

  if (input.allowMixedCompetitionVersions === true) {
    request.allowMixedCompetitionVersions = true;
  }

  return ok(deepFreeze(request));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionAnalyticsSourceResponse(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_SOURCE_FAILURE,
        "CompetitionAnalyticsSourceResponse must be a plain object",
        "response"
      )
    );
  }
  const snapshotResult = createCompetitionAnalyticsSnapshot(input.snapshot || input);
  if (!snapshotResult.ok) return snapshotResult;
  return ok(
    deepFreeze({
      snapshot: snapshotResult.value,
    })
  );
}

/**
 * @param {unknown} error
 * @returns {import("../contracts/result.js").Result}
 */
export function wrapCompetitionSourceFailure(error) {
  if (
    error &&
    typeof error === "object" &&
    error.ok === false &&
    error.error &&
    typeof error.error.code === "string"
  ) {
    return /** @type {import("../contracts/result.js").Result} */ (error);
  }

  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object" && typeof error.message === "string"
        ? error.message
        : "Competition analytics source failure";

  return fail(
    analyticsError(
      ANALYTICS_ERROR_CODE.COMPETITION_SOURCE_FAILURE,
      message,
      "sourceAdapter",
      error && typeof error === "object" && error.code
        ? { wrappedCode: String(error.code) }
        : undefined
    )
  );
}

/**
 * @param {unknown} adapter
 * @returns {boolean}
 */
export function isCompetitionAnalyticsSourceAdapter(adapter) {
  return isPlainObject(adapter) && typeof adapter.load === "function";
}
