/**
 * Batch 7 — Booking ↔ Live Runtime projection tests (Q–T).
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  __resetCanonicalBookingLifecycleForTests,
  __setCanonicalBookingLifecycleForTests,
  CANONICAL_BOOKING_LIFECYCLE_STATUS,
} from "../src/features/court-resource/constants/canonicalBooking.js";
import {
  __resetCanonicalCourtLiveRuntimeForTests,
  __setCanonicalCourtLiveRuntimeForTests,
  COURT_OCCUPANCY_STATE,
} from "../src/features/court-resource/constants/canonicalLiveRuntime.js";
import {
  __resetCanonicalBookingRpcClientForTests,
  __setCanonicalBookingRpcClientForTests,
} from "../src/features/court-resource/services/canonicalBookingClient.js";
import {
  __resetCanonicalLiveRuntimeRpcClientForTests,
  __setCanonicalLiveRuntimeRpcClientForTests,
} from "../src/features/court-resource/services/canonicalLiveRuntimeClient.js";
import {
  createCourtOperationsBooking,
  getCourtOperationsBooking,
  updateCourtOperationsBookingLifecycle,
} from "../src/features/court-resource/services/courtOperationsBookingApplication.js";
import { getCourtLiveState } from "../src/features/court-resource/services/courtOperationsLiveRuntimeApplication.js";
import { createCanonicalBookingFakeStore } from "./helpers/canonicalBookingFakeStore.js";
import { createCanonicalLiveRuntimeFakeStore } from "./helpers/canonicalLiveRuntimeFakeStore.js";

const COURT_A = "11111111-1111-4111-8111-111111111111";

function window(date, start, end) {
  return {
    startsAt: new Date(`${date}T${start}:00.000Z`).toISOString(),
    endsAt: new Date(`${date}T${end}:00.000Z`).toISOString(),
  };
}

function setup() {
  __setCanonicalBookingLifecycleForTests(true);
  __setCanonicalCourtLiveRuntimeForTests(true);
  const bookingStore = createCanonicalBookingFakeStore();
  const liveStore = createCanonicalLiveRuntimeFakeStore();
  __setCanonicalBookingRpcClientForTests(bookingStore.rpcClient());
  __setCanonicalLiveRuntimeRpcClientForTests(liveStore.rpcClient());
  return { bookingStore, liveStore };
}

function teardown() {
  __resetCanonicalBookingRpcClientForTests();
  __resetCanonicalLiveRuntimeRpcClientForTests();
  __resetCanonicalBookingLifecycleForTests();
  __resetCanonicalCourtLiveRuntimeForTests();
}

test("Q canonical Booking start → projects Live Resource session", async () => {
  setup();
  try {
    const created = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-20", "18:00", "20:00"),
      customerName: "Alice",
      requestId: "book-q",
      forceCanonical: true,
    });
    assert.equal(created.ok, true);
    const started = await updateCourtOperationsBookingLifecycle({
      tenantId: "tenant-a",
      bookingId: created.bookingId,
      lifecycleStatus: CANONICAL_BOOKING_LIFECYCLE_STATUS.PLAYING,
      physicalCourtId: COURT_A,
      expectedVersion: created.booking.version,
      requestId: "life-q-play",
      forceCanonical: true,
    });
    assert.equal(started.ok, true);
    assert.ok(started.liveProjection);
    assert.equal(started.liveProjection.ok, true);
    assert.equal(started.liveProjection.occupancyState, COURT_OCCUPANCY_STATE.OCCUPIED);
    assert.equal(started.liveProjection.activeSession.sourceType, "booking");
    assert.equal(started.liveProjection.activeSession.sourceId, created.bookingId);
  } finally {
    teardown();
  }
});

test("R Booking end → ends Live session", async () => {
  setup();
  try {
    const created = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-20", "10:00", "11:00"),
      requestId: "book-r",
      forceCanonical: true,
    });
    await updateCourtOperationsBookingLifecycle({
      tenantId: "tenant-a",
      bookingId: created.bookingId,
      lifecycleStatus: CANONICAL_BOOKING_LIFECYCLE_STATUS.PLAYING,
      physicalCourtId: COURT_A,
      expectedVersion: created.booking.version,
      requestId: "life-r-play",
      forceCanonical: true,
    });
    const afterPlay = await getCourtOperationsBooking({
      tenantId: "tenant-a",
      bookingId: created.bookingId,
    });
    const completed = await updateCourtOperationsBookingLifecycle({
      tenantId: "tenant-a",
      bookingId: created.bookingId,
      lifecycleStatus: CANONICAL_BOOKING_LIFECYCLE_STATUS.COMPLETED,
      physicalCourtId: COURT_A,
      expectedVersion: afterPlay.booking?.version ?? created.booking.version + 1,
      requestId: "life-r-done",
      forceCanonical: true,
    });
    assert.equal(completed.ok, true);
    assert.equal(completed.liveProjection.ok, true);
    assert.equal(completed.liveProjection.occupancyState, COURT_OCCUPANCY_STATE.FREE);
    const state = await getCourtLiveState({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      forceCanonical: true,
    });
    assert.equal(state.occupancyState, COURT_OCCUPANCY_STATE.FREE);
  } finally {
    teardown();
  }
});

test("S Live Runtime does not change Booking business status itself", async () => {
  const source = await import("node:fs").then((fs) =>
    fs.readFileSync(
      new URL(
        "../src/features/court-resource/services/courtOperationsLiveRuntimeApplication.js",
        import.meta.url
      ),
      "utf8"
    )
  );
  assert.doesNotMatch(source, /updateCourtOperationsBookingLifecycle|rpcUpdateBookingLifecycle/);
  assert.doesNotMatch(source, /lifecycleStatus/);
});

test("T Booking reservation ownership remains Capacity SSOT", async () => {
  const { bookingStore } = setup();
  try {
    const created = await createCourtOperationsBooking({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      ...window("2026-08-21", "12:00", "13:00"),
      requestId: "book-t",
      forceCanonical: true,
    });
    assert.ok(created.reservationId);
    assert.equal(bookingStore.reservations.get(created.reservationId).ownerType, "booking");
    await updateCourtOperationsBookingLifecycle({
      tenantId: "tenant-a",
      bookingId: created.bookingId,
      lifecycleStatus: CANONICAL_BOOKING_LIFECYCLE_STATUS.PLAYING,
      physicalCourtId: COURT_A,
      expectedVersion: created.booking.version,
      requestId: "life-t-play",
      forceCanonical: true,
    });
    assert.equal(bookingStore.reservations.get(created.reservationId).status, "active");
  } finally {
    teardown();
  }
});
