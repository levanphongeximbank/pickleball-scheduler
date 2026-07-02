import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { can } from "../src/auth/rbac.js";
import { canAccessRoute } from "../src/auth/menuAccess.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { ROLES } from "../src/auth/roles.js";
import { normalizeUser } from "../src/models/user.js";
import { saveClubs } from "../src/data/club.js";
import {
  assertTenantOperational,
  resolveRouteAccessScope,
  resolveTenantRecord,
} from "../src/features/tenant/index.js";
import { resolveBillingTenantId } from "../src/features/billing/services/billingTenantResolver.js";
import { mapProfileRowToUser } from "../src/auth/profileService.js";

const STAGING_VENUE = "venue-staging-a";
const RBAC_ON = { rbacEnabled: true };

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

function enableSupabaseEnv() {
  const nodeEnv = typeof globalThis.process !== "undefined" ? globalThis.process.env : {};
  nodeEnv.VITE_SUPABASE_URL = "https://qyewbxjsiiyufanzcjcq.supabase.co";
  nodeEnv.VITE_SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.test";
  nodeEnv.VITE_RBAC_ENABLED = "true";
  if (typeof import.meta !== "undefined" && import.meta.env) {
    import.meta.env.VITE_SUPABASE_URL = nodeEnv.VITE_SUPABASE_URL;
    import.meta.env.VITE_SUPABASE_ANON_KEY = nodeEnv.VITE_SUPABASE_ANON_KEY;
    import.meta.env.VITE_RBAC_ENABLED = "true";
  }
}

function ownerUser() {
  return mapProfileRowToUser({
    id: "owner-user-id",
    email: "owner@staging.local",
    display_name: "Owner Staging",
    role: "VENUE_OWNER",
    venue_id: STAGING_VENUE,
    club_id: null,
    status: "active",
  });
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  enableSupabaseEnv();
  saveClubs([
    {
      id: "default-club",
      name: "CLB Mặc định",
      isDefault: true,
    },
  ]);
});

afterEach(() => {
  delete globalThis.localStorage;
});

describe("Profile venue runtime", () => {
  it("VENUE_OWNER normalizes to COURT_OWNER with venue_id from profile row", () => {
    const user = ownerUser();
    assert.equal(user.role, ROLES.COURT_OWNER);
    assert.equal(user.venueId, STAGING_VENUE);
    assert.equal(user.tenantId, STAGING_VENUE);
  });

  it("assertTenantOperational passes without local venue registry when profile venue matches", () => {
    const user = ownerUser();
    const check = assertTenantOperational(STAGING_VENUE, { user });
    assert.equal(check.ok, true);
    assert.equal(check.source, "profile");
    assert.equal(check.tenant?.id, STAGING_VENUE);
  });

  it("resolveTenantRecord uses profile venue when local registry is empty", () => {
    const user = ownerUser();
    const tenant = resolveTenantRecord(STAGING_VENUE, user);
    assert.equal(tenant?.id, STAGING_VENUE);
  });

  it("resolveRouteAccessScope prefers profiles.venue_id over stale default club", () => {
    const user = ownerUser();
    const scope = resolveRouteAccessScope({
      user,
      activeClubId: "default-club",
      activeClub: { id: "default-club", name: "CLB Mặc định" },
    });

    assert.equal(scope.venueId, STAGING_VENUE);
    assert.equal(scope.tenantId, STAGING_VENUE);
    assert.notEqual(scope.venueId, "default-tenant");
    assert.notEqual(scope.venueId, "tenant-demo");
  });

  it("owner can access /profile and /billing route scopes with valid venue_id", () => {
    const user = ownerUser();
    const scope = resolveRouteAccessScope({ user, activeClubId: null, activeClub: null });
    const ownerCan = (perm, routeScope) => can(user, perm, routeScope, RBAC_ON);

    assert.equal(canAccessRoute(ownerCan, "/profile", scope), true);
    assert.equal(canAccessRoute(ownerCan, "/billing", scope), true);
    assert.equal(resolveBillingTenantId({ user, currentTenantId: scope.tenantId }), STAGING_VENUE);
  });

  it("owner can access /settings/integrations with valid venue_id", () => {
    const user = ownerUser();
    const scope = resolveRouteAccessScope({
      user,
      activeClubId: "default-club",
      activeClub: { id: "default-club" },
    });
    const ownerCan = (perm, routeScope) => can(user, perm, routeScope, RBAC_ON);

    assert.equal(canAccessRoute(ownerCan, "/settings/integrations", scope), true);
    assert.equal(can(user, PERMISSIONS.INTEGRATION_MANAGE, scope, RBAC_ON), true);
  });

  it("PLAYER cannot manage integrations with stale default club active", () => {
    const player = normalizeUser({
      id: "player-1",
      role: ROLES.PLAYER,
      clubId: "default-club",
      playerId: "player-1",
      venueId: STAGING_VENUE,
      status: "active",
    });
    const scope = resolveRouteAccessScope({
      user: player,
      activeClubId: "default-club",
      activeClub: { id: "default-club" },
    });
    const playerCan = (perm, routeScope) => can(player, perm, routeScope, RBAC_ON);

    assert.equal(can(player, PERMISSIONS.INTEGRATION_MANAGE, scope, RBAC_ON), false);
    assert.equal(canAccessRoute(playerCan, "/settings/integrations", scope), false);
  });
});
