/**
 * CORE-12 — in-request court overlap detection (HALF_OPEN).
 * Not a generic CORE-14 Resource Conflict Resolver.
 */

import { intervalsOverlapHalfOpen } from "../deterministic/intervals.js";

/**
 * @typedef {{ matchId: string, courtId: string, startMs: number, endMs: number }} Occupancy
 */

/**
 * Find pairwise overlaps on the same court within one assignment request.
 * @param {readonly Occupancy[]} occupancies
 * @returns {Array<{ matchIdA: string, matchIdB: string, courtId: string }>}
 */
export function detectCourtOverlaps(occupancies) {
  const list = Array.isArray(occupancies) ? occupancies.slice() : [];
  /** @type {Array<{ matchIdA: string, matchIdB: string, courtId: string }>} */
  const overlaps = [];
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      if (a.courtId !== b.courtId) continue;
      if (
        intervalsOverlapHalfOpen(a.startMs, a.endMs, b.startMs, b.endMs)
      ) {
        overlaps.push({
          matchIdA: a.matchId,
          matchIdB: b.matchId,
          courtId: a.courtId,
        });
      }
    }
  }
  return overlaps;
}

/**
 * @param {readonly Occupancy[]} existing
 * @param {Occupancy} candidate
 * @returns {boolean}
 */
export function occupancyConflictsWith(existing, candidate) {
  for (const occ of existing) {
    if (occ.courtId !== candidate.courtId) continue;
    if (
      intervalsOverlapHalfOpen(
        occ.startMs,
        occ.endMs,
        candidate.startMs,
        candidate.endMs
      )
    ) {
      return true;
    }
  }
  return false;
}
