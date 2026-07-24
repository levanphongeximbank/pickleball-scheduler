/**
 * Deterministic observation filtering, grouping, and ordering helpers.
 */

import { ANALYTICS_FILTER_OPERATOR } from "../contracts/queryParts.js";
import { isFiniteNumber } from "../contracts/shared.js";

/**
 * @param {import("./observation.js").AnalyticsObservation} observation
 * @param {import("../contracts/queryParts.js").AnalyticsFilter} filter
 * @returns {boolean}
 */
export function observationMatchesFilter(observation, filter) {
  const fieldValue =
    filter.field === "value"
      ? observation.value
      : observation.dimensions[filter.field];

  switch (filter.operator) {
    case ANALYTICS_FILTER_OPERATOR.EQ:
      return fieldValue === filter.value;
    case ANALYTICS_FILTER_OPERATOR.NEQ:
      return fieldValue !== filter.value;
    case ANALYTICS_FILTER_OPERATOR.IN:
      return Array.isArray(filter.value) && filter.value.includes(fieldValue);
    case ANALYTICS_FILTER_OPERATOR.NOT_IN:
      return Array.isArray(filter.value) && !filter.value.includes(fieldValue);
    case ANALYTICS_FILTER_OPERATOR.GT:
      return isFiniteNumber(fieldValue) && isFiniteNumber(filter.value) && fieldValue > filter.value;
    case ANALYTICS_FILTER_OPERATOR.GTE:
      return isFiniteNumber(fieldValue) && isFiniteNumber(filter.value) && fieldValue >= filter.value;
    case ANALYTICS_FILTER_OPERATOR.LT:
      return isFiniteNumber(fieldValue) && isFiniteNumber(filter.value) && fieldValue < filter.value;
    case ANALYTICS_FILTER_OPERATOR.LTE:
      return isFiniteNumber(fieldValue) && isFiniteNumber(filter.value) && fieldValue <= filter.value;
    case ANALYTICS_FILTER_OPERATOR.IS_NULL:
      return fieldValue === null || fieldValue === undefined || fieldValue === "";
    case ANALYTICS_FILTER_OPERATOR.IS_NOT_NULL:
      return !(fieldValue === null || fieldValue === undefined || fieldValue === "");
    default:
      return false;
  }
}

/**
 * @param {ReadonlyArray<import("./observation.js").AnalyticsObservation>} observations
 * @param {ReadonlyArray<import("../contracts/queryParts.js").AnalyticsFilter>} filters
 */
export function applyObservationFilters(observations, filters) {
  if (!filters || filters.length === 0) return [...observations];
  return observations.filter((obs) =>
    filters.every((filter) => observationMatchesFilter(obs, filter))
  );
}

/**
 * Inclusive/exclusive time-window filter on observedAt.
 * @param {ReadonlyArray<import("./observation.js").AnalyticsObservation>} observations
 * @param {import("../contracts/timeWindow.js").AnalyticsTimeWindow} timeWindow
 */
export function applyTimeWindowFilter(observations, timeWindow) {
  const startMs = Date.parse(timeWindow.startAt);
  const endMs = Date.parse(timeWindow.endAt);
  const inclusive = timeWindow.inclusive !== false;

  return observations.filter((obs) => {
    const t = Date.parse(obs.observedAt);
    if (!Number.isFinite(t)) return false;
    if (inclusive) return t >= startMs && t <= endMs;
    return t > startMs && t < endMs;
  });
}

/**
 * Tenant guard — keep observations matching query tenant scope only.
 * @param {ReadonlyArray<import("./observation.js").AnalyticsObservation>} observations
 * @param {import("../contracts/tenantScope.js").AnalyticsTenantScope} tenantScope
 */
export function applyTenantGuard(observations, tenantScope) {
  return observations.filter((obs) => {
    if (obs.tenantScope.kind !== tenantScope.kind) return false;
    if (tenantScope.tenantId && obs.tenantScope.tenantId !== tenantScope.tenantId) {
      return false;
    }
    if (tenantScope.venueId && obs.tenantScope.venueId !== tenantScope.venueId) {
      return false;
    }
    if (tenantScope.clubId && obs.tenantScope.clubId !== tenantScope.clubId) {
      return false;
    }
    return true;
  });
}

/**
 * Stable group key from explicit dimensions. Missing dims use sentinel `__missing__`.
 * @param {import("./observation.js").AnalyticsObservation} observation
 * @param {ReadonlyArray<import("../contracts/queryParts.js").AnalyticsDimension>} dimensions
 */
export function buildGroupKey(observation, dimensions) {
  /** @type {Record<string, string>} */
  const parts = {};
  for (const dim of dimensions) {
    const raw = observation.dimensions[dim.key];
    parts[dim.key] =
      raw === undefined || raw === null || raw === "" ? "__missing__" : String(raw);
  }
  const orderedKeys = Object.keys(parts).sort();
  return orderedKeys.map((k) => `${k}=${parts[k]}`).join("|");
}

/**
 * @param {ReadonlyArray<import("./observation.js").AnalyticsObservation>} observations
 * @param {import("../contracts/queryParts.js").AnalyticsGrouping | undefined} grouping
 * @returns {Array<{ key: string, dimensions: Record<string, string>, observations: import("./observation.js").AnalyticsObservation[] }>}
 */
export function groupObservations(observations, grouping) {
  if (!grouping || grouping.dimensions.length === 0) {
    return [
      {
        key: "all",
        dimensions: {},
        observations: [...observations],
      },
    ];
  }

  /** @type {Map<string, { key: string, dimensions: Record<string, string>, observations: import("./observation.js").AnalyticsObservation[] }>} */
  const groups = new Map();

  for (const obs of observations) {
    const key = buildGroupKey(obs, grouping.dimensions);
    /** @type {Record<string, string>} */
    const dims = {};
    for (const dim of grouping.dimensions) {
      const raw = obs.dimensions[dim.key];
      dims[dim.key] =
        raw === undefined || raw === null || raw === "" ? "__missing__" : String(raw);
    }
    const existing = groups.get(key);
    if (existing) {
      existing.observations.push(obs);
    } else {
      groups.set(key, { key, dimensions: dims, observations: [obs] });
    }
  }

  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([, group]) => group);
}

/**
 * Deterministic ordering with stable tie-break on key.
 * @param {Array<{ key: string, value: number | null, dimensions?: Record<string, string> }>} points
 * @param {ReadonlyArray<import("../contracts/queryParts.js").AnalyticsOrdering> | undefined} ordering
 */
export function orderDataPoints(points, ordering) {
  const copy = [...points];
  const orders = ordering && ordering.length > 0 ? ordering : [{ field: "key", direction: "asc" }];

  copy.sort((a, b) => {
    for (const order of orders) {
      let av;
      let bv;
      if (order.field === "value") {
        av = a.value;
        bv = b.value;
      } else if (order.field === "key") {
        av = a.key;
        bv = b.key;
      } else {
        av = a.dimensions?.[order.field];
        bv = b.dimensions?.[order.field];
      }

      let cmp;
      if (av === bv) cmp = 0;
      else if (av === null || av === undefined) cmp = 1;
      else if (bv === null || bv === undefined) cmp = -1;
      else if (typeof av === "number" && typeof bv === "number") cmp = av < bv ? -1 : 1;
      else cmp = String(av) < String(bv) ? -1 : 1;

      if (cmp !== 0) {
        return order.direction === "desc" ? -cmp : cmp;
      }
    }
    // Deterministic tie-break
    if (a.key === b.key) return 0;
    return a.key < b.key ? -1 : 1;
  });

  return copy;
}
