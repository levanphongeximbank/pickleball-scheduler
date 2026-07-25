/**
 * In-memory Competition Analytics source for certification (I&A-06).
 * No DB / localStorage / Supabase / Competition Engine imports.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { clonePlain, deepFreeze, isPlainObject } from "../contracts/shared.js";
import { createCompetitionAnalyticsSnapshot } from "./snapshot.js";
import {
  createCompetitionAnalyticsSourceRequest,
  wrapCompetitionSourceFailure,
} from "./sourceAdapter.js";
import { guardCompetitionAnalyticsSnapshot } from "./guards.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createInMemoryCompetitionAnalyticsSource(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_SOURCE_FAILURE,
        "createInMemoryCompetitionAnalyticsSource input must be a plain object",
        "input"
      )
    );
  }

  const snapshotResult = createCompetitionAnalyticsSnapshot(
    input.snapshot || input
  );
  if (!snapshotResult.ok) return snapshotResult;

  const frozenSnapshot = deepFreeze(clonePlain(snapshotResult.value));
  const failMode = input.failMode;

  /**
   * @param {unknown} requestInput
   */
  function load(requestInput) {
    try {
      if (failMode === "throw") {
        throw new Error("competition analytics certification source throw");
      }
      if (failMode === "unavailable") {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.SOURCE_UNAVAILABLE,
            "Competition analytics certification source unavailable",
            "sourceAdapter"
          )
        );
      }
      if (failMode === "failure") {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.COMPETITION_SOURCE_FAILURE,
            "Competition analytics certification source failure",
            "sourceAdapter"
          )
        );
      }

      const requestResult = createCompetitionAnalyticsSourceRequest(requestInput);
      if (!requestResult.ok) return requestResult;
      const request = requestResult.value;

      const guard = guardCompetitionAnalyticsSnapshot(
        request.context,
        frozenSnapshot,
        {
          allowMixedCompetitionVersions:
            request.allowMixedCompetitionVersions === true,
        }
      );
      if (!guard.ok) return guard;

      return ok(
        deepFreeze({
          snapshot: clonePlain(frozenSnapshot),
        })
      );
    } catch (error) {
      return wrapCompetitionSourceFailure(error);
    }
  }

  return ok(
    Object.freeze({
      load,
      kind: "in-memory-competition-analytics",
      snapshotContext: frozenSnapshot.context,
    })
  );
}
