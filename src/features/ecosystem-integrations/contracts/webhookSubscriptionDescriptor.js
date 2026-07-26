/**
 * Immutable webhook subscription descriptor — binds route to handler capability.
 */

import { fail, ok } from "../../../core/platform/index.js";
import { WEBHOOK_SUBSCRIPTION_DESCRIPTOR_VERSION } from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  normalizeOpaquePayload,
  requireBoolean,
  requireNonEmptyString,
  requireStringArray,
} from "./shared.js";

export const WEBHOOK_SUBSCRIPTION_DESCRIPTOR_ERROR = Object.freeze({
  INVALID: "WEBHOOK_SUBSCRIPTION_DESCRIPTOR_INVALID",
  VERSION_INVALID: "WEBHOOK_SUBSCRIPTION_DESCRIPTOR_VERSION_INVALID",
  REFERENCE_INVALID: "WEBHOOK_SUBSCRIPTION_DESCRIPTOR_REFERENCE_INVALID",
  METADATA_INVALID: "WEBHOOK_SUBSCRIPTION_DESCRIPTOR_METADATA_INVALID",
});

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function createWebhookSubscriptionDescriptor(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        WEBHOOK_SUBSCRIPTION_DESCRIPTOR_ERROR.INVALID,
        "WebhookSubscriptionDescriptor input must be a plain object"
      )
    );
  }

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? WEBHOOK_SUBSCRIPTION_DESCRIPTOR_VERSION,
    "contractVersion",
    WEBHOOK_SUBSCRIPTION_DESCRIPTOR_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const subscriptionId = requireNonEmptyString(
    input.subscriptionId ??
      `${String(input.routeId || "").trim()}:${String(input.handlerKey || "").trim()}`,
    "subscriptionId",
    WEBHOOK_SUBSCRIPTION_DESCRIPTOR_ERROR.REFERENCE_INVALID,
    "subscriptionId"
  );
  if (!subscriptionId.ok) return subscriptionId;

  const routeId = requireNonEmptyString(
    input.routeId,
    "routeId",
    WEBHOOK_SUBSCRIPTION_DESCRIPTOR_ERROR.REFERENCE_INVALID,
    "routeId"
  );
  if (!routeId.ok) return routeId;

  const handlerKey = requireNonEmptyString(
    input.handlerKey ?? input.capabilityId ?? "eco.webhook.ingress.handle",
    "handlerKey",
    WEBHOOK_SUBSCRIPTION_DESCRIPTOR_ERROR.REFERENCE_INVALID,
    "handlerKey"
  );
  if (!handlerKey.ok) return handlerKey;

  const enabled = requireBoolean(
    input.enabled ?? true,
    "enabled",
    WEBHOOK_SUBSCRIPTION_DESCRIPTOR_ERROR.INVALID
  );
  if (!enabled.ok) return enabled;

  const priority =
    input.priority != null && Number.isFinite(Number(input.priority))
      ? Number(input.priority)
      : 100;

  const eventTypes = requireStringArray(
    input.eventTypes ?? [],
    "eventTypes",
    WEBHOOK_SUBSCRIPTION_DESCRIPTOR_ERROR.REFERENCE_INVALID,
    "eventTypes"
  );
  if (!eventTypes.ok) return eventTypes;

  let publicMetadata = Object.freeze({});
  if ("publicMetadata" in input && input.publicMetadata !== undefined) {
    const meta = normalizeOpaquePayload(
      input.publicMetadata,
      "publicMetadata",
      WEBHOOK_SUBSCRIPTION_DESCRIPTOR_ERROR.METADATA_INVALID
    );
    if (!meta.ok) return meta;
    publicMetadata = meta.value;
  }

  return ok(
    deepFreeze({
      contractVersion: contractVersion.value,
      subscriptionId: subscriptionId.value,
      routeId: routeId.value,
      handlerKey: handlerKey.value,
      enabled: enabled.value,
      priority,
      eventTypes: eventTypes.value,
      publicMetadata,
    })
  );
}

/**
 * @param {*} value
 * @returns {boolean}
 */
export function isWebhookSubscriptionDescriptor(value) {
  return (
    isPlainObject(value) &&
    value.contractVersion === WEBHOOK_SUBSCRIPTION_DESCRIPTOR_VERSION &&
    typeof value.subscriptionId === "string" &&
    typeof value.routeId === "string" &&
    typeof value.handlerKey === "string"
  );
}
