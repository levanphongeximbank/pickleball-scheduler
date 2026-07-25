/**
 * Customer / Player analytics snapshot envelope (I&A-08).
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
import { createCustomerPlayerAnalyticsContext } from "./context.js";
import {
  CUSTOMER_PLAYER_ANALYTICS_COMPLETENESS,
  isCustomerPlayerAnalyticsEnumValue,
} from "./enums.js";
import {
  createCustomerActivityFact,
  createCustomerAnalyticalFact,
  createCustomerLifecycleFact,
  createCustomerPlayerLinkFact,
  createCustomerProfileCompletenessFact,
  createPlayerActivityFact,
  createPlayerAnalyticalFact,
  createPlayerClubMembershipFact,
  createPlayerCompetitionParticipationFact,
  createPlayerLifecycleFact,
  createPlayerProfileCompletenessFact,
} from "./facts.js";

const FACT_FACTORIES = Object.freeze({
  customers: createCustomerAnalyticalFact,
  customerLifecycles: createCustomerLifecycleFact,
  customerProfileCompleteness: createCustomerProfileCompletenessFact,
  customerActivities: createCustomerActivityFact,
  players: createPlayerAnalyticalFact,
  playerLifecycles: createPlayerLifecycleFact,
  playerProfileCompleteness: createPlayerProfileCompletenessFact,
  playerActivities: createPlayerActivityFact,
  customerPlayerLinks: createCustomerPlayerLinkFact,
  playerCompetitionParticipations: createPlayerCompetitionParticipationFact,
  playerClubMemberships: createPlayerClubMembershipFact,
});

/**
 * customerPlayerLinks must preserve the distinction between "not supplied by
 * the source" (linkage indeterminate) and "supplied but empty" (linkage
 * known to be zero) — see projections.js projectCustomerPlayerLinkage.
 */
const LIST_KEYS_ALLOWING_ABSENT = Object.freeze(new Set(["customerPlayerLinks"]));

/**
 * @param {unknown} list
 * @param {string} key
 * @param {(input: unknown) => import("../contracts/result.js").Result} factory
 * @returns {import("../contracts/result.js").Result}
 */
function normalizeFactList(list, key, factory) {
  if (list === undefined) {
    return ok(LIST_KEYS_ALLOWING_ABSENT.has(key) ? undefined : Object.freeze([]));
  }
  if (!Array.isArray(list)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_SNAPSHOT_INVALID,
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
          created.error.code || ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_FACT_INVALID,
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
export function createCustomerPlayerAnalyticsSnapshot(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_SNAPSHOT_INVALID,
        "CustomerPlayerAnalyticsSnapshot must be a plain object",
        "snapshot"
      )
    );
  }

  const contextResult = createCustomerPlayerAnalyticsContext(
    input.context || {
      tenantScope: input.tenantScope,
      customerId: input.customerId,
      playerId: input.playerId,
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
        sourceId: "customer-player-analytics-explicit",
        sourceKind: "explicit_input",
        ownerModule: "intelligence-analytics",
        reference: "ia-08-certification",
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

  const completeness = isCustomerPlayerAnalyticsEnumValue(
    input.completeness,
    CUSTOMER_PLAYER_ANALYTICS_COMPLETENESS
  )
    ? /** @type {string} */ (input.completeness)
    : CUSTOMER_PLAYER_ANALYTICS_COMPLETENESS.COMPLETE;

  if (
    input.sourceTimestamp !== undefined &&
    !isValidIsoTimestamp(input.sourceTimestamp)
  ) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.CUSTOMER_PLAYER_TIMESTAMP_INVALID,
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
    isCanonicalCustomerPlayerState: false,
    isCanonicalModuleState: false,
  };

  if (input.sourceTimestamp !== undefined) {
    snapshot.sourceTimestamp = String(input.sourceTimestamp).trim();
  }
  if (isNonEmptyString(input.canonicalSourceRef)) {
    snapshot.canonicalSourceRef = String(input.canonicalSourceRef).trim();
  }

  return ok(deepFreeze(clonePlain(snapshot)));
}
