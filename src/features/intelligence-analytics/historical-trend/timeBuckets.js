/**
 * Deterministic UTC time bucketing for historical series (I&A-05).
 * Inclusive/exclusive follows AnalyticsTimeWindow.inclusive (default true).
 * Does not depend on locale display formatting.
 */

import { fail, ok } from "../contracts/result.js";
import { analyticsError, ANALYTICS_ERROR_CODE } from "../contracts/errors.js";
import { ANALYTICS_GRANULARITY } from "../contracts/enums.js";
import {
  deepFreeze,
  isFiniteNumber,
  isNonEmptyString,
  isPlainObject,
  isValidIsoTimestamp,
} from "../contracts/shared.js";
import { createAnalyticsGranularity } from "../contracts/timeWindow.js";

const BUCKETABLE = new Set([
  ANALYTICS_GRANULARITY.HOUR,
  ANALYTICS_GRANULARITY.DAY,
  ANALYTICS_GRANULARITY.WEEK,
  ANALYTICS_GRANULARITY.MONTH,
]);

/**
 * @param {Date} date
 */
function toIsoUtc(date) {
  return new Date(date.getTime()).toISOString();
}

/**
 * Monday-start ISO week bucket (UTC).
 * @param {Date} date
 */
function startOfUtcWeek(date) {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );
  const day = d.getUTCDay(); // 0=Sun .. 6=Sat
  const offset = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + offset);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/**
 * @param {Date} date
 * @param {string} granularity
 */
export function bucketStartUtc(date, granularity) {
  if (granularity === ANALYTICS_GRANULARITY.HOUR) {
    return new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
        date.getUTCHours(),
        0,
        0,
        0
      )
    );
  }
  if (granularity === ANALYTICS_GRANULARITY.DAY) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
    );
  }
  if (granularity === ANALYTICS_GRANULARITY.WEEK) {
    return startOfUtcWeek(date);
  }
  if (granularity === ANALYTICS_GRANULARITY.MONTH) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }
  return null;
}

/**
 * @param {Date} start
 * @param {string} granularity
 */
export function nextBucketStartUtc(start, granularity) {
  const d = new Date(start.getTime());
  if (granularity === ANALYTICS_GRANULARITY.HOUR) {
    d.setUTCHours(d.getUTCHours() + 1);
    return d;
  }
  if (granularity === ANALYTICS_GRANULARITY.DAY) {
    d.setUTCDate(d.getUTCDate() + 1);
    return d;
  }
  if (granularity === ANALYTICS_GRANULARITY.WEEK) {
    d.setUTCDate(d.getUTCDate() + 7);
    return d;
  }
  if (granularity === ANALYTICS_GRANULARITY.MONTH) {
    d.setUTCMonth(d.getUTCMonth() + 1);
    return d;
  }
  return null;
}

/**
 * @param {unknown} input
 * @returns {import("../contracts/result.js").Result}
 */
export function createAnalyticsTimeBucket(input) {
  if (!isPlainObject(input)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_BUCKET_INVALID,
        "AnalyticsTimeBucket must be a plain object",
        "timeBucket"
      )
    );
  }

  const granularityResult = createAnalyticsGranularity(input.granularity);
  if (!granularityResult.ok) return granularityResult;
  if (!BUCKETABLE.has(granularityResult.value)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_BUCKET_INVALID,
        `Historical bucketing does not support granularity: ${granularityResult.value}`,
        "timeBucket.granularity"
      )
    );
  }

  if (!isValidIsoTimestamp(input.startAt) || !isValidIsoTimestamp(input.endAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_BUCKET_INVALID,
        "AnalyticsTimeBucket startAt/endAt must be ISO timestamps",
        "timeBucket"
      )
    );
  }

  const startMs = Date.parse(String(input.startAt));
  const endMs = Date.parse(String(input.endAt));
  if (!(endMs > startMs)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_BUCKET_INVALID,
        "AnalyticsTimeBucket.endAt must be > startAt (end exclusive)",
        "timeBucket.endAt"
      )
    );
  }

  return ok(
    deepFreeze({
      key: isNonEmptyString(input.key)
        ? String(input.key).trim()
        : String(input.startAt).trim(),
      granularity: granularityResult.value,
      startAt: String(input.startAt).trim(),
      endAt: String(input.endAt).trim(),
      inclusiveStart: true,
      exclusiveEnd: true,
      timezone: isNonEmptyString(input.timezone)
        ? String(input.timezone).trim()
        : "UTC",
    })
  );
}

/**
 * Enumerate expected bucket boundaries for a requested window (UTC).
 * Start inclusive; end exclusive unless window.inclusive and end falls inside last bucket.
 *
 * @param {{ startAt: string, endAt: string, inclusive?: boolean }} timeWindow
 * @param {string} granularity
 * @param {number} [maxBuckets]
 * @returns {import("../contracts/result.js").Result}
 */
export function enumerateBucketBoundaries(timeWindow, granularity, maxBuckets = 10000) {
  if (!BUCKETABLE.has(granularity)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_BUCKET_INVALID,
        `Unsupported historical granularity: ${granularity}`,
        "granularity"
      )
    );
  }
  if (!isValidIsoTimestamp(timeWindow?.startAt) || !isValidIsoTimestamp(timeWindow?.endAt)) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TIME_WINDOW_INVALID,
        "enumerateBucketBoundaries requires a valid time window",
        "timeWindow"
      )
    );
  }

  const inclusive = timeWindow.inclusive !== false;
  const windowStart = new Date(String(timeWindow.startAt));
  const windowEnd = new Date(String(timeWindow.endAt));
  if (!(windowEnd.getTime() >= windowStart.getTime())) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.TIME_WINDOW_INVALID,
        "timeWindow.endAt must be >= startAt",
        "timeWindow.endAt"
      )
    );
  }

  let cursor = bucketStartUtc(windowStart, granularity);
  if (!cursor) {
    return fail(
      analyticsError(
        ANALYTICS_ERROR_CODE.HISTORICAL_BUCKET_INVALID,
        "Failed to compute bucket start",
        "granularity"
      )
    );
  }

  // If window starts after bucket start, still include that bucket when any
  // observation in [start,end] can land in it — expected buckets cover full span.
  /** @type {ReturnType<typeof createAnalyticsTimeBucket> extends {ok:true,value:infer V} ? V[] : never} */
  const buckets = [];

  while (cursor.getTime() <= windowEnd.getTime()) {
    const next = nextBucketStartUtc(cursor, granularity);
    if (!next) break;

    const bucketStartMs = cursor.getTime();
    const bucketEndMs = next.getTime();

    // Keep buckets that overlap the requested window.
    const overlaps =
      bucketStartMs < (inclusive ? windowEnd.getTime() + 1 : windowEnd.getTime()) &&
      bucketEndMs > windowStart.getTime();

    if (overlaps) {
      if (buckets.length >= maxBuckets) {
        return fail(
          analyticsError(
            ANALYTICS_ERROR_CODE.RESULT_LIMIT_EXCEEDED,
            "Historical bucket count exceeds bounded period limit",
            "maxBucketCount",
            { maxBuckets, attempted: buckets.length + 1 }
          )
        );
      }
      const created = createAnalyticsTimeBucket({
        key: toIsoUtc(cursor),
        granularity,
        startAt: toIsoUtc(cursor),
        endAt: toIsoUtc(next),
        timezone: "UTC",
      });
      if (!created.ok) return created;
      buckets.push(created.value);
    }

    if (bucketStartMs > windowEnd.getTime()) break;
    cursor = next;
    // Safety: empty advance
    if (next.getTime() === bucketStartMs) break;
  }

  return ok(Object.freeze(buckets));
}

/**
 * @param {string} observedAt
 * @param {{ startAt: string, endAt: string, inclusive?: boolean }} timeWindow
 */
export function isTimestampInWindow(observedAt, timeWindow) {
  if (!isValidIsoTimestamp(observedAt)) return false;
  const ts = Date.parse(observedAt);
  const start = Date.parse(timeWindow.startAt);
  const end = Date.parse(timeWindow.endAt);
  if (ts < start) return false;
  if (timeWindow.inclusive === false) return ts < end;
  return ts <= end;
}

/**
 * Aggregate numeric values for a single bucket.
 * @param {Array<number | null>} values
 * @param {string} aggregationKind
 */
export function aggregateBucketValues(values, aggregationKind) {
  const numeric = values.filter((v) => isFiniteNumber(v));
  if (numeric.length === 0) return null;
  if (aggregationKind === "count") return numeric.length;
  if (aggregationKind === "sum") {
    return numeric.reduce((acc, v) => acc + /** @type {number} */ (v), 0);
  }
  if (aggregationKind === "average") {
    const sum = numeric.reduce((acc, v) => acc + /** @type {number} */ (v), 0);
    return sum / numeric.length;
  }
  if (aggregationKind === "rate") {
    // Rate without explicit denominator collapses to average of ratios.
    const sum = numeric.reduce((acc, v) => acc + /** @type {number} */ (v), 0);
    return sum / numeric.length;
  }
  return null;
}
