/**
 * Deterministic webhook ingress routing — no HTTP, no Production activation.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  CONNECTOR_ENVIRONMENT,
  WEBHOOK_ROUTING_OUTCOME,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireEnumMember,
  requireNonEmptyString,
} from "../contracts/shared.js";

export const WEBHOOK_INGRESS_ROUTING_ERROR = Object.freeze({
  INVALID: "WEBHOOK_INGRESS_ROUTING_INVALID",
  REGISTRY_INVALID: "WEBHOOK_INGRESS_ROUTING_REGISTRY_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function routeWebhookIngress(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        WEBHOOK_INGRESS_ROUTING_ERROR.INVALID,
        "routeWebhookIngress input must be a plain object"
      )
    );
  }

  const registry = input.registry;
  if (
    !registry ||
    typeof registry.findRoutesByKey !== "function" ||
    typeof registry.findSubscriptionsByRoute !== "function"
  ) {
    return fail(
      contractError(
        WEBHOOK_INGRESS_ROUTING_ERROR.REGISTRY_INVALID,
        "registry must be a WebhookRouteRegistry",
        "registry"
      )
    );
  }

  const routeKey = requireNonEmptyString(
    input.routeKey,
    "routeKey",
    WEBHOOK_INGRESS_ROUTING_ERROR.INVALID,
    "routeKey"
  );
  if (!routeKey.ok) return routeKey;

  const environment = requireEnumMember(
    input.environment ?? "TEST",
    Object.values(CONNECTOR_ENVIRONMENT),
    "environment",
    WEBHOOK_INGRESS_ROUTING_ERROR.INVALID,
    "environment"
  );
  if (!environment.ok) return environment;

  if (environment.value === "PRODUCTION") {
    return ok(
      deepFreeze({
        outcome: WEBHOOK_ROUTING_OUTCOME.PRODUCTION_BLOCKED,
        selectedRouteId: null,
        selectedSubscriptionId: null,
        reason: "production_environment_blocked",
        candidates: Object.freeze([]),
      })
    );
  }

  const found = registry.findRoutesByKey(routeKey.value);
  if (!found.ok) return found;

  const candidates = found.value;
  if (candidates.length === 0) {
    return ok(
      deepFreeze({
        outcome: WEBHOOK_ROUTING_OUTCOME.NO_MATCH,
        selectedRouteId: null,
        selectedSubscriptionId: null,
        reason: "no_route_for_key",
        candidates: Object.freeze([]),
      })
    );
  }

  /** @type {object[]} */
  const envEligible = [];
  /** @type {object[]} */
  const disabled = [];

  for (const route of candidates) {
    if (route.endpointClass === "PRODUCTION") {
      return ok(
        deepFreeze({
          outcome: WEBHOOK_ROUTING_OUTCOME.PRODUCTION_BLOCKED,
          selectedRouteId: null,
          selectedSubscriptionId: null,
          reason: "production_route_blocked",
          candidates: Object.freeze(candidates.map((r) => r.routeId)),
        })
      );
    }
    if (
      route.lifecycleState === "DISABLED" ||
      route.lifecycleState === "RETIRED" ||
      route.enabled === false
    ) {
      disabled.push(route);
      continue;
    }
    if (!route.supportedEnvironments.includes(environment.value)) {
      continue;
    }
    if (
      input.providerEventType &&
      Array.isArray(route.eventTypes) &&
      route.eventTypes.length > 0 &&
      !route.eventTypes.includes(input.providerEventType)
    ) {
      continue;
    }
    envEligible.push(route);
  }

  if (envEligible.length === 0) {
    if (disabled.length > 0) {
      return ok(
        deepFreeze({
          outcome: WEBHOOK_ROUTING_OUTCOME.DISABLED,
          selectedRouteId: null,
          selectedSubscriptionId: null,
          reason: "matching_routes_disabled",
          candidates: Object.freeze(disabled.map((r) => r.routeId)),
        })
      );
    }
    return ok(
      deepFreeze({
        outcome: WEBHOOK_ROUTING_OUTCOME.ENVIRONMENT_BLOCKED,
        selectedRouteId: null,
        selectedSubscriptionId: null,
        reason: "no_environment_eligible_route",
        candidates: Object.freeze(candidates.map((r) => r.routeId)),
      })
    );
  }

  // Deterministic: lowest priority, then routeId.
  const sorted = [...envEligible].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.routeId.localeCompare(b.routeId);
  });

  if (
    sorted.length > 1 &&
    sorted[0].priority === sorted[1].priority &&
    input.allowAmbiguous !== true
  ) {
    // Same priority ties are ambiguous unless explicitly allowed (then first wins).
    const samePriority = sorted.filter((r) => r.priority === sorted[0].priority);
    if (samePriority.length > 1) {
      return ok(
        deepFreeze({
          outcome: WEBHOOK_ROUTING_OUTCOME.AMBIGUOUS,
          selectedRouteId: null,
          selectedSubscriptionId: null,
          reason: "multiple_routes_same_priority",
          candidates: Object.freeze(samePriority.map((r) => r.routeId)),
        })
      );
    }
  }

  const selectedRoute = sorted[0];
  const subscriptionsResult = registry.findSubscriptionsByRoute(
    selectedRoute.routeId
  );
  if (!subscriptionsResult.ok) return subscriptionsResult;

  const enabledSubs = subscriptionsResult.value.filter(
    (s) => s.enabled !== false
  );
  const filteredSubs =
    input.providerEventType && enabledSubs.some((s) => s.eventTypes.length > 0)
      ? enabledSubs.filter(
          (s) =>
            s.eventTypes.length === 0 ||
            s.eventTypes.includes(input.providerEventType)
        )
      : enabledSubs;

  const sortedSubs = [...filteredSubs].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.subscriptionId.localeCompare(b.subscriptionId);
  });

  return ok(
    deepFreeze({
      outcome: WEBHOOK_ROUTING_OUTCOME.ROUTED,
      selectedRouteId: selectedRoute.routeId,
      selectedRoute,
      selectedSubscriptionId: sortedSubs[0]?.subscriptionId ?? null,
      selectedSubscription: sortedSubs[0] ?? null,
      reason: "routed",
      candidates: Object.freeze(sorted.map((r) => r.routeId)),
    })
  );
}
