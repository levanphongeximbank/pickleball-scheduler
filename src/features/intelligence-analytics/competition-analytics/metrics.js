/**
 * Competition Analytics metric catalog (I&A-06).
 * Registry-compatible definitions — no business-rule calculation.
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

export const COMPETITION_ANALYTICS_METRIC_SOURCE = Object.freeze({
  sourceId: "competition-analytics-explicit",
  sourceKind: "explicit_input",
  ownerModule: "intelligence-analytics",
  reference: "ia-06-competition-analytics",
});

/**
 * Stable metric ID catalog for Competition Analytics foundation.
 */
export const COMPETITION_ANALYTICS_METRIC_IDS = Object.freeze({
  PARTICIPANTS_COUNT: "competition.participants.count",
  ENTRIES_COUNT: "competition.entries.count",
  REGISTRATIONS_COUNT: "competition.registrations.count",
  REGISTRATIONS_STATUS_DISTRIBUTION:
    "competition.registrations.status_distribution",
  DIVISIONS_COUNT: "competition.divisions.count",
  CATEGORIES_COUNT: "competition.categories.count",
  TEAMS_COUNT: "competition.teams.count",
  MATCHES_COUNT: "competition.matches.count",
  MATCHES_LIFECYCLE_DISTRIBUTION: "competition.matches.lifecycle_distribution",
  MATCHES_COMPLETED_COUNT: "competition.matches.completed_count",
  MATCHES_COMPLETION_RATE: "competition.matches.completion_rate",
  RESULTS_ACCEPTED_COUNT: "competition.results.accepted_count",
  RESULTS_REJECTED_COUNT: "competition.results.rejected_count",
  RESULTS_ACCEPTANCE_RATE: "competition.results.acceptance_rate",
  SCHEDULE_STARTED_ON_TIME_COUNT: "competition.schedule.started_on_time_count",
  SCHEDULE_DELAYED_START_COUNT: "competition.schedule.delayed_start_count",
  SCHEDULE_ADHERENCE_RATE: "competition.schedule.adherence_rate",
  MATCHES_AVERAGE_DURATION: "competition.matches.average_duration",
  MATCHES_DURATION_DISTRIBUTION: "competition.matches.duration_distribution",
  MATCHES_CANCELLED_COUNT: "competition.matches.cancelled_count",
  MATCHES_ABANDONED_COUNT: "competition.matches.abandoned_count",
  MATCHES_VOID_COUNT: "competition.matches.void_count",
  COURTS_ASSIGNED_MATCH_COUNT: "competition.courts.assigned_match_count",
  REFEREES_ASSIGNED_MATCH_COUNT: "competition.referees.assigned_match_count",
  PROGRESS_PERCENTAGE: "competition.progress.percentage",
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
    source: COMPETITION_ANALYTICS_METRIC_SOURCE,
    supportedTenantScopeKinds: [ANALYTICS_TENANT_SCOPE_KIND.TENANT],
    supportedGranularities: [
      ANALYTICS_GRANULARITY.RAW,
      ANALYTICS_GRANULARITY.DAY,
      ANALYTICS_GRANULARITY.WEEK,
      ANALYTICS_GRANULARITY.MONTH,
      ANALYTICS_GRANULARITY.WINDOW,
    ],
    allowedDimensions: [
      { key: "competitionId" },
      { key: "status" },
      { key: "divisionId" },
      { key: "categoryId" },
    ],
    missingDataSemantics: ANALYTICS_MISSING_DATA_SEMANTICS.PRESERVE_NULL,
  };
}

/**
 * Build validated Competition Analytics metric definitions.
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionAnalyticsMetricDefinitions() {
  const drafts = [
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.PARTICIPANTS_COUNT,
      "Count of explicit competition participant facts in the analytical snapshot.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.ENTRIES_COUNT,
      "Count of explicit competition entry facts in the analytical snapshot.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.REGISTRATIONS_COUNT,
      "Count of explicit registration facts in the analytical snapshot.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.REGISTRATIONS_STATUS_DISTRIBUTION,
      "Distribution of explicit registration status labels.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT,
      ANALYTICS_METRIC_KIND.OBSERVATIONAL
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.DIVISIONS_COUNT,
      "Count of explicit division facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.CATEGORIES_COUNT,
      "Count of explicit category facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.TEAMS_COUNT,
      "Count of explicit team facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.MATCHES_COUNT,
      "Count of explicit match facts.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.MATCHES_LIFECYCLE_DISTRIBUTION,
      "Distribution of explicit match lifecycle statuses.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT,
      ANALYTICS_METRIC_KIND.OBSERVATIONAL
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.MATCHES_COMPLETED_COUNT,
      "Count of matches with explicit completed lifecycle status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.MATCHES_COMPLETION_RATE,
      "completed / eligible total matches per explicit progress policy. Null when denominator is zero.",
      ANALYTICS_METRIC_UNIT.RATIO,
      ANALYTICS_AGGREGATION_KIND.RATE
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.RESULTS_ACCEPTED_COUNT,
      "Count of results with explicit accepted acceptance status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.RESULTS_REJECTED_COUNT,
      "Count of results with explicit rejected acceptance status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.RESULTS_ACCEPTANCE_RATE,
      "accepted / (accepted + rejected). Null when denominator is zero. Pending/unknown excluded from denominator.",
      ANALYTICS_METRIC_UNIT.RATIO,
      ANALYTICS_AGGREGATION_KIND.RATE
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.SCHEDULE_STARTED_ON_TIME_COUNT,
      "Count of matches whose actual start is within the versioned on-time threshold of scheduled start.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.SCHEDULE_DELAYED_START_COUNT,
      "Count of matches whose actual start exceeds the versioned on-time threshold after scheduled start.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.SCHEDULE_ADHERENCE_RATE,
      "on-time / (on-time + delayed). Null when denominator is zero.",
      ANALYTICS_METRIC_UNIT.RATIO,
      ANALYTICS_AGGREGATION_KIND.RATE
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.MATCHES_AVERAGE_DURATION,
      "Average match duration in seconds from explicit actualStartAt/actualEndAt. Null when no valid durations.",
      ANALYTICS_METRIC_UNIT.DURATION_SECONDS,
      ANALYTICS_AGGREGATION_KIND.AVERAGE
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.MATCHES_DURATION_DISTRIBUTION,
      "Distribution of explicit match durations (bucketed descriptively).",
      ANALYTICS_METRIC_UNIT.DURATION_SECONDS,
      ANALYTICS_AGGREGATION_KIND.COUNT,
      ANALYTICS_METRIC_KIND.OBSERVATIONAL
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.MATCHES_CANCELLED_COUNT,
      "Count of matches with explicit cancelled lifecycle status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.MATCHES_ABANDONED_COUNT,
      "Count of matches with explicit abandoned lifecycle status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.MATCHES_VOID_COUNT,
      "Count of matches with explicit void lifecycle status.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.COURTS_ASSIGNED_MATCH_COUNT,
      "Count of distinct matches with an explicit court assignment fact.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.REFEREES_ASSIGNED_MATCH_COUNT,
      "Count of distinct matches with an explicit referee assignment fact.",
      ANALYTICS_METRIC_UNIT.COUNT,
      ANALYTICS_AGGREGATION_KIND.COUNT
    ),
    metricDraft(
      COMPETITION_ANALYTICS_METRIC_IDS.PROGRESS_PERCENTAGE,
      "Descriptive progress percentage: completed / eligible * 100. Null when denominator is zero.",
      ANALYTICS_METRIC_UNIT.PERCENT,
      ANALYTICS_AGGREGATION_KIND.RATE
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
 * Build registry-compatible entry requests for Competition Analytics metrics.
 * @param {{ lifecycleState?: string }} [options]
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionAnalyticsMetricCatalogEntries(options = {}) {
  if (!isPlainObject(options)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.DEFINITION_INVALID,
        "options must be a plain object",
        "options"
      )
    );
  }

  const definitionsResult = createCompetitionAnalyticsMetricDefinitions();
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
