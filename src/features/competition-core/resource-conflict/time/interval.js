/**
 * CORE-14 — half-open interval primitives.
 * No ISO parsing, timezone parsing, slot resolution, or implicit duration.
 */

/**
 * @param {unknown} value
 * @returns {value is number}
 */
export function isSafeEpochMs(value) {
  return typeof value === "number" && Number.isSafeInteger(value);
}

/**
 * Validate half-open interval [startMs, endMs).
 * @param {unknown} startMs
 * @param {unknown} endMs
 * @returns {{ ok: true, startMs: number, endMs: number } | { ok: false, reason: "TIME_WINDOW_MISSING" | "INVALID_TIME_INTERVAL" }}
 */
export function validateHalfOpenInterval(startMs, endMs) {
  if (startMs == null || endMs == null) {
    return { ok: false, reason: "TIME_WINDOW_MISSING" };
  }
  if (!isSafeEpochMs(startMs) || !isSafeEpochMs(endMs)) {
    return { ok: false, reason: "INVALID_TIME_INTERVAL" };
  }
  if (/** @type {number} */ (startMs) >= /** @type {number} */ (endMs)) {
    return { ok: false, reason: "INVALID_TIME_INTERVAL" };
  }
  return {
    ok: true,
    startMs: /** @type {number} */ (startMs),
    endMs: /** @type {number} */ (endMs),
  };
}

/**
 * Overlap: startA < endB && startB < endA. Adjacent (endA === startB) → false.
 * @param {number} startA
 * @param {number} endA
 * @param {number} startB
 * @param {number} endB
 * @returns {boolean}
 */
export function intervalsOverlap(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

/**
 * Intersection of half-open intervals, or null if no overlap.
 * @param {number} startA
 * @param {number} endA
 * @param {number} startB
 * @param {number} endB
 * @returns {{ startMs: number, endMs: number } | null}
 */
export function intervalIntersection(startA, endA, startB, endB) {
  if (!intervalsOverlap(startA, endA, startB, endB)) return null;
  const startMs = startA > startB ? startA : startB;
  const endMs = endA < endB ? endA : endB;
  if (startMs >= endMs) return null;
  return { startMs, endMs };
}

/**
 * Compare intervals by (startMs, endMs). Equal intervals → 0.
 * @param {{ startMs: number, endMs: number }} a
 * @param {{ startMs: number, endMs: number }} b
 * @returns {number}
 */
export function compareIntervals(a, b) {
  if (a.startMs < b.startMs) return -1;
  if (a.startMs > b.startMs) return 1;
  if (a.endMs < b.endMs) return -1;
  if (a.endMs > b.endMs) return 1;
  return 0;
}
