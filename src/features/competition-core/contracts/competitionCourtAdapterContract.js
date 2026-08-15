/**
 * Canonical Competition Court Adapter Contract (ĐẦU A).
 *
 * Tournament modules consume this contract. They must not modify it.
 * Missing capability → SHARED_CONTRACT_CAPABILITY_GAP (return to Owner).
 *
 * Court Resource owns physical identity, availability, and reservation
 * authority. This contract is the stable Competition-shaped surface above
 * CourtResourceGateway. Phase 3B may replace the reservation substrate
 * below the gateway without changing this public contract.
 */
import {
  COURT_RESOURCE_CODE,
  OWNERSHIP_STATUS,
} from "../../court-resource/constants/courtResourceContract.js";

export const COMPETITION_COURT_ADAPTER_CONTRACT_NAME =
  "Competition Court Adapter Contract";

export const COMPETITION_COURT_ADAPTER_CONTRACT_VERSION = 1;

export const COMPETITION_COURT_ADAPTER_AUTHORITATIVE_IMPORT_PATH =
  "src/features/competition-core/contracts/competitionCourtAdapterContract.js";

export const COMPETITION_COURT_RESOURCE_BINDING_PATH =
  "src/features/competition-core/adapters/courtResourceCompetitionAdapter.js";

/**
 * V1 breaking-change lock. Tournament workstreams cannot change this contract.
 * Backward-compatible internal implementation below the public surface is allowed
 * if V1 semantics remain unchanged.
 */
export const COMPETITION_COURT_ADAPTER_VERSIONING_POLICY = Object.freeze({
  CURRENT_VERSION: 1,
  SILENT_IN_PLACE_BREAKING_CHANGE_FORBIDDEN: true,
  TOURNAMENT_MODULES_MAY_MODIFY: false,
  BREAKING_CHANGE_REQUIRES_OWNER_APPROVED_SHARED_CONTRACT_CHANGE: true,
  BREAKING_CHANGE_REQUIRES_EXPLICIT_CONTRACT_VERSION_DECISION: true,
  BACKWARD_COMPATIBLE_INTERNAL_IMPLEMENTATION_BELOW_CONTRACT_ALLOWED: true,
});

export const COMPETITION_COURT_ADAPTER_CAPABILITY = Object.freeze({
  LIST_ELIGIBLE_COURTS: "listEligibleCourts",
  GET_COURT_AVAILABILITY: "getCourtAvailability",
  RESERVE_COURTS: "reserveCourts",
  RELEASE_COURTS: "releaseCourts",
  VALIDATE_MATCH_ASSIGNMENT: "validateMatchAssignment",
});

export const COMPETITION_TYPE = Object.freeze({
  INTERNAL: "internal",
  OFFICIAL_OPEN: "official_open",
  TEAM: "team",
});

export const COMPETITION_RESERVATION_OWNER_TYPE = "competition";

/**
 * Competition-facing result codes.
 * Exact gateway strings are reused where they already exist.
 * Named aliases below are the only Competition-facing vocabulary for ĐẦU B.
 */
export const COMPETITION_COURT_RESULT_CODE = Object.freeze({
  OK: COURT_RESOURCE_CODE.OK,
  AVAILABLE: "AVAILABLE",
  OWN_RESERVATION: OWNERSHIP_STATUS.OWN_RESERVATION,
  FOREIGN_RESERVATION: "FOREIGN_RESERVATION",
  OUT_OF_SCOPE: "OUT_OF_SCOPE",
  UNKNOWN_COURT: "UNKNOWN_COURT",
  MAINTENANCE: "MAINTENANCE",
  ASSIGNMENT_VALID: COURT_RESOURCE_CODE.ASSIGNMENT_VALID,
});

export const COMPETITION_COURT_ERROR_CODE = Object.freeze({
  MISSING_CLUB_ID: COURT_RESOURCE_CODE.MISSING_CLUB_ID,
  MISSING_COURT_ID: COURT_RESOURCE_CODE.MISSING_COURT_ID,
  MISSING_OWNER: COURT_RESOURCE_CODE.MISSING_OWNER,
  MISSING_WINDOW: COURT_RESOURCE_CODE.MISSING_WINDOW,
  INVALID_TIME_RANGE: COURT_RESOURCE_CODE.INVALID_TIME_RANGE,
  COURT_NOT_FOUND: COURT_RESOURCE_CODE.COURT_NOT_FOUND,
  CLUSTER_MISMATCH: COURT_RESOURCE_CODE.CLUSTER_MISMATCH,
  TENANT_MISMATCH: COURT_RESOURCE_CODE.TENANT_MISMATCH,
  CLUB_MISMATCH: COURT_RESOURCE_CODE.CLUB_MISMATCH,
  VENUE_MISMATCH: COURT_RESOURCE_CODE.VENUE_MISMATCH,
  COURT_INACTIVE: COURT_RESOURCE_CODE.COURT_INACTIVE,
  COURT_MAINTENANCE: COURT_RESOURCE_CODE.COURT_MAINTENANCE,
  COURT_LOCKED: COURT_RESOURCE_CODE.COURT_LOCKED,
  COURT_NOT_IN_OWNER_SCOPE: COURT_RESOURCE_CODE.COURT_NOT_IN_OWNER_SCOPE,
  FOREIGN_RESERVATION_CONFLICT: COURT_RESOURCE_CODE.FOREIGN_RESERVATION_CONFLICT,
  CUSTOMER_BOOKING_CONFLICT: COURT_RESOURCE_CODE.CUSTOMER_BOOKING_CONFLICT,
  MAINTENANCE_CONFLICT: COURT_RESOURCE_CODE.MAINTENANCE_CONFLICT,
  TOURNAMENT_BOOKING_CONFLICT: COURT_RESOURCE_CODE.TOURNAMENT_BOOKING_CONFLICT,
  BOOKING_CONFLICT: COURT_RESOURCE_CODE.BOOKING_CONFLICT,
  SYNTHETIC_COURT_DENIED: COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED,
  WHOLE_CLUSTER_DENIED: COURT_RESOURCE_CODE.WHOLE_CLUSTER_DENIED,
  DATA_UNAVAILABLE: COURT_RESOURCE_CODE.DATA_UNAVAILABLE,
  PARTIAL_FAILURE: COURT_RESOURCE_CODE.PARTIAL_FAILURE,
  COURT_COUNT_RESERVATION_DENIED: "COURT_COUNT_RESERVATION_DENIED",
  SHARED_CONTRACT_CAPABILITY_GAP: "SHARED_CONTRACT_CAPABILITY_GAP",
  FOREIGN_RESERVATION: COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION,
  OUT_OF_SCOPE: COMPETITION_COURT_RESULT_CODE.OUT_OF_SCOPE,
  UNKNOWN_COURT: COMPETITION_COURT_RESULT_CODE.UNKNOWN_COURT,
  MAINTENANCE: COMPETITION_COURT_RESULT_CODE.MAINTENANCE,
});

export const COMPETITION_COURT_FORBIDDEN_BYPASS = Object.freeze([
  "club_data_v3",
  "court_reservations",
  "booking storage",
  "Physical Court tables",
  "Club operational-access tables",
  "Court Engine runtime storage",
]);

export const COMPETITION_COURT_IDENTITY_RULES = Object.freeze({
  PHYSICAL_COURT_ID_IS_AUTHORITY: true,
  COURT_LABEL_IS_DISPLAY_ONLY: true,
  COURT_NUMBER_IS_DISPLAY_ONLY: true,
  COURT_COUNT_IS_CAPACITY_DEMAND_ONLY: true,
  CLUSTER_IS_NOT_A_RESERVABLE_UNIT: true,
  CLUSTER_REGISTRATION_IS_NOT_OPERATIONAL_ACCESS: true,
});

const GATEWAY_FOREIGN_CODES = new Set([
  COURT_RESOURCE_CODE.FOREIGN_RESERVATION_CONFLICT,
  COURT_RESOURCE_CODE.CUSTOMER_BOOKING_CONFLICT,
  COURT_RESOURCE_CODE.TOURNAMENT_BOOKING_CONFLICT,
  COURT_RESOURCE_CODE.BOOKING_CONFLICT,
  OWNERSHIP_STATUS.FOREIGN,
]);

const GATEWAY_OUT_OF_SCOPE_CODES = new Set([
  COURT_RESOURCE_CODE.COURT_NOT_IN_OWNER_SCOPE,
  COURT_RESOURCE_CODE.CLUSTER_MISMATCH,
  COURT_RESOURCE_CODE.TENANT_MISMATCH,
  COURT_RESOURCE_CODE.CLUB_MISMATCH,
  COURT_RESOURCE_CODE.VENUE_MISMATCH,
]);

const GATEWAY_UNKNOWN_COURT_CODES = new Set([
  COURT_RESOURCE_CODE.COURT_NOT_FOUND,
  COURT_RESOURCE_CODE.MISSING_COURT_ID,
]);

const GATEWAY_MAINTENANCE_CODES = new Set([
  COURT_RESOURCE_CODE.COURT_MAINTENANCE,
  COURT_RESOURCE_CODE.MAINTENANCE_CONFLICT,
]);

function trimId(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed === "" ? null : trimmed;
}

export function isSupportedCompetitionCourtCapability(name) {
  return Object.values(COMPETITION_COURT_ADAPTER_CAPABILITY).includes(name);
}

export function createSharedContractCapabilityGap(capability) {
  return Object.freeze({
    ok: false,
    valid: false,
    contractVersion: COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
    code: COMPETITION_COURT_ERROR_CODE.SHARED_CONTRACT_CAPABILITY_GAP,
    error: `Capability '${capability}' is not on the Competition Court Adapter Contract. Tournament modules must not add a local workaround.`,
    capability: capability == null ? null : String(capability),
  });
}

export function normalizeCompetitionCourtContext(input = {}) {
  return Object.freeze({
    tenantId: trimId(input.tenantId),
    competitionId: trimId(input.competitionId),
    competitionType: trimId(input.competitionType),
    clubId: trimId(input.clubId),
    clusterId: trimId(input.clusterId),
    actorId: trimId(input.actorId),
  });
}

export function createCompetitionReservationOwner(input = {}) {
  const context = normalizeCompetitionCourtContext(input);
  const ownerId = trimId(input.ownerId) || context.competitionId;
  if (!ownerId) return null;
  return Object.freeze({
    ownerType: COMPETITION_RESERVATION_OWNER_TYPE,
    ownerId,
    competitionType: trimId(input.competitionType) || context.competitionType,
  });
}

export function listPhysicalCourtIds(input = {}) {
  if (Array.isArray(input.physicalCourtIds) && input.physicalCourtIds.length) {
    return input.physicalCourtIds.map(trimId).filter(Boolean);
  }
  const single = trimId(input.physicalCourtId);
  return single ? [single] : [];
}

export function hasCourtCountWithoutPhysicalIds(input = {}) {
  const count = input.courtCount;
  if (count == null || count === "") return false;
  const numeric = Number(count);
  if (!Number.isFinite(numeric)) return false;
  return listPhysicalCourtIds(input).length === 0;
}

export function hasDisplayIdentityWithoutPhysicalIds(input = {}) {
  const ids = listPhysicalCourtIds(input);
  if (ids.length > 0) return false;
  return Boolean(
    trimId(input.courtLabel) ||
      trimId(input.displayName) ||
      trimId(input.displayCode) ||
      trimId(input.courtNumber) ||
      trimId(input.displayNumber)
  );
}

export function isWholeClusterReservationAttempt(input = {}) {
  const ids = listPhysicalCourtIds(input);
  const clusterId = trimId(input.clusterId);
  if (!clusterId) return false;
  if (ids.length === 0) return true;
  return ids.length === 1 && ids[0] === clusterId;
}

export function mapGatewayCodeToCompetitionCode(code, ownershipStatus = null) {
  const status = ownershipStatus || null;
  if (status === OWNERSHIP_STATUS.OWN_RESERVATION || code === OWNERSHIP_STATUS.OWN_RESERVATION) {
    return COMPETITION_COURT_RESULT_CODE.OWN_RESERVATION;
  }
  if (status === OWNERSHIP_STATUS.FOREIGN || GATEWAY_FOREIGN_CODES.has(code)) {
    return COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION;
  }
  if (GATEWAY_UNKNOWN_COURT_CODES.has(code)) {
    return COMPETITION_COURT_RESULT_CODE.UNKNOWN_COURT;
  }
  if (GATEWAY_OUT_OF_SCOPE_CODES.has(code)) {
    return COMPETITION_COURT_RESULT_CODE.OUT_OF_SCOPE;
  }
  if (GATEWAY_MAINTENANCE_CODES.has(code) || code === "COURT_MAINTENANCE") {
    return COMPETITION_COURT_RESULT_CODE.MAINTENANCE;
  }
  if (code === "AVAILABLE" || code === COURT_RESOURCE_CODE.OK) {
    return COMPETITION_COURT_RESULT_CODE.AVAILABLE;
  }
  if (code === COURT_RESOURCE_CODE.ASSIGNMENT_VALID) {
    return COMPETITION_COURT_RESULT_CODE.ASSIGNMENT_VALID;
  }
  if (code === COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED) {
    return COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED;
  }
  if (code === COURT_RESOURCE_CODE.WHOLE_CLUSTER_DENIED) {
    return COURT_RESOURCE_CODE.WHOLE_CLUSTER_DENIED;
  }
  return code || COMPETITION_COURT_ERROR_CODE.PARTIAL_FAILURE;
}

export function isForeignReservationCode(code) {
  return (
    code === COMPETITION_COURT_RESULT_CODE.FOREIGN_RESERVATION ||
    GATEWAY_FOREIGN_CODES.has(code)
  );
}

export function isFailClosedAvailabilityCode(code) {
  return (
    isForeignReservationCode(code) ||
    code === COMPETITION_COURT_RESULT_CODE.OUT_OF_SCOPE ||
    code === COMPETITION_COURT_RESULT_CODE.UNKNOWN_COURT ||
    code === COMPETITION_COURT_RESULT_CODE.MAINTENANCE ||
    GATEWAY_OUT_OF_SCOPE_CODES.has(code) ||
    GATEWAY_UNKNOWN_COURT_CODES.has(code) ||
    GATEWAY_MAINTENANCE_CODES.has(code)
  );
}

export function createCompetitionCourtContractEnvelope(partial = {}) {
  return {
    ok: partial.ok !== false,
    contractVersion: COMPETITION_COURT_ADAPTER_CONTRACT_VERSION,
    code: partial.code || COMPETITION_COURT_RESULT_CODE.OK,
    ...partial,
  };
}
