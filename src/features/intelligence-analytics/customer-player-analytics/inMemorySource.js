/**
 * In-memory Customer / Player Analytics source for certification (I&A-08).
 * No DB / localStorage / Supabase / Customer / Player / CRM imports.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { clonePlain, deepFreeze, isPlainObject } from "../contracts/shared.js";
import { createCustomerPlayerAnalyticsSnapshot } from "./snapshot.js";
import {
  createCustomerPlayerAnalyticsSourceRequest,
  wrapCustomerPlayerSourceFailure,
} from "./sourceAdapter.js";
import { guardCustomerPlayerAnalyticsSnapshot } from "./guards.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createInMemoryCustomerPlayerAnalyticsSource(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_SOURCE_FAILURE,
        "createInMemoryCustomerPlayerAnalyticsSource input must be a plain object",
        "input"
      )
    );
  }

  const snapshotResult = createCustomerPlayerAnalyticsSnapshot(
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
        throw new Error(
          "customer/player analytics certification source throw"
        );
      }
      if (failMode === "unavailable") {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.SOURCE_UNAVAILABLE,
            "Customer/Player analytics certification source unavailable",
            "sourceAdapter"
          )
        );
      }
      if (failMode === "failure") {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_SOURCE_FAILURE,
            "Customer/Player analytics certification source failure",
            "sourceAdapter"
          )
        );
      }

      const requestResult =
        createCustomerPlayerAnalyticsSourceRequest(requestInput);
      if (!requestResult.ok) return requestResult;
      const request = requestResult.value;

      const guard = guardCustomerPlayerAnalyticsSnapshot(
        request.context,
        frozenSnapshot
      );
      if (!guard.ok) return guard;

      return ok(
        deepFreeze({
          snapshot: clonePlain(frozenSnapshot),
        })
      );
    } catch (error) {
      return wrapCustomerPlayerSourceFailure(error);
    }
  }

  return ok(
    Object.freeze({
      load,
      kind: "in-memory-customer-player-analytics",
      snapshotContext: frozenSnapshot.context,
    })
  );
}
