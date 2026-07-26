/**
 * Safe webhook ingress observation / audit metadata — no secrets or raw body.
 */

import { fail, ok } from "../../../core/platform/index.js";
import { WEBHOOK_INGRESS_OBSERVATION_VERSION } from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireIsoInstant,
  requireNonEmptyString,
} from "./shared.js";
import { createRedactedDiagnostics } from "./redactedDiagnostics.js";

export const WEBHOOK_INGRESS_OBSERVATION_ERROR = Object.freeze({
  INVALID: "WEBHOOK_INGRESS_OBSERVATION_INVALID",
  REFERENCE_INVALID: "WEBHOOK_INGRESS_OBSERVATION_REFERENCE_INVALID",
  TIMESTAMP_INVALID: "WEBHOOK_INGRESS_OBSERVATION_TIMESTAMP_INVALID",
  VERSION_INVALID: "WEBHOOK_INGRESS_OBSERVATION_VERSION_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createWebhookIngressObservation(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        WEBHOOK_INGRESS_OBSERVATION_ERROR.INVALID,
        "WebhookIngressObservation input must be a plain object"
      )
    );
  }

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? WEBHOOK_INGRESS_OBSERVATION_VERSION,
    "contractVersion",
    WEBHOOK_INGRESS_OBSERVATION_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const observationId = requireNonEmptyString(
    input.observationId,
    "observationId",
    WEBHOOK_INGRESS_OBSERVATION_ERROR.REFERENCE_INVALID,
    "observationId"
  );
  if (!observationId.ok) return observationId;

  const ingressId = requireNonEmptyString(
    input.ingressId,
    "ingressId",
    WEBHOOK_INGRESS_OBSERVATION_ERROR.REFERENCE_INVALID,
    "ingressId"
  );
  if (!ingressId.ok) return ingressId;

  const observedAt = requireIsoInstant(
    input.observedAt ?? new Date().toISOString(),
    "observedAt",
    WEBHOOK_INGRESS_OBSERVATION_ERROR.TIMESTAMP_INVALID
  );
  if (!observedAt.ok) return observedAt;

  const eventType = requireNonEmptyString(
    input.eventType ?? "webhook.ingress",
    "eventType",
    WEBHOOK_INGRESS_OBSERVATION_ERROR.REFERENCE_INVALID,
    "eventType"
  );
  if (!eventType.ok) return eventType;

  /** @type {string|undefined} */
  let routeId;
  if ("routeId" in input && input.routeId !== undefined) {
    const route = requireNonEmptyString(
      input.routeId,
      "routeId",
      WEBHOOK_INGRESS_OBSERVATION_ERROR.REFERENCE_INVALID,
      "routeId"
    );
    if (!route.ok) return route;
    routeId = route.value;
  }

  /** @type {string|undefined} */
  let outcome;
  if ("outcome" in input && input.outcome !== undefined) {
    const o = requireNonEmptyString(
      input.outcome,
      "outcome",
      WEBHOOK_INGRESS_OBSERVATION_ERROR.REFERENCE_INVALID,
      "outcome"
    );
    if (!o.ok) return o;
    outcome = o.value;
  }

  /** @type {string|undefined} */
  let correlationId;
  if ("correlationId" in input && input.correlationId !== undefined) {
    const corr = requireNonEmptyString(
      input.correlationId,
      "correlationId",
      WEBHOOK_INGRESS_OBSERVATION_ERROR.REFERENCE_INVALID,
      "correlationId"
    );
    if (!corr.ok) return corr;
    correlationId = corr.value;
  }

  let attributes = Object.freeze({});
  if ("attributes" in input && input.attributes !== undefined) {
    if (!isPlainObject(input.attributes)) {
      return fail(
        contractError(
          WEBHOOK_INGRESS_OBSERVATION_ERROR.INVALID,
          "attributes must be a plain object",
          "attributes"
        )
      );
    }
    const redacted = createRedactedDiagnostics(input.attributes);
    if (!redacted.ok) return redacted;
    attributes = redacted.value;
  }

  return ok(
    deepFreeze({
      observationId: observationId.value,
      contractVersion: contractVersion.value,
      ingressId: ingressId.value,
      observedAt: observedAt.value,
      eventType: eventType.value,
      ...(routeId ? { routeId } : {}),
      ...(outcome ? { outcome } : {}),
      ...(correlationId ? { correlationId } : {}),
      attributes,
    })
  );
}
