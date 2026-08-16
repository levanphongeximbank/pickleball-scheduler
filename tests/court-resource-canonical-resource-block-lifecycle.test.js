import assert from "node:assert/strict";
import test from "node:test";

import {
  __resetCanonicalResourceBlocksForTests,
  __setCanonicalResourceBlocksForTests,
  CANONICAL_RESOURCE_BLOCK_TYPE,
} from "../src/features/court-resource/constants/canonicalResourceBlock.js";
import {
  __resetCanonicalResourceBlockRpcClientForTests,
  __setCanonicalResourceBlockRpcClientForTests,
} from "../src/features/court-resource/services/canonicalResourceBlockClient.js";
import {
  cancelResourceBlock,
  createResourceBlock,
  listResourceBlocks,
  rescheduleResourceBlock,
  transferResourceBlock,
} from "../src/features/court-resource/services/courtOperationsResourceBlockApplication.js";
import { createCanonicalResourceBlockFakeStore } from "./helpers/canonicalResourceBlockFakeStore.js";

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
  __setCanonicalResourceBlocksForTests(true);
  const store = createCanonicalResourceBlockFakeStore();
  __setCanonicalResourceBlockRpcClientForTests(store.rpcClient());
  return store;
}

function teardown() {
  __resetCanonicalResourceBlockRpcClientForTests();
  __resetCanonicalResourceBlocksForTests();
}

test("A create MAINTENANCE persists block + maintenance capacity", async () => {
  const store = setup();
  try {
    const created = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-20", "08:00", "12:00"),
      reason: "Resurface",
      requestId: "rb-maint-1",
      forceCanonical: true,
    });
    assert.equal(created.ok, true);
    assert.equal(created.resourceBlock.blockType, "MAINTENANCE");
    assert.equal(created.resourceBlock.identityAuthority, "physicalCourtId");
    assert.equal(store.reservations.get(created.reservationId).ownerType, "maintenance");
    assert.equal(store.reservations.get(created.reservationId).ownerId, created.resourceBlockId);
    assert.equal(store.reservations.get(created.reservationId).ownerSubType, "resource_block");
  } finally {
    teardown();
  }
});

test("B create OPERATIONAL_BLOCK persists operations capacity", async () => {
  const store = setup();
  try {
    const created = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.OPERATIONAL_BLOCK,
      ...window("2026-08-20", "13:00", "15:00"),
      reason: "Private event hold",
      requestId: "rb-ops-1",
      forceCanonical: true,
    });
    assert.equal(created.ok, true);
    assert.equal(created.resourceBlock.blockType, "OPERATIONAL_BLOCK");
    assert.equal(store.reservations.get(created.reservationId).ownerType, "operations");
  } finally {
    teardown();
  }
});

test("C conflict vs booking reservation", async () => {
  const store = setup();
  try {
    store.seedReservation({
      physicalCourtId: COURT_A,
      ownerType: "booking",
      ownerId: "booking-x",
      ...window("2026-08-21", "10:00", "12:00"),
    });
    const result = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-21", "11:00", "13:00"),
      requestId: "rb-vs-booking",
      forceCanonical: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "FOREIGN_RESERVATION_CONFLICT");
  } finally {
    teardown();
  }
});

test("D conflict vs competition reservation", async () => {
  const store = setup();
  try {
    store.seedReservation({
      physicalCourtId: COURT_A,
      ownerType: "competition",
      ownerId: "tourney-1",
      ...window("2026-08-21", "14:00", "16:00"),
    });
    const result = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.OPERATIONAL_BLOCK,
      ...window("2026-08-21", "15:00", "17:00"),
      requestId: "rb-vs-comp",
      forceCanonical: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "FOREIGN_RESERVATION_CONFLICT");
  } finally {
    teardown();
  }
});

test("D1b conflict vs daily_play reservation", async () => {
  const store = setup();
  try {
    store.seedReservation({
      physicalCourtId: COURT_A,
      ownerType: "daily_play",
      ownerId: "daily-session-1",
      ...window("2026-08-21", "08:00", "10:00"),
    });
    const result = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-21", "09:00", "11:00"),
      requestId: "rb-vs-daily",
      forceCanonical: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "FOREIGN_RESERVATION_CONFLICT");
  } finally {
    teardown();
  }
});

test("D2 booking/competition over Resource Block reject via shared capacity SSOT", async () => {
  const store = setup();
  try {
    const block = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-21", "18:00", "22:00"),
      requestId: "rb-first-capacity",
      forceCanonical: true,
    });
    assert.equal(block.ok, true);
    const bookingOver = store.tryAcquireCapacity({
      physicalCourtId: COURT_A,
      ownerType: "booking",
      ownerId: "booking-over-block",
      ...window("2026-08-21", "19:00", "21:00"),
    });
    assert.equal(bookingOver.ok, false);
    assert.equal(bookingOver.code, "FOREIGN_RESERVATION_CONFLICT");
    const competitionOver = store.tryAcquireCapacity({
      physicalCourtId: COURT_A,
      ownerType: "competition",
      ownerId: "comp-over-block",
      ...window("2026-08-21", "20:00", "21:00"),
    });
    assert.equal(competitionOver.ok, false);
    assert.equal(competitionOver.code, "FOREIGN_RESERVATION_CONFLICT");
    assert.equal(store.resourceBlocks.get(block.resourceBlockId)?.lifecycleStatus, "active");
  } finally {
    teardown();
  }
});

test("E conflict vs other resource block", async () => {
  setup();
  try {
    const first = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-22", "09:00", "11:00"),
      requestId: "rb-other-1",
      forceCanonical: true,
    });
    assert.equal(first.ok, true);
    const second = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.OPERATIONAL_BLOCK,
      ...window("2026-08-22", "10:00", "12:00"),
      requestId: "rb-other-2",
      forceCanonical: true,
    });
    assert.equal(second.ok, false);
    assert.equal(second.code, "FOREIGN_RESERVATION_CONFLICT");
  } finally {
    teardown();
  }
});

test("F non-overlap and different court succeed", async () => {
  setup();
  try {
    const a = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-22", "13:00", "14:00"),
      requestId: "rb-nonoverlap-a",
      forceCanonical: true,
    });
    const b = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-22", "14:00", "15:00"),
      requestId: "rb-nonoverlap-b",
      forceCanonical: true,
    });
    const c = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_B,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-22", "13:00", "14:00"),
      requestId: "rb-diffcourt",
      forceCanonical: true,
    });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(c.ok, true);
  } finally {
    teardown();
  }
});

test("G disabled access / foreign tenant / unknown court reject", async () => {
  const store = setup();
  try {
    store.setActor({ tenantId: "tenant-a" });
    const foreignTenant = await createResourceBlock({
      tenantId: "tenant-b",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-23", "08:00", "09:00"),
      requestId: "rb-foreign-tenant",
      forceCanonical: true,
    });
    assert.equal(foreignTenant.ok, false);
    assert.match(String(foreignTenant.code), /TENANT/);

    const noAccess = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_FOREIGN,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-23", "08:00", "09:00"),
      requestId: "rb-no-access",
      forceCanonical: true,
    });
    assert.equal(noAccess.ok, false);
    assert.ok(["OUT_OF_SCOPE", "CROSS_TENANT_COURT", "UNKNOWN_COURT"].includes(noAccess.code));

    const unknown = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: "99999999-9999-4999-8999-999999999999",
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-23", "08:00", "09:00"),
      requestId: "rb-unknown",
      forceCanonical: true,
    });
    assert.equal(unknown.ok, false);
    assert.equal(unknown.code, "UNKNOWN_COURT");
  } finally {
    teardown();
  }
});

test("H idempotent retry does not duplicate capacity", async () => {
  const store = setup();
  try {
    const first = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-23", "10:00", "11:00"),
      requestId: "rb-idem-1",
      forceCanonical: true,
    });
    const second = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-23", "10:00", "11:00"),
      requestId: "rb-idem-1",
      forceCanonical: true,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.replay, true);
    assert.equal(first.resourceBlockId, second.resourceBlockId);
    const active = [...store.reservations.values()].filter((r) => r.status === "active");
    assert.equal(active.length, 1);
  } finally {
    teardown();
  }
});

test("I persist failure after reserve compensates", async () => {
  const store = setup();
  try {
    const raw = await store.rpcClient().rpc("court_operations_resource_block_create", {
      p_tenant_id: "tenant-a",
      p_club_id: "club-a",
      p_physical_court_id: COURT_A,
      p_starts_at: window("2026-08-23", "12:00", "13:00").startsAt,
      p_ends_at: window("2026-08-23", "12:00", "13:00").endsAt,
      p_request_id: "rb-persist-fail",
      p_payload: {
        blockType: "MAINTENANCE",
        __failPersistAfterReserve: true,
      },
    });
    assert.equal(raw.data.ok, false);
    assert.equal(raw.data.compensated, true);
    const active = [...store.reservations.values()].filter((r) => r.status === "active");
    assert.equal(active.length, 0);
  } finally {
    teardown();
  }
});

test("J reschedule success / fail preserves capacity", async () => {
  const store = setup();
  try {
    const created = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-24", "08:00", "10:00"),
      requestId: "rb-rs-create",
      forceCanonical: true,
    });
    const moved = await rescheduleResourceBlock({
      tenantId: "tenant-a",
      resourceBlockId: created.resourceBlockId,
      physicalCourtId: COURT_A,
      ...window("2026-08-24", "10:00", "12:00"),
      expectedVersion: created.resourceBlock.version,
      requestId: "rb-rs-ok",
      forceCanonical: true,
    });
    assert.equal(moved.ok, true);
    assert.equal(moved.resourceBlockId, created.resourceBlockId);

    await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.OPERATIONAL_BLOCK,
      ...window("2026-08-24", "12:00", "14:00"),
      requestId: "rb-rs-blocker",
      forceCanonical: true,
    });
    const failed = await rescheduleResourceBlock({
      tenantId: "tenant-a",
      resourceBlockId: created.resourceBlockId,
      physicalCourtId: COURT_A,
      ...window("2026-08-24", "11:00", "13:00"),
      expectedVersion: moved.resourceBlock.version,
      requestId: "rb-rs-fail",
      forceCanonical: true,
    });
    assert.equal(failed.ok, false);
    assert.equal(failed.capacityPreserved, true);
    assert.equal(store.reservations.get(moved.reservationId).status, "active");
  } finally {
    teardown();
  }
});

test("K transfer success / fail", async () => {
  const store = setup();
  try {
    const created = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-25", "09:00", "10:00"),
      requestId: "rb-tr-create",
      forceCanonical: true,
    });
    const moved = await transferResourceBlock({
      tenantId: "tenant-a",
      resourceBlockId: created.resourceBlockId,
      newPhysicalCourtId: COURT_B,
      expectedVersion: created.resourceBlock.version,
      requestId: "rb-tr-ok",
      forceCanonical: true,
    });
    assert.equal(moved.ok, true);
    assert.equal(moved.physicalCourtId, COURT_B);
    assert.equal(moved.resourceBlockId, created.resourceBlockId);

    await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.OPERATIONAL_BLOCK,
      ...window("2026-08-25", "09:00", "10:00"),
      requestId: "rb-tr-blocker",
      forceCanonical: true,
    });
    const failed = await transferResourceBlock({
      tenantId: "tenant-a",
      resourceBlockId: created.resourceBlockId,
      newPhysicalCourtId: COURT_A,
      expectedVersion: moved.resourceBlock.version,
      requestId: "rb-tr-fail",
      forceCanonical: true,
    });
    assert.equal(failed.ok, false);
    assert.equal(failed.capacityPreserved, true);
    assert.equal(store.resourceBlocks.get(created.resourceBlockId).physicalCourtId, COURT_B);
  } finally {
    teardown();
  }
});

test("L version conflict on concurrent transfer", async () => {
  setup();
  try {
    const created = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-26", "08:00", "09:00"),
      requestId: "rb-ver-create",
      forceCanonical: true,
    });
    const first = await transferResourceBlock({
      tenantId: "tenant-a",
      resourceBlockId: created.resourceBlockId,
      newPhysicalCourtId: COURT_B,
      expectedVersion: created.resourceBlock.version,
      requestId: "rb-ver-1",
      forceCanonical: true,
    });
    const second = await transferResourceBlock({
      tenantId: "tenant-a",
      resourceBlockId: created.resourceBlockId,
      newPhysicalCourtId: COURT_B,
      expectedVersion: created.resourceBlock.version,
      requestId: "rb-ver-2",
      forceCanonical: true,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
    assert.equal(second.code, "VERSION_CONFLICT");
  } finally {
    teardown();
  }
});

test("M cancel + idempotent cancel + history retained", async () => {
  const store = setup();
  try {
    const created = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-27", "09:00", "10:00"),
      requestId: "rb-cancel-create",
      forceCanonical: true,
    });
    const first = await cancelResourceBlock({
      tenantId: "tenant-a",
      resourceBlockId: created.resourceBlockId,
      requestId: "rb-cancel-1",
      forceCanonical: true,
    });
    const second = await cancelResourceBlock({
      tenantId: "tenant-a",
      resourceBlockId: created.resourceBlockId,
      requestId: "rb-cancel-2",
      forceCanonical: true,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(store.reservations.get(created.reservationId).status, "released");
    assert.equal(store.resourceBlocks.get(created.resourceBlockId).lifecycleStatus, "cancelled");

    const listed = await listResourceBlocks({
      tenantId: "tenant-a",
      clubId: "club-a",
      includeCancelled: true,
    });
    assert.equal(listed.ok, true);
    assert.equal(
      listed.resourceBlocks.some(
        (b) => b.resourceBlockId === created.resourceBlockId && b.lifecycleStatus === "cancelled"
      ),
      true
    );
  } finally {
    teardown();
  }
});

test("N wrong owner release denied", async () => {
  const store = setup();
  try {
    const a = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-27", "11:00", "12:00"),
      requestId: "rb-own-a",
      forceCanonical: true,
    });
    const b = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_B,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.OPERATIONAL_BLOCK,
      ...window("2026-08-27", "11:00", "12:00"),
      requestId: "rb-own-b",
      forceCanonical: true,
    });
    const row = store.reservations.get(a.reservationId);
    const release = (() => {
      if (row.ownerType !== "operations" || row.ownerId !== b.resourceBlockId) {
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

test("O flag OFF fails closed; label / missing tenant-club deny", async () => {
  __setCanonicalResourceBlocksForTests(false);
  __setCanonicalResourceBlockRpcClientForTests(createCanonicalResourceBlockFakeStore().rpcClient());
  try {
    const disabled = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-28", "09:00", "10:00"),
      requestId: "rb-flag-off",
    });
    assert.equal(disabled.ok, false);
    assert.equal(disabled.code, "CANONICAL_PATH_UNAVAILABLE");
  } finally {
    teardown();
  }

  setup();
  try {
    const label = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: "Court 1",
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-28", "09:00", "10:00"),
      requestId: "rb-label",
      forceCanonical: true,
    });
    assert.equal(label.ok, false);
    assert.equal(label.code, "SYNTHETIC_COURT_DENIED");

    const missingTenant = await createResourceBlock({
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-28", "09:00", "10:00"),
      requestId: "rb-no-tenant",
      forceCanonical: true,
    });
    const missingClub = await createResourceBlock({
      tenantId: "tenant-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-28", "09:00", "10:00"),
      requestId: "rb-no-club",
      forceCanonical: true,
    });
    assert.equal(missingTenant.ok, false);
    assert.equal(missingClub.ok, false);
    assert.equal(missingClub.code, "MISSING_CLUB_ID");
  } finally {
    teardown();
  }
});

test("P disabled club operational access rejects transfer target", async () => {
  const store = setup();
  try {
    store.courts.get(COURT_B).accessClubs = [];
    const created = await createResourceBlock({
      tenantId: "tenant-a",
      clubId: "club-a",
      physicalCourtId: COURT_A,
      blockType: CANONICAL_RESOURCE_BLOCK_TYPE.MAINTENANCE,
      ...window("2026-08-28", "11:00", "12:00"),
      requestId: "rb-access-create",
      forceCanonical: true,
    });
    const failed = await transferResourceBlock({
      tenantId: "tenant-a",
      resourceBlockId: created.resourceBlockId,
      newPhysicalCourtId: COURT_B,
      expectedVersion: created.resourceBlock.version,
      requestId: "rb-access-xfer",
      forceCanonical: true,
    });
    assert.equal(failed.ok, false);
    assert.equal(failed.code, "OUT_OF_SCOPE");
  } finally {
    teardown();
  }
});
