/**
 * Venue & Court — Competition court availability adapter (Phase 1F).
 *
 * Thin read-only boundary for Competition / tournament scheduling consumers.
 * Delegates all availability evaluation to getCourtAvailability (Phase 1E).
 * Does not assign courts, persist results, or import Competition/Court Engine.
 */

import { getCourtAvailability as getCourtAvailabilityDefault } from "../services/courtAvailabilityService.js";

const defaultDeps = Object.freeze({
  getCourtAvailability: getCourtAvailabilityDefault,
});

let deps = { ...defaultDeps };

/** @internal Test-only dependency override. */
export function __setCompetitionCourtAvailabilityAdapterDepsForTests(nextDeps = {}) {
  deps = { ...defaultDeps, ...nextDeps };
}

/** @internal Test-only dependency reset. */
export function __resetCompetitionCourtAvailabilityAdapterDepsForTests() {
  deps = { ...defaultDeps };
}

function copyConflict(conflict) {
  return conflict ? { ...conflict } : conflict;
}

function toUnavailableCourt(row) {
  return {
    courtId: row.courtId,
    available: false,
    reasons: Array.isArray(row.reasons) ? [...row.reasons] : [],
    conflicts: Array.isArray(row.conflicts)
      ? row.conflicts.map(copyConflict)
      : [],
  };
}

/**
 * Competition-facing availability query.
 *
 * Input (venue-local civil time; no timezone conversion):
 * {
 *   clubId,                 // required — no first-club fallback
 *   venueId?,               // optional; validated by canonical service
 *   date,                   // YYYY-MM-DD
 *   startTime, endTime,     // HH:mm, end > start same day
 *   courtIds?,              // optional id list
 *   clusterId?,             // optional
 *   includeUnavailable?,    // default true — when false, unavailableCourts is []
 *   context?                // forwarded (e.g. excludeBookingId)
 * }
 *
 * Output:
 * {
 *   clubId,
 *   venueId,
 *   date,
 *   startTime,
 *   endTime,
 *   availableCourtIds,      // deterministic; follows canonical courts order
 *   unavailableCourts       // { courtId, available:false, reasons, conflicts }[]
 * }
 *
 * Ordering: availableCourtIds and unavailableCourts preserve the order of
 * courts returned by getCourtAvailability (inventory order, or courtIds order
 * when courtIds is supplied). No shuffle / random / Set-dependent sort.
 */
export function getCompetitionCourtAvailability(options = {}) {
  const includeUnavailable = options.includeUnavailable !== false;

  const canonical = deps.getCourtAvailability({
    clubId: options.clubId,
    venueId: options.venueId,
    date: options.date,
    startTime: options.startTime,
    endTime: options.endTime,
    courtIds: options.courtIds,
    clusterId: options.clusterId,
    context: options.context,
    // Always request full reasoned rows so available IDs stay accurate and
    // unavailable reasons remain available for the adapter contract.
    includeUnavailable: true,
  });

  const availableCourtIds = [];
  const unavailableCourts = [];

  for (const row of canonical.courts || []) {
    if (row.available) {
      availableCourtIds.push(String(row.courtId));
    } else if (includeUnavailable) {
      unavailableCourts.push(toUnavailableCourt(row));
    }
  }

  return {
    clubId: canonical.clubId,
    venueId: canonical.venueId ?? null,
    date: canonical.checkedRange.date,
    startTime: canonical.checkedRange.startTime,
    endTime: canonical.checkedRange.endTime,
    availableCourtIds,
    unavailableCourts,
  };
}
