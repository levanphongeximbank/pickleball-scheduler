/**
 * Venue & Court — Competition Canonical Court Descriptor adapter (Phase 3B).
 *
 * Competition-facing public contract: listCanonicalCourtDescriptors(request).
 * Separate from getCompetitionCourtAvailability (eligibility-only).
 * Does not assign courts, fabricate snapshot metadata, or invent capabilities/priority.
 */

import { listCourts as listCourtsDefault } from "../services/courtInventoryService.js";
import { loadClubs as loadClubsDefault } from "../../../data/club.js";
import {
  DESCRIPTOR_AUTHORITY,
  SOURCE_CONTRACT_VERSION,
  DESCRIPTOR_DIAGNOSTIC_REASON,
  DESCRIPTOR_ERROR,
} from "../constants/descriptorContract.js";

const defaultDeps = Object.freeze({
  listCourts: listCourtsDefault,
  loadClubs: loadClubsDefault,
});

let deps = { ...defaultDeps };

/** @internal Test-only dependency override. */
export function __setCompetitionCourtDescriptorAdapterDepsForTests(nextDeps = {}) {
  deps = { ...defaultDeps, ...nextDeps };
}

/** @internal Test-only dependency reset. */
export function __resetCompetitionCourtDescriptorAdapterDepsForTests() {
  deps = { ...defaultDeps };
}

function createDescriptorError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function normalizeRequiredId(value, missingCode, label) {
  if (value == null || typeof value !== "string") {
    throw createDescriptorError(
      `${label} is required and must be a non-empty string.`,
      value == null || value === ""
        ? missingCode
        : DESCRIPTOR_ERROR.INVALID_REQUEST
    );
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw createDescriptorError(
      `${label} is required and must be a non-empty string.`,
      missingCode
    );
  }
  return trimmed;
}

function isAuthoritativePriority(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function hasOwnPriority(court) {
  return (
    court != null &&
    Object.prototype.hasOwnProperty.call(court, "priority")
  );
}

function isLockedCourt(court) {
  return court?.status === "locked";
}

function isActiveCourt(court) {
  return court?.active !== false;
}

function pushExcluded(excludedCourts, courtId, reason) {
  excludedCourts.push({ courtId: String(courtId), reason });
}

function toDescriptor(court, scope) {
  return {
    courtId: String(court.id),
    tenantId: scope.tenantId,
    clubId: scope.clubId,
    venueId: scope.venueId,
    active: isActiveCourt(court),
    locked: isLockedCourt(court),
    capabilities: [],
    priority: court.priority,
  };
}

function resolveStrictScope(request = {}) {
  if (request == null || typeof request !== "object" || Array.isArray(request)) {
    throw createDescriptorError(
      "listCanonicalCourtDescriptors requires a request object.",
      DESCRIPTOR_ERROR.INVALID_REQUEST
    );
  }

  const tenantId = normalizeRequiredId(
    request.tenantId,
    DESCRIPTOR_ERROR.TENANT_SCOPE_MISSING,
    "tenantId"
  );
  const clubId = normalizeRequiredId(
    request.clubId,
    DESCRIPTOR_ERROR.CLUB_SCOPE_MISSING,
    "clubId"
  );
  const venueId = normalizeRequiredId(
    request.venueId,
    DESCRIPTOR_ERROR.VENUE_SCOPE_MISSING,
    "venueId"
  );

  if (request.includeInactive !== undefined && typeof request.includeInactive !== "boolean") {
    throw createDescriptorError(
      "includeInactive must be a boolean when provided.",
      DESCRIPTOR_ERROR.INVALID_REQUEST
    );
  }
  if (request.includeLocked !== undefined && typeof request.includeLocked !== "boolean") {
    throw createDescriptorError(
      "includeLocked must be a boolean when provided.",
      DESCRIPTOR_ERROR.INVALID_REQUEST
    );
  }
  if (request.courtIds !== undefined && !Array.isArray(request.courtIds)) {
    throw createDescriptorError(
      "courtIds must be an array when provided.",
      DESCRIPTOR_ERROR.INVALID_REQUEST
    );
  }
  if (
    request.clusterId !== undefined &&
    request.clusterId !== null &&
    typeof request.clusterId !== "string"
  ) {
    throw createDescriptorError(
      "clusterId must be a string when provided.",
      DESCRIPTOR_ERROR.INVALID_REQUEST
    );
  }

  let clubs;
  try {
    clubs = deps.loadClubs();
  } catch {
    throw createDescriptorError(
      "Failed to load clubs for descriptor scope check.",
      DESCRIPTOR_ERROR.DATA_UNAVAILABLE
    );
  }

  const club = (Array.isArray(clubs) ? clubs : []).find(
    (item) => String(item?.id) === clubId
  );
  if (!club) {
    throw createDescriptorError(
      "Club not found for descriptor scope.",
      DESCRIPTOR_ERROR.CLUB_NOT_FOUND
    );
  }

  const clubVenueId =
    club.venueId != null && String(club.venueId).trim() !== ""
      ? String(club.venueId).trim()
      : null;

  if (!clubVenueId || clubVenueId !== venueId) {
    throw createDescriptorError(
      "Club does not belong to the selected venue.",
      DESCRIPTOR_ERROR.VENUE_MISMATCH
    );
  }

  if (clubVenueId !== tenantId) {
    throw createDescriptorError(
      "Club does not belong to the selected tenant.",
      DESCRIPTOR_ERROR.TENANT_MISMATCH
    );
  }

  return {
    tenantId,
    clubId,
    venueId,
    includeInactive: request.includeInactive === true,
    includeLocked: request.includeLocked !== false,
    courtIds: request.courtIds,
    clusterId:
      request.clusterId != null && String(request.clusterId).trim() !== ""
        ? String(request.clusterId).trim()
        : null,
  };
}

function loadInventory(scope) {
  try {
    return deps.listCourts({
      clubId: scope.clubId,
      tenantId: scope.tenantId,
      clusterId: scope.clusterId,
      includeInactive: true,
    });
  } catch (error) {
    if (error?.code && Object.values(DESCRIPTOR_ERROR).includes(error.code)) {
      throw error;
    }
    throw createDescriptorError(
      "Failed to load court inventory for descriptors.",
      DESCRIPTOR_ERROR.DATA_UNAVAILABLE
    );
  }
}

function passesListingFlags(court, scope) {
  if (!scope.includeInactive && !isActiveCourt(court)) {
    return false;
  }
  if (!scope.includeLocked && isLockedCourt(court)) {
    return false;
  }
  return true;
}

function considerCourt(court, scope, courts, excludedCourts) {
  if (!passesListingFlags(court, scope)) {
    return;
  }

  const courtId = String(court.id);
  if (!hasOwnPriority(court) || !isAuthoritativePriority(court.priority)) {
    pushExcluded(
      excludedCourts,
      courtId,
      DESCRIPTOR_DIAGNOSTIC_REASON.PRIORITY_NOT_AUTHORITATIVE
    );
    return;
  }

  courts.push(toDescriptor(court, scope));
}

/**
 * Competition-facing Canonical Court Descriptor listing.
 *
 * Request:
 * {
 *   tenantId, clubId, venueId,   // required — no ambient / first-* fallback
 *   courtIds?,                   // optional; preserves request order among matches
 *   clusterId?,                  // optional filter only
 *   includeInactive?,            // default false
 *   includeLocked?               // default true
 * }
 *
 * Response:
 * {
 *   tenantId, clubId, venueId,
 *   descriptorAuthority, sourceContractVersion,
 *   sourceSnapshotId: null, sourceSnapshotVersion: null,
 *   courts: [{ courtId, tenantId, clubId, venueId, active, locked, capabilities, priority }],
 *   diagnostics: { excludedCourts: [{ courtId, reason }] }
 * }
 */
export function listCanonicalCourtDescriptors(request = {}) {
  const scope = resolveStrictScope(request);
  const inventory = loadInventory(scope);
  const inventoryById = new Map();
  for (const court of inventory || []) {
    if (court?.id == null || court.id === "") {
      continue;
    }
    const id = String(court.id);
    if (!inventoryById.has(id)) {
      inventoryById.set(id, court);
    }
  }

  const courts = [];
  const excludedCourts = [];

  if (Array.isArray(scope.courtIds)) {
    for (const rawId of scope.courtIds) {
      const courtId = String(rawId);
      const court = inventoryById.get(courtId);
      if (!court) {
        pushExcluded(
          excludedCourts,
          courtId,
          DESCRIPTOR_DIAGNOSTIC_REASON.COURT_NOT_FOUND
        );
        continue;
      }
      considerCourt(court, scope, courts, excludedCourts);
    }
  } else {
    for (const court of inventory || []) {
      if (court?.id == null || court.id === "") {
        continue;
      }
      considerCourt(court, scope, courts, excludedCourts);
    }
  }

  return {
    tenantId: scope.tenantId,
    clubId: scope.clubId,
    venueId: scope.venueId,
    descriptorAuthority: DESCRIPTOR_AUTHORITY,
    sourceContractVersion: SOURCE_CONTRACT_VERSION,
    sourceSnapshotId: null,
    sourceSnapshotVersion: null,
    courts,
    diagnostics: {
      excludedCourts,
    },
  };
}
