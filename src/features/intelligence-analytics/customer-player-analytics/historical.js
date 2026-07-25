/**
 * Historical observation composition for Customer / Player Analytics (I&A-08).
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
import { CUSTOMER_PLAYER_ANALYTICS_METHOD_VERSION } from "./enums.js";
import { CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS } from "./metrics.js";

/**
 * Build I&A-05-compatible historical observations from a Customer/Player
 * summary projection.
 * @param {unknown} summary
 * @param {{ observedAt?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function composeCustomerPlayerHistoricalObservations(
  summary,
  options = {}
) {
  if (!isPlainObject(summary)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_QUERY_INVALID,
        "composeCustomerPlayerHistoricalObservations requires a summary",
        "summary"
      )
    );
  }

  const observedAt =
    options.observedAt || summary.sourceTimestamp || summary.generatedAt;

  if (!isValidIsoTimestamp(observedAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_TIMESTAMP_INVALID,
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
      sourceId: "customer-player-analytics-explicit",
      sourceKind: "explicit_input",
      ownerModule: "intelligence-analytics",
      reference: "ia-08-historical",
    },
  };

  /** @type {Record<string, string>} */
  const dimensions = {};
  if (summary.customerId) dimensions.customerId = String(summary.customerId);
  if (summary.playerId) dimensions.playerId = String(summary.playerId);

  const pairs = [
    [CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.CUSTOMER_COUNT, summary.customerCount],
    [CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.PLAYER_COUNT, summary.playerCount],
    [
      CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.CUSTOMER_ACTIVITIES_COUNT,
      summary.customerActivityCount,
    ],
    [
      CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.PLAYER_ACTIVITIES_COUNT,
      summary.playerActivityCount,
    ],
    [
      CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.CUSTOMER_PLAYER_LINKAGE_RATE,
      summary.customerLinkageRate,
    ],
    [
      CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.PLAYER_PROFILE_COMPLETENESS_RATE,
      summary.playerProfileCompletenessRate,
    ],
    [
      CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.PLAYER_COMPETITION_PARTICIPATIONS_COUNT,
      summary.participationCount,
    ],
    [
      CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS.PLAYER_CLUB_MEMBERSHIPS_COUNT,
      summary.membershipCount,
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
      dimensions,
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
      analyticalMethodVersion: CUSTOMER_PLAYER_ANALYTICS_METHOD_VERSION.HISTORICAL,
      deterministic: true,
    })
  );
}
