/**
 * Read-only metric registry facade.
 * Discovery and lookup only — no register/write commands.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import {
  createAnalyticsMetricId,
  createAnalyticsMetricVersion,
} from "../contracts/identifiers.js";
import {
  clonePlain,
  deepFreeze,
  isNonEmptyString,
  isPlainObject,
} from "../contracts/shared.js";
import { isAnalyticsMetricLifecycleState } from "./lifecycle.js";
import {
  createAnalyticsMetricRegistryEntry,
  metricIdentityKey,
} from "./entry.js";
import { compareMetricDefinitions } from "./compatibility.js";

const WRITE_REJECT_MESSAGE =
  "ReadOnlyMetricRegistry does not expose write/command operations";

/**
 * @param {ReadonlyArray<import("./entry.js").AnalyticsMetricRegistryEntry>} entries
 * @returns {Readonly<{
 *   size: number,
 *   isEmpty: boolean,
 *   getMetric: Function,
 *   hasMetric: Function,
 *   listMetrics: Function,
 *   listByLifecycle: Function,
 *   listByTenantScopeKind: Function,
 *   listByOwnerModule: Function,
 *   compareVersions: Function,
 * }>}
 */
export function buildReadOnlyMetricRegistry(entries) {
  /** @type {Map<string, import("./entry.js").AnalyticsMetricRegistryEntry>} */
  const byIdentity = new Map();
  /** @type {import("./entry.js").AnalyticsMetricRegistryEntry[]} */
  const ordered = [];

  for (const entry of entries) {
    const key = metricIdentityKey(entry.metricId, entry.version);
    byIdentity.set(key, entry);
    ordered.push(entry);
  }

  /**
   * Exact lookup — metricId and version are both required.
   * @param {unknown} metricId
   * @param {unknown} version
   */
  function getMetric(metricId, version) {
    const idResult = createAnalyticsMetricId(metricId);
    if (!idResult.ok) return idResult;
    const versionResult = createAnalyticsMetricVersion(version);
    if (!versionResult.ok) return versionResult;

    const found = byIdentity.get(
      metricIdentityKey(idResult.value, versionResult.value)
    );
    if (!found) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.REGISTRY_NOT_FOUND,
          "Metric not found for exact ID/version",
          "lookup",
          { metricId: idResult.value, version: versionResult.value }
        )
      );
    }

    return ok(clonePlain(found));
  }

  /**
   * @param {unknown} metricId
   * @param {unknown} version
   */
  function hasMetric(metricId, version) {
    if (!isNonEmptyString(metricId) || !isNonEmptyString(version)) return false;
    return byIdentity.has(
      metricIdentityKey(String(metricId).trim(), String(version).trim())
    );
  }

  /**
   * @param {unknown} [filter]
   */
  function listMetrics(filter) {
    let result = ordered.slice();

    if (filter !== undefined) {
      if (!isPlainObject(filter)) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.REGISTRY_ENTRY_INVALID,
            "listMetrics filter must be a plain object",
            "filter"
          )
        );
      }

      if (filter.lifecycleState !== undefined) {
        if (!isAnalyticsMetricLifecycleState(filter.lifecycleState)) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.REGISTRY_LIFECYCLE_INVALID,
              `Unsupported lifecycle filter: ${filter.lifecycleState}`,
              "filter.lifecycleState"
            )
          );
        }
        result = result.filter((e) => e.lifecycleState === filter.lifecycleState);
      }

      if (filter.tenantScopeKind !== undefined) {
        if (!isNonEmptyString(filter.tenantScopeKind)) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.REGISTRY_ENTRY_INVALID,
              "tenantScopeKind filter must be a non-empty string",
              "filter.tenantScopeKind"
            )
          );
        }
        const kind = String(filter.tenantScopeKind).trim();
        result = result.filter((e) =>
          e.definition.supportedTenantScopeKinds.includes(kind)
        );
      }

      if (filter.ownerModule !== undefined) {
        if (!isNonEmptyString(filter.ownerModule)) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.REGISTRY_ENTRY_INVALID,
              "ownerModule filter must be a non-empty string",
              "filter.ownerModule"
            )
          );
        }
        const owner = String(filter.ownerModule).trim();
        result = result.filter((e) => e.definition.source.ownerModule === owner);
      }

      if (filter.sourceId !== undefined) {
        if (!isNonEmptyString(filter.sourceId)) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.REGISTRY_ENTRY_INVALID,
              "sourceId filter must be a non-empty string",
              "filter.sourceId"
            )
          );
        }
        const sourceId = String(filter.sourceId).trim();
        result = result.filter((e) => e.definition.source.sourceId === sourceId);
      }

      if (filter.metricId !== undefined) {
        if (!isNonEmptyString(filter.metricId)) {
          return fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.REGISTRY_ENTRY_INVALID,
              "metricId filter must be a non-empty string",
              "filter.metricId"
            )
          );
        }
        const metricId = String(filter.metricId).trim();
        result = result.filter((e) => e.metricId === metricId);
      }
    }

    return ok(deepFreeze(result.map((e) => clonePlain(e))));
  }

  /**
   * @param {unknown} lifecycleState
   */
  function listByLifecycle(lifecycleState) {
    return listMetrics({ lifecycleState });
  }

  /**
   * @param {unknown} tenantScopeKind
   */
  function listByTenantScopeKind(tenantScopeKind) {
    return listMetrics({ tenantScopeKind });
  }

  /**
   * @param {unknown} ownerModule
   */
  function listByOwnerModule(ownerModule) {
    return listMetrics({ ownerModule });
  }

  /**
   * Compare two registered versions of the same metric by exact ID/version lookup.
   * @param {unknown} metricId
   * @param {unknown} beforeVersion
   * @param {unknown} afterVersion
   */
  function compareVersions(metricId, beforeVersion, afterVersion) {
    const before = getMetric(metricId, beforeVersion);
    if (!before.ok) return before;
    const after = getMetric(metricId, afterVersion);
    if (!after.ok) return after;
    return compareMetricDefinitions(
      before.value.definition,
      after.value.definition
    );
  }

  /** @type {Record<string, unknown>} */
  const facade = {
    get size() {
      return ordered.length;
    },
    get isEmpty() {
      return ordered.length === 0;
    },
    getMetric,
    hasMetric,
    listMetrics,
    listByLifecycle,
    listByTenantScopeKind,
    listByOwnerModule,
    compareVersions,
  };

  for (const writeName of [
    "register",
    "write",
    "command",
    "mutate",
    "insert",
    "update",
    "upsert",
    "delete",
    "save",
  ]) {
    Object.defineProperty(facade, writeName, {
      enumerable: false,
      configurable: false,
      get() {
        return () =>
          fail(
            analyticsError(
              ANALYTICS_ERROR_CODE.FACADE_WRITE_REJECTED,
              WRITE_REJECT_MESSAGE,
              writeName
            )
          );
      },
    });
  }

  return Object.freeze(facade);
}

/**
 * Create a read-only registry from validated registry entries or registration requests.
 * Fail-closed: any invalid or duplicate ID/version rejects the whole create.
 *
 * @param {unknown} [input]
 * @returns {import("../contracts/result.js").Result}
 */
export function createReadOnlyMetricRegistry(input = {}) {
  if (!isPlainObject(input) && !Array.isArray(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.REGISTRY_ENTRY_INVALID,
        "createReadOnlyMetricRegistry input must be a plain object or array",
        "input"
      )
    );
  }

  const rawEntries = Array.isArray(input)
    ? input
    : Array.isArray(/** @type {Record<string, unknown>} */ (input).entries)
      ? /** @type {unknown[]} */ (
          /** @type {Record<string, unknown>} */ (input).entries
        )
      : [];

  /** @type {import("./entry.js").AnalyticsMetricRegistryEntry[]} */
  const entries = [];
  /** @type {Set<string>} */
  const seen = new Set();

  for (const raw of rawEntries) {
    const created = createAnalyticsMetricRegistryEntry(raw);
    if (!created.ok) return created;
    const key = metricIdentityKey(created.value.metricId, created.value.version);
    if (seen.has(key)) {
      return fail(
        analyticsError(
          ANALYTICS_ERROR_CODE.REGISTRY_CONFLICT,
          "Duplicate metric ID/version in read-only registry input",
          "entries",
          { metricId: created.value.metricId, version: created.value.version }
        )
      );
    }
    seen.add(key);
    entries.push(created.value);
  }

  return ok(buildReadOnlyMetricRegistry(entries));
}
