/**
 * Immutable webhook route / subscription registry — explicit input only.
 * Not a global service locator. No HTTP listeners. No Production routes.
 */

import { fail, ok } from "../../../core/platform/index.js";
import { createWebhookRouteDescriptor } from "../contracts/webhookRouteDescriptor.js";
import { createWebhookSubscriptionDescriptor } from "../contracts/webhookSubscriptionDescriptor.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
} from "../contracts/shared.js";

export const WEBHOOK_ROUTE_REGISTRY_ERROR = Object.freeze({
  INVALID: "WEBHOOK_ROUTE_REGISTRY_INVALID",
  DUPLICATE_ROUTE: "WEBHOOK_ROUTE_REGISTRY_DUPLICATE_ROUTE",
  DUPLICATE_SUBSCRIPTION: "WEBHOOK_ROUTE_REGISTRY_DUPLICATE_SUBSCRIPTION",
  INVALID_SUBSCRIPTION: "WEBHOOK_ROUTE_REGISTRY_INVALID_SUBSCRIPTION",
  NOT_FOUND: "WEBHOOK_ROUTE_REGISTRY_NOT_FOUND",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createWebhookRouteRegistry(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        WEBHOOK_ROUTE_REGISTRY_ERROR.INVALID,
        "WebhookRouteRegistry input must be a plain object"
      )
    );
  }

  const routesRaw = Array.isArray(input.routes) ? input.routes : [];
  const subscriptionsRaw = Array.isArray(input.subscriptions)
    ? input.subscriptions
    : [];

  /** @type {Map<string, object>} */
  const routesById = new Map();
  /** @type {Map<string, object[]>} */
  const routesByKey = new Map();
  /** @type {Map<string, object>} */
  const subscriptionsById = new Map();
  /** @type {Map<string, object[]>} */
  const subscriptionsByRoute = new Map();

  for (let i = 0; i < routesRaw.length; i += 1) {
    const result = createWebhookRouteDescriptor(routesRaw[i]);
    if (!result.ok) {
      return fail(
        contractError(
          WEBHOOK_ROUTE_REGISTRY_ERROR.INVALID,
          `routes[${i}] is invalid: ${result.error.message}`,
          "routes"
        )
      );
    }
    const route = result.value;
    if (routesById.has(route.routeId)) {
      return fail(
        contractError(
          WEBHOOK_ROUTE_REGISTRY_ERROR.DUPLICATE_ROUTE,
          `Duplicate routeId: ${route.routeId}`,
          "routes"
        )
      );
    }
    routesById.set(route.routeId, route);
    const keyList = routesByKey.get(route.routeKey) ?? [];
    keyList.push(route);
    routesByKey.set(route.routeKey, keyList);
  }

  for (let i = 0; i < subscriptionsRaw.length; i += 1) {
    const result = createWebhookSubscriptionDescriptor(subscriptionsRaw[i]);
    if (!result.ok) {
      return fail(
        contractError(
          WEBHOOK_ROUTE_REGISTRY_ERROR.INVALID,
          `subscriptions[${i}] is invalid: ${result.error.message}`,
          "subscriptions"
        )
      );
    }
    const subscription = result.value;
    if (subscriptionsById.has(subscription.subscriptionId)) {
      return fail(
        contractError(
          WEBHOOK_ROUTE_REGISTRY_ERROR.DUPLICATE_SUBSCRIPTION,
          `Duplicate subscriptionId: ${subscription.subscriptionId}`,
          "subscriptions"
        )
      );
    }
    if (!routesById.has(subscription.routeId)) {
      return fail(
        contractError(
          WEBHOOK_ROUTE_REGISTRY_ERROR.INVALID_SUBSCRIPTION,
          `Subscription references unknown routeId: ${subscription.routeId}`,
          "subscriptions"
        )
      );
    }
    subscriptionsById.set(subscription.subscriptionId, subscription);
    const list = subscriptionsByRoute.get(subscription.routeId) ?? [];
    list.push(subscription);
    subscriptionsByRoute.set(subscription.routeId, list);
  }

  const routeList = Object.freeze(
    [...routesById.values()].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.routeId.localeCompare(b.routeId);
    })
  );
  const subscriptionList = Object.freeze(
    [...subscriptionsById.values()].sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.subscriptionId.localeCompare(b.subscriptionId);
    })
  );

  const registry = {
    listRoutes() {
      return routeList;
    },
    listSubscriptions() {
      return subscriptionList;
    },
    getRoute(routeId) {
      if (typeof routeId !== "string" || !routesById.has(routeId)) {
        return fail(
          contractError(
            WEBHOOK_ROUTE_REGISTRY_ERROR.NOT_FOUND,
            `Route not found: ${String(routeId)}`,
            "routeId"
          )
        );
      }
      return ok(routesById.get(routeId));
    },
    getSubscription(subscriptionId) {
      if (
        typeof subscriptionId !== "string" ||
        !subscriptionsById.has(subscriptionId)
      ) {
        return fail(
          contractError(
            WEBHOOK_ROUTE_REGISTRY_ERROR.NOT_FOUND,
            `Subscription not found: ${String(subscriptionId)}`,
            "subscriptionId"
          )
        );
      }
      return ok(subscriptionsById.get(subscriptionId));
    },
    /**
     * Deterministic candidate routes for a routeKey.
     * @param {string} routeKey
     */
    findRoutesByKey(routeKey) {
      if (typeof routeKey !== "string" || routeKey.trim().length === 0) {
        return fail(
          contractError(
            WEBHOOK_ROUTE_REGISTRY_ERROR.INVALID,
            "routeKey must be a non-empty string",
            "routeKey"
          )
        );
      }
      const key = routeKey.trim();
      const matched = routesByKey.get(key) ?? [];
      return ok(
        Object.freeze(
          [...matched].sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.routeId.localeCompare(b.routeId);
          })
        )
      );
    },
    /**
     * @param {string} routeId
     */
    findSubscriptionsByRoute(routeId) {
      if (typeof routeId !== "string" || routeId.trim().length === 0) {
        return fail(
          contractError(
            WEBHOOK_ROUTE_REGISTRY_ERROR.INVALID,
            "routeId must be a non-empty string",
            "routeId"
          )
        );
      }
      const matched = subscriptionsByRoute.get(routeId.trim()) ?? [];
      return ok(
        Object.freeze(
          [...matched].sort((a, b) => {
            if (a.priority !== b.priority) return a.priority - b.priority;
            return a.subscriptionId.localeCompare(b.subscriptionId);
          })
        )
      );
    },
  };

  return ok(deepFreeze(registry));
}
