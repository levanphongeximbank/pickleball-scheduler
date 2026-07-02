import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  INTEGRATION_STORE_MODES,
  resolveIntegrationStoreMode,
  getIntegrationStore,
  resetIntegrationStore,
  createIntegrationStore,
} from "../src/features/integrations/index.js";
import { createDefaultTenantSettings } from "../src/features/integrations/models/integrationDefaults.js";
import {
  getTenantIntegrationSettings,
  saveTenantIntegrationSettings,
  clearIntegrationStorage,
} from "../src/features/integrations/storage/integrationStorage.js";
import { serializeTenantSettingsRow } from "../src/features/integrations/repositories/integrationRowMap.js";
import { can } from "../src/auth/rbac.js";
import { canAccessRoute } from "../src/auth/menuAccess.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { ROLES } from "../src/auth/roles.js";
import { normalizeUser } from "../src/models/user.js";
import {
  canManageIntegrations,
  toggleIntegrationProvider,
} from "../src/features/integrations/services/integrationSettingsService.js";
import { enableRbac, signInAs } from "../src/auth/authService.js";

const TENANT_A = "tenant-a-phase11b";
const TENANT_B = "tenant-b-phase11b";

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

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  process.env.NODE_ENV = "test";
  process.env.VITE_INTEGRATIONS_STORE_MODE = "memory";
  resetIntegrationStore();
  clearIntegrationStorage();
});

afterEach(() => {
  resetIntegrationStore();
  clearIntegrationStorage();
});

describe("Phase 11B — integration store mode", () => {
  it("defaults to memory in test environment", () => {
    assert.equal(resolveIntegrationStoreMode(), INTEGRATION_STORE_MODES.MEMORY);
  });

  it("memory store isolates tenants", () => {
    saveTenantIntegrationSettings(TENANT_A, { zaloEnabled: true });
    saveTenantIntegrationSettings(TENANT_B, { emailEnabled: true });
    assert.equal(getTenantIntegrationSettings(TENANT_A).zaloEnabled, true);
    assert.equal(getTenantIntegrationSettings(TENANT_B).zaloEnabled, false);
  });
});

describe("Phase 11B — row map security", () => {
  it("serialize strips secret-like fields from settings", () => {
    const row = serializeTenantSettingsRow(TENANT_A, {
      ...createDefaultTenantSettings(TENANT_A),
      hashSecret: "must-not-persist",
      zaloConfig: { appId: "app-1", secret: "zalo-secret" },
    });
    assert.equal(row.settings.hashSecret, undefined);
    assert.equal(row.settings.zaloConfig.secret, undefined);
    assert.equal(row.settings.zaloConfig.appId, "app-1");
  });
});

describe("Phase 11B — supabase store shape", () => {
  it("supabase store tracks dirty tenants without network", async () => {
    const store = createIntegrationStore({
      mode: INTEGRATION_STORE_MODES.MEMORY,
    });
    store.writeTenantSettings(TENANT_A, { mockPaymentEnabled: true });
    assert.equal(store.readTenantSettings(TENANT_A).mockPaymentEnabled, true);
    assert.equal(getIntegrationStore({ forceNew: true, mode: "memory" }).mode, "memory");
  });
});

describe("Phase 11B — integration RBAC", () => {
  const rbac = { rbacEnabled: true };
  const venueScope = { venueId: "venue-staging-a", tenantId: "venue-staging-a" };

  it("COURT_OWNER / VENUE_OWNER can INTEGRATION_MANAGE at venue scope", () => {
    const owner = normalizeUser({
      id: "owner-a",
      email: "owner@staging.local",
      role: ROLES.VENUE_OWNER,
      venueId: "venue-staging-a",
      status: "active",
    });

    assert.equal(can(owner, PERMISSIONS.INTEGRATION_MANAGE, venueScope, rbac), true);
    assert.equal(canManageIntegrations(owner).ok, true);
  });

  it("PLAYER cannot INTEGRATION_MANAGE", () => {
    const player = normalizeUser({
      id: "player-1",
      role: ROLES.PLAYER,
      venueId: "venue-staging-a",
      clubId: "club-1",
      playerId: "player-1",
      status: "active",
    });

    assert.equal(can(player, PERMISSIONS.INTEGRATION_MANAGE, venueScope, rbac), false);
    enableRbac();
    assert.equal(canManageIntegrations(player).ok, false);
  });

  it("/settings/integrations route allowed for owner, blocked for player", () => {
    const owner = normalizeUser({
      id: "owner-a",
      role: ROLES.COURT_OWNER,
      venueId: "venue-staging-a",
      status: "active",
    });
    const player = normalizeUser({
      id: "player-1",
      role: ROLES.PLAYER,
      clubId: "club-1",
      playerId: "player-1",
      status: "active",
    });

    const ownerCan = (perm, scope) => can(owner, perm, scope, rbac);
    const playerCan = (perm, scope) => can(player, perm, scope, rbac);

    assert.equal(canAccessRoute(ownerCan, "/settings/integrations", venueScope), true);
    assert.equal(canAccessRoute(playerCan, "/settings/integrations", venueScope), false);
  });

  it("toggle integration uses memory store without network", () => {
    enableRbac();
    signInAs({
      id: "owner-a",
      role: ROLES.COURT_OWNER,
      venueId: TENANT_A,
      status: "active",
    });

    assert.equal(canManageIntegrations().ok, true);

    const result = toggleIntegrationProvider(TENANT_A, "mock", true);
    assert.equal(result.ok, true);
    assert.equal(result.settings.mockPaymentEnabled, true);
    assert.equal(getTenantIntegrationSettings(TENANT_A).mockPaymentEnabled, true);
  });
});
