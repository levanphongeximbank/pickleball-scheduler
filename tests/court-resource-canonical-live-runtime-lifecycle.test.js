/**
 * Batch 7 — Court Live Resource Runtime lifecycle tests (A–P, AF–AJ core).
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  __resetCanonicalCourtLiveRuntimeForTests,
  __setCanonicalCourtLiveRuntimeForTests,
  COURT_OCCUPANCY_STATE,
  COURT_OPERATIONAL_STATE,
  LIVE_RUNTIME_CODE,
  RESOURCE_SESSION_SOURCE_TYPE,
} from "../src/features/court-resource/constants/canonicalLiveRuntime.js";
import {
  __resetCanonicalLiveRuntimeRpcClientForTests,
  __setCanonicalLiveRuntimeRpcClientForTests,
} from "../src/features/court-resource/services/canonicalLiveRuntimeClient.js";
import {
  beginResourceSession,
  endResourceSession,
  getCourtLiveState,
  setCurrentOperationalState,
} from "../src/features/court-resource/services/courtOperationsLiveRuntimeApplication.js";
import { createCanonicalLiveRuntimeFakeStore } from "./helpers/canonicalLiveRuntimeFakeStore.js";

const COURT_A = "11111111-1111-4111-8111-111111111111";
const COURT_FOREIGN = "33333333-3333-4333-8333-333333333333";

function setup() {
  __setCanonicalCourtLiveRuntimeForTests(true);
  const store = createCanonicalLiveRuntimeFakeStore();
  __setCanonicalLiveRuntimeRpcClientForTests(store.rpcClient());
  return store;
}

function teardown() {
  __resetCanonicalLiveRuntimeRpcClientForTests();
  __resetCanonicalCourtLiveRuntimeForTests();
}

test("A begin session on valid physical court → occupancy occupied", async () => {
  const store = setup();
  try {
    store.seedCapacityClaim({
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "booking-1",
    });
    const begun = await beginResourceSession({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      sourceType: RESOURCE_SESSION_SOURCE_TYPE.BOOKING,
      sourceId: "booking-1",
      capacityClaimValid: true,
      requestId: "begin-a",
      forceCanonical: true,
    });
    assert.equal(begun.ok, true);
    assert.equal(begun.occupancyState, COURT_OCCUPANCY_STATE.OCCUPIED);
    assert.equal(begun.activeSession.sourceType, "booking");
    assert.equal(begun.activeSession.sourceId, "booking-1");
    assert.equal(begun.reservationWriteCount, 0);
  } finally {
    teardown();
  }
});

test("B second simultaneous session same court → rejected", async () => {
  const store = setup();
  try {
    store.seedCapacityClaim({
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "booking-1",
    });
    store.seedCapacityClaim({
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "booking-2",
    });
    const first = await beginResourceSession({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "booking-1",
      capacityClaimValid: true,
      requestId: "begin-b1",
      forceCanonical: true,
    });
    assert.equal(first.ok, true);
    const second = await beginResourceSession({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "booking-2",
      capacityClaimValid: true,
      requestId: "begin-b2",
      forceCanonical: true,
    });
    assert.equal(second.ok, false);
    assert.equal(second.code, LIVE_RUNTIME_CODE.SESSION_ACTIVE_CONFLICT);
  } finally {
    teardown();
  }
});

test("C end session → occupancy free", async () => {
  const store = setup();
  try {
    store.seedCapacityClaim({
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "booking-1",
    });
    await beginResourceSession({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "booking-1",
      capacityClaimValid: true,
      requestId: "begin-c",
      forceCanonical: true,
    });
    const ended = await endResourceSession({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "booking-1",
      requestId: "end-c",
      forceCanonical: true,
    });
    assert.equal(ended.ok, true);
    assert.equal(ended.occupancyState, COURT_OCCUPANCY_STATE.FREE);
    assert.equal(ended.reservationReleased, false);
  } finally {
    teardown();
  }
});

test("D repeat end → idempotent/safe", async () => {
  setup();
  try {
    const ended = await endResourceSession({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "missing",
      requestId: "end-d1",
      forceCanonical: true,
    });
    assert.equal(ended.ok, true);
    const again = await endResourceSession({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "missing",
      requestId: "end-d2",
      forceCanonical: true,
    });
    assert.equal(again.ok, true);
  } finally {
    teardown();
  }
});

test("E foreign tenant → reject", async () => {
  const store = setup();
  try {
    store.setActor({ tenantId: "tenant-a" });
    const result = await beginResourceSession({
      tenantId: "tenant-b",
      physicalCourtId: COURT_FOREIGN,
      sourceType: "booking",
      sourceId: "booking-x",
      capacityClaimValid: true,
      requestId: "begin-e",
      forceCanonical: true,
    });
    assert.equal(result.ok, false);
    assert.match(String(result.code), /TENANT/);
  } finally {
    teardown();
  }
});

test("F unknown physicalCourtId → reject", async () => {
  setup();
  try {
    const result = await beginResourceSession({
      tenantId: "tenant-a",
      physicalCourtId: "99999999-9999-4999-8999-999999999999",
      sourceType: "booking",
      sourceId: "booking-x",
      capacityClaimValid: true,
      requestId: "begin-f",
      forceCanonical: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "UNKNOWN_COURT");
  } finally {
    teardown();
  }
});

test("G current operational state disallows use → begin rejected", async () => {
  setup();
  try {
    await setCurrentOperationalState({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      state: COURT_OPERATIONAL_STATE.OUT_OF_SERVICE_NOW,
      reason: "surface wet",
      requestId: "ops-g",
      forceCanonical: true,
    });
    const begun = await beginResourceSession({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "booking-1",
      capacityClaimValid: true,
      requestId: "begin-g",
      forceCanonical: true,
    });
    assert.equal(begun.ok, false);
    assert.equal(begun.code, LIVE_RUNTIME_CODE.OPERATIONAL_STATE_DENIES_USE);
  } finally {
    teardown();
  }
});

test("H physical Court rename → live session identity unchanged", async () => {
  const store = setup();
  try {
    store.seedCapacityClaim({
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "booking-1",
    });
    const begun = await beginResourceSession({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "booking-1",
      capacityClaimValid: true,
      requestId: "begin-h",
      forceCanonical: true,
    });
    store.renameCourtDisplayName(COURT_A, "Renamed Court Label");
    const state = await getCourtLiveState({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      forceCanonical: true,
    });
    assert.equal(begun.ok, true);
    assert.equal(state.physicalCourtId, COURT_A);
    assert.equal(state.activeSession.physicalCourtId, COURT_A);
  } finally {
    teardown();
  }
});

test("I clusterId cannot identify live resource", async () => {
  setup();
  try {
    const result = await beginResourceSession({
      tenantId: "tenant-a",
      clusterId: "cluster-1",
      sourceType: "booking",
      sourceId: "booking-1",
      capacityClaimValid: true,
      requestId: "begin-i",
      forceCanonical: true,
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.code === "MISSING_COURT_ID" || result.code === "WHOLE_CLUSTER_DENIED"
    );
  } finally {
    teardown();
  }
});

test("J display label cannot identify live resource", async () => {
  setup();
  try {
    const result = await beginResourceSession({
      tenantId: "tenant-a",
      courtLabel: "Court 1",
      sourceType: "booking",
      sourceId: "booking-1",
      capacityClaimValid: true,
      requestId: "begin-j",
      forceCanonical: true,
    });
    assert.equal(result.ok, false);
    assert.ok(
      result.code === "MISSING_COURT_ID" || result.code === "SYNTHETIC_COURT_DENIED"
    );
  } finally {
    teardown();
  }
});

test("K begin live session → reservation row count unchanged", async () => {
  const store = setup();
  try {
    const before = store.getReservationWriteCount();
    store.seedCapacityClaim({
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "booking-1",
    });
    await beginResourceSession({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "booking-1",
      capacityClaimValid: true,
      requestId: "begin-k",
      forceCanonical: true,
    });
    assert.equal(store.getReservationWriteCount(), before);
  } finally {
    teardown();
  }
});

test("L end live session → reservation remains (not released)", async () => {
  const store = setup();
  try {
    store.seedCapacityClaim({
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "booking-1",
    });
    await beginResourceSession({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "booking-1",
      capacityClaimValid: true,
      requestId: "begin-l",
      forceCanonical: true,
    });
    const ended = await endResourceSession({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      sourceType: "booking",
      sourceId: "booking-1",
      requestId: "end-l",
      forceCanonical: true,
    });
    assert.equal(ended.reservationReleased, false);
    assert.equal(store.capacityClaims.size >= 1, true);
  } finally {
    teardown();
  }
});

test("M current OUT_OF_SERVICE_NOW → does not fabricate future reservation", async () => {
  const store = setup();
  try {
    const result = await setCurrentOperationalState({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      state: COURT_OPERATIONAL_STATE.OUT_OF_SERVICE_NOW,
      reason: "now only",
      requestId: "ops-m",
      forceCanonical: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.reservationCreated, false);
    assert.equal(result.resourceBlockCreated, false);
    assert.equal(store.getReservationWriteCount(), 0);
  } finally {
    teardown();
  }
});

test("N/O live occupancy is not reservation conflict authority (constants)", async () => {
  const {
    COURT_LIVE_RUNTIME_IS_RESERVATION_SSOT,
    LIVE_OCCUPANCY_USED_AS_RESERVATION_CONFLICT_AUTHORITY,
  } = await import("../src/features/court-resource/constants/canonicalLiveRuntime.js");
  assert.equal(COURT_LIVE_RUNTIME_IS_RESERVATION_SSOT, "NO");
  assert.equal(LIVE_OCCUPANCY_USED_AS_RESERVATION_CONFLICT_AUTHORITY, "NO");
});

test("P Live Runtime has zero direct reservation writes", async () => {
  const store = setup();
  try {
    store.seedCapacityClaim({
      physicalCourtId: COURT_A,
      sourceType: "operations",
      sourceId: "ops-1",
    });
    const begun = await beginResourceSession({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      sourceType: "operations",
      sourceId: "ops-1",
      operationsAuthorized: true,
      requestId: "begin-p",
      forceCanonical: true,
    });
    assert.equal(begun.ok, true);
    assert.equal(begun.reservationWriteCount, 0);
    assert.equal(store.getReservationWriteCount(), 0);
  } finally {
    teardown();
  }
});

test("AF setCurrentOperationalState updates live runtime", async () => {
  setup();
  try {
    const result = await setCurrentOperationalState({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      state: COURT_OPERATIONAL_STATE.UNAVAILABLE_NOW,
      reason: "locked now",
      requestId: "ops-af",
      forceCanonical: true,
    });
    assert.equal(result.ok, true);
    assert.equal(result.operationalState, COURT_OPERATIONAL_STATE.UNAVAILABLE_NOW);
    const state = await getCourtLiveState({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      forceCanonical: true,
    });
    assert.equal(state.operationalState, COURT_OPERATIONAL_STATE.UNAVAILABLE_NOW);
    assert.equal(state.allowsLiveUse, false);
  } finally {
    teardown();
  }
});

test("AG/AH canonical state update creates neither Resource Block nor Reservation", async () => {
  const store = setup();
  try {
    const result = await setCurrentOperationalState({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      state: COURT_OPERATIONAL_STATE.OUT_OF_SERVICE_NOW,
      requestId: "ops-ag",
      forceCanonical: true,
    });
    assert.equal(result.resourceBlockCreated, false);
    assert.equal(result.reservationCreated, false);
    assert.equal(store.getReservationWriteCount(), 0);
  } finally {
    teardown();
  }
});
