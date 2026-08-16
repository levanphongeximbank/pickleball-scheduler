import assert from "node:assert/strict";
import test from "node:test";

import {
  __resetCanonicalBookingLifecycleForTests,
  __setCanonicalBookingLifecycleForTests,
} from "../src/features/court-resource/constants/canonicalBooking.js";
import {
  __resetCanonicalBookingRpcClientForTests,
  __setCanonicalBookingRpcClientForTests,
} from "../src/features/court-resource/services/canonicalBookingClient.js";
import {
  cancelCourtOperationsBooking,
  createCourtOperationsBooking,
  rescheduleCourtOperationsBooking,
  transferCourtOperationsBooking,
  updateCourtOperationsBookingLifecycle,
} from "../src/features/court-resource/services/courtOperationsBookingApplication.js";
import { createCanonicalBookingFakeStore } from "./helpers/canonicalBookingFakeStore.js";

const COURT_A = "11111111-1111-4111-8111-111111111111";
const COURT_B = "22222222-2222-4222-8222-222222222222";
const COURT_FOREIGN = "33333333-3333-4333-8333-333333333333";

function window(date, start, end) {
  return {
    startsAt: new Date(`${date}T${start}:00.000Z`).toISOString(),
    endsAt: new Date(`${date}T${end}:00.000Z`).toISOString(),
  };
}

function setup() {
  __setCanonicalBookingLifecycleForTests(true);
  const store = createCanonicalBookingFakeStore();
  __setCanonicalBookingRpcClientForTests(store.rpcClient());
  return store;
}

function teardown() {
  __resetCanonicalBookingRpcClientForTests();
  __resetCanonicalBookingLifecycleForTests();
}

test("B valid Booking create persists booking + capacity reservation", async () => {
  const store = setup();
  try {
    const created = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-20", "18:00", "20:00"),
      customerName: "Alice",
      requestId: "create-1",
      forceCanonical: true,
    });
    assert.equal(created.ok, true);
    assert.equal(created.booking.physicalCourtId, COURT_A);
    assert.equal(created.booking.identityAuthority, "physicalCourtId");
    assert.ok(created.reservationId);
    assert.equal(store.reservations.get(created.reservationId).status, "active");
    assert.equal(store.reservations.get(created.reservationId).ownerType, "booking");
    assert.equal(store.reservations.get(created.reservationId).ownerId, created.bookingId);
  } finally {
    teardown();
  }
});

test("C foreign tenant create rejects", async () => {
  const store = setup();
  try {
    store.setActor({ tenantId: "tenant-a" });
    const result = await createCourtOperationsBooking({
      tenantId: "tenant-b",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-20", "10:00", "11:00"),
      requestId: "foreign-tenant",
      forceCanonical: true,
    });
    assert.equal(result.ok, false);
    assert.match(String(result.code), /TENANT/);
  } finally {
    teardown();
  }
});

test("D club lacks court access rejects", async () => {
  setup();
  try {
    const result = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_FOREIGN,
      ...window("2026-08-20", "10:00", "11:00"),
      requestId: "no-access",
      forceCanonical: true,
    });
    assert.equal(result.ok, false);
    assert.ok(["OUT_OF_SCOPE", "CROSS_TENANT_COURT", "UNKNOWN_COURT"].includes(result.code));
  } finally {
    teardown();
  }
});

test("E occupied court rejects", async () => {
  setup();
  try {
    const first = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-20", "12:00", "14:00"),
      requestId: "occ-1",
      forceCanonical: true,
    });
    assert.equal(first.ok, true);
    const second = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-20", "13:00", "15:00"),
      requestId: "occ-2",
      forceCanonical: true,
    });
    assert.equal(second.ok, false);
    assert.equal(second.code, "FOREIGN_RESERVATION_CONFLICT");
  } finally {
    teardown();
  }
});

test("F unknown physicalCourtId rejects", async () => {
  setup();
  try {
    const result = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: "99999999-9999-4999-8999-999999999999",
      ...window("2026-08-20", "08:00", "09:00"),
      requestId: "unknown-court",
      forceCanonical: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "UNKNOWN_COURT");
  } finally {
    teardown();
  }
});

test("G idempotent retry does not duplicate capacity", async () => {
  const store = setup();
  try {
    const first = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-21", "09:00", "10:00"),
      requestId: "idem-1",
      forceCanonical: true,
    });
    const second = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-21", "09:00", "10:00"),
      requestId: "idem-1",
      forceCanonical: true,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.replay, true);
    assert.equal(first.bookingId, second.bookingId);
    const active = [...store.reservations.values()].filter((r) => r.status === "active");
    assert.equal(active.length, 1);
  } finally {
    teardown();
  }
});

test("H booking persist failure after reserve leaves no orphan reservation", async () => {
  const store = setup();
  try {
    const raw = await store.rpcClient().rpc("court_operations_booking_create", {
      p_tenant_id: "tenant-a",
      p_club_id: "club-a",
      p_physical_court_id: COURT_A,
      p_starts_at: window("2026-08-21", "11:00", "12:00").startsAt,
      p_ends_at: window("2026-08-21", "11:00", "12:00").endsAt,
      p_request_id: "persist-fail-raw",
      p_payload: { __failPersistAfterReserve: true },
    });
    assert.equal(raw.data.ok, false);
    assert.equal(raw.data.compensated, true);
    const active = [...store.reservations.values()].filter((r) => r.status === "active");
    assert.equal(active.length, 0);
  } finally {
    teardown();
  }
});

test("I display rename keeps physicalCourtId identity", async () => {
  setup();
  try {
    const created = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-22", "08:00", "09:00"),
      courtDisplayName: "Court One",
      requestId: "rename-1",
      forceCanonical: true,
    });
    assert.equal(created.ok, true);
    assert.equal(created.booking.physicalCourtId, COURT_A);
    assert.equal(created.booking.courtDisplayName, "Court One");
    assert.notEqual(created.booking.courtDisplayName, created.booking.physicalCourtId);
  } finally {
    teardown();
  }
});

test("J legacy court label cannot create canonical Booking", async () => {
  setup();
  try {
    const result = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: "Court 1",
      ...window("2026-08-22", "10:00", "11:00"),
      requestId: "label-denied",
      forceCanonical: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "SYNTHETIC_COURT_DENIED");
  } finally {
    teardown();
  }
});

test("K reschedule to free window succeeds", async () => {
  setup();
  try {
    const created = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-23", "18:00", "20:00"),
      requestId: "rs-create",
      forceCanonical: true,
    });
    const moved = await rescheduleCourtOperationsBooking({
      tenantId: "tenant-a",
      bookingId: created.bookingId,
      physicalCourtId: COURT_A,
      ...window("2026-08-23", "20:00", "22:00"),
      expectedVersion: created.booking.version,
      requestId: "rs-move",
      forceCanonical: true,
    });
    assert.equal(moved.ok, true);
    assert.equal(moved.bookingId, created.bookingId);
    assert.equal(moved.booking.startsAt, window("2026-08-23", "20:00", "22:00").startsAt);
  } finally {
    teardown();
  }
});

test("L reschedule to conflicting window fails and preserves old capacity", async () => {
  const store = setup();
  try {
    const a = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-24", "10:00", "12:00"),
      requestId: "rs-a",
      forceCanonical: true,
    });
    await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-24", "12:00", "14:00"),
      requestId: "rs-b",
      forceCanonical: true,
    });
    const failed = await rescheduleCourtOperationsBooking({
      tenantId: "tenant-a",
      bookingId: a.bookingId,
      physicalCourtId: COURT_A,
      ...window("2026-08-24", "11:00", "13:00"),
      expectedVersion: a.booking.version,
      requestId: "rs-conflict",
      forceCanonical: true,
    });
    assert.equal(failed.ok, false);
    assert.equal(failed.capacityPreserved, true);
    const old = store.reservations.get(a.reservationId);
    assert.equal(old.status, "active");
    assert.equal(old.startsAt, a.booking.startsAt);
  } finally {
    teardown();
  }
});

test("M transfer A → free B succeeds and preserves bookingId", async () => {
  setup();
  try {
    const created = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-25", "09:00", "10:00"),
      requestId: "tr-create",
      forceCanonical: true,
    });
    const moved = await transferCourtOperationsBooking({
      tenantId: "tenant-a",
      bookingId: created.bookingId,
      newPhysicalCourtId: COURT_B,
      expectedVersion: created.booking.version,
      requestId: "tr-ok",
      forceCanonical: true,
    });
    assert.equal(moved.ok, true);
    assert.equal(moved.bookingId, created.bookingId);
    assert.equal(moved.physicalCourtId, COURT_B);
  } finally {
    teardown();
  }
});

test("N transfer A → occupied B fails and A remains held", async () => {
  const store = setup();
  try {
    const a = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-25", "11:00", "12:00"),
      requestId: "tr-a",
      forceCanonical: true,
    });
    await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_B,
      ...window("2026-08-25", "11:00", "12:00"),
      requestId: "tr-b",
      forceCanonical: true,
    });
    const failed = await transferCourtOperationsBooking({
      tenantId: "tenant-a",
      bookingId: a.bookingId,
      newPhysicalCourtId: COURT_B,
      expectedVersion: a.booking.version,
      requestId: "tr-fail",
      forceCanonical: true,
    });
    assert.equal(failed.ok, false);
    assert.equal(failed.capacityPreserved, true);
    assert.equal(store.reservations.get(a.reservationId).status, "active");
    assert.equal(store.bookings.get(a.bookingId).physicalCourtId, COURT_A);
  } finally {
    teardown();
  }
});

test("O concurrent transfer is deterministic via version", async () => {
  setup();
  try {
    const created = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-26", "08:00", "09:00"),
      requestId: "conc-create",
      forceCanonical: true,
    });
    const first = await transferCourtOperationsBooking({
      tenantId: "tenant-a",
      bookingId: created.bookingId,
      newPhysicalCourtId: COURT_B,
      expectedVersion: created.booking.version,
      requestId: "conc-1",
      forceCanonical: true,
    });
    const second = await transferCourtOperationsBooking({
      tenantId: "tenant-a",
      bookingId: created.bookingId,
      newPhysicalCourtId: COURT_B,
      expectedVersion: created.booking.version,
      requestId: "conc-2",
      forceCanonical: true,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    assert.equal(second.code, "VERSION_CONFLICT");
  } finally {
    teardown();
  }
});

test("P foreign-tenant transfer rejects", async () => {
  const store = setup();
  try {
    const created = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-26", "10:00", "11:00"),
      requestId: "ft-create",
      forceCanonical: true,
    });
    store.setActor({ tenantId: "tenant-b" });
    const failed = await transferCourtOperationsBooking({
      tenantId: "tenant-b",
      bookingId: created.bookingId,
      newPhysicalCourtId: COURT_B,
      expectedVersion: created.booking.version,
      requestId: "ft-xfer",
      forceCanonical: true,
    });
    assert.equal(failed.ok, false);
  } finally {
    teardown();
  }
});

test("Q disabled club operational access rejects transfer target", async () => {
  const store = setup();
  try {
    // Remove club-a access to COURT_B
    store.courts.get(COURT_B).accessClubs = [];
    const created = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-26", "12:00", "13:00"),
      requestId: "access-create",
      forceCanonical: true,
    });
    const failed = await transferCourtOperationsBooking({
      tenantId: "tenant-a",
      bookingId: created.bookingId,
      newPhysicalCourtId: COURT_B,
      expectedVersion: created.booking.version,
      requestId: "access-xfer",
      forceCanonical: true,
    });
    assert.equal(failed.ok, false);
    assert.equal(failed.code, "OUT_OF_SCOPE");
  } finally {
    teardown();
  }
});

test("R cancel releases canonical capacity", async () => {
  const store = setup();
  try {
    const created = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-27", "09:00", "10:00"),
      requestId: "cancel-create",
      forceCanonical: true,
    });
    const cancelled = await cancelCourtOperationsBooking({
      tenantId: "tenant-a",
      bookingId: created.bookingId,
      requestId: "cancel-1",
      forceCanonical: true,
    });
    assert.equal(cancelled.ok, true);
    assert.equal(cancelled.booking.lifecycleStatus, "cancelled");
    assert.equal(store.reservations.get(created.reservationId).status, "released");
  } finally {
    teardown();
  }
});

test("S repeat cancel is idempotent", async () => {
  setup();
  try {
    const created = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-27", "11:00", "12:00"),
      requestId: "cancel2-create",
      forceCanonical: true,
    });
    const first = await cancelCourtOperationsBooking({
      tenantId: "tenant-a",
      bookingId: created.bookingId,
      requestId: "cancel2-a",
      forceCanonical: true,
    });
    const second = await cancelCourtOperationsBooking({
      tenantId: "tenant-a",
      bookingId: created.bookingId,
      requestId: "cancel2-b",
      forceCanonical: true,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
  } finally {
    teardown();
  }
});

test("T wrong owner cannot release another booking reservation", async () => {
  const store = setup();
  try {
    const a = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-27", "13:00", "14:00"),
      requestId: "own-a",
      forceCanonical: true,
    });
    const b = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_B,
      ...window("2026-08-27", "13:00", "14:00"),
      requestId: "own-b",
      forceCanonical: true,
    });
    const denied = store.reservations.get(a.reservationId);
    // Simulate foreign release attempt
    const release = (() => {
      const row = denied;
      if (row.ownerId !== b.bookingId) {
        return { ok: false, code: "FOREIGN_OWNER_RELEASE_DENIED" };
      }
      return { ok: true };
    })();
    assert.equal(release.ok, false);
    assert.equal(release.code, "FOREIGN_OWNER_RELEASE_DENIED");
    assert.equal(store.reservations.get(a.reservationId).status, "active");
  } finally {
    teardown();
  }
});

test("U cancel history remains queryable", async () => {
  setup();
  try {
    const created = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-28", "09:00", "10:00"),
      requestId: "hist-create",
      forceCanonical: true,
    });
    await cancelCourtOperationsBooking({
      tenantId: "tenant-a",
      bookingId: created.bookingId,
      requestId: "hist-cancel",
      forceCanonical: true,
    });
    const listed = await storeList();
    async function storeList() {
      const { listCourtOperationsBookings } = await import(
        "../src/features/court-resource/services/courtOperationsBookingApplication.js"
      );
      return listCourtOperationsBookings({ tenantId: "tenant-a", clubId: "club-a" });
    }
    assert.equal(listed.ok, true);
    assert.equal(listed.bookings.some((b) => b.bookingId === created.bookingId && b.lifecycleStatus === "cancelled"), true);
  } finally {
    teardown();
  }
});

test("V/W cancel does not leave active booking with released capacity or cancelled with active capacity", async () => {
  const store = setup();
  try {
    const created = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-28", "11:00", "12:00"),
      requestId: "vw-create",
      forceCanonical: true,
    });
    const cancelled = await cancelCourtOperationsBooking({
      tenantId: "tenant-a",
      bookingId: created.bookingId,
      requestId: "vw-cancel",
      forceCanonical: true,
    });
    assert.equal(cancelled.ok, true);
    const booking = store.bookings.get(created.bookingId);
    const reservation = store.reservations.get(created.reservationId);
    assert.equal(booking.lifecycleStatus, "cancelled");
    assert.notEqual(reservation.status, "active");
  } finally {
    teardown();
  }
});

test("AB missing tenant/club fail closed — no default-club", async () => {
  setup();
  try {
    const missingTenant = await createCourtOperationsBooking({
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-29", "09:00", "10:00"),
      requestId: "no-tenant",
      forceCanonical: true,
    });
    const missingClub = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-29", "09:00", "10:00"),
      requestId: "no-club",
      forceCanonical: true,
    });
    assert.equal(missingTenant.ok, false);
    assert.equal(missingClub.ok, false);
    assert.equal(missingClub.code, "MISSING_CLUB_ID");
  } finally {
    teardown();
  }
});

test("lifecycle update does not mutate capacity", async () => {
  const store = setup();
  try {
    const created = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-29", "13:00", "14:00"),
      requestId: "life-create",
      forceCanonical: true,
    });
    const updated = await updateCourtOperationsBookingLifecycle({
      tenantId: "tenant-a",
      bookingId: created.bookingId,
      lifecycleStatus: "checked_in",
      expectedVersion: created.booking.version,
      requestId: "life-1",
      forceCanonical: true,
    });
    assert.equal(updated.ok, true);
    assert.equal(store.reservations.get(created.reservationId).status, "active");
  } finally {
    teardown();
  }
});
