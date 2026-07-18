/**
 * Venue & Court — Court Inventory facade (Phase 1B).
 *
 * Delegates to existing domain courtService / clubStorage loaders.
 * Does not own storage, bookings, availability, or engine wiring.
 */

import {
  filterCourtsByTenant,
  loadCourtsForClubScoped,
  loadCourtsForVenue,
  loadCourtsForVenueScoped,
} from "../../../domain/courtService.js";
import { loadCourtsForClub } from "../../../domain/clubStorage.js";
import { loadClubs } from "../../../data/club.js";

const defaultDeps = Object.freeze({
  filterCourtsByTenant,
  loadCourtsForClubScoped,
  loadCourtsForVenue,
  loadCourtsForVenueScoped,
  loadCourtsForClub,
  loadClubs,
});

let deps = { ...defaultDeps };

/** @internal Test-only dependency override. */
export function __setCourtInventoryDepsForTests(nextDeps = {}) {
  deps = { ...defaultDeps, ...nextDeps };
}

/** @internal Test-only dependency reset. */
export function __resetCourtInventoryDepsForTests() {
  deps = { ...defaultDeps };
}

function requireScope(options = {}) {
  const clubId = options.clubId != null && options.clubId !== "" ? options.clubId : null;
  const venueId = options.venueId != null && options.venueId !== "" ? options.venueId : null;

  if (!clubId && !venueId) {
    throw new Error("listCourts requires clubId or venueId");
  }

  return { clubId, venueId };
}

function toSafeCourtCopies(courts) {
  return (courts || []).map((court) => ({ ...court }));
}

function applyClusterFilter(courts, clusterId) {
  if (clusterId == null || clusterId === "") {
    return courts;
  }

  const target = String(clusterId);
  return courts.filter((court) => String(court?.clusterId || "") === target);
}

function loadClubCourtsIncludingInactive(clubId, tenantId) {
  if (!clubId) {
    return [];
  }

  if (tenantId) {
    const club = deps.loadClubs().find((item) => item.id === clubId);
    if (club?.venueId && club.venueId !== tenantId) {
      return [];
    }
  }

  const courts = deps.loadCourtsForClub(clubId);
  return deps.filterCourtsByTenant(courts, tenantId);
}

function loadCourtsFromLegacy(options = {}) {
  const { clubId, venueId } = requireScope(options);
  const tenantId = options.tenantId || null;
  const includeInactive = options.includeInactive === true;

  if (clubId) {
    if (includeInactive) {
      return loadClubCourtsIncludingInactive(clubId, tenantId);
    }
    return deps.loadCourtsForClubScoped(clubId, tenantId);
  }

  if (includeInactive) {
    const courts = deps.loadCourtsForVenue(venueId);
    return deps.filterCourtsByTenant(courts, tenantId);
  }

  if (tenantId) {
    return deps.loadCourtsForVenueScoped(venueId, tenantId);
  }

  return deps.loadCourtsForVenue(venueId).filter((court) => court.active !== false);
}

/**
 * List court master inventory for a club or venue scope.
 *
 * @param {object} [options]
 * @param {string} [options.clubId]
 * @param {string} [options.venueId]
 * @param {string} [options.tenantId]
 * @param {string} [options.clusterId]
 * @param {boolean} [options.includeInactive=false]
 * @returns {object[]} Shallow-copied court records
 */
export function listCourts(options = {}) {
  let courts;

  try {
    courts = loadCourtsFromLegacy(options);
  } catch (error) {
    if (error instanceof Error && error.message === "listCourts requires clubId or venueId") {
      throw error;
    }
    throw new Error("Failed to load court inventory", { cause: error });
  }

  return toSafeCourtCopies(applyClusterFilter(courts, options.clusterId));
}

/**
 * Find one court by id within the same scope rules as listCourts.
 *
 * @param {string|number} courtId
 * @param {object} [options] Same scope options as listCourts
 * @returns {object|null}
 */
export function getCourtById(courtId, options = {}) {
  if (courtId == null || courtId === "") {
    return null;
  }

  const target = String(courtId);
  const courts = listCourts(options);
  const found = courts.find((court) => String(court?.id) === target);
  return found ? { ...found } : null;
}
