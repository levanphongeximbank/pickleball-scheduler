/**
 * In-memory fake for Batch 4 canonical resource block RPC semantics (unit tests).
 * Models capacity + resource-block business separation without Postgres.
 * Shared capacity map can also hold booking/competition reservations for conflict tests.
 */
import { createHash, randomUUID } from "node:crypto";

function fingerprint(operation, payload) {
  return createHash("sha256").update(JSON.stringify({ operation, payload })).digest("hex");
}

function mapBlockTypeToOwnerType(blockType) {
  const type = String(blockType || "").trim().toUpperCase();
  if (type === "MAINTENANCE") return "maintenance";
  if (type === "OPERATIONAL_BLOCK") return "operations";
  return null;
}

export function createCanonicalResourceBlockFakeStore(seed = {}) {
  const clubs = new Map(Object.entries(seed.clubs || { "club-a": "tenant-a" }));
  const courts = new Map(
    Object.entries(seed.courts || {
      "11111111-1111-4111-8111-111111111111": { tenantId: "tenant-a", accessClubs: ["club-a"] },
      "22222222-2222-4222-8222-222222222222": { tenantId: "tenant-a", accessClubs: ["club-a"] },
      "33333333-3333-4333-8333-333333333333": { tenantId: "tenant-b", accessClubs: ["club-b"] },
    })
  );
  const reservations = new Map();
  const resourceBlocks = new Map();
  const commands = new Map();
  let authUid = seed.authUid || "user-1";
  let actorTenant = seed.actorTenant || "tenant-a";

  function setActor({ uid = "user-1", tenantId = "tenant-a" } = {}) {
    authUid = uid;
    actorTenant = tenantId;
  }

  function assertAuth(tenantId) {
    if (!authUid) return { ok: false, code: "UNAUTHENTICATED" };
    if (!tenantId) return { ok: false, code: "TENANT_MISMATCH" };
    if (tenantId !== actorTenant) return { ok: false, code: "TENANT_FORBIDDEN" };
    return { ok: true };
  }

  function assertScope(tenantId, clubId) {
    const auth = assertAuth(tenantId);
    if (!auth.ok) return auth;
    if (!clubId) return { ok: false, code: "MISSING_CLUB_ID" };
    const clubTenant = clubs.get(clubId);
    if (!clubTenant) return { ok: false, code: "OUT_OF_SCOPE" };
    if (clubTenant !== tenantId) return { ok: false, code: "TENANT_MISMATCH" };
    return { ok: true };
  }

  function overlaps(aStart, aEnd, bStart, bEnd) {
    return aStart < bEnd && bStart < aEnd;
  }

  function hasConflict(tenantId, physicalCourtId, startsAt, endsAt, ignoreReservationId = null) {
    for (const row of reservations.values()) {
      if (row.status !== "active") continue;
      if (row.tenantId !== tenantId || row.physicalCourtId !== physicalCourtId) continue;
      if (ignoreReservationId && row.reservationId === ignoreReservationId) continue;
      if (overlaps(new Date(row.startsAt), new Date(row.endsAt), new Date(startsAt), new Date(endsAt))) {
        return true;
      }
    }
    return false;
  }

  function assertAccess(tenantId, clubId, physicalCourtId) {
    const court = courts.get(physicalCourtId);
    if (!court) return { ok: false, code: "UNKNOWN_COURT", physicalCourtId };
    if (court.tenantId !== tenantId) return { ok: false, code: "CROSS_TENANT_COURT", physicalCourtId };
    if (!court.accessClubs.includes(clubId)) {
      return { ok: false, code: "OUT_OF_SCOPE", physicalCourtId };
    }
    return { ok: true };
  }

  function serialize(block) {
    return {
      resourceBlockId: block.resourceBlockId,
      tenantId: block.tenantId,
      clubId: block.clubId,
      physicalCourtId: block.physicalCourtId,
      reservationId: block.reservationId,
      blockType: block.blockType,
      startsAt: block.startsAt,
      endsAt: block.endsAt,
      lifecycleStatus: block.lifecycleStatus,
      reason: block.reason,
      operatorNotes: block.operatorNotes,
      courtDisplayName: block.courtDisplayName,
      version: block.version,
      createdAt: block.createdAt,
      updatedAt: block.updatedAt,
      cancelledAt: block.cancelledAt,
      identityAuthority: "physicalCourtId",
      capacityOwnerType: mapBlockTypeToOwnerType(block.blockType),
      capacityOwnerSubType: "resource_block",
    };
  }

  function replayOrConflict(tenantId, requestId, operation, fp) {
    const key = `${tenantId}::${requestId}`;
    const existing = commands.get(key);
    if (!existing) return null;
    if (existing.operation !== operation || existing.fingerprint !== fp) {
      return { ok: false, code: "IDEMPOTENCY_CONFLICT" };
    }
    return { ...existing.result, replay: true };
  }

  function storeCommand(tenantId, requestId, operation, fp, result, resourceBlockId, reservationIds) {
    commands.set(`${tenantId}::${requestId}`, {
      operation,
      fingerprint: fp,
      result,
      resourceBlockId,
      reservationIds,
    });
  }

  function seedReservation({
    tenantId = "tenant-a",
    clubId = "club-a",
    physicalCourtId,
    ownerType,
    ownerId,
    startsAt,
    endsAt,
    status = "active",
  }) {
    const reservationId = randomUUID();
    reservations.set(reservationId, {
      reservationId,
      tenantId,
      clubId,
      physicalCourtId,
      ownerType,
      ownerId,
      ownerSubType: ownerType === "maintenance" || ownerType === "operations"
        ? "resource_block"
        : null,
      startsAt,
      endsAt,
      status,
    });
    return reservationId;
  }

  function reserve(tenantId, clubId, physicalCourtId, ownerType, ownerId, startsAt, endsAt) {
    const access = assertAccess(tenantId, clubId, physicalCourtId);
    if (!access.ok) return access;
    if (hasConflict(tenantId, physicalCourtId, startsAt, endsAt)) {
      return { ok: false, code: "FOREIGN_RESERVATION_CONFLICT" };
    }
    const reservationId = randomUUID();
    reservations.set(reservationId, {
      reservationId,
      tenantId,
      clubId,
      physicalCourtId,
      ownerType,
      ownerId,
      ownerSubType: "resource_block",
      startsAt,
      endsAt,
      status: "active",
    });
    return { ok: true, reservationId };
  }

  function releaseOwn(tenantId, resourceBlockId, ownerType, reservationId) {
    const row = reservations.get(reservationId);
    if (!row || row.tenantId !== tenantId) return { ok: true, released: false };
    if (row.ownerType !== ownerType || row.ownerId !== resourceBlockId) {
      return { ok: false, code: "FOREIGN_OWNER_RELEASE_DENIED" };
    }
    if (row.status === "active") {
      row.status = "released";
      row.releasedAt = new Date().toISOString();
    }
    return { ok: true, released: true };
  }

  async function create(args) {
    const tenantId = args.p_tenant_id;
    const clubId = args.p_club_id;
    const physicalCourtId = args.p_physical_court_id;
    const startsAt = args.p_starts_at;
    const endsAt = args.p_ends_at;
    const requestId = args.p_request_id;
    const payload = args.p_payload || {};
    const scope = assertScope(tenantId, clubId);
    if (!scope.ok) return scope;
    if (!physicalCourtId) return { ok: false, code: "MISSING_COURT_ID" };
    if (!requestId) return { ok: false, code: "MISSING_REQUEST_ID" };

    const blockType = String(payload.blockType || "").trim().toUpperCase();
    const ownerType = mapBlockTypeToOwnerType(blockType);
    if (!ownerType) return { ok: false, code: "INVALID_BLOCK_TYPE", blockType };

    const fp = fingerprint("create", {
      tenantId,
      clubId,
      physicalCourtId,
      startsAt,
      endsAt,
      blockType,
    });
    const replay = replayOrConflict(tenantId, requestId, "create", fp);
    if (replay) return replay;

    const resourceBlockId = randomUUID();
    const reserved = reserve(
      tenantId, clubId, physicalCourtId, ownerType, resourceBlockId, startsAt, endsAt
    );
    if (!reserved.ok) return reserved;

    if (payload.__failPersistAfterReserve) {
      releaseOwn(tenantId, resourceBlockId, ownerType, reserved.reservationId);
      return { ok: false, code: "RESOURCE_BLOCK_PERSIST_FAILED", compensated: true };
    }

    const now = new Date().toISOString();
    const block = {
      resourceBlockId,
      tenantId,
      clubId,
      physicalCourtId,
      reservationId: reserved.reservationId,
      blockType,
      startsAt,
      endsAt,
      lifecycleStatus: "active",
      reason: payload.reason || "",
      operatorNotes: payload.operatorNotes || "",
      courtDisplayName: payload.courtDisplayName || "",
      version: 1,
      createdAt: now,
      updatedAt: now,
      cancelledAt: null,
    };
    resourceBlocks.set(resourceBlockId, block);
    const result = {
      ok: true,
      code: "OK",
      resourceBlock: serialize(block),
      resourceBlockId,
      reservationId: reserved.reservationId,
      physicalCourtId,
      replay: false,
    };
    storeCommand(tenantId, requestId, "create", fp, result, resourceBlockId, [reserved.reservationId]);
    return result;
  }

  async function reschedule(args) {
    const tenantId = args.p_tenant_id;
    const resourceBlockId = args.p_resource_block_id;
    const physicalCourtId = args.p_physical_court_id;
    const startsAt = args.p_starts_at;
    const endsAt = args.p_ends_at;
    const requestId = args.p_request_id;
    const expectedVersion = args.p_expected_version;
    const payload = args.p_payload || {};
    const auth = assertAuth(tenantId);
    if (!auth.ok) return auth;
    const block = resourceBlocks.get(resourceBlockId);
    if (!block || block.tenantId !== tenantId) {
      return { ok: false, code: "RESOURCE_BLOCK_NOT_FOUND" };
    }
    const fp = fingerprint("reschedule", { resourceBlockId, physicalCourtId, startsAt, endsAt });
    const replay = replayOrConflict(tenantId, requestId, "reschedule", fp);
    if (replay) return replay;
    if (Number(expectedVersion) !== block.version) {
      return { ok: false, code: "VERSION_CONFLICT", capacityPreserved: true };
    }
    if (block.lifecycleStatus === "cancelled") {
      return { ok: false, code: "RESOURCE_BLOCK_CANCELLED", capacityPreserved: true };
    }

    const ownerType = mapBlockTypeToOwnerType(block.blockType);
    const oldReservationId = block.reservationId;
    const old = reservations.get(oldReservationId);
    const oldSnapshot = old ? { ...old } : null;
    if (old && old.status === "active") old.status = "released";

    const reserved = reserve(
      tenantId, block.clubId, physicalCourtId, ownerType, resourceBlockId, startsAt, endsAt
    );
    if (!reserved.ok) {
      if (oldSnapshot) {
        reservations.set(oldReservationId, oldSnapshot);
      }
      return { ...reserved, capacityPreserved: true };
    }

    block.physicalCourtId = physicalCourtId;
    block.startsAt = startsAt;
    block.endsAt = endsAt;
    block.reservationId = reserved.reservationId;
    if (payload.courtDisplayName != null && payload.courtDisplayName !== "") {
      block.courtDisplayName = payload.courtDisplayName;
    }
    block.version += 1;
    block.updatedAt = new Date().toISOString();
    const result = {
      ok: true,
      code: "OK",
      resourceBlock: serialize(block),
      resourceBlockId,
      reservationId: reserved.reservationId,
      physicalCourtId,
      replay: false,
    };
    storeCommand(tenantId, requestId, "reschedule", fp, result, resourceBlockId, [
      reserved.reservationId,
    ]);
    return result;
  }

  async function transfer(args) {
    const tenantId = args.p_tenant_id;
    const resourceBlockId = args.p_resource_block_id;
    const newPhysicalCourtId = args.p_new_physical_court_id;
    const requestId = args.p_request_id;
    const expectedVersion = args.p_expected_version;
    const auth = assertAuth(tenantId);
    if (!auth.ok) return auth;
    const block = resourceBlocks.get(resourceBlockId);
    if (!block || block.tenantId !== tenantId) {
      return { ok: false, code: "RESOURCE_BLOCK_NOT_FOUND" };
    }
    const fp = fingerprint("transfer", { resourceBlockId, newPhysicalCourtId });
    const replay = replayOrConflict(tenantId, requestId, "transfer", fp);
    if (replay) return replay;
    if (Number(expectedVersion) !== block.version) {
      return { ok: false, code: "VERSION_CONFLICT", capacityPreserved: true };
    }
    if (block.physicalCourtId === newPhysicalCourtId) {
      return {
        ok: true,
        code: "OK",
        resourceBlock: serialize(block),
        resourceBlockId,
        replay: false,
      };
    }

    const ownerType = mapBlockTypeToOwnerType(block.blockType);
    const reserved = reserve(
      tenantId,
      block.clubId,
      newPhysicalCourtId,
      ownerType,
      resourceBlockId,
      block.startsAt,
      block.endsAt
    );
    if (!reserved.ok) {
      return { ...reserved, capacityPreserved: true };
    }
    releaseOwn(tenantId, resourceBlockId, ownerType, block.reservationId);
    block.physicalCourtId = newPhysicalCourtId;
    block.reservationId = reserved.reservationId;
    block.version += 1;
    block.updatedAt = new Date().toISOString();
    const result = {
      ok: true,
      code: "OK",
      resourceBlock: serialize(block),
      resourceBlockId,
      reservationId: reserved.reservationId,
      physicalCourtId: newPhysicalCourtId,
      replay: false,
    };
    storeCommand(tenantId, requestId, "transfer", fp, result, resourceBlockId, [
      reserved.reservationId,
    ]);
    return result;
  }

  async function cancel(args) {
    const tenantId = args.p_tenant_id;
    const resourceBlockId = args.p_resource_block_id;
    const requestId = args.p_request_id;
    const auth = assertAuth(tenantId);
    if (!auth.ok) return auth;
    const block = resourceBlocks.get(resourceBlockId);
    if (!block || block.tenantId !== tenantId) {
      return { ok: false, code: "RESOURCE_BLOCK_NOT_FOUND" };
    }
    const fp = fingerprint("cancel", { resourceBlockId });
    const replay = replayOrConflict(tenantId, requestId, "cancel", fp);
    if (replay) return replay;

    const ownerType = mapBlockTypeToOwnerType(block.blockType);
    if (block.lifecycleStatus === "cancelled") {
      if (block.reservationId) {
        releaseOwn(tenantId, resourceBlockId, ownerType, block.reservationId);
      }
      const result = {
        ok: true,
        code: "OK",
        resourceBlock: serialize(block),
        resourceBlockId,
        replay: false,
        alreadyCancelled: true,
      };
      storeCommand(tenantId, requestId, "cancel", fp, result, resourceBlockId, []);
      return result;
    }

    if (block.reservationId) {
      const released = releaseOwn(tenantId, resourceBlockId, ownerType, block.reservationId);
      if (!released.ok) return released;
    }
    block.lifecycleStatus = "cancelled";
    block.cancelledAt = new Date().toISOString();
    block.version += 1;
    block.updatedAt = block.cancelledAt;
    const result = {
      ok: true,
      code: "OK",
      resourceBlock: serialize(block),
      resourceBlockId,
      replay: false,
      alreadyCancelled: false,
    };
    storeCommand(tenantId, requestId, "cancel", fp, result, resourceBlockId, []);
    return result;
  }

  async function get(args) {
    const auth = assertAuth(args.p_tenant_id);
    if (!auth.ok) return auth;
    const block = resourceBlocks.get(args.p_resource_block_id);
    if (!block || block.tenantId !== args.p_tenant_id) {
      return { ok: false, code: "RESOURCE_BLOCK_NOT_FOUND" };
    }
    return { ok: true, code: "OK", resourceBlock: serialize(block) };
  }

  async function list(args) {
    const scope = assertScope(args.p_tenant_id, args.p_club_id);
    if (!scope.ok) return { ...scope, resourceBlocks: [] };
    const includeCancelled = args.p_include_cancelled === true;
    const courtFilter = Array.isArray(args.p_physical_court_ids)
      ? new Set(args.p_physical_court_ids)
      : null;
    const typeFilter = Array.isArray(args.p_block_types)
      ? new Set(args.p_block_types.map((t) => String(t).toUpperCase()))
      : null;
    const rows = [...resourceBlocks.values()]
      .filter((b) => b.tenantId === args.p_tenant_id && b.clubId === args.p_club_id)
      .filter((b) => includeCancelled || b.lifecycleStatus !== "cancelled")
      .filter((b) => !courtFilter || courtFilter.has(b.physicalCourtId))
      .filter((b) => !typeFilter || typeFilter.has(b.blockType))
      .map(serialize);
    return { ok: true, code: "OK", resourceBlocks: rows };
  }

  function rpcClient() {
    return {
      async rpc(name, args) {
        const map = {
          court_operations_resource_block_create: create,
          court_operations_resource_block_reschedule: reschedule,
          court_operations_resource_block_transfer_court: transfer,
          court_operations_resource_block_cancel: cancel,
          court_operations_resource_block_get: get,
          court_operations_resource_block_list: list,
        };
        const fn = map[name];
        if (!fn) {
          return {
            data: null,
            error: { message: `function ${name} does not exist`, code: "PGRST202" },
          };
        }
        return { data: await fn(args), error: null };
      },
    };
  }

  /**
   * Capacity-level acquire for cross-owner conflict proofs (booking/competition
   * vs resource block) through the same SSOT conflict engine.
   */
  function tryAcquireCapacity({
    tenantId = "tenant-a",
    clubId = "club-a",
    physicalCourtId,
    ownerType,
    ownerId,
    startsAt,
    endsAt,
  }) {
    return reserve(tenantId, clubId, physicalCourtId, ownerType, ownerId, startsAt, endsAt);
  }

  return {
    setActor,
    rpcClient,
    resourceBlocks,
    reservations,
    courts,
    seedReservation,
    tryAcquireCapacity,
  };
}
