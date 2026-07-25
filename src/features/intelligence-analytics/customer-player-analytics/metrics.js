/**
 * Customer / Player Analytics metric catalog (I&A-08).
 * Registry-compatible definitions — no business-rule calculation, no CRM
 * conversion, revenue, rating, ranking, performance, or eligibility metrics.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  ANALYTICS_AGGREGATION_KIND,
  ANALYTICS_GRANULARITY,
  ANALYTICS_METRIC_KIND,
  ANALYTICS_METRIC_UNIT,
  ANALYTICS_MISSING_DATA_SEMANTICS,
} from "../contracts/enums.js";
import { ANALYTICS_TENANT_SCOPE_KIND } from "../contracts/tenantScope.js";
import { createAnalyticsMetricDefinition } from "../contracts/metricDefinition.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import { ANALYTICS_METRIC_LIFECYCLE_STATE } from "../registry/lifecycle.js";

export const CUSTOMER_PLAYER_ANALYTICS_METRIC_SOURCE = Object.freeze({
  sourceId: "customer-player-analytics-explicit",
  sourceKind: "explicit_input",
  ownerModule: "intelligence-analytics",
  reference: "ia-08-customer-player-analytics",
});

/**
 * Stable metric ID catalog for Customer / Player Analytics foundation.
 */
export const CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS = Object.freeze({
  CUSTOMER_COUNT: "customer.count",
  CUSTOMER_ACTIVE_COUNT: "customer.active_count",
  CUSTOMER_INACTIVE_COUNT: "customer.inactive_count",
  CUSTOMER_LIFECYCLE_DISTRIBUTION: "customer.lifecycle_distribution",
  CUSTOMER_CREATED_COUNT: "customer.created_count",
  CUSTOMER_ACTIVE_IN_WINDOW_COUNT: "customer.active_in_window_count",
  CUSTOMER_PROFILE_COMPLETE_COUNT: "customer.profile_complete_count",
  CUSTOMER_PROFILE_COMPLETENESS_RATE: "customer.profile_completeness_rate",
  CUSTOMER_PLAYER_LINKED_COUNT: "customer.player_linked_count",
  CUSTOMER_PLAYER_LINKAGE_RATE: "customer.player_linkage_rate",
  CUSTOMER_ACTIVITIES_COUNT: "customer.activities.count",
  PLAYER_COUNT: "player.count",
  PLAYER_ACTIVE_COUNT: "player.active_count",
  PLAYER_INACTIVE_COUNT: "player.inactive_count",
  PLAYER_LIFECYCLE_DISTRIBUTION: "player.lifecycle_distribution",
  PLAYER_CREATED_COUNT: "player.created_count",
  PLAYER_ACTIVE_IN_WINDOW_COUNT: "player.active_in_window_count",
  PLAYER_PROFILE_COMPLETE_COUNT: "player.profile_complete_count",
  PLAYER_PROFILE_COMPLETENESS_RATE: "player.profile_completeness_rate",
  PLAYER_CUSTOMER_LINKED_COUNT: "player.customer_linked_count",
  PLAYER_CUSTOMER_LINKAGE_RATE: "player.customer_linkage_rate",
  PLAYER_COMPETITION_PARTICIPATIONS_COUNT:
    "player.competition_participations.count",
  PLAYER_CLUB_MEMBERSHIPS_COUNT: "player.club_memberships.count",
  PLAYER_ACTIVITIES_COUNT: "player.activities.count",
});

const METRIC_VERSION = "1.0.0";

/**
 * @param {string} metricId
 * @param {string} definition
 * @param {string} unit
 * @param {string} aggregationKind
 * @param {string} [metricKind]
 * @returns {Record<string, unknown>}
 */
function metricDraft(
  metricId,
  definition,
  unit,
  aggregationKind,
  metricKind = ANALYTICS_METRIC_KIND.DERIVED
) {
  return {
    metricId,
    version: METRIC_VERSION,
    definition,
    unit,
    aggregationKind,
    metricKind,
    source: CUSTOMER_PLAYER_ANALYTICS_METRIC_SOURCE,
    supportedTenantScopeKinds: [
      ANALYTICS_TENANT_SCOPE_KIND.TENANT,
      ANALYTICS_TENANT_SCOPE_KIND.VENUE,
      ANALYTICS_TENANT_SCOPE_KIND.CLUB,
    ],
    supportedGranularities: [
      ANALYTICS_GRANULARITY.RAW,
      ANALYTICS_GRANULARITY.DAY,
      ANALYTICS_GRANULARITY.WEEK,
      ANALYTICS_GRANULARITY.MONTH,
      ANALYTICS_GRANULARITY.WINDOW,
    ],
    allowedDimensions: [
      { key: "customerId" },
      { key: "playerId" },
      { key: "status" },
      { key: "lifecycleStatus" },
    ],
    missingDataSemantics: ANALYTICS_MISSING_DATA_SEMANTICS.PRESERVE_NULL,
  };
}

/**
 * Build validated Customer / Player Analytics metric definitions.
 * @returns {import("../contracts/result.js").Result}
 */
export function createCustomerPlayerAnalyticsMetricDefinitions() {
  const ids = CUSTOMER_PLAYER_ANALYTICS_METRIC_IDS;
  const drafts = [
    metricDraft(
      ids.CUSTOMER_COUNT,
      "Count of explicit customer analytical facts in the snapshot (identity not deduplicated).",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.CUSTOMER_ACTIVE_COUNT,
      "Count of customers with explicit active lifecycle/status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.CUSTOMER_INACTIVE_COUNT,
      "Count of customers with explicit inactive lifecycle/status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.CUSTOMER_LIFECYCLE_DISTRIBUTION,
      "Distribution of explicit customer lifecycle/status labels.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT,
      ANALYTICS_METRIC_KIND.OBSERVATIONAL
    ),
    metricDraft(
      ids.CUSTOMER_CREATED_COUNT,
      "Count of customers with an explicit createdAt (optionally windowed).",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.CUSTOMER_ACTIVE_IN_WINDOW_COUNT,
      "Distinct customers with explicit activity facts inside the requested time window. Null when no time window is requested.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.CUSTOMER_PROFILE_COMPLETE_COUNT,
      "Count of customers with an explicit complete profile-completeness signal. Missing signals are never coerced to incomplete.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.CUSTOMER_PROFILE_COMPLETENESS_RATE,
      "complete / (complete + incomplete) from explicit completeness facts only. Null when no completeness facts exist.",
      ANALYTICS_METRIC_UNIT.RATIO,
      ANALYTICS_AGGREGATION_KIND.RATE
    ),
    metricDraft(
      ids.CUSTOMER_PLAYER_LINKED_COUNT,
      "Distinct customerIds present in explicit customer↔player link facts. Null when the link fact list is absent.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.CUSTOMER_PLAYER_LINKAGE_RATE,
      "linkedCustomerCount / customerCount. Null when customerCount is zero or link facts are absent.",
      ANALYTICS_METRIC_UNIT.RATIO,
      ANALYTICS_AGGREGATION_KIND.RATE
    ),
    metricDraft(
      ids.CUSTOMER_ACTIVITIES_COUNT,
      "Count of explicit customer activity facts (optionally windowed).",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PLAYER_COUNT,
      "Count of explicit player analytical facts in the snapshot (identity not deduplicated).",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PLAYER_ACTIVE_COUNT,
      "Count of players with explicit active lifecycle/status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PLAYER_INACTIVE_COUNT,
      "Count of players with explicit inactive lifecycle/status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PLAYER_LIFECYCLE_DISTRIBUTION,
      "Distribution of explicit player lifecycle/status labels.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT,
      ANALYTICS_METRIC_KIND.OBSERVATIONAL
    ),
    metricDraft(
      ids.PLAYER_CREATED_COUNT,
      "Count of players with an explicit createdAt (optionally windowed).",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PLAYER_ACTIVE_IN_WINDOW_COUNT,
      "Distinct players with explicit activity facts inside the requested time window. Null when no time window is requested.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PLAYER_PROFILE_COMPLETE_COUNT,
      "Count of players with an explicit complete profile-completeness signal. Missing signals are never coerced to incomplete.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PLAYER_PROFILE_COMPLETENESS_RATE,
      "complete / (complete + incomplete) from explicit completeness facts only. Null when no completeness facts exist.",
      ANALYTICS_METRIC_UNIT.RATIO,
      ANALYTICS_AGGREGATION_KIND.RATE
    ),
    metricDraft(
      ids.PLAYER_CUSTOMER_LINKED_COUNT,
      "Distinct playerIds present in explicit customer↔player link facts. Null when the link fact list is absent.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PLAYER_CUSTOMER_LINKAGE_RATE,
      "linkedPlayerCount / playerCount. Null when playerCount is zero or link facts are absent.",
      ANALYTICS_METRIC_UNIT.RATIO,
      ANALYTICS_AGGREGATION_KIND.RATE
    ),
    metricDraft(
      ids.PLAYER_COMPETITION_PARTICIPATIONS_COUNT,
      "Count of explicit player competition-participation facts. No eligibility or performance inference.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PLAYER_CLUB_MEMBERSHIPS_COUNT,
      "Count of explicit player club-membership facts. No ranking inference.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      ids.PLAYER_ACTIVITIES_COUNT,
      "Count of explicit player activity facts (optionally windowed).",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
  ];

  /** @type {unknown[]} */
  const definitions = [];
  for (const draft of drafts) {
    const created = createAnalyticsMetricDefinition(draft);
    if (!created.ok) return created;
    definitions.push(created.value);
  }

  return ok(Object.freeze(definitions));
}

/**
 * Build registry-compatible entry requests for Customer / Player metrics.
 * @param {{ lifecycleState?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function createCustomerPlayerAnalyticsMetricCatalogEntries(
  options = {}
) {
  if (!isPlainObject(options)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DEFINITION_INVALID,
        "options must be a plain object",
        "options"
      )
    );
  }

  const definitionsResult = createCustomerPlayerAnalyticsMetricDefinitions();
  if (!definitionsResult.ok) return definitionsResult;

  const lifecycleState =
    options.lifecycleState || ANALYTICS_METRIC_LIFECYCLE_STATE.ACTIVE;

  const entries = definitionsResult.value.map((definition) =>
    Object.freeze({
      definition,
      lifecycleState,
      displayName: definition.metricId,
    })
  );

  return ok(deepFreeze(entries));
}
