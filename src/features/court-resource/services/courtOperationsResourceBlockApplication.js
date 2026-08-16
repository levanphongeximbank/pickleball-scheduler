/**
 * Court Operations Resource Block Application Service.
 *
 * UI → this boundary → CourtResourceGateway (inventory/availability)
 *                   → canonical resource block RPCs (business + atomic capacity)
 *
 * Canonical path is fail-closed. No blob overlap checkers, no court status
 * as capacity, no bookingType=maintenance, and no default-club fallbacks.
 */
import { isCanonicalPhysicalCourtId } from "../contracts/canonicalPhysicalCourt.js";
import { COURT_RESOURCE_CODE } from "../constants/courtResourceContract.js";
import {
  CANONICAL_RESOURCE_BLOCK_LIFECYCLE_STATUS,
  CANONICAL_RESOURCE_BLOCK_TYPE,
  isCanonicalResourceBlocks,
  mapBlockTypeToOwnerType,
} from "../constants/canonicalResourceBlock.js";
import {
  getCourtAvailability,
  listEligibleCourts,
} from "./courtResourceGateway.js";
import {
  rpcCancelResourceBlock,
  rpcCreateResourceBlock,
  rpcGetResourceBlock,
  rpcListResourceBlocks,
  rpcRescheduleResourceBlock,
  rpcTransferResourceBlockCourt,
} from "./canonicalResourceBlockClient.js";
import { requireCanonicalClubScope } from "../scope/courtOperationsScope.js";

function trimId(value) {
  if (value == null) return "";
  return String(value).trim();
}

function fail(code, message, extra = {}) {
  return { ok: false, code, message, ...extra };
}

function windowToTimestamps(input = {}) {
  const startsAt = trimId(input.startsAt);
  const endsAt = trimId(input.endsAt);
  if (startsAt && endsAt) {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      return null;
    }
    return { startsAt: start.toISOString(), endsAt: end.toISOString() };
  }
  const date = trimId(input.date);
  const startTime = trimId(input.startTime);
  const endTime = trimId(input.endTime);
  if (!date || !startTime || !endTime) return null;
  const start = new Date(`${date}T${startTime}:00`);
  const end = new Date(`${date}T${endTime}:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
    return null;
  }
  return { startsAt: start.toISOString(), endsAt: end.toISOString() };
}

function requireTenantClub(input = {}) {
  const scoped = requireCanonicalClubScope(input);
  if (!scoped.ok) {
    return fail(
      scoped.code || COURT_RESOURCE_CODE.TENANT_MISMATCH,
      scoped.error || "tenantId is required — fail closed (no venueId invent, no default-club)."
    );
  }
  return { ok: true, tenantId: scoped.tenantId, clubId: scoped.clubId };
}

function requirePhysicalCourtId(value) {
  const physicalCourtId = trimId(value);
  if (!physicalCourtId) {
    return fail(
      COURT_RESOURCE_CODE.MISSING_COURT_ID,
      "physicalCourtId is required — legacy courtId / labels are not identity."
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

function normalizeBlockType(value) {
  const type = String(value || "").trim().toUpperCase();
  if (type === CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE) {
    return CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE;
  }
  if (type === CANONICAL_RESOURCE_BLOCK_TYPE.OPERATIONAL_BLOCK) {
    return CANONICAL_RESOURCE_BLOCK_TYPE.OPERATIONAL_BLOCK;
  }
  return null;
}

function buildPayload(input = {}) {
  const blockType = normalizeBlockType(input.blockType);
  return {
    blockType: blockType || undefined,
    reason: input.reason || "",
    operatorNotes: input.operatorNotes || input.note || "",
    courtDisplayName: input.courtDisplayName || input.courtName || "",
  };
}

function mapResourceBlockResult(result) {
  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code || COURT_RESOURCE_CODE.DATA_UNAVAILABLE,
      message: result?.message || result?.error || "Canonical resource block command failed.",
      capacityPreserved: result?.capacityPreserved === true,
      ...result,
    };
  }
  const resourceBlock = result.resourceBlock || null;
  return {
    ok: true,
    code: result.code || COURT_RESOURCE_CODE.OK,
    resourceBlock,
    resourceBlockId: resourceBlock?.resourceBlockId || result.resourceBlockId || null,
    reservationId: result.reservationId || resourceBlock?.reservationId || null,
    physicalCourtId: result.physicalCourtId || resourceBlock?.physicalCourtId || null,
    replay: result.replay === true,
    message: result.message,
  };
}

function defaultRequestId(prefix) {
  return `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function requireCanonicalEnabled(input = {}) {
  if (!isCanonicalResourceBlocks() && input.forceCanonical !== true) {
    return fail(
      COURT_RESOURCE_CODE.CANONICAL_PATH_UNAVAILABLE,
      "Canonical resource blocks path is not enabled."
    );
  }
  return { ok: true };
}

/**
 * List eligible courts for Resource Block UI — gateway only.
 */
export async function listResourceBlockEligibleCourts(input = {}) {
  const scope = requireTenantClub(input);
  if (!scope.ok) return { ...scope, courts: [] };
  return listEligibleCourts({
    tenantId: scope.tenantId,
    clubId: scope.clubId,
    clusterId: trimId(input.clusterId) || undefined,
  });
}

/**
 * Availability for Resource Block — gateway canonical capacity only.
 */
export async function getResourceBlockCourtAvailability(input = {}) {
  const scope = requireTenantClub(input);
  if (!scope.ok) return scope;
  const court = requirePhysicalCourtId(input.physicalCourtId || input.physicalCourtIds?.[0]);
  if (!court.ok) return court;
  const window = windowToTimestamps(input);
  if (!window) {
    return fail(
      COURT_RESOURCE_CODE.MISSING_WINDOW,
      "startsAt/endsAt or date+startTime+endTime are required."
    );
  }
  const blockType = normalizeBlockType(input.blockType) || CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE;
  const ownerType = mapBlockTypeToOwnerType(blockType);
  return getCourtAvailability({
    tenantId: scope.tenantId,
    clubId: scope.clubId,
    physicalCourtId: court.physicalCourtId,
    physicalCourtIds: [court.physicalCourtId],
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    owner: input.owner || {
      type: ownerType,
      id: trimId(input.resourceBlockId) || "preview",
    },
  });
}

/**
 * Create resource block (MAINTENANCE or OPERATIONAL_BLOCK). Atomic reserve + persist.
 */
export async function createResourceBlock(input = {}) {
  const enabled = requireCanonicalEnabled(input);
  if (!enabled.ok) return enabled;
  const scope = requireTenantClub(input);
  if (!scope.ok) return scope;
  const court = requirePhysicalCourtId(input.physicalCourtId);
  if (!court.ok) return court;
  if (trimId(input.courtLabel) && !trimId(input.physicalCourtId)) {
    return fail(
      COURT_RESOURCE_CODE.SYNTHETIC_COURT_DENIED,
      "court label cannot create canonical Resource Block."
    );
  }
  const blockType = normalizeBlockType(input.blockType);
  if (!blockType) {
    return fail(
      COURT_RESOURCE_CODE.INVALID_INPUT,
      "blockType must be MAINTENANCE or OPERATIONAL_BLOCK."
    );
  }
  const window = windowToTimestamps(input);
  if (!window) {
    return fail(
      COURT_RESOURCE_CODE.MISSING_WINDOW,
      "startsAt/endsAt or date+startTime+endTime are required."
    );
  }
  const requestId = trimId(input.requestId) || defaultRequestId("resource-block-create");
  const result = await rpcCreateResourceBlock({
    tenantId: scope.tenantId,
    clubId: scope.clubId,
    physicalCourtId: court.physicalCourtId,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    requestId,
    payload: buildPayload({ ...input, blockType }),
  });
  return mapResourceBlockResult(result);
}

/**
 * Reschedule time and/or court (atomic). Failed reschedule preserves old capacity.
 */
export async function rescheduleResourceBlock(input = {}) {
  const enabled = requireCanonicalEnabled(input);
  if (!enabled.ok) return enabled;
  const tenantId = trimId(input.tenantId);
  if (!tenantId) {
    return fail(COURT_RESOURCE_CODE.TENANT_MISMATCH, "tenantId is required — fail closed.");
  }
  const resourceBlockId = trimId(input.resourceBlockId);
  if (!resourceBlockId) {
    return fail(COURT_RESOURCE_CODE.INVALID_INPUT, "resourceBlockId is required.");
  }
  const court = requirePhysicalCourtId(input.physicalCourtId);
  if (!court.ok) return court;
  const window = windowToTimestamps(input);
  if (!window) {
    return fail(
      COURT_RESOURCE_CODE.MISSING_WINDOW,
      "startsAt/endsAt or date+startTime+endTime are required."
    );
  }
  const requestId =
    trimId(input.requestId) || defaultRequestId(`resource-block-reschedule:${resourceBlockId}`);
  const result = await rpcRescheduleResourceBlock({
    tenantId,
    resourceBlockId,
    physicalCourtId: court.physicalCourtId,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    expectedVersion: Number(input.expectedVersion ?? input.version),
    requestId,
    payload: buildPayload(input),
  });
  return mapResourceBlockResult(result);
}

/** Alias matching booking naming. */
export const updateResourceBlock = rescheduleResourceBlock;

/**
 * Transfer court A → B preserving resourceBlockId. Failed transfer preserves A.
 */
export async function transferResourceBlock(input = {}) {
  const enabled = requireCanonicalEnabled(input);
  if (!enabled.ok) return enabled;
  const tenantId = trimId(input.tenantId);
  if (!tenantId) {
    return fail(COURT_RESOURCE_CODE.TENANT_MISMATCH, "tenantId is required — fail closed.");
  }
  const resourceBlockId = trimId(input.resourceBlockId);
  if (!resourceBlockId) {
    return fail(COURT_RESOURCE_CODE.INVALID_INPUT, "resourceBlockId is required.");
  }
  const court = requirePhysicalCourtId(input.newPhysicalCourtId || input.physicalCourtId);
  if (!court.ok) return court;
  const requestId =
    trimId(input.requestId) || defaultRequestId(`resource-block-transfer:${resourceBlockId}`);
  const result = await rpcTransferResourceBlockCourt({
    tenantId,
    resourceBlockId,
    newPhysicalCourtId: court.physicalCourtId,
    expectedVersion: Number(input.expectedVersion ?? input.version),
    requestId,
  });
  return mapResourceBlockResult(result);
}

/**
 * Cancel resource block + release owned capacity. Idempotent.
 * lifecycle cancelled is the canonical cancelled/released status.
 */
export async function cancelResourceBlock(input = {}) {
  const enabled = requireCanonicalEnabled(input);
  if (!enabled.ok) return enabled;
  const tenantId = trimId(input.tenantId);
  if (!tenantId) {
    return fail(COURT_RESOURCE_CODE.TENANT_MISMATCH, "tenantId is required — fail closed.");
  }
  const resourceBlockId = trimId(input.resourceBlockId);
  if (!resourceBlockId) {
    return fail(COURT_RESOURCE_CODE.INVALID_INPUT, "resourceBlockId is required.");
  }
  const requestId =
    trimId(input.requestId) || defaultRequestId(`resource-block-cancel:${resourceBlockId}`);
  const result = await rpcCancelResourceBlock({
    tenantId,
    resourceBlockId,
    requestId,
    releaseReason: input.releaseReason || "resource_block_cancelled",
  });
  return mapResourceBlockResult(result);
}

export async function getResourceBlock(input = {}) {
  const tenantId = trimId(input.tenantId);
  if (!tenantId) {
    return fail(COURT_RESOURCE_CODE.TENANT_MISMATCH, "tenantId is required — fail closed.");
  }
  const resourceBlockId = trimId(input.resourceBlockId);
  if (!resourceBlockId) {
    return fail(COURT_RESOURCE_CODE.INVALID_INPUT, "resourceBlockId is required.");
  }
  return mapResourceBlockResult(await rpcGetResourceBlock({ tenantId, resourceBlockId }));
}

export async function listResourceBlocks(input = {}) {
  const scope = requireTenantClub(input);
  if (!scope.ok) return { ...scope, resourceBlocks: [] };
  const result = await rpcListResourceBlocks({
    tenantId: scope.tenantId,
    clubId: scope.clubId,
    from: input.from || null,
    to: input.to || null,
    physicalCourtIds: input.physicalCourtIds || null,
    blockTypes: input.blockTypes || null,
    includeCancelled: input.includeCancelled === true,
  });
  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code || COURT_RESOURCE_CODE.DATA_UNAVAILABLE,
      message: result?.message || result?.error || "Failed to list resource blocks.",
      resourceBlocks: [],
    };
  }
  return {
    ok: true,
    code: result.code || COURT_RESOURCE_CODE.OK,
    resourceBlocks: Array.isArray(result.resourceBlocks) ? result.resourceBlocks : [],
  };
}

export {
  CANONICAL_RESOURCE_BLOCK_LIFECYCLE_STATUS,
  CANONICAL_RESOURCE_BLOCK_TYPE,
};
