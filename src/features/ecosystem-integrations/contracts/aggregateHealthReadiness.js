/**
 * Aggregate readiness / health projection across connectors, adapters, routes.
 * Injected flags only — never reads env, secrets, or network.
 */

import { fail, ok } from "../../../core/platform/index.js";
import {
  AGGREGATE_HEALTH_READINESS_VERSION,
  AGGREGATE_HEALTH_STATUS,
  OPERATIONAL_STATUS,
} from "../constants/catalogues.js";
import {
  contractError,
  deepFreeze,
  isPlainObject,
  requireBoolean,
  requireIsoInstant,
  requireNonEmptyString,
} from "./shared.js";

export const AGGREGATE_HEALTH_READINESS_ERROR = Object.freeze({
  INVALID: "AGGREGATE_HEALTH_READINESS_INVALID",
  VERSION_INVALID: "AGGREGATE_HEALTH_READINESS_VERSION_INVALID",
  FLAG_INVALID: "AGGREGATE_HEALTH_READINESS_FLAG_INVALID",
  INPUT_INVALID: "AGGREGATE_HEALTH_READINESS_INPUT_INVALID",
});

/**
 * @param {ReadonlyArray<*>} items
 * @param {string} field
 * @returns {{ ok: true, value: ReadonlyArray<Record<string, *>> } | { ok: false, error: * }}
 */
function requirePlainObjectArray(items, field) {
  if (!Array.isArray(items)) {
    return fail(
      contractError(
        AGGREGATE_HEALTH_READINESS_ERROR.INPUT_INVALID,
        `${field} must be an array`,
        field
      )
    );
  }
  /** @type {Array<Record<string, *>>} */
  const out = [];
  for (let i = 0; i < items.length; i += 1) {
    if (!isPlainObject(items[i])) {
      return fail(
        contractError(
          AGGREGATE_HEALTH_READINESS_ERROR.INPUT_INVALID,
          `${field}[${i}] must be a plain object`,
          `${field}[${i}]`
        )
      );
    }
    out.push(items[i]);
  }
  return ok(Object.freeze(out));
}

/**
 * @param {*} status
 * @returns {string}
 */
function normalizeOperational(status) {
  if (typeof status !== "string") return OPERATIONAL_STATUS.NOT_READY;
  return status;
}

/**
 * @param {*} input
 * @returns {import("../../../core/platform/contracts/result.js").Result}
 */
export function projectAggregateIntegrationHealth(input) {
  if (!isPlainObject(input)) {
    return fail(
      contractError(
        AGGREGATE_HEALTH_READINESS_ERROR.INVALID,
        "Aggregate health input must be a plain object"
      )
    );
  }

  const contractVersion = requireNonEmptyString(
    input.contractVersion ?? AGGREGATE_HEALTH_READINESS_VERSION,
    "contractVersion",
    AGGREGATE_HEALTH_READINESS_ERROR.VERSION_INVALID,
    "contractVersion"
  );
  if (!contractVersion.ok) return contractVersion;

  const projectedAt = requireIsoInstant(
    input.projectedAt ?? new Date().toISOString(),
    "projectedAt",
    AGGREGATE_HEALTH_READINESS_ERROR.INVALID
  );
  if (!projectedAt.ok) return projectedAt;

  const connectorReadiness = requirePlainObjectArray(
    input.connectorReadiness ?? [],
    "connectorReadiness"
  );
  if (!connectorReadiness.ok) return connectorReadiness;

  const adapterReadiness = requirePlainObjectArray(
    input.adapterReadiness ?? [],
    "adapterReadiness"
  );
  if (!adapterReadiness.ok) return adapterReadiness;

  const webhookRouteReadiness = requirePlainObjectArray(
    input.webhookRouteReadiness ?? [],
    "webhookRouteReadiness"
  );
  if (!webhookRouteReadiness.ok) return webhookRouteReadiness;

  const productionBlocked = requireBoolean(
    input.productionBlocked ?? true,
    "productionBlocked",
    AGGREGATE_HEALTH_READINESS_ERROR.FLAG_INVALID
  );
  if (!productionBlocked.ok) return productionBlocked;

  const hasRealProviders = requireBoolean(
    input.hasRealProviders ?? false,
    "hasRealProviders",
    AGGREGATE_HEALTH_READINESS_ERROR.FLAG_INVALID
  );
  if (!hasRealProviders.ok) return hasRealProviders;

  const hasLiveCredentialResolver = requireBoolean(
    input.hasLiveCredentialResolver ?? false,
    "hasLiveCredentialResolver",
    AGGREGATE_HEALTH_READINESS_ERROR.FLAG_INVALID
  );
  if (!hasLiveCredentialResolver.ok) return hasLiveCredentialResolver;

  const hasProductionWebhooks = requireBoolean(
    input.hasProductionWebhooks ?? false,
    "hasProductionWebhooks",
    AGGREGATE_HEALTH_READINESS_ERROR.FLAG_INVALID
  );
  if (!hasProductionWebhooks.ok) return hasProductionWebhooks;

  const connectorTotal = connectorReadiness.value.length;
  const adapterTotal = adapterReadiness.value.length;
  const webhookTotal = webhookRouteReadiness.value.length;

  let connectorReady = 0;
  let connectorDegraded = 0;
  let connectorBlocked = 0;
  for (const item of connectorReadiness.value) {
    const status = normalizeOperational(item.operationalStatus);
    if (status === OPERATIONAL_STATUS.READY) connectorReady += 1;
    else if (status === OPERATIONAL_STATUS.DEGRADED) connectorDegraded += 1;
    else connectorBlocked += 1;
  }

  let adapterReady = 0;
  let adapterDegraded = 0;
  let adapterBlocked = 0;
  for (const item of adapterReadiness.value) {
    const status = String(item.readinessStatus ?? item.operationalStatus ?? "");
    if (
      status === "OPERATIONALLY_READY" ||
      status === OPERATIONAL_STATUS.READY
    ) {
      adapterReady += 1;
    } else if (status === "DEGRADED" || status === OPERATIONAL_STATUS.DEGRADED) {
      adapterDegraded += 1;
    } else {
      adapterBlocked += 1;
    }
  }

  let webhookReady = 0;
  let webhookBlocked = 0;
  for (const item of webhookRouteReadiness.value) {
    const enabled = item.enabled === true;
    const lifecycle = String(item.lifecycleState ?? "");
    if (enabled && (lifecycle === "ENABLED" || lifecycle === "")) {
      webhookReady += 1;
    } else {
      webhookBlocked += 1;
    }
  }

  /** @type {string[]} */
  const blockedReasons = [];
  if (hasRealProviders.value) {
    blockedReasons.push("real_providers_present");
  }
  if (hasLiveCredentialResolver.value) {
    blockedReasons.push("live_credential_resolver_present");
  }
  if (hasProductionWebhooks.value) {
    blockedReasons.push("production_webhooks_present");
  }
  if (!productionBlocked.value) {
    blockedReasons.push("production_not_blocked");
  }

  /** @type {string} */
  let aggregateStatus = AGGREGATE_HEALTH_STATUS.READY;
  if (blockedReasons.length > 0 || !productionBlocked.value) {
    aggregateStatus = AGGREGATE_HEALTH_STATUS.PRODUCTION_BLOCKED;
  } else if (
    connectorBlocked > 0 ||
    adapterBlocked > 0 ||
    webhookBlocked > 0 ||
    (connectorTotal === 0 && adapterTotal === 0 && webhookTotal === 0)
  ) {
    // Empty inventories are structurally valid (foundation certified, no live
    // wiring). Prefer NOT_READY only when blockers exist among declared items.
    if (connectorBlocked > 0 || adapterBlocked > 0 || webhookBlocked > 0) {
      aggregateStatus = AGGREGATE_HEALTH_STATUS.NOT_READY;
    } else {
      aggregateStatus = AGGREGATE_HEALTH_STATUS.READY;
    }
  } else if (connectorDegraded > 0 || adapterDegraded > 0) {
    aggregateStatus = AGGREGATE_HEALTH_STATUS.DEGRADED;
  }

  return ok(
    deepFreeze({
      contractVersion: contractVersion.value,
      projectedAt: projectedAt.value,
      aggregateStatus,
      productionBlocked: productionBlocked.value,
      hasRealProviders: hasRealProviders.value,
      hasLiveCredentialResolver: hasLiveCredentialResolver.value,
      hasProductionWebhooks: hasProductionWebhooks.value,
      connectorSummary: Object.freeze({
        total: connectorTotal,
        ready: connectorReady,
        degraded: connectorDegraded,
        blocked: connectorBlocked,
      }),
      adapterSummary: Object.freeze({
        total: adapterTotal,
        ready: adapterReady,
        degraded: adapterDegraded,
        blocked: adapterBlocked,
      }),
      webhookSummary: Object.freeze({
        total: webhookTotal,
        ready: webhookReady,
        blocked: webhookBlocked,
      }),
      blockedReasons: Object.freeze(blockedReasons),
    })
  );
}
