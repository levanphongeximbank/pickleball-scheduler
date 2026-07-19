/**
 * Phase 2F — Venue & Court multi-venue / multi-club scope helpers.
 *
 * Fail-closed ownership checks. clusterId is never treated as ownership.
 */

import { loadClubs } from "../../../data/club.js";
import { loadCourtsForClub } from "../../../domain/clubStorage.js";

export const VENUE_COURT_SCOPE_ERROR = Object.freeze({
  CLUB_SCOPE_MISSING: "CLUB_SCOPE_MISSING",
  VENUE_MISMATCH: "VENUE_MISMATCH",
  COURT_OUT_OF_SCOPE: "COURT_OUT_OF_SCOPE",
  DATA_UNAVAILABLE: "DATA_UNAVAILABLE",
});

const defaultDeps = Object.freeze({
  loadClubs,
  loadCourtsForClub,
});

let deps = { ...defaultDeps };

/** @internal Test-only dependency override. */
export function __setVenueCourtScopeDepsForTests(nextDeps = {}) {
  deps = { ...defaultDeps, ...nextDeps };
}

/** @internal Test-only dependency reset. */
export function __resetVenueCourtScopeDepsForTests() {
  deps = { ...defaultDeps };
}

function normalizeId(value) {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Require an explicit clubId. Never invent a club from venue/tenant/list[0].
 *
 * @param {{ clubId?: string|null, venueId?: string|null, tenantId?: string|null }} options
 * @returns {{ ok: true, clubId: string, venueId: string|null, club: object } | { ok: false, error: string, code: string }}
 */
export function assertClubVenueScope(options = {}) {
  const clubId = normalizeId(options.clubId);
  const venueId =
    normalizeId(options.venueId) || normalizeId(options.tenantId) || null;

  if (!clubId) {
    return {
      ok: false,
      error: "clubId is required — no first-club fallback.",
      code: VENUE_COURT_SCOPE_ERROR.CLUB_SCOPE_MISSING,
    };
  }

  let clubs;
  try {
    clubs = deps.loadClubs();
  } catch {
    return {
      ok: false,
      error: "Unable to load clubs for scope check.",
      code: VENUE_COURT_SCOPE_ERROR.DATA_UNAVAILABLE,
    };
  }

  const club = (Array.isArray(clubs) ? clubs : []).find(
    (item) => String(item?.id) === clubId
  );
  if (!club) {
    return {
      ok: false,
      error: "Club not found for scope check.",
      code: VENUE_COURT_SCOPE_ERROR.CLUB_SCOPE_MISSING,
    };
  }

  if (venueId && club.venueId && String(club.venueId) !== venueId) {
    return {
      ok: false,
      error: "Club does not belong to the selected venue.",
      code: VENUE_COURT_SCOPE_ERROR.VENUE_MISMATCH,
    };
  }

  return {
    ok: true,
    clubId,
    venueId: venueId || club.venueId || null,
    club,
  };
}

/**
 * Assert a court id belongs to the club inventory (ownership boundary).
 * clusterId is ignored for ownership — callers may still filter by cluster separately.
 *
 * @param {{ clubId?: string|null, courtId?: string|null, venueId?: string|null, tenantId?: string|null, clusterId?: string|null }} options
 */
export function assertCourtOwnedByClub(options = {}) {
  const scope = assertClubVenueScope(options);
  if (!scope.ok) {
    return scope;
  }

  const courtId = normalizeId(options.courtId);
  if (!courtId) {
    return {
      ok: false,
      error: "courtId is required for ownership check.",
      code: VENUE_COURT_SCOPE_ERROR.COURT_OUT_OF_SCOPE,
    };
  }

  // Explicit: clusterId never grants ownership across clubs.
  void options.clusterId;

  let courts;
  try {
    courts = deps.loadCourtsForClub(scope.clubId);
  } catch {
    return {
      ok: false,
      error: "Unable to load club court inventory.",
      code: VENUE_COURT_SCOPE_ERROR.DATA_UNAVAILABLE,
    };
  }

  const found = (Array.isArray(courts) ? courts : []).some(
    (court) => String(court?.id) === courtId
  );
  if (!found) {
    return {
      ok: false,
      error: "Court is outside the active club inventory.",
      code: VENUE_COURT_SCOPE_ERROR.COURT_OUT_OF_SCOPE,
    };
  }

  return {
    ok: true,
    clubId: scope.clubId,
    venueId: scope.venueId,
    courtId,
  };
}

/**
 * Keep only courts that belong to clubId (by court.clubId stamp or inventory membership).
 * Does not elevate ownership via clusterId.
 *
 * @param {Array} courts
 * @param {string} clubId
 * @param {{ inventoryCourtIds?: Set<string>|string[] }} [options]
 */
export function filterCourtsToClubScope(courts = [], clubId, options = {}) {
  const normalizedClubId = normalizeId(clubId);
  if (!normalizedClubId) {
    return [];
  }

  const inventory = options.inventoryCourtIds
    ? new Set(
        [...options.inventoryCourtIds].map((id) => String(id)).filter(Boolean)
      )
    : null;

  return (Array.isArray(courts) ? courts : []).filter((court) => {
    const id = court?.id != null ? String(court.id) : null;
    if (!id) {
      return false;
    }
    if (court?.clubId != null && String(court.clubId) !== normalizedClubId) {
      return false;
    }
    if (inventory && !inventory.has(id)) {
      return false;
    }
    return true;
  });
}

/**
 * Optional cluster filter only — empty/missing clusterId passes all.
 * Courts without clusterId pass when a cluster filter is set (filter, not ownership).
 *
 * @param {Array} courts
 * @param {string|null|undefined} clusterId
 */
export function applyClusterFilterOnly(courts = [], clusterId) {
  const normalized = normalizeId(clusterId);
  if (!normalized) {
    return Array.isArray(courts) ? [...courts] : [];
  }

  return (Array.isArray(courts) ? courts : []).filter((court) => {
    const courtCluster = normalizeId(court?.clusterId ?? court?.cluster_id);
    return !courtCluster || courtCluster === normalized;
  });
}
