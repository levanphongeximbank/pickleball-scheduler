/**
 * Phase 1H-B — Admin listPlayerVerificationQueue tests.
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  ADMIN_VERIFICATION_QUEUE_DTO_FIELDS,
  ADMIN_VERIFICATION_QUEUE_EXCLUDED_FIELDS,
  IDENTITY_VERIFICATION_STATUS,
  VERIFICATION_QUEUE_DEFAULT_STATUS,
  VERIFICATION_QUEUE_ERROR_CODES,
  VERIFICATION_QUEUE_MAX_LIMIT,
  listPlayerVerificationQueue,
  projectAdminVerificationQueueItem,
  updatePlayerVerificationStatus,
} from "../src/features/player/index.js";
import { ROLES } from "../src/auth/roles.js";
import { createUserRecord } from "../src/models/user.js";

const VENUE_A = "venue-a";
const VENUE_B = "venue-b";

function makeActors() {
  return {
    superAdmin: createUserRecord({
      id: "auth-super-1h-b",
      email: "super@test.local",
      role: ROLES.SUPER_ADMIN,
      venueId: null,
    }),
    platformAdmin: createUserRecord({
      id: "auth-platform-1h-b",
      email: "platform@test.local",
      role: ROLES.PLATFORM_ADMIN,
      venueId: null,
    }),
    tenantOwner: createUserRecord({
      id: "auth-owner-1h-b",
      email: "owner@test.local",
      role: ROLES.TENANT_OWNER,
      venueId: VENUE_A,
    }),
    crossVenueOwner: createUserRecord({
      id: "auth-owner-other-1h-b",
      email: "other-owner@test.local",
      role: ROLES.TENANT_OWNER,
      venueId: VENUE_B,
    }),
    venueManager: createUserRecord({
      id: "auth-staff-1h-b",
      email: "manager@test.local",
      role: ROLES.VENUE_MANAGER,
      venueId: VENUE_A,
    }),
  };
}

function profileRow(overrides = {}) {
  const id = overrides.id || "auth-player-1";
  return {
    id,
    player_id: overrides.player_id || `player-auth-${id}`,
    display_name: overrides.display_name || "Queue Player",
    activity_region: overrides.activity_region ?? { countryCode: "VN", provinceName: "Hà Nội" },
    identity_verification_status:
      overrides.identity_verification_status || IDENTITY_VERIFICATION_STATUS.PENDING,
    venue_id: overrides.venue_id === undefined ? VENUE_A : overrides.venue_id,
    updated_at: overrides.updated_at || "2026-07-20T10:00:00.000Z",
    privacy_settings: {
      publicProfileEnabled: false,
      showPhone: true,
      showEmail: true,
    },
    email: "secret@example.com",
    phone: "0900000000",
    birth_date: "1990-01-01",
    handedness: "right",
    role: "PLAYER",
    ...overrides,
  };
}

function createListHarness(rows) {
  const listCalls = [];
  const mutationCalls = [];

  const listProfileRows = async (query) => {
    listCalls.push(query);
    const status = query.status;
    const venueId = query.venueId || null;
    const filtered = rows.filter((row) => {
      if (row.identity_verification_status !== status) return false;
      if (venueId && row.venue_id !== venueId) return false;
      return true;
    });
    return { ok: true, rows: filtered };
  };

  return {
    listCalls,
    mutationCalls,
    listProfileRows,
    trackMutation: (name) => {
      mutationCalls.push(name);
    },
    call: (actor, options = {}) =>
      listPlayerVerificationQueue({
        rbacEnabled: true,
        user: actor,
        listProfileRows,
        ...options,
      }),
  };
}

const BASE_ROWS = [
  profileRow({
    id: "auth-pending-old",
    display_name: "Pending Old",
    identity_verification_status: "pending",
    updated_at: "2026-07-18T08:00:00.000Z",
  }),
  profileRow({
    id: "auth-pending-new",
    display_name: "Pending New",
    identity_verification_status: "pending",
    updated_at: "2026-07-20T12:00:00.000Z",
  }),
  profileRow({
    id: "auth-pending-b",
    display_name: "Pending Other Venue",
    identity_verification_status: "pending",
    venue_id: VENUE_B,
    updated_at: "2026-07-20T13:00:00.000Z",
  }),
  profileRow({
    id: "auth-unverified",
    display_name: "Unverified One",
    identity_verification_status: "unverified",
    updated_at: "2026-07-19T09:00:00.000Z",
  }),
  profileRow({
    id: "auth-rejected",
    display_name: "Rejected One",
    identity_verification_status: "rejected",
    updated_at: "2026-07-17T09:00:00.000Z",
  }),
  profileRow({
    id: "auth-verified",
    display_name: "Verified One",
    identity_verification_status: "verified",
    updated_at: "2026-07-16T09:00:00.000Z",
  }),
];

test("1H-B public export includes listPlayerVerificationQueue", async () => {
  const api = await import("../src/features/player/index.js");
  assert.equal(typeof api.listPlayerVerificationQueue, "function");
  assert.equal(api.VERIFICATION_QUEUE_DEFAULT_STATUS, "pending");
  assert.equal(typeof api.projectAdminVerificationQueueItem, "function");
});

test("1H-B rejects unauthenticated caller", async () => {
  const harness = createListHarness(BASE_ROWS);
  const result = await harness.call(null);
  assert.equal(result.ok, false);
  assert.equal(result.code, VERIFICATION_QUEUE_ERROR_CODES.NOT_AUTHENTICATED);
  assert.deepEqual(result.data, []);
  assert.equal(harness.listCalls.length, 0);
});

test("1H-B rejects unauthorized staff without user.manage", async () => {
  const { venueManager } = makeActors();
  const harness = createListHarness(BASE_ROWS);
  const result = await harness.call(venueManager);
  assert.equal(result.ok, false);
  assert.equal(result.code, VERIFICATION_QUEUE_ERROR_CODES.UNAUTHORIZED);
  assert.deepEqual(result.data, []);
  assert.equal(harness.listCalls.length, 0);
});

test("1H-B SUPER_ADMIN allowed", async () => {
  const { superAdmin } = makeActors();
  const harness = createListHarness(BASE_ROWS);
  const result = await harness.call(superAdmin);
  assert.equal(result.ok, true);
  assert.equal(result.meta.status, VERIFICATION_QUEUE_DEFAULT_STATUS);
  assert.ok(result.data.length >= 2);
  assert.ok(result.data.every((item) => item.verificationStatus === "pending"));
});

test("1H-B PLATFORM_ADMIN allowed", async () => {
  const { platformAdmin } = makeActors();
  const harness = createListHarness(BASE_ROWS);
  const result = await harness.call(platformAdmin);
  assert.equal(result.ok, true);
  assert.ok(result.data.every((item) => item.verificationStatus === "pending"));
});

test("1H-B same-scope user.manage caller allowed", async () => {
  const { tenantOwner } = makeActors();
  const harness = createListHarness(BASE_ROWS);
  const result = await harness.call(tenantOwner);
  assert.equal(result.ok, true);
  assert.equal(result.meta.venueId, VENUE_A);
  assert.ok(result.data.length >= 1);
  assert.ok(result.data.every((item) => item.venueId === VENUE_A));
});

test("1H-B cross-venue records excluded for venue-scoped caller", async () => {
  const { tenantOwner } = makeActors();
  const harness = createListHarness(BASE_ROWS);
  const result = await harness.call(tenantOwner);
  assert.equal(result.ok, true);
  assert.equal(
    result.data.some((item) => item.venueId === VENUE_B),
    false
  );
  assert.equal(
    result.data.some((item) => item.displayName === "Pending Other Venue"),
    false
  );
});

test("1H-B cross-venue venueId request rejected for venue-scoped caller", async () => {
  const { tenantOwner } = makeActors();
  const harness = createListHarness(BASE_ROWS);
  const result = await harness.call(tenantOwner, { venueId: VENUE_B });
  assert.equal(result.ok, false);
  assert.equal(result.code, VERIFICATION_QUEUE_ERROR_CODES.UNAUTHORIZED);
  assert.equal(harness.listCalls.length, 0);
});

test("1H-B default filter returns pending only", async () => {
  const { tenantOwner } = makeActors();
  const harness = createListHarness(BASE_ROWS);
  const result = await harness.call(tenantOwner);
  assert.equal(result.ok, true);
  assert.equal(result.meta.status, "pending");
  assert.equal(result.meta.statusDefaulted, true);
  assert.ok(result.data.length > 0);
  assert.ok(result.data.every((item) => item.verificationStatus === "pending"));
  assert.equal(
    result.data.some((item) => item.verificationStatus === "unverified"),
    false
  );
});

test("1H-B explicit supported status filter works", async () => {
  const { tenantOwner } = makeActors();
  const harness = createListHarness(BASE_ROWS);
  const result = await harness.call(tenantOwner, { status: "rejected" });
  assert.equal(result.ok, true);
  assert.equal(result.meta.status, "rejected");
  assert.equal(result.meta.statusDefaulted, false);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].verificationStatus, "rejected");
  assert.equal(result.data[0].displayName, "Rejected One");
});

test("1H-B unsupported status rejected", async () => {
  const { tenantOwner } = makeActors();
  const harness = createListHarness(BASE_ROWS);
  const result = await harness.call(tenantOwner, { status: "all" });
  assert.equal(result.ok, false);
  assert.equal(result.code, VERIFICATION_QUEUE_ERROR_CODES.UNSUPPORTED_STATUS);
  assert.deepEqual(result.data, []);
  assert.equal(harness.listCalls.length, 0);
});

test("1H-B search filter works deterministically", async () => {
  const { tenantOwner } = makeActors();
  const harness = createListHarness(BASE_ROWS);
  const result = await harness.call(tenantOwner, { query: "pending new" });
  assert.equal(result.ok, true);
  assert.equal(result.data.length, 1);
  assert.equal(result.data[0].displayName, "Pending New");
});

test("1H-B result limit is enforced", async () => {
  const rows = Array.from({ length: 8 }, (_, i) =>
    profileRow({
      id: `auth-lim-${i}`,
      display_name: `Limited ${i}`,
      identity_verification_status: "pending",
      updated_at: `2026-07-20T${String(10 + i).padStart(2, "0")}:00:00.000Z`,
    })
  );
  const { tenantOwner } = makeActors();
  const harness = createListHarness(rows);
  const result = await harness.call(tenantOwner, { limit: 3 });
  assert.equal(result.ok, true);
  assert.equal(result.data.length, 3);
  assert.equal(result.meta.limit, 3);

  const capped = await harness.call(tenantOwner, { limit: 999 });
  assert.equal(capped.ok, true);
  assert.equal(capped.meta.limit, VERIFICATION_QUEUE_MAX_LIMIT);
  assert.ok(capped.data.length <= VERIFICATION_QUEUE_MAX_LIMIT);
});

test("1H-B deterministic sorting by updatedAt desc then playerId", async () => {
  const { tenantOwner } = makeActors();
  const harness = createListHarness(BASE_ROWS);
  const result = await harness.call(tenantOwner);
  assert.equal(result.ok, true);
  assert.ok(result.data.length >= 2);
  assert.equal(result.data[0].displayName, "Pending New");
  assert.equal(result.data[1].displayName, "Pending Old");
  for (let i = 1; i < result.data.length; i += 1) {
    const prev = Date.parse(result.data[i - 1].updatedAt);
    const curr = Date.parse(result.data[i].updatedAt);
    assert.ok(prev >= curr);
  }
});

test("1H-B sensitive fields excluded from queue DTO", async () => {
  const { tenantOwner } = makeActors();
  const harness = createListHarness(BASE_ROWS);
  const result = await harness.call(tenantOwner);
  assert.equal(result.ok, true);
  assert.ok(result.data.length > 0);
  for (const item of result.data) {
    const keys = Object.keys(item).sort();
    assert.deepEqual(keys, [...ADMIN_VERIFICATION_QUEUE_DTO_FIELDS].sort());
    for (const excluded of ADMIN_VERIFICATION_QUEUE_EXCLUDED_FIELDS) {
      assert.equal(Object.prototype.hasOwnProperty.call(item, excluded), false);
    }
    assert.equal(item.email, undefined);
    assert.equal(item.phone, undefined);
    assert.equal(item.privacy_settings, undefined);
    assert.equal(item.privacySettings, undefined);
  }
});

test("1H-B raw privacy_settings are not exposed", () => {
  const item = projectAdminVerificationQueueItem(
    profileRow({
      id: "auth-privacy",
      privacy_settings: { publicProfileEnabled: false, showPhone: true },
    })
  );
  assert.ok(item);
  assert.equal(Object.prototype.hasOwnProperty.call(item, "privacy_settings"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(item, "privacySettings"), false);
  assert.equal(item.privacy_settings, undefined);
  assert.equal(item.privacySettings, undefined);
  const serialized = JSON.stringify(item);
  assert.equal(serialized.includes("privacy_settings"), false);
  assert.equal(serialized.includes("privacySettings"), false);
  assert.equal(serialized.includes("showPhone"), false);
});

test("1H-B no mutation API is called", async () => {
  const { tenantOwner } = makeActors();
  const harness = createListHarness(BASE_ROWS);
  const result = await harness.call(tenantOwner);

  assert.equal(result.ok, true);
  assert.equal(result.meta.readOnly, true);
  // Queue API surface is read-only; writer remains a separate export.
  assert.equal(typeof updatePlayerVerificationStatus, "function");
  assert.equal(harness.mutationCalls.length, 0);
  assert.ok(harness.listCalls.length >= 1);
});
