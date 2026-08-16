/**
 * Court Operations Live Resource Runtime Application Service.
 *
 * Answers NOW-state only:
 *   occupancy / active resource session / current operational state
 *
 * MUST NOT:
 *   write court_resource_reservations
 *   own match lifecycle / scoring
 *   treat occupancy as future availability conflict authority
 *
 * UI / Booking / Competition projections → this boundary → live runtime RPCs
 * Capacity validation is read-only (claim check), never a capacity write.
 */
import { isCanonicalPhysicalCourtId } from "../contracts/canonicalPhysicalCourt.js";
import { COURT_RESOURCE_CODE } from "../constants/courtResourceContract.js";
import {
  COURT_OCCUPANCY_STATE,
  COURT_OPERATIONAL_STATE,
  LIVE_RUNTIME_CODE,
  RESOURCE_SESSION_SOURCE_TYPE,
  isCanonicalCourtLiveRuntime,
  normalizeOperationalState,
  normalizeSourceType,
  operationalStateAllowsUse,
} from "../constants/canonicalLiveRuntime.js";
import { requireCanonicalTenantId } from "../scope/courtOperationsScope.js";
import {
  rpcBeginResourceSession,
  rpcEndResourceSession,
  rpcGetCourtLiveState,
  rpcListResourceSessions,
  rpcSetCurrentOperationalState,
} from "./canonicalLiveRuntimeClient.js";

function trimId(value) {
  if (value == null) return "";
  return String(value).trim();
}

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function defaultRequestId(prefix) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function requireCanonicalEnabled(input = {}) {
  if (!isCanonicalCourtLiveRuntime() && input.forceCanonical !== true) {
    return fail(
      COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      "Canonical court live runtime is not enabled."
    );
  }
  return { ok: true };
}

function requireTenant(input = {}) {
  const scoped = requireCanonicalTenantId(input);
  if (!scoped.ok) {
    return fail(
      scoped.code || COURT_RESOURCE_CODE.TENANT_MISMATCH,
      scoped.error || "tenantId is required — fail closed (no venueId invent)."
    );
  }
  return { ok: true, tenantId: scoped.tenantId };
}

function requirePhysicalCourtId(value) {
  const physicalCourtId = trimId(value);
  if (!physicalCourtId) {
    return fail(
      COURT_RESOURCE_CODE.MISSING_COURT_ID,
      "physicalCourtId is required — clusterId / labels are not live resource identity."
    );
  }
  if (!isCanonicalPhysicalCourtId(physicalCourtId)) {
    return fail(
      COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED,
      "physicalCourtId must be a UUID — labels and legacy court ids are not identity.",
      { physicalCourtId }
    );
  }
  return { ok: true, physicalCourtId };
}

function mapLiveResult(result) {
  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code || COURT_RESOURCE_CODE.DATA_UNAVAILABLE,
      message: result?.message || result?.error || "Canonical live runtime command failed.",
      reservationWriteCount: result?.reservationWriteCount ?? 0,
      ...result,
    };
  }
  return {
    ok: true,
    code: result.code || LIVE_RUNTIME_CODE.OK,
    liveState: result.liveState || null,
    resourceSession: result.resourceSession || null,
    occupancyState: result.liveState?.occupancyState || null,
    operationalState: result.liveState?.operationalState || null,
    activeSession: result.liveState?.activeSession || result.resourceSession || null,
    replay: result.replay === true,
    reservationWriteCount: result.reservationWriteCount ?? 0,
    reservationReleased: result.reservationReleased === true,
    resourceBlockCreated: result.resourceBlockCreated === true,
    reservationCreated: result.reservationCreated === true,
    message: result.message,
  };
}

/**
 * Begin a live resource session (physical use NOW).
 * Does NOT create a reservation.
 */
export async function beginResourceSession(input = {}) {
  const enabled = requireCanonicalEnabled(input);
  if (!enabled.ok) return enabled;
  const scope = requireTenant(input);
  if (!scope.ok) return scope;
  const court = requirePhysicalCourtId(input.physicalCourtId);
  if (!court.ok) return court;
  if (trimId(input.clusterId) && !trimId(input.physicalCourtId)) {
    return fail(
      COURT_RESOURCE_CODE.WHOLE_CLUSTER_DENIED,
      "clusterId cannot identify a live resource session."
    );
  }
  if (trimId(input.courtLabel || input.displayLabel) && !trimId(input.physicalCourtId)) {
    return fail(
      COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED,
      "display label cannot identify a live resource session."
    );
  }

  const sourceType = normalizeSourceType(input.sourceType);
  const sourceId = trimId(input.sourceId);
  if (!sourceType || !sourceId) {
    return fail(
      COURT_RESOURCE_CODE.INVALID_INPUT,
      "sourceType and sourceId are required (opaque reference)."
    );
  }

  if (sourceType === RESOURCE_SESSION_SOURCE_TYPE.OPERATIONS) {
    if (input.operationsAuthorized !== true) {
      return fail(
        LIVE_RUNTIME_CODE.OPERATIONS_POLICY_REQUIRED,
        "Operations live use requires explicit Court Operations authorization."
      );
    }
  } else if (input.capacityClaimValid !== true) {
    // Callers must prove capacity ownership via gateway/read path before begin.
    // Live runtime never creates that reservation.
    return fail(
      LIVE_RUNTIME_CODE.CAPACITY_CLAIM_REQUIRED,
      "beginResourceSession requires a validated capacity claim for booking/competition/daily_play."
    );
  }

  const requestId =
    trimId(input.requestId) || defaultRequestId(`live-begin:${court.physicalCourtId}:${sourceId}`);

  const result = await rpcBeginResourceSession({
    tenantId: scope.tenantId,
    physicalCourtId: court.physicalCourtId,
    sourceType,
    sourceId,
    reservationRef: trimId(input.reservationRef) || null,
    requestId,
    actorId: trimId(input.actorId) || null,
    operationsAuthorized: input.operationsAuthorized === true,
    capacityClaimValid: input.capacityClaimValid === true,
  });
  return mapLiveResult(result);
}

/**
 * End a live resource session. Idempotent.
 * Does NOT release durable capacity / reservations.
 */
export async function endResourceSession(input = {}) {
  const enabled = requireCanonicalEnabled(input);
  if (!enabled.ok) return enabled;
  const scope = requireTenant(input);
  if (!scope.ok) return scope;

  const physicalCourtId = trimId(input.physicalCourtId);
  const resourceSessionId = trimId(input.resourceSessionId);
  if (!physicalCourtId && !resourceSessionId) {
    return fail(
      COURT_RESOURCE_CODE.INVALID_INPUT,
      "physicalCourtId or resourceSessionId is required."
    );
  }
  if (physicalCourtId) {
    const court = requirePhysicalCourtId(physicalCourtId);
    if (!court.ok) return court;
  }

  const requestId =
    trimId(input.requestId)
    || defaultRequestId(`live-end:${resourceSessionId || physicalCourtId}`);

  const result = await rpcEndResourceSession({
    tenantId: scope.tenantId,
    physicalCourtId: physicalCourtId || null,
    resourceSessionId: resourceSessionId || null,
    sourceType: normalizeSourceType(input.sourceType) || null,
    sourceId: trimId(input.sourceId) || null,
    requestId,
    actorId: trimId(input.actorId) || null,
  });
  return mapLiveResult(result);
}

/**
 * Set current operational state (NOW only).
 * NOT Resource Block creation. NOT Reservation creation.
 */
export async function setCurrentOperationalState(input = {}) {
  const enabled = requireCanonicalEnabled(input);
  if (!enabled.ok) return enabled;
  const scope = requireTenant(input);
  if (!scope.ok) return scope;
  const court = requirePhysicalCourtId(input.physicalCourtId);
  if (!court.ok) return court;

  const operationalState = normalizeOperationalState(input.state || input.operationalState);
  if (!operationalState) {
    return fail(
      LIVE_RUNTIME_CODE.INVALID_OPERATIONAL_STATE,
      "operationalState must be AVAILABLE | UNAVAILABLE_NOW | OUT_OF_SERVICE_NOW."
    );
  }

  const requestId =
    trimId(input.requestId)
    || defaultRequestId(`live-ops-state:${court.physicalCourtId}:${operationalState}`);

  const result = await rpcSetCurrentOperationalState({
    tenantId: scope.tenantId,
    physicalCourtId: court.physicalCourtId,
    operationalState,
    reason: input.reason || "",
    requestId,
    actorId: trimId(input.actorId) || null,
  });
  return mapLiveResult(result);
}

/**
 * Read composed current court live state with explicit authority fields.
 */
export async function getCourtLiveState(input = {}) {
  const enabled = requireCanonicalEnabled(input);
  if (!enabled.ok) return enabled;
  const scope = requireTenant(input);
  if (!scope.ok) return scope;
  const court = requirePhysicalCourtId(input.physicalCourtId);
  if (!court.ok) return court;

  const result = await rpcGetCourtLiveState({
    tenantId: scope.tenantId,
    physicalCourtId: court.physicalCourtId,
  });
  if (!result?.ok) return mapLiveResult(result);

  const liveState = result.liveState || {};
  return {
    ok: true,
    code: LIVE_RUNTIME_CODE.OK,
    physicalCourtId: court.physicalCourtId,
    occupancyState: liveState.occupancyState || COURT_OCCUPANCY_STATE.FREE,
    operationalState: liveState.operationalState || COURT_OPERATIONAL_STATE.AVAILABLE,
    activeSession: liveState.activeSession || null,
    activeResourceBlock: liveState.activeResourceBlock || null,
    liveState,
    allowsLiveUse: operationalStateAllowsUse(liveState.operationalState),
  };
}

export async function listResourceSessions(input = {}) {
  const enabled = requireCanonicalEnabled(input);
  if (!enabled.ok) return { ...enabled, sessions: [] };
  const scope = requireTenant(input);
  if (!scope.ok) return { ...scope, sessions: [] };

  const physicalCourtId = trimId(input.physicalCourtId);
  if (physicalCourtId) {
    const court = requirePhysicalCourtId(physicalCourtId);
    if (!court.ok) return { ...court, sessions: [] };
  }

  const result = await rpcListResourceSessions({
    tenantId: scope.tenantId,
    physicalCourtId: physicalCourtId || null,
    status: trimId(input.status) || null,
  });
  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code || COURT_RESOURCE_CODE.DATA_UNAVAILABLE,
      message: result?.message || result?.error || "Failed to list resource sessions.",
      sessions: [],
    };
  }
  return {
    ok: true,
    code: LIVE_RUNTIME_CODE.OK,
    sessions: Array.isArray(result.sessions) ? result.sessions : [],
  };
}

export {
  COURT_OCCUPANCY_STATE,
  COURT_OPERATIONAL_STATE,
  RESOURCE_SESSION_SOURCE_TYPE,
  operationalStateAllowsUse,
};
