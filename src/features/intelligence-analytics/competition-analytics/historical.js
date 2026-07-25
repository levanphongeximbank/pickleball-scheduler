/**
 * Historical observation composition for Competition Analytics (I&A-06).
 * Reuses I&A-05 observation contracts — does not duplicate the historical engine.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { createAnalyticsHistoricalObservation } from "../historical-trend/series.js";
import {
  deepFreeze,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import { COMPETITION_ANALYTICS_METHOD_VERSION } from "./enums.js";
import { COMPETITION_ANALYTICS_METRIC_IDS } from "./metrics.js";

/**
 * Build I&A-05-compatible historical observations from a competition summary.
 * @param {unknown} summary
 * @param {{ observedAt?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function composeCompetitionHistoricalObservations(summary, options = {}) {
  if (!isPlainObject(summary)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_QUERY_INVALID,
        "composeCompetitionHistoricalObservations requires a summary",
        "summary"
      )
    );
  }

  const observedAt =
    options.observedAt ||
    summary.sourceTimestamp ||
    summary.generatedAt;

  if (!isValidIsoTimestamp(observedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_TIMESTAMP_INVALID,
        "observedAt / sourceTimestamp / generatedAt must be a valid ISO timestamp",
        "observedAt"
      )
    );
  }

  const tenantScope = {
    kind: "tenant",
    tenantId: summary.tenantId,
  };

  const provenance = summary.provenance || {
    source: {
      sourceId: "competition-analytics-explicit",
      sourceKind: "explicit_input",
      ownerModule: "intelligence-analytics",
      reference: "ia-06-historical",
    },
  };

  const pairs = [
    [
      COMPETITION_ANALYTICS_METRIC_IDS.PARTICIPANTS_COUNT,
      summary.participantCount,
    ],
    [COMPETITION_ANALYTICS_METRIC_IDS.ENTRIES_COUNT, summary.entryCount],
    [COMPETITION_ANALYTICS_METRIC_IDS.MATCHES_COUNT, summary.totalMatchCount],
    [
      COMPETITION_ANALYTICS_METRIC_IDS.MATCHES_COMPLETED_COUNT,
      summary.completedCount,
    ],
    [
      COMPETITION_ANALYTICS_METRIC_IDS.MATCHES_COMPLETION_RATE,
      summary.completionRate,
    ],
    [
      COMPETITION_ANALYTICS_METRIC_IDS.RESULTS_ACCEPTED_COUNT,
      summary.acceptedResultCount,
    ],
    [
      COMPETITION_ANALYTICS_METRIC_IDS.PROGRESS_PERCENTAGE,
      summary.progressPercentage,
    ],
    [
      COMPETITION_ANALYTICS_METRIC_IDS.SCHEDULE_ADHERENCE_RATE,
      summary.scheduleAdherence?.adherenceRate,
    ],
  ];

  /** @type {unknown[]} */
  const observations = [];
  for (const [metricId, value] of pairs) {
    const missing = value === null || value === undefined;
    const created = createAnalyticsHistoricalObservation({
      metricId,
      metricVersion: "1.0.0",
      tenantScope,
      observedAt,
      dimensions: {
        competitionId: String(summary.competitionId || ""),
      },
      value: missing ? null : value,
      missing,
      provenance,
      freshness: summary.freshness || ANALYTICS_FRESHNESS_STATE.FRESH,
    });
    if (!created.ok) return created;
    observations.push(created.value);
  }

  return ok(
    deepFreeze({
      observations: Object.freeze(observations),
      analyticalMethodVersion: COMPETITION_ANALYTICS_METHOD_VERSION.HISTORICAL,
      deterministic: true,
    })
  );
}
