/**
 * Competition analytics snapshot envelope (I&A-06).
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_FRESHNESS_STATE } from "../contracts/enums.js";
import { createAnalyticsMetricProvenance } from "../contracts/source.js";
import { createAnalyticsWarning } from "../contracts/analyticsResult.js";
import {
  clonePlain,
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import { createCompetitionAnalyticsContext } from "./context.js";
import {
  COMPETITION_ANALYTICS_COMPLETENESS,
  isCompetitionAnalyticsEnumValue,
} from "./enums.js";
import {
  createCompetitionAssignmentFact,
  createCompetitionCategoryFact,
  createCompetitionDivisionFact,
  createCompetitionEntryFact,
  createCompetitionMatchFact,
  createCompetitionParticipantFact,
  createCompetitionRankingSnapshotFact,
  createCompetitionRegistrationFact,
  createCompetitionResultFact,
  createCompetitionRosterFact,
  createCompetitionScheduleFact,
  createCompetitionStandingsSnapshotFact,
  createCompetitionTeamFact,
} from "./facts.js";

const FACT_FACTORIES = Object.freeze({
  participants: createCompetitionParticipantFact,
  entries: createCompetitionEntryFact,
  registrations: createCompetitionRegistrationFact,
  divisions: createCompetitionDivisionFact,
  categories: createCompetitionCategoryFact,
  teams: createCompetitionTeamFact,
  rosters: createCompetitionRosterFact,
  matches: createCompetitionMatchFact,
  schedules: createCompetitionScheduleFact,
  assignments: createCompetitionAssignmentFact,
  results: createCompetitionResultFact,
  standingsSnapshots: createCompetitionStandingsSnapshotFact,
  rankingSnapshots: createCompetitionRankingSnapshotFact,
});

/**
 * @param {unknown} list
 * @param {string} key
 * @param {(input: unknown) => import("../contracts/result.js").Result} factory
 * @returns {import("../contracts/result.js").Result}
 */
function normalizeFactList(list, key, factory) {
  if (list === undefined) return ok(Object.freeze([]));
  if (!Array.isArray(list)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_SNAPSHOT_INVALID,
        `${key} must be an array`,
        key
      )
    );
  }
  /** @type {unknown[]} */
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    const created = factory(list[i]);
    if (!created.ok) {
      return fail(
        analyticsError(
          created.error.code || ANALYTICS_ERROR_CODE.COMPETITION_FACT_INVALID,
          created.error.message,
          `${key}[${i}]`,
          created.error.details
        )
      );
    }
    out.push(created.value);
  }
  return ok(Object.freeze(out));
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createCompetitionAnalyticsSnapshot(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_SNAPSHOT_INVALID,
        "CompetitionAnalyticsSnapshot must be a plain object",
        "snapshot"
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
  const context = contextResult.value;

  /** @type {Record<string, unknown>} */
  const lists = {};
  for (const [key, factory] of Object.entries(FACT_FACTORIES)) {
    const normalized = normalizeFactList(input[key], key, factory);
    if (!normalized.ok) return normalized;
    lists[key] = normalized.value;
  }

  let provenance;
  if (input.provenance !== undefined) {
    const provenanceResult = createAnalyticsMetricProvenance(input.provenance);
    if (!provenanceResult.ok) return provenanceResult;
    provenance = provenanceResult.value;
  } else {
    const provenanceResult = createAnalyticsMetricProvenance({
      source: {
        sourceId: "competition-analytics-explicit",
        sourceKind: "explicit_input",
        ownerModule: "intelligence-analytics",
        reference: "ia-06-certification",
      },
    });
    if (!provenanceResult.ok) return provenanceResult;
    provenance = provenanceResult.value;
  }

  const freshness = Object.values(ANALYTICS_FRESHNESS_STATE).includes(
    /** @type {string} */ (input.freshness)
  )
    ? /** @type {string} */ (input.freshness)
    : ANALYTICS_FRESHNESS_STATE.FRESH;

  const completeness = isCompetitionAnalyticsEnumValue(
    input.completeness,
    COMPETITION_ANALYTICS_COMPLETENESS
  )
    ? /** @type {string} */ (input.completeness)
    : COMPETITION_ANALYTICS_COMPLETENESS.COMPLETE;

  if (input.sourceTimestamp !== undefined && !isValidIsoTimestamp(input.sourceTimestamp)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.COMPETITION_TIMESTAMP_INVALID,
        "sourceTimestamp must be a valid ISO timestamp",
        "sourceTimestamp"
      )
    );
  }

  /** @type {unknown[]} */
  const warnings = [];
  if (Array.isArray(input.warnings)) {
    for (const warning of input.warnings) {
      const created = createAnalyticsWarning(warning);
      if (!created.ok) return created;
      warnings.push(created.value);
    }
  }

  /** @type {Record<string, unknown>} */
  const snapshot = {
    context,
    ...lists,
    provenance,
    freshness,
    completeness,
    warnings: Object.freeze(warnings),
    isCanonicalCompetitionState: false,
  };

  if (input.sourceTimestamp !== undefined) {
    snapshot.sourceTimestamp = String(input.sourceTimestamp).trim();
  }
  if (isNonEmptyString(input.canonicalSourceRef)) {
    snapshot.canonicalSourceRef = String(input.canonicalSourceRef).trim();
  }

  return ok(deepFreeze(clonePlain(snapshot)));
}
