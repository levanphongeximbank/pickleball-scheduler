/**
 * Deterministic immutable metric registry factory (I&A-02).
 * Built from explicit registration requests — no database, no singleton.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { deepFreeze, isPlainObject } from "../contracts/shared.js";
import {
  classifyRegistrationAgainstExisting,
  createAnalyticsMetricRegistryEntry,
  metricIdentityKey,
} from "./entry.js";
import { buildReadOnlyMetricRegistry } from "./createReadOnlyMetricRegistry.js";

export const ANALYTICS_METRIC_REGISTRATION_STATUS = Object.freeze({
  REGISTERED: "registered",
  IDEMPOTENT: "idempotent",
});

/**
 * @typedef {{
 *   definition?: unknown,
 *   lifecycleState?: string,
 *   displayName?: string,
 *   deprecation?: unknown,
 *   registeredAt?: string,
 *   [key: string]: unknown,
 * }} AnalyticsMetricRegistrationRequest
 *
 * @typedef {{
 *   status: string,
 *   entry: import("./entry.js").AnalyticsMetricRegistryEntry,
 * }} AnalyticsMetricRegistrationSuccess
 */

/**
 * Create a metric registry from explicit initial registration requests.
 *
 * Behavior:
 * - deterministic insertion order
 * - per-request typed registration results
 * - same ID/version + same definition/governance → idempotent success
 * - same ID/version + different definition/governance → conflict (typed fail)
 * - invalid definition → typed fail (not inserted)
 * - no global singleton; caller owns the instance
 * - returned registry is read-only (no register/write)
 *
 * Top-level create fails only when input shape is invalid. Entry-level
 * failures are reported in `registrations` and omitted from the registry
 * (fail closed for those entries).
 *
 * @param {unknown} [input]
 * @returns {import("../contracts/result.js").Result}
 */
export function createMetricRegistry(input = {}) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.REGISTRY_ENTRY_INVALID,
        "createMetricRegistry input must be a plain object",
        "input"
      )
    );
  }

  const requests = Array.isArray(input.entries) ? input.entries : [];

  /** @type {Map<string, import("./entry.js").AnalyticsMetricRegistryEntry>} */
  const byIdentity = new Map();
  /** @type {import("./entry.js").AnalyticsMetricRegistryEntry[]} */
  const ordered = [];
  /** @type {import("../contracts/result.js").Result[]} */
  const registrations = [];

  for (const request of requests) {
    const entryResult = createAnalyticsMetricRegistryEntry(request);
    if (!entryResult.ok) {
      registrations.push(entryResult);
      continue;
    }

    const incoming = entryResult.value;
    const key = metricIdentityKey(incoming.metricId, incoming.version);
    const existing = byIdentity.get(key);

    if (!existing) {
      byIdentity.set(key, incoming);
      ordered.push(incoming);
      registrations.push(
        ok(
          deepFreeze({
            status: ANALYTICS_METRIC_REGISTRATION_STATUS.REGISTERED,
            entry: incoming,
          })
        )
      );
      continue;
    }

    const classified = classifyRegistrationAgainstExisting(existing, incoming);
    registrations.push(classified);
    // Idempotent: keep existing. Conflict: keep existing, do not replace.
  }

  const registry = buildReadOnlyMetricRegistry(ordered);

  return ok(
    deepFreeze({
      registry,
      registrations: Object.freeze([...registrations]),
      size: ordered.length,
    })
  );
}
