/**
 * Venue/Court → Platform Core integration adapter.
 *
 * Pure projections of caller-supplied identifiers into Platform Core contracts.
 * Does not equate tenantId / clubId / venueId, calculate availability, book
 * courts, generate IDs, or access persistence / environment / globals.
 */

import {
  fail,
  projectIdentityActor,
  projectTenantScope,
  projectContractVersion,
  projectPlatformCapabilityDescriptor,
  projectEventErrorDescriptor,
} from "../../../core/platform/index.js";

export const VENUE_COURT_PLATFORM_ADAPTER_ERROR = Object.freeze({
  INVALID: "VENUE_COURT_PLATFORM_ADAPTER_INVALID",
  TENANT_ID_REQUIRED: "VENUE_COURT_PLATFORM_ADAPTER_TENANT_ID_REQUIRED",
  VENUE_ID_REQUIRED: "VENUE_COURT_PLATFORM_ADAPTER_VENUE_ID_REQUIRED",
  CLUB_ID_REQUIRED: "VENUE_COURT_PLATFORM_ADAPTER_CLUB_ID_REQUIRED",
  ACTOR_ID_REQUIRED: "VENUE_COURT_PLATFORM_ADAPTER_ACTOR_ID_REQUIRED",
  VERSION_REQUIRED: "VENUE_COURT_PLATFORM_ADAPTER_VERSION_REQUIRED",
  CAPABILITY_REQUIRED: "VENUE_COURT_PLATFORM_ADAPTER_CAPABILITY_REQUIRED",
  ERROR_REQUIRED: "VENUE_COURT_PLATFORM_ADAPTER_ERROR_REQUIRED",
});

/**
 * @param {string} code
 * @param {string} message
 * @param {string} [field]
 */
function adapterError(code, message, field) {
  /** @type {{ code: string, message: string, field?: string }} */
  const error = { code, message };
  if (field !== undefined) {
    error.field = field;
  }
  return Object.freeze(error);
}

/**
 * @param {*} input
 * @returns {input is Record<string, *>}
 */
function isPlainObject(input) {
  return input !== null && typeof input === "object" && !Array.isArray(input);
}

/**
 * Project an explicit tenant scope. Never infers tenantId from venueId/clubId.
 *
 * @param {*} input
 * @returns {import("../../../core/platform/index.js").Result | { ok: false, error: * }}
 */
export function projectVenueCourtTenantScope(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        VENUE_COURT_PLATFORM_ADAPTER_ERROR.INVALID,
        "Venue/Court tenant scope input must be a plain object"
      )
    );
  }
  if (!("tenantId" in input) || input.tenantId === undefined || input.tenantId === null) {
    return fail(
      adapterError(
        VENUE_COURT_PLATFORM_ADAPTER_ERROR.TENANT_ID_REQUIRED,
        "Venue/Court tenant scope requires an explicit tenantId",
        "tenantId"
      )
    );
  }
  return projectTenantScope({
    scopeType: "TENANT",
    tenantId: input.tenantId,
    ...(input.scopeId !== undefined ? { scopeId: input.scopeId } : {}),
  });
}

/**
 * Project an explicit venue scope. Does not set tenantId from venueId.
 *
 * @param {*} input
 */
export function projectVenueCourtVenueScope(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        VENUE_COURT_PLATFORM_ADAPTER_ERROR.INVALID,
        "Venue/Court venue scope input must be a plain object"
      )
    );
  }
  if (!("venueId" in input) || input.venueId === undefined || input.venueId === null) {
    return fail(
      adapterError(
        VENUE_COURT_PLATFORM_ADAPTER_ERROR.VENUE_ID_REQUIRED,
        "Venue/Court venue scope requires an explicit venueId",
        "venueId"
      )
    );
  }
  /** @type {{ scopeType: string, scopeId: *, tenantId?: * }} */
  const payload = {
    scopeType: "VENUE",
    scopeId: input.venueId,
  };
  if ("tenantId" in input && input.tenantId !== undefined) {
    payload.tenantId = input.tenantId;
  }
  return projectTenantScope(payload);
}

/**
 * Project an explicit club scope. Does not equate clubId with tenantId/venueId.
 *
 * @param {*} input
 */
export function projectVenueCourtClubScope(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        VENUE_COURT_PLATFORM_ADAPTER_ERROR.INVALID,
        "Venue/Court club scope input must be a plain object"
      )
    );
  }
  if (!("clubId" in input) || input.clubId === undefined || input.clubId === null) {
    return fail(
      adapterError(
        VENUE_COURT_PLATFORM_ADAPTER_ERROR.CLUB_ID_REQUIRED,
        "Venue/Court club scope requires an explicit clubId",
        "clubId"
      )
    );
  }
  /** @type {{ scopeType: string, scopeId: *, tenantId?: * }} */
  const payload = {
    scopeType: "CLUB",
    scopeId: input.clubId,
  };
  if ("tenantId" in input && input.tenantId !== undefined) {
    payload.tenantId = input.tenantId;
  }
  return projectTenantScope(payload);
}

/**
 * Project an already-resolved user actor for Venue/Court boundaries.
 *
 * @param {*} input
 */
export function projectVenueCourtActor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        VENUE_COURT_PLATFORM_ADAPTER_ERROR.INVALID,
        "Venue/Court actor input must be a plain object"
      )
    );
  }
  const actorId =
    "actorId" in input && input.actorId !== undefined
      ? input.actorId
      : "userId" in input
        ? input.userId
        : undefined;
  if (actorId === undefined || actorId === null) {
    return fail(
      adapterError(
        VENUE_COURT_PLATFORM_ADAPTER_ERROR.ACTOR_ID_REQUIRED,
        "Venue/Court actor projection requires an explicit actorId or userId",
        "actorId"
      )
    );
  }
  return projectIdentityActor({
    actorType: typeof input.actorType === "string" ? input.actorType : "USER",
    actorId,
  });
}

/**
 * Project an explicit Venue/Court contract version string.
 *
 * @param {*} input
 */
export function projectVenueCourtContractVersion(input) {
  if (typeof input === "string") {
    return projectContractVersion(input);
  }
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        VENUE_COURT_PLATFORM_ADAPTER_ERROR.INVALID,
        "Venue/Court contract version input must be a string or plain object"
      )
    );
  }
  const version =
    "version" in input && input.version !== undefined
      ? input.version
      : input.contractVersion;
  if (version === undefined || version === null) {
    return fail(
      adapterError(
        VENUE_COURT_PLATFORM_ADAPTER_ERROR.VERSION_REQUIRED,
        "Venue/Court contract version requires an explicit version",
        "version"
      )
    );
  }
  return projectContractVersion(version);
}

/**
 * Project a caller-supplied Venue/Court capability descriptor.
 *
 * @param {*} input
 */
export function projectVenueCourtCapabilityDescriptor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        VENUE_COURT_PLATFORM_ADAPTER_ERROR.INVALID,
        "Venue/Court capability descriptor input must be a plain object"
      )
    );
  }
  if (!("capabilityCode" in input) || input.capabilityCode === undefined) {
    return fail(
      adapterError(
        VENUE_COURT_PLATFORM_ADAPTER_ERROR.CAPABILITY_REQUIRED,
        "Venue/Court capability descriptor requires an explicit capabilityCode",
        "capabilityCode"
      )
    );
  }
  return projectPlatformCapabilityDescriptor({
    capabilityCode: input.capabilityCode,
    ownerModule:
      "ownerModule" in input && input.ownerModule !== undefined
        ? input.ownerModule
        : "venue-court",
    ...(input.version !== undefined ? { version: input.version } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  });
}

/**
 * Project an already-resolved error at a Venue/Court facade boundary.
 *
 * @param {*} input
 */
export function projectVenueCourtErrorDescriptor(input) {
  if (!isPlainObject(input)) {
    return fail(
      adapterError(
        VENUE_COURT_PLATFORM_ADAPTER_ERROR.ERROR_REQUIRED,
        "Venue/Court error descriptor input must be a plain object"
      )
    );
  }
  return projectEventErrorDescriptor(input);
}
