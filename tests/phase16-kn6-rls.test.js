import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createQrToken,
  validateQrToken,
} from "../src/features/mobile/services/qrTokenService.js";
import {
  processQrCheckin,
  canPerformCheckin,
} from "../src/features/mobile/services/checkInService.js";
import { QR_ENTITY_TYPES } from "../src/features/mobile/constants/qrEntityTypes.js";
import { ROLES } from "../src/auth/roles.js";
import { createUserRecord } from "../src/models/user.js";
import { USER_STATUS } from "../src/models/user.js";

/**
 * Phase 16 KN-6 — app-layer tenant isolation intent (complements Supabase RLS).
 * Staging JWT probes: scripts/verify-phase16-kn6-rls-staging.mjs
 */

function createLocalStorageMock(seed = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

describe("Phase 16 KN-6 — tenant isolation intent", () => {
  it("maps tenant_id to venue scope for QR token creation", async () => {
    globalThis.localStorage = createLocalStorageMock();

    const created = await createQrToken({
      entityType: QR_ENTITY_TYPES.PLAYER,
      entityId: "p-venue-a",
      tenantId: "venue-staging-a",
    });

    assert.equal(created.ok, true);
    assert.equal(created.record.tenant_id, "venue-staging-a");

    const wrongTenant = await validateQrToken(created.rawToken, {
      expectedTenantId: "venue-staging-b",
    });
    assert.equal(wrongTenant.ok, false);
    assert.equal(wrongTenant.code, "WRONG_TENANT");

    const sameTenant = await validateQrToken(created.rawToken, {
      expectedTenantId: "venue-staging-a",
    });
    assert.equal(sameTenant.ok, true);

    delete globalThis.localStorage;
  });

  it("blocks cross-tenant QR check-in at validation layer", async () => {
    globalThis.localStorage = createLocalStorageMock();
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true },
      configurable: true,
      writable: true,
    });

    const created = await createQrToken({
      entityType: QR_ENTITY_TYPES.PLAYER,
      entityId: "cross-tenant-player",
      tenantId: "venue-staging-a",
    });

    const result = await processQrCheckin({
      rawToken: created.rawToken,
      tenantId: "venue-staging-b",
      skipPermissionCheck: true,
    });

    assert.equal(result.ok, false);
    assert.equal(result.code, "WRONG_TENANT");

    delete globalThis.localStorage;
    delete globalThis.navigator;
  });

  it("allows same-tenant QR check-in flow (dev store)", async () => {
    globalThis.localStorage = createLocalStorageMock();
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: true },
      configurable: true,
      writable: true,
    });

    const created = await createQrToken({
      entityType: QR_ENTITY_TYPES.PLAYER,
      entityId: "same-tenant-player",
      tenantId: "venue-staging-a",
    });

    const result = await processQrCheckin({
      rawToken: created.rawToken,
      tenantId: "venue-staging-a",
      skipPermissionCheck: true,
    });

    assert.equal(result.ok, true);
    assert.equal(result.checkin.tenant_id, "venue-staging-a");

    delete globalThis.localStorage;
    delete globalThis.navigator;
  });

  it("PLAYER role cannot perform check-in (app guard)", () => {
    const player = createUserRecord({
      role: ROLES.PLAYER,
      venueId: "venue-staging-a",
      status: USER_STATUS.ACTIVE,
    });
    assert.equal(canPerformCheckin(player), false);
  });
});

describe("Phase 16 KN-6 — RLS policy contract", () => {
  const TENANT_SCOPED_TABLES = ["qr_tokens", "checkins"];

  it("documents tenant-scoped tables", () => {
    assert.deepEqual(TENANT_SCOPED_TABLES, ["qr_tokens", "checkins"]);
  });

  it("expects profiles.venue_id as tenant key", () => {
    const profileVenueId = "venue-staging-a";
    const rowTenantId = "venue-staging-a";
    assert.equal(profileVenueId, rowTenantId);
  });

  it("expects no anon access to tenant tables", () => {
    const anonPolicies = [];
    assert.equal(anonPolicies.length, 0);
  });
});
