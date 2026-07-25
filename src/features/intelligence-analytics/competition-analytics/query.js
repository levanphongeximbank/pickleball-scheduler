/**
 * Competition analytics query descriptor (I&A-06).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  deepFreeze,
  isFiniteNumber,
  isPlainObject,
} from "../contracts/shared.js";
import { createCompetitionAnalyticsContext } from "./context.js";
import {
  COMPETITION_PROGRESS_EXCLUSION_POLICY,
  COMPETITION_SCHEDULE_ON_TIME_THRESHOLD_SECONDS_DEFAULT,
  isCompetitionAnalyticsEnumValue,
} from "./enums.js";

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionAnalyticsQuery(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_QUERY_INVALID,
        "CompetitionAnalyticsQuery must be a plain object",
        "query"
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

  const onTimeThresholdSeconds =
    input.onTimeThresholdSeconds === undefined
      ? COMPETITION_SCHEDULE_ON_TIME_THRESHOLD_SECONDS_DEFAULT
      : input.onTimeThresholdSeconds;

  if (!isFiniteNumber(onTimeThresholdSeconds) || onTimeThresholdSeconds < 0) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_QUERY_INVALID,
        "onTimeThresholdSeconds must be a finite non-negative number",
        "onTimeThresholdSeconds"
      )
    );
  }

  const exclusionPolicy =
    input.exclusionPolicy ||
    COMPETITION_PROGRESS_EXCLUSION_POLICY.EXCLUDE_CANCELLED_VOID;

  if (
    !isCompetitionAnalyticsEnumValue(
      exclusionPolicy,
      COMPETITION_PROGRESS_EXCLUSION_POLICY
    )
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_QUERY_INVALID,
        `Unsupported exclusionPolicy: ${exclusionPolicy}`,
        "exclusionPolicy"
      )
    );
  }

  /** @type {Record<string, unknown>} */
  const query = {
    context: contextResult.value,
    onTimeThresholdSeconds,
    exclusionPolicy,
    includeDashboardPayloads: input.includeDashboardPayloads === true,
    includeHistoricalObservations:
      input.includeHistoricalObservations === true,
    allowMixedCompetitionVersions:
      input.allowMixedCompetitionVersions === true,
  };

  return ok(deepFreeze(query));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function normalizeCompetitionAnalyticsQuery(input) {
  return createCompetitionAnalyticsQuery(input);
}
