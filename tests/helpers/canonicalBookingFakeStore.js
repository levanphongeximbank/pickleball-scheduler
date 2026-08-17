/**
 * In-memory fake for Batch 3 canonical booking RPC semantics (unit tests).
 * Models capacity + booking business separation without Postgres.
 */
import { createHash, randomUUID } from "node:crypto";

function fingerprint(operation, payload) {
  return createHash("sha256").update(JSON.stringify({ operation, payload })).digest("hex");
}

export function createCanonicalBookingFakeStore(seed = {}) {
  const clubs = new Map(Object.entries(seed.clubs || { "club-a": "tenant-a" }));
  const courts = new Map(
    Object.entries(seed.courts || {
      "11111111-1111-4111-8111-111111111111": { tenantId: "tenant-a", accessClubs: ["club-a"] },
      "22222222-2222-4222-8222-222222222222": { tenantId: "tenant-a", accessClubs: ["club-a"] },
      "33333333-3333-4333-8333-333333333333": { tenantId: "tenant-b", accessClubs: ["club-b"] },
    })
  );
  const reservations = new Map();
  const bookings = new Map();
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

  function serialize(booking) {
    return {
      bookingId: booking.bookingId,
      tenantId: booking.tenantId,
      clubId: booking.clubId,
      physicalCourtId: booking.physicalCourtId,
      reservationId: booking.reservationId,
      startsAt: booking.startsAt,
      endsAt: booking.endsAt,
      lifecycleStatus: booking.lifecycleStatus,
      bookingCode: booking.bookingCode,
      bookingType: booking.bookingType,
      customerName: booking.customerName,
      customerPhone: booking.customerPhone,
      customerType: booking.customerType,
      customerRef: booking.customerRef,
      totalAmount: booking.totalAmount,
      depositAmount: booking.depositAmount,
      paidAmount: booking.paidAmount,
      paymentStatus: booking.paymentStatus,
      note: booking.note,
      courtDisplayName: booking.courtDisplayName,
      version: booking.version,
      createdAt: booking.createdAt,
      updatedAt: booking.updatedAt,
      cancelledAt: booking.cancelledAt,
      identityAuthority: "physicalCourtId",
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

  function storeCommand(tenantId, requestId, operation, fp, result, bookingId, reservationIds) {
    commands.set(`${tenantId}::${requestId}`, {
      operation,
      fingerprint: fp,
      result,
      bookingId,
      reservationIds,
    });
  }

  function reserve(tenantId, clubId, physicalCourtId, ownerId, startsAt, endsAt) {
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
      ownerType: "booking",
      ownerId,
      startsAt,
      endsAt,
      status: "active",
    });
    return { ok: true, reservationId };
  }

  function releaseOwn(tenantId, bookingId, reservationId) {
    const row = reservations.get(reservationId);
    if (!row || row.tenantId !== tenantId) return { ok: true, released: false };
    if (row.ownerType !== "booking" || row.ownerId !== bookingId) {
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
    const fp = fingerprint("create", {
      tenantId,
      clubId,
      physicalCourtId,
      startsAt,
      endsAt,
    });
    const replay = replayOrConflict(tenantId, requestId, "create", fp);
    if (replay) return replay;

    const bookingId = randomUUID();
    // Simulate booking persist failure path for tests via payload.__failPersistAfterReserve
    const reserved = reserve(tenantId, clubId, physicalCourtId, bookingId, startsAt, endsAt);
    if (!reserved.ok) return reserved;

    if (payload.__failPersistAfterReserve) {
      // Compensation: release exactly the reservation just acquired
      releaseOwn(tenantId, bookingId, reserved.reservationId);
      return { ok: false, code: "BOOKING_PERSIST_FAILED", compensated: true };
    }

    const now = new Date().toISOString();
    const booking = {
      bookingId,
      tenantId,
      clubId,
      physicalCourtId,
      reservationId: reserved.reservationId,
      startsAt,
      endsAt,
      lifecycleStatus: payload.lifecycleStatus || "confirmed",
      bookingCode: payload.bookingCode || `BK-${bookingId.slice(0, 8)}`,
      bookingType: payload.bookingType || "single",
      customerName: payload.customerName || "",
      customerPhone: payload.customerPhone || "",
      customerType: payload.customerType || "walk_in",
      customerRef: payload.customerRef || null,
      totalAmount: Number(payload.totalAmount || 0),
      depositAmount: Number(payload.depositAmount || 0),
      paidAmount: Number(payload.paidAmount || 0),
      paymentStatus: payload.paymentStatus || "unpaid",
      note: payload.note || "",
      courtDisplayName: payload.courtDisplayName || "",
      version: 1,
      createdAt: now,
      updatedAt: now,
      cancelledAt: null,
    };
    bookings.set(bookingId, booking);
    const result = {
      ok: true,
      code: "OK",
      booking: serialize(booking),
      bookingId,
      reservationId: reserved.reservationId,
      physicalCourtId,
      replay: false,
    };
    storeCommand(tenantId, requestId, "create", fp, result, bookingId, [reserved.reservationId]);
    return result;
  }

  async function reschedule(args) {
    const tenantId = args.p_tenant_id;
    const bookingId = args.p_booking_id;
    const physicalCourtId = args.p_physical_court_id;
    const startsAt = args.p_starts_at;
    const endsAt = args.p_ends_at;
    const requestId = args.p_request_id;
    const expectedVersion = args.p_expected_version;
    const auth = assertAuth(tenantId);
    if (!auth.ok) return auth;
    const booking = bookings.get(bookingId);
    if (!booking || booking.tenantId !== tenantId) return { ok: false, code: "NOT_FOUND" };
    const fp = fingerprint("reschedule", { bookingId, physicalCourtId, startsAt, endsAt });
    const replay = replayOrConflict(tenantId, requestId, "reschedule", fp);
    if (replay) return replay;
    if (Number(expectedVersion) !== booking.version) {
      return { ok: false, code: "VERSION_CONFLICT", capacityPreserved: true };
    }
    if (booking.lifecycleStatus === "cancelled" || booking.lifecycleStatus === "completed") {
      return { ok: false, code: "INVALID_LIFECYCLE_STATUS", capacityPreserved: true };
    }

    const oldReservationId = booking.reservationId;
    // Atomic: release then reserve; on failure restore old (simulate txn rollback)
    const old = reservations.get(oldReservationId);
    const oldSnapshot = old ? { ...old } : null;
    if (old && old.status === "active") old.status = "released";

    const reserved = reserve(tenantId, booking.clubId, physicalCourtId, bookingId, startsAt, endsAt);
    if (!reserved.ok) {
      if (oldSnapshot) {
        reservations.set(oldReservationId, oldSnapshot);
      }
      return { ...reserved, capacityPreserved: true };
    }

    booking.physicalCourtId = physicalCourtId;
    booking.startsAt = startsAt;
    booking.endsAt = endsAt;
    booking.reservationId = reserved.reservationId;
    booking.version += 1;
    booking.updatedAt = new Date().toISOString();
    const result = {
      ok: true,
      code: "OK",
      booking: serialize(booking),
      bookingId,
      reservationId: reserved.reservationId,
      physicalCourtId,
      replay: false,
    };
    storeCommand(tenantId, requestId, "reschedule", fp, result, bookingId, [reserved.reservationId]);
    return result;
  }

  async function transfer(args) {
    const tenantId = args.p_tenant_id;
    const bookingId = args.p_booking_id;
    const newPhysicalCourtId = args.p_new_physical_court_id;
    const requestId = args.p_request_id;
    const expectedVersion = args.p_expected_version;
    const auth = assertAuth(tenantId);
    if (!auth.ok) return auth;
    const booking = bookings.get(bookingId);
    if (!booking || booking.tenantId !== tenantId) return { ok: false, code: "NOT_FOUND" };
    const fp = fingerprint("transfer", { bookingId, newPhysicalCourtId });
    const replay = replayOrConflict(tenantId, requestId, "transfer", fp);
    if (replay) return replay;
    if (Number(expectedVersion) !== booking.version) {
      return { ok: false, code: "VERSION_CONFLICT", capacityPreserved: true };
    }
    if (booking.physicalCourtId === newPhysicalCourtId) {
      return { ok: true, code: "OK", booking: serialize(booking), bookingId, replay: false };
    }

    // Reserve B first while A still held
    const reserved = reserve(
      tenantId,
      booking.clubId,
      newPhysicalCourtId,
      bookingId,
      booking.startsAt,
      booking.endsAt
    );
    if (!reserved.ok) {
      return { ...reserved, capacityPreserved: true };
    }
    releaseOwn(tenantId, bookingId, booking.reservationId);
    booking.physicalCourtId = newPhysicalCourtId;
    booking.reservationId = reserved.reservationId;
    booking.version += 1;
    booking.updatedAt = new Date().toISOString();
    const result = {
      ok: true,
      code: "OK",
      booking: serialize(booking),
      bookingId,
      reservationId: reserved.reservationId,
      physicalCourtId: newPhysicalCourtId,
      replay: false,
    };
    storeCommand(tenantId, requestId, "transfer", fp, result, bookingId, [reserved.reservationId]);
    return result;
  }

  async function cancel(args) {
    const tenantId = args.p_tenant_id;
    const bookingId = args.p_booking_id;
    const requestId = args.p_request_id;
    const auth = assertAuth(tenantId);
    if (!auth.ok) return auth;
    const booking = bookings.get(bookingId);
    if (!booking || booking.tenantId !== tenantId) return { ok: false, code: "NOT_FOUND" };
    const fp = fingerprint("cancel", { bookingId });
    const replay = replayOrConflict(tenantId, requestId, "cancel", fp);
    if (replay) return replay;

    if (booking.lifecycleStatus === "cancelled") {
      if (booking.reservationId) releaseOwn(tenantId, bookingId, booking.reservationId);
      const result = {
        ok: true,
        code: "OK",
        booking: serialize(booking),
        bookingId,
        replay: false,
        idempotent: true,
      };
      storeCommand(tenantId, requestId, "cancel", fp, result, bookingId, []);
      return result;
    }

    if (booking.reservationId) {
      const released = releaseOwn(tenantId, bookingId, booking.reservationId);
      if (!released.ok) return released;
    }
    booking.lifecycleStatus = "cancelled";
    booking.cancelledAt = new Date().toISOString();
    booking.version += 1;
    booking.updatedAt = booking.cancelledAt;
    const result = {
      ok: true,
      code: "OK",
      booking: serialize(booking),
      bookingId,
      replay: false,
    };
    storeCommand(tenantId, requestId, "cancel", fp, result, bookingId, []);
    return result;
  }

  async function updateLifecycle(args) {
    const tenantId = args.p_tenant_id;
    const bookingId = args.p_booking_id;
    const lifecycleStatus = args.p_lifecycle_status;
    const expectedVersion = args.p_expected_version;
    const auth = assertAuth(tenantId);
    if (!auth.ok) return auth;
    const booking = bookings.get(bookingId);
    if (!booking || booking.tenantId !== tenantId) return { ok: false, code: "NOT_FOUND" };
    if (Number(expectedVersion) !== booking.version) {
      return { ok: false, code: "VERSION_CONFLICT" };
    }
    if (booking.lifecycleStatus === "cancelled") {
      return { ok: false, code: "INVALID_LIFECYCLE_STATUS" };
    }
    booking.lifecycleStatus = lifecycleStatus;
    booking.version += 1;
    booking.updatedAt = new Date().toISOString();
    return {
      ok: true,
      code: "OK",
      booking: serialize(booking),
      capacityMutated: false,
      replay: false,
    };
  }

  async function get(args) {
    const auth = assertAuth(args.p_tenant_id);
    if (!auth.ok) return auth;
    const booking = bookings.get(args.p_booking_id);
    if (!booking || booking.tenantId !== args.p_tenant_id) return { ok: false, code: "NOT_FOUND" };
    return { ok: true, code: "OK", booking: serialize(booking) };
  }

  async function list(args) {
    const scope = assertScope(args.p_tenant_id, args.p_club_id);
    if (!scope.ok) return { ...scope, bookings: [] };
    const rows = [...bookings.values()]
      .filter((b) => b.tenantId === args.p_tenant_id && b.clubId === args.p_club_id)
      .map(serialize);
    return { ok: true, code: "OK", bookings: rows };
  }

  function rpcClient() {
    return {
      async rpc(name, args) {
        const map = {
          court_operations_booking_create: create,
          court_operations_booking_reschedule: reschedule,
          court_operations_booking_transfer_court: transfer,
          court_operations_booking_cancel: cancel,
          court_operations_booking_update_lifecycle: updateLifecycle,
          court_operations_booking_get: get,
          court_operations_booking_list: list,
        };
        const fn = map[name];
        if (!fn) return { data: null, error: { message: `function ${name} does not exist`, code: "PGRST202" } };
        return { data: await fn(args), error: null };
      },
    };
  }

  return {
    setActor,
    rpcClient,
    bookings,
    reservations,
    courts,
  };
}
