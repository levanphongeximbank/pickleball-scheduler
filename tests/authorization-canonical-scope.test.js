import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { ROLES } from "../src/auth/roles.js";
import { canAccessClub } from "../src/auth/rbac.js";
import { createUserRecord } from "../src/models/user.js";
import { saveClubs } from "../src/data/club.js";
import {
  resolveAllowedClubIds,
  assertClubInScope,
  resolveScopedClubId,
} from "../src/features/api/services/clubScopeService.js";
import {
  clearClubScope,
  getClubScopeState,
  getScopedClubsForAuthz,
  hydrateClubScope,
  isCloudRegistryAuthoritative,
  primeClubScopeForTest,
  setClubScopeErrorForTest,
  SCOPE_STATUS,
} from "../src/auth/clubScopeResolver.js";
import { RULES } from "../scripts/ci/ownership-lock.mjs";

const RBAC_ON = { rbacEnabled: true };
const TENANT_A = "tenant-canon-a";
const TENANT_B = "tenant-canon-b";
const CLUB_A = "club-canon-a";
const CLUB_B = "club-canon-b";

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

function ownerUser(id, venueId = TENANT_A) {
  return createUserRecord({
    id,
    role: ROLES.VENUE_OWNER,
    venueId,
    tenantId: venueId,
    status: "active",
  });
}

function cloudClub(id, tenantId = TENANT_A) {
  return { id, name: `Club ${id}`, venueId: tenantId, tenantId, isDefault: false };
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  globalThis.sessionStorage = createLocalStorageMock();
  clearClubScope();
});

afterEach(() => {
  clearClubScope();
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
});

// ---------------------------------------------------------------------------
// Cloud-authoritative behavior (Supabase configured → cloud registry is SoT)
// ---------------------------------------------------------------------------
describe("Phase 44C.1 — canonical club scope (cloud authoritative)", () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = "https://unit-test.supabase.co";
    process.env.VITE_SUPABASE_ANON_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.canonical-club-scope-unit-test";
    clearClubScope();
  });

  afterEach(() => {
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    delete process.env.VITE_CLUB_STORAGE_V2;
    delete process.env.VITE_CLUB_REGISTRY_CLOUD;
    clearClubScope();
  });

  it("environment is cloud authoritative", () => {
    assert.equal(isCloudRegistryAuthoritative(), true);
  });

  it("1. user with canonical active club membership is allowed", () => {
    const owner = ownerUser("owner-1");
    primeClubScopeForTest({ user: owner, tenantId: TENANT_A, clubs: [cloudClub(CLUB_A)] });

    assert.equal(canAccessClub(owner, CLUB_A, {}, RBAC_ON), true);
  });

  it("2. user without canonical membership is denied even if LocalStorage lists the club", () => {
    const owner = ownerUser("owner-2");
    // Stale local registry lists CLUB_B for this owner's venue.
    saveClubs([{ id: CLUB_B, name: "Stale", venueId: TENANT_A, tenantId: TENANT_A }]);
    // Canonical cloud scope only contains CLUB_A.
    primeClubScopeForTest({ user: owner, tenantId: TENANT_A, clubs: [cloudClub(CLUB_A)] });

    assert.equal(canAccessClub(owner, CLUB_B, { venueId: TENANT_A }, RBAC_ON), false);
  });

  it("3. stale LocalStorage cannot grant access", () => {
    const owner = ownerUser("owner-3");
    saveClubs([{ id: CLUB_A, name: "Stale A", venueId: TENANT_A, tenantId: TENANT_A }]);
    // Canonical scope is empty (owner has no clubs on the cloud registry).
    primeClubScopeForTest({ user: owner, tenantId: TENANT_A, clubs: [] });

    assert.equal(canAccessClub(owner, CLUB_A, { venueId: TENANT_A }, RBAC_ON), false);
    assert.equal(
      resolveAllowedClubIds({ tenantId: TENANT_A, user: owner, rbacEnabled: true }).size,
      0
    );
  });

  it("4. canonical cloud registry error defaults to deny", () => {
    const owner = ownerUser("owner-4");
    setClubScopeErrorForTest({ user: owner, tenantId: TENANT_A, code: "RPC_FAILED" });

    assert.equal(canAccessClub(owner, CLUB_A, { venueId: TENANT_A }, RBAC_ON), false);
    assert.equal(
      resolveAllowedClubIds({ tenantId: TENANT_A, user: owner, rbacEnabled: true }).size,
      0
    );
  });

  it("5. loading state does not temporarily grant access", () => {
    const owner = ownerUser("owner-5");
    clearClubScope(); // unresolved → loading

    assert.equal(getScopedClubsForAuthz({ user: owner, tenantId: TENANT_A }).ready, false);
    assert.equal(canAccessClub(owner, CLUB_A, { venueId: TENANT_A }, RBAC_ON), false);
    assert.equal(
      resolveAllowedClubIds({ tenantId: TENANT_A, user: owner, rbacEnabled: true }).size,
      0
    );
  });

  it("6. logout clears allowed-club scope", () => {
    const owner = ownerUser("owner-6");
    primeClubScopeForTest({ user: owner, tenantId: TENANT_A, clubs: [cloudClub(CLUB_A)] });
    assert.equal(canAccessClub(owner, CLUB_A, {}, RBAC_ON), true);

    clearClubScope(); // logout
    assert.equal(getClubScopeState().status, SCOPE_STATUS.IDLE);
    assert.equal(canAccessClub(owner, CLUB_A, {}, RBAC_ON), false);
  });

  it("7. user switch clears previous user scope (no cross-user leakage)", () => {
    const ownerA = ownerUser("owner-7a");
    const ownerB = ownerUser("owner-7b");
    // Only ownerB is hydrated.
    primeClubScopeForTest({ user: ownerB, tenantId: TENANT_A, clubs: [cloudClub(CLUB_A)] });

    assert.equal(canAccessClub(ownerB, CLUB_A, {}, RBAC_ON), true);
    // ownerA must not inherit ownerB's canonical scope.
    assert.equal(canAccessClub(ownerA, CLUB_A, {}, RBAC_ON), false);
  });

  it("8. tenant switch clears previous tenant scope", () => {
    const owner = ownerUser("owner-8", TENANT_A);
    primeClubScopeForTest({ user: owner, tenantId: TENANT_A, clubs: [cloudClub(CLUB_A, TENANT_A)] });
    assert.equal(canAccessClub(owner, CLUB_A, {}, RBAC_ON), true);

    // Switching tenants clears scope (ClubContext calls clearClubScope on switch).
    clearClubScope();
    assert.equal(
      resolveAllowedClubIds({ tenantId: TENANT_B, user: owner, rbacEnabled: true }).size,
      0
    );
  });

  it("9. API handler rejects missing club scope with CLUB_REQUIRED", () => {
    const owner = ownerUser("owner-9");
    primeClubScopeForTest({ user: owner, tenantId: TENANT_A, clubs: [cloudClub(CLUB_A)] });
    const ctx = { auth: { tenantId: TENANT_A, user: owner } };

    assert.throws(
      () => assertClubInScope("", ctx),
      (error) => error.statusCode === 403 && error.code === "CLUB_REQUIRED"
    );
  });

  it("10. API handler rejects unauthorized club with CLUB_OUT_OF_SCOPE", () => {
    const owner = ownerUser("owner-10");
    primeClubScopeForTest({ user: owner, tenantId: TENANT_A, clubs: [cloudClub(CLUB_A)] });
    const ctx = { auth: { tenantId: TENANT_A, user: owner } };

    assert.throws(
      () => assertClubInScope(CLUB_B, ctx),
      (error) => error.statusCode === 403 && error.code === "CLUB_OUT_OF_SCOPE"
    );
  });

  it("11. server does not trust client-provided clubId", () => {
    const owner = ownerUser("owner-11");
    // Client puts an out-of-scope clubId in the query; canonical scope only has CLUB_A.
    primeClubScopeForTest({ user: owner, tenantId: TENANT_A, clubs: [cloudClub(CLUB_A)] });
    const ctx = { auth: { tenantId: TENANT_A, user: owner }, query: { clubId: CLUB_B } };

    assert.throws(
      () => resolveScopedClubId(ctx),
      (error) => error.code === "CLUB_OUT_OF_SCOPE"
    );

    // In-scope request resolves to the verified club.
    const okCtx = { auth: { tenantId: TENANT_A, user: owner }, query: { clubId: CLUB_A } };
    assert.equal(resolveScopedClubId(okCtx), CLUB_A);
  });

  it("12. SUPER_ADMIN retains full access regardless of scope hydration", () => {
    const admin = createUserRecord({ id: "admin-12", role: ROLES.SUPER_ADMIN, status: "active" });
    clearClubScope(); // even unresolved
    assert.equal(canAccessClub(admin, CLUB_A, {}, RBAC_ON), true);
    assert.equal(canAccessClub(admin, "any-club", {}, RBAC_ON), true);
  });

  it("13. Club Owner keeps access to assigned club, denied for others", () => {
    const clubOwner = createUserRecord({
      id: "club-owner-13",
      role: ROLES.CLUB_OWNER,
      venueId: TENANT_A,
      clubId: CLUB_A,
      status: "active",
    });
    // Club-scoped access is decided by the assigned clubId (JWT/profile), not the registry.
    assert.equal(canAccessClub(clubOwner, CLUB_A, { venueId: TENANT_A }, RBAC_ON), true);
    assert.equal(canAccessClub(clubOwner, CLUB_B, { venueId: TENANT_A }, RBAC_ON), false);
  });
});

// ---------------------------------------------------------------------------
// Offline / no-cloud behavior (local registry is the single source)
// ---------------------------------------------------------------------------
describe("Phase 44C.1 — offline scope (local single source)", () => {
  it("is not cloud authoritative without Supabase config", () => {
    assert.equal(isCloudRegistryAuthoritative(), false);
  });

  it("hydrateClubScope builds from the local registry", async () => {
    const owner = ownerUser("owner-offline-1");
    saveClubs([{ id: CLUB_A, name: "A", venueId: TENANT_A, tenantId: TENANT_A }]);

    const result = await hydrateClubScope({ user: owner, tenantId: TENANT_A });
    assert.equal(result.ok, true);
    assert.equal(result.source, "local");
    assert.equal(getClubScopeState().status, SCOPE_STATUS.READY);
  });

  it("venue owner can access an in-venue club (legacy parity offline)", () => {
    const owner = ownerUser("owner-offline-2");
    saveClubs([{ id: CLUB_A, name: "A", venueId: TENANT_A, tenantId: TENANT_A }]);
    assert.equal(canAccessClub(owner, CLUB_A, {}, RBAC_ON), true);
  });

  it("SUPER_ADMIN retains access offline", () => {
    const admin = createUserRecord({ id: "admin-offline", role: ROLES.SUPER_ADMIN, status: "active" });
    assert.equal(canAccessClub(admin, CLUB_A, {}, RBAC_ON), true);
  });

  it("resolveAllowedClubIds returns tenant clubs the user can access", () => {
    const owner = ownerUser("owner-offline-3");
    saveClubs([
      { id: CLUB_A, name: "A", venueId: TENANT_A, tenantId: TENANT_A },
      { id: CLUB_B, name: "B", venueId: TENANT_B, tenantId: TENANT_B },
    ]);
    const allowed = resolveAllowedClubIds({ tenantId: TENANT_A, user: owner, rbacEnabled: true });
    assert.equal(allowed.has(CLUB_A), true);
    assert.equal(allowed.has(CLUB_B), false);
  });
});

// ---------------------------------------------------------------------------
// CI ownership lock detects new authorization use of loadClubs()
// ---------------------------------------------------------------------------
describe("Phase 44C.1 — ownership lock", () => {
  it("15. lock rule detects loadClubs()/pickleball-clubs-v1 in authz paths", () => {
    const rule = RULES.find((r) => r.id === "authorization-legacy-club-registry");
    assert.ok(rule, "authorization-legacy-club-registry rule must exist");

    // The migrated authz-decision files are explicitly scoped.
    assert.ok(rule.onlyIn.includes("src/auth/rbac.js"));
    assert.ok(rule.onlyIn.includes("src/auth/guardAction.js"));
    assert.ok(rule.onlyIn.includes("src/features/api/services/clubScopeService.js"));

    // Forbidden patterns are detected.
    assert.ok(rule.match("const clubs = loadClubs();").length >= 1);
    assert.ok(rule.match('localStorage.getItem("pickleball-clubs-v1")').length >= 1);

    // Canonical resolver usage is not flagged.
    assert.equal(rule.match("const { clubs } = getScopedClubsForAuthz(opts);").length, 0);
  });

  it("raw role-string comparisons are detected in authz paths", () => {
    const rule = RULES.find((r) => r.id === "authorization-raw-role-compare");
    assert.ok(rule, "authorization-raw-role-compare rule must exist");
    assert.ok(rule.match('if (user.role === "SUPER_ADMIN") return true;').length >= 1);
    assert.equal(rule.match("if (isVenueScopedRole(user.role)) return true;").length, 0);
  });
});
