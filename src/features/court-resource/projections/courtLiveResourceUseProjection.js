/**
 * Mode-agnostic Court Live Resource Use projection port.
 *
 * Competition / Booking / Daily Play project physical use into Court Live Runtime.
 * This is NOT Head A. This is NOT Capacity SSOT. This is NOT match lifecycle.
 *
 * Preferred integration:
 *   owning business workflow emits generic resource-use projection
 *   → beginResourceSession / endResourceSession
 *
 * Court Operations never calls back into Competition scoring / bracket / match status.
 */
import {
  RESOURCE_SESSION_SOURCE_TYPE,
  isCanonicalCourtLiveRuntime,
  normalizeSourceType,
} from "../constants/canonicalLiveRuntime.js";
import {
  beginResourceSession,
  endResourceSession,
} from "../services/courtOperationsLiveRuntimeApplication.js";

function trimId(value) {
  if (value == null) return "";
  return String(value).trim();
}

/**
 * Project a generic resource-use begin into Live Runtime.
 *
 * @param {object} input
 * @param {'booking'|'daily_play'|'competition'|'operations'} input.sourceType
 * @param {string} input.sourceId opaque reference (e.g. matchId / bookingId)
 */
export async function projectLiveResourceUseBegin(input = {}) {
  if (!isCanonicalCourtLiveRuntime() && input.forceCanonical !== true) {
    return {
      ok: false,
      code: "CANONICAL_PATH_UNAVAILABLE",
      message: "Canonical court live runtime is not enabled.",
      projected: false,
    };
  }

  const sourceType = normalizeSourceType(input.sourceType);
  const sourceId = trimId(input.sourceId);
  if (!sourceType || !sourceId) {
    return {
      ok: false,
      code: "INVALID_INPUT",
      message: "sourceType and opaque sourceId are required.",
      projected: false,
    };
  }

  const result = await beginResourceSession({
    tenantId: input.tenantId,
    physicalCourtId: input.physicalCourtId,
    sourceType,
    sourceId,
    reservationRef: trimId(input.reservationRef) || null,
    actorId: trimId(input.actorId) || null,
    requestId: trimId(input.requestId) || undefined,
    capacityClaimValid: input.capacityClaimValid === true,
    operationsAuthorized: input.operationsAuthorized === true,
    forceCanonical: input.forceCanonical === true,
  });

  return {
    ...result,
    projected: result.ok === true,
    integrationModel: "GENERIC_LIVE_RESOURCE_USE_PROJECTION",
    headABypassed: false,
    matchLifecycleMutated: false,
    scoreMutated: false,
    reservationWritten: false,
  };
}

/**
 * Project a generic resource-use end into Live Runtime.
 */
export async function projectLiveResourceUseEnd(input = {}) {
  if (!isCanonicalCourtLiveRuntime() && input.forceCanonical !== true) {
    return {
      ok: false,
      code: "CANONICAL_PATH_UNAVAILABLE",
      message: "Canonical court live runtime is not enabled.",
      projected: false,
    };
  }

  const result = await endResourceSession({
    tenantId: input.tenantId,
    physicalCourtId: input.physicalCourtId,
    resourceSessionId: input.resourceSessionId || null,
    sourceType: normalizeSourceType(input.sourceType) || null,
    sourceId: trimId(input.sourceId) || null,
    actorId: trimId(input.actorId) || null,
    requestId: trimId(input.requestId) || undefined,
    forceCanonical: input.forceCanonical === true,
  });

  return {
    ...result,
    projected: result.ok === true,
    integrationModel: "GENERIC_LIVE_RESOURCE_USE_PROJECTION",
    headABypassed: false,
    matchLifecycleMutated: false,
    scoreMutated: false,
    reservationReleased: false,
    reservationWritten: false,
  };
}

/**
 * Competition-facing helper — opaque matchId as sourceId only.
 * Does not load/change match status, score, or bracket.
 */
export async function projectCompetitionMatchLiveBegin(input = {}) {
  return projectLiveResourceUseBegin({
    ...input,
    sourceType: RESOURCE_SESSION_SOURCE_TYPE.COMPETITION,
    sourceId: trimId(input.matchId || input.sourceId),
    capacityClaimValid: input.capacityClaimValid !== false,
  });
}

export async function projectCompetitionMatchLiveEnd(input = {}) {
  return projectLiveResourceUseEnd({
    ...input,
    sourceType: RESOURCE_SESSION_SOURCE_TYPE.COMPETITION,
    sourceId: trimId(input.matchId || input.sourceId),
  });
}

/**
 * Booking-facing helper — opaque bookingId as sourceId only.
 * Does not change Booking business status (caller owns that).
 */
export async function projectBookingLiveBegin(input = {}) {
  return projectLiveResourceUseBegin({
    ...input,
    sourceType: RESOURCE_SESSION_SOURCE_TYPE.BOOKING,
    sourceId: trimId(input.bookingId || input.sourceId),
    capacityClaimValid: input.capacityClaimValid !== false,
  });
}

export async function projectBookingLiveEnd(input = {}) {
  return projectLiveResourceUseEnd({
    ...input,
    sourceType: RESOURCE_SESSION_SOURCE_TYPE.BOOKING,
    sourceId: trimId(input.bookingId || input.sourceId),
  });
}

/**
 * Daily Play-facing helper — lease remains projection; Live Runtime is occupancy SSOT.
 */
export async function projectDailyPlayLiveBegin(input = {}) {
  return projectLiveResourceUseBegin({
    ...input,
    sourceType: RESOURCE_SESSION_SOURCE_TYPE.DAILY_PLAY,
    sourceId: trimId(input.matchId || input.sessionId || input.sourceId),
    capacityClaimValid: input.capacityClaimValid !== false,
  });
}

export async function projectDailyPlayLiveEnd(input = {}) {
  return projectLiveResourceUseEnd({
    ...input,
    sourceType: RESOURCE_SESSION_SOURCE_TYPE.DAILY_PLAY,
    sourceId: trimId(input.matchId || input.sessionId || input.sourceId),
  });
}

export const COMPETITION_LIVE_INTEGRATION_MODEL =
  "GENERIC_LIVE_RESOURCE_USE_PROJECTION_ONE_WAY";
