/**
 * Shared cluster membership — Court Cluster is a FILTER/SCOPE, not a reservable unit.
 *
 * clusterId = location/facility scope
 * courtId   = canonical physical resource
 *
 * Do not treat selecting a cluster as reserving every physical court in it.
 */

import { listCourts } from "./courtInventoryService.js";
import { COURT_RESOURCE_CODE } from "../constants/courtResourceContract.js";

const defaultDeps = Object.freeze({
  listCourts,
});

let deps = { ...defaultDeps };

/** @internal */
export function __setCourtClusterMembershipDepsForTests(next = {}) {
  deps = { ...defaultDeps, ...next };
}

/** @internal */
export function __resetCourtClusterMembershipDepsForTests() {
  deps = { ...defaultDeps };
}

function trimId(value) {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

function deny(code, error, extra = {}) {
  return { ok: false, code, error, court: null, ...extra };
}

/**
 * Strict physical-court membership in tenant/club/venue/cluster scope.
 *
 * @param {{
 *   tenantId?: string|null,
 *   clubId?: string|null,
 *   venueId?: string|null,
 *   clusterId?: string|null,
 *   courtId?: string|number|null,
 *   courts?: object[],
 *   includeInactive?: boolean,
 * }} options
 */
export function assertCourtClusterMembership(options = {}) {
  const clubId = trimId(options.clubId);
  const tenantId = trimId(options.tenantId) || trimId(options.venueId);
  const venueId = trimId(options.venueId) || tenantId;
  const clusterId = trimId(options.clusterId);
  const courtId = options.courtId != null && String(options.courtId).trim() !== ""
    ? String(options.courtId).trim()
    : null;

  if (!clubId) {
    return deny(COURT_RESOURCE_CODE.MISSING_CLUB_ID, "clubId is required — no first-club fallback.");
  }
  if (!courtId) {
    return deny(COURT_RESOURCE_CODE.MISSING_COURT_ID, "courtId is required — courtLabel is not identity.");
  }

  let courts = options.courts;
  if (!Array.isArray(courts)) {
    try {
      courts = deps.listCourts({
        clubId,
        tenantId,
        includeInactive: options.includeInactive !== false,
      });
    } catch (error) {
      return deny(
        COURT_RESOURCE_CODE.DATA_UNAVAILABLE,
        error?.message || "Unable to load court inventory."
      );
    }
  }

  const court = (Array.isArray(courts) ? courts : []).find(
    (item) => String(item?.id) === courtId
  );
  if (!court) {
    return deny(COURT_RESOURCE_CODE.COURT_NOT_FOUND, "Unknown court — denied.");
  }

  if (clubId && court.clubId && String(court.clubId) !== clubId) {
    return deny(COURT_RESOURCE_CODE.CLUB_MISMATCH, "Court does not belong to the requested club.");
  }
  if (tenantId && court.tenantId && String(court.tenantId) !== tenantId) {
    return deny(COURT_RESOURCE_CODE.TENANT_MISMATCH, "Court does not belong to the requested tenant.");
  }
  if (venueId && court.venueId && String(court.venueId) !== venueId) {
    return deny(COURT_RESOURCE_CODE.VENUE_MISMATCH, "Court does not belong to the requested venue.");
  }
  if (clusterId && String(court.clusterId || "") !== clusterId) {
    return deny(
      COURT_RESOURCE_CODE.CLUSTER_MISMATCH,
      "Court does not belong to the requested cluster."
    );
  }

  if (options.includeInactive !== true && court.active === false) {
    return deny(COURT_RESOURCE_CODE.COURT_INACTIVE, "Court is inactive.");
  }
  if (court.status === "maintenance") {
    return deny(COURT_RESOURCE_CODE.COURT_MAINTENANCE, "Court master status is maintenance.");
  }

  return {
    ok: true,
    code: COURT_RESOURCE_CODE.OK,
    error: null,
    court: { ...court },
    clubId,
    tenantId: tenantId || null,
    venueId: venueId || null,
    clusterId,
    courtId,
  };
}

/**
 * Keep only physical courts that belong to the requested cluster.
 * Missing clusterId on a court is a mismatch when cluster is supplied (fail closed).
 */
export function filterCourtsByClusterMembership(courts = [], clusterId) {
  const target = trimId(clusterId);
  if (!target) {
    return Array.isArray(courts) ? courts.map((court) => ({ ...court })) : [];
  }
  return (Array.isArray(courts) ? courts : [])
    .filter((court) => String(court?.clusterId || "") === target)
    .map((court) => ({ ...court }));
}
