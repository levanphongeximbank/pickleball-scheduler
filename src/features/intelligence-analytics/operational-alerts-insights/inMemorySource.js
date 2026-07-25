/**
 * In-memory operational signals source for certification (I&A-10).
 * No DB / localStorage / Supabase / Notification / business-module imports.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { clonePlain, deepFreeze, isPlainObject } from "../contracts/shared.js";
import { createOperationalSignalsSnapshot } from "./snapshot.js";
import {
  createOperationalSignalSourceRequest,
  wrapOperationalAlertsSourceFailure,
} from "./sourceAdapter.js";
import { guardOperationalSignalsSnapshot } from "./guards.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createInMemoryOperationalSignalsSource(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SOURCE_FAILURE,
        "createInMemoryOperationalSignalsSource input must be a plain object",
        "input"
      )
    );
  }

  const snapshotResult = createOperationalSignalsSnapshot(
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
        throw new Error("operational alerts certification source throw");
      }
      if (failMode === "unavailable") {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.SOURCE_UNAVAILABLE,
            "Operational alerts certification source unavailable",
            "sourceAdapter"
          )
        );
      }
      if (failMode === "failure") {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.OPERATIONAL_ALERTS_SOURCE_FAILURE,
            "Operational alerts certification source failure",
            "sourceAdapter"
          )
        );
      }

      const requestResult = createOperationalSignalSourceRequest(requestInput);
      if (!requestResult.ok) return requestResult;
      const request = requestResult.value;

      const guard = guardOperationalSignalsSnapshot(
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
      return wrapOperationalAlertsSourceFailure(error);
    }
  }

  return ok(
    Object.freeze({
      load,
      kind: "in-memory-operational-signals",
      snapshotContext: frozenSnapshot.context,
    })
  );
}
