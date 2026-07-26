/**
 * Aggregate connector / provider-adapter / webhook observations (ECO-05).
 * Deterministic, immutable — no persistence or network.
 */

import { fail, ok } from "../../../core/platform/index.js";
import { OBSERVATION_AGGREGATION_VERSION } from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireIsoInstant,
  requireNonEmptyString,
} from "./shared.js";
import { createIntegrationObservation } from "./integrationObservation.js";

export const OBSERVATION_AGGREGATION_ERROR = Object.freeze({
  INVALID: "OBSERVATION_AGGREGATION_INVALID",
  VERSION_INVALID: "OBSERVATION_AGGREGATION_VERSION_INVALID",
  OBSERVATION_INVALID: "OBSERVATION_AGGREGATION_OBSERVATION_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function aggregateIntegrationObservations(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        OBSERVATION_AGGREGATION_ERROR.INVALID,
        "Observation aggregation input must be a plain object"
      )
    );
  }

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? OBSERVATION_AGGREGATION_VERSION,
    "contractVersion",
    OBSERVATION_AGGREGATION_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const aggregatedAt = requireIsoInstant(
    input.aggregatedAt ?? new Date().toISOString(),
    "aggregatedAt",
    OBSERVATION_AGGREGATION_ERROR.INVALID
  );
  if (!aggregatedAt.ok) return aggregatedAt;

  if (!Array.isArray(input.observations)) {
    return fail(
      contractError(
        OBSERVATION_AGGREGATION_ERROR.INVALID,
        "observations must be an array",
        "observations"
      )
    );
  }

  /** @type {Array<Record<string, *>>} */
  const normalized = [];
  /** @type {Record<string, number>} */
  const bySourceKind = Object.create(null);
  /** @type {Record<string, number>} */
  const byOutcome = Object.create(null);
  /** @type {string|undefined} */
  let latestObservedAt;

  for (let i = 0; i < input.observations.length; i += 1) {
    const item = input.observations[i];
    const observation = createIntegrationObservation(item);
    if (!observation.ok) {
      return fail(
        contractError(
          OBSERVATION_AGGREGATION_ERROR.OBSERVATION_INVALID,
          `observations[${i}] is invalid: ${observation.error.message}`,
          `observations[${i}]`
        )
      );
    }
    const value = observation.value;
    normalized.push(value);

    bySourceKind[value.sourceKind] = (bySourceKind[value.sourceKind] ?? 0) + 1;
    const outcomeKey = value.outcome ?? "UNSPECIFIED";
    byOutcome[outcomeKey] = (byOutcome[outcomeKey] ?? 0) + 1;

    if (
      !latestObservedAt ||
      Date.parse(value.observedAt) > Date.parse(latestObservedAt)
    ) {
      latestObservedAt = value.observedAt;
    }
  }

  /** @type {Record<string, number>} */
  let connectorCounts = Object.create(null);
  /** @type {Record<string, number>} */
  let adapterCounts = Object.create(null);
  /** @type {Record<string, number>} */
  let webhookCounts = Object.create(null);

  for (const obs of normalized) {
    if (obs.connectorId) {
      connectorCounts[obs.connectorId] =
        (connectorCounts[obs.connectorId] ?? 0) + 1;
    }
    if (obs.adapterId) {
      adapterCounts[obs.adapterId] = (adapterCounts[obs.adapterId] ?? 0) + 1;
    }
    if (obs.ingressId || obs.sourceKind === "WEBHOOK_INGRESS") {
      const key = obs.ingressId ?? obs.subjectId;
      webhookCounts[key] = (webhookCounts[key] ?? 0) + 1;
    }
  }

  return ok(
    deepFreeze({
      contractVersion: contractVersion.value,
      aggregatedAt: aggregatedAt.value,
      total: normalized.length,
      bySourceKind: Object.freeze({ ...bySourceKind }),
      byOutcome: Object.freeze({ ...byOutcome }),
      connectorObservationCounts: Object.freeze({ ...connectorCounts }),
      providerAdapterObservationCounts: Object.freeze({ ...adapterCounts }),
      webhookIngressObservationCounts: Object.freeze({ ...webhookCounts }),
      ...(latestObservedAt ? { latestObservedAt } : {}),
      observations: Object.freeze(normalized),
    })
  );
}
