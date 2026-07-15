import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { ROLES, normalizeRole } from "../src/auth/roles.js";
import { createUserRecord } from "../src/models/user.js";
import { saveClubs } from "../src/data/club.js";
import {
  resolveGovernanceElevatedRole,
  hasClubGovernanceManagerAccess,
  hydrateGovernanceScope,
  clearGovernanceScope,
  getGovernanceScopeState,
  isGovernanceCloudAuthoritative,
  primeGovernanceScopeForTest,
  setGovernanceScopeErrorForTest,
  GOVERNANCE_MANAGER_ROLES,
  GOV_SCOPE_STATUS,
} from "../src/auth/governanceScopeResolver.js";
import { RULES } from "../scripts/ci/ownership-lock.mjs";

const CLUB_ID = "club-gov-canon";
const TENANT = "tenant-gov-canon";

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

function playerUser(id, clubId = CLUB_ID) {
  return createUserRecord({
    id,
    role: ROLES.PLAYER,
    clubId,
    tenantId: TENANT,
    status: "active",
  });
}

function clubWithGovernance(governance) {
  return {
    id: CLUB_ID,
    name: "Canon Club",
    venueId: TENANT,
    tenantId: TENANT,
    governance: { registeredCourtIds: [], ...governance },
  };
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  globalThis.sessionStorage = createLocalStorageMock();
  clearGovernanceScope();
});

afterEach(() => {
  clearGovernanceScope();
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
});

// ---------------------------------------------------------------------------
// Cloud-authoritative (Club Storage V2 = canonical governance SSOT)
// ---------------------------------------------------------------------------
describe("Phase 44C.1A — canonical governance elevation (cloud/V2 authoritative)", () => {
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = "https://unit-test.supabase.co";
    process.env.VITE_SUPABASE_ANON_KEY =
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.governance-canon-unit-test";
    process.env.VITE_CLUB_STORAGE_V2 = "true";
    clearGovernanceScope();
  });

  afterEach(() => {
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.VITE_SUPABASE_ANON_KEY;
    delete process.env.VITE_CLUB_STORAGE_V2;
    clearGovernanceScope();
  });

  it("environment is governance cloud authoritative", () => {
    assert.equal(isGovernanceCloudAuthoritative(), true);
  });

  it("1. canonical president is elevated to CLUB_MANAGER", () => {
    const president = playerUser("gov-president-1");
    // phase42_has_gov_role(['president','vice_president']) → allowed (president row).
    primeGovernanceScopeForTest({ user: president, elevated: true, clubId: CLUB_ID });

    assert.equal(hasClubGovernanceManagerAccess(president), true);
    assert.equal(resolveGovernanceElevatedRole(president), ROLES.CLUB_MANAGER);
  });

  it("2. canonical vice-president is elevated (RPC covers vice_president role)", () => {
    // The canonical predicate is asked for BOTH manager governance roles.
    assert.ok(GOVERNANCE_MANAGER_ROLES.includes("president"));
    assert.ok(GOVERNANCE_MANAGER_ROLES.includes("vice_president"));

    const vice = playerUser("gov-vice-2");
    primeGovernanceScopeForTest({ user: vice, elevated: true, clubId: CLUB_ID });

    assert.equal(hasClubGovernanceManagerAccess(vice), true);
    assert.equal(resolveGovernanceElevatedRole(vice), ROLES.CLUB_MANAGER);
  });

  it("3. stale local president cannot elevate", () => {
    const user = playerUser("gov-stale-pres-3");
    // Stale local registry says this user is president.
    saveClubs([clubWithGovernance({ presidentUserId: user.id })]);
    // Canonical governance says NOT a manager (snapshot resolved, not elevated).
    primeGovernanceScopeForTest({ user, elevated: false, clubId: CLUB_ID });

    assert.equal(hasClubGovernanceManagerAccess(user), false);
    assert.equal(resolveGovernanceElevatedRole(user), ROLES.PLAYER);
  });

  it("4. stale local vice-president cannot elevate", () => {
    const user = playerUser("gov-stale-vice-4");
    saveClubs([clubWithGovernance({ vicePresidentUserId: user.id })]);
    primeGovernanceScopeForTest({ user, elevated: false, clubId: CLUB_ID });

    assert.equal(hasClubGovernanceManagerAccess(user), false);
    assert.equal(resolveGovernanceElevatedRole(user), ROLES.PLAYER);
  });

  it("5. canonical governance error defaults to no elevation", () => {
    const user = playerUser("gov-error-5");
    saveClubs([clubWithGovernance({ presidentUserId: user.id })]);
    setGovernanceScopeErrorForTest({ user, code: "RPC_FAILED" });

    assert.equal(hasClubGovernanceManagerAccess(user), false);
    assert.equal(resolveGovernanceElevatedRole(user), ROLES.PLAYER);
  });

  it("6. loading/unresolved state does not temporarily elevate", () => {
    const user = playerUser("gov-loading-6");
    saveClubs([clubWithGovernance({ presidentUserId: user.id })]);
    clearGovernanceScope(); // idle / unresolved

    assert.equal(hasClubGovernanceManagerAccess(user), false);
    assert.equal(resolveGovernanceElevatedRole(user), ROLES.PLAYER);
  });

  it("7. non-PLAYER roles are returned unchanged (no governance lookup)", () => {
    const manager = createUserRecord({ id: "gov-mgr-7", role: ROLES.CLUB_MANAGER, clubId: CLUB_ID, status: "active" });
    const venueOwner = createUserRecord({ id: "gov-vo-7", role: ROLES.VENUE_OWNER, venueId: TENANT, status: "active" });
    clearGovernanceScope();

    // Non-PLAYER roles pass through normalizeRole unchanged and are never elevated.
    assert.equal(resolveGovernanceElevatedRole(manager), normalizeRole(manager.role));
    assert.equal(resolveGovernanceElevatedRole(venueOwner), normalizeRole(venueOwner.role));
    assert.notEqual(resolveGovernanceElevatedRole(venueOwner), ROLES.CLUB_MANAGER);
  });

  it("8. SUPER_ADMIN is unchanged regardless of governance hydration", () => {
    const admin = createUserRecord({ id: "gov-admin-8", role: ROLES.SUPER_ADMIN, status: "active" });
    clearGovernanceScope();
    assert.equal(resolveGovernanceElevatedRole(admin), normalizeRole(admin.role));
    assert.notEqual(resolveGovernanceElevatedRole(admin), ROLES.CLUB_MANAGER);
  });

  it("9. user switch clears prior governance elevation (no cross-user leakage)", () => {
    const userA = playerUser("gov-switch-9a");
    const userB = playerUser("gov-switch-9b");
    // Only userB is hydrated as elevated.
    primeGovernanceScopeForTest({ user: userB, elevated: true, clubId: CLUB_ID });

    assert.equal(resolveGovernanceElevatedRole(userB), ROLES.CLUB_MANAGER);
    // userA must not inherit userB's elevation.
    assert.equal(resolveGovernanceElevatedRole(userA), ROLES.PLAYER);
  });

  it("10. tenant switch clears prior governance elevation", () => {
    const user = playerUser("gov-tenant-10");
    primeGovernanceScopeForTest({ user, elevated: true, clubId: CLUB_ID });
    assert.equal(resolveGovernanceElevatedRole(user), ROLES.CLUB_MANAGER);

    // ClubContext calls clearGovernanceScope() on tenant/user switch.
    clearGovernanceScope();
    assert.equal(getGovernanceScopeState().status, GOV_SCOPE_STATUS.IDLE);
    assert.equal(resolveGovernanceElevatedRole(user), ROLES.PLAYER);
  });
});

// ---------------------------------------------------------------------------
// Offline / no-Supabase (local registry remains the single source)
// ---------------------------------------------------------------------------
describe("Phase 44C.1A — offline governance elevation (local single source)", () => {
  it("is not governance cloud authoritative without Supabase/V2", () => {
    assert.equal(isGovernanceCloudAuthoritative(), false);
  });

  it("11. offline PLAYER president/vice elevate from the local registry (legacy parity)", async () => {
    const president = playerUser("gov-offline-pres");
    const vice = playerUser("gov-offline-vice");
    saveClubs([
      clubWithGovernance({ presidentUserId: president.id, vicePresidentUserId: vice.id }),
    ]);

    assert.equal(resolveGovernanceElevatedRole(president), ROLES.CLUB_MANAGER);
    assert.equal(resolveGovernanceElevatedRole(vice), ROLES.CLUB_MANAGER);

    // A plain member is not elevated.
    const member = playerUser("gov-offline-member");
    assert.equal(resolveGovernanceElevatedRole(member), ROLES.PLAYER);

    // Offline hydration builds a ready (non-cloud) snapshot without network.
    const result = await hydrateGovernanceScope({ user: president });
    assert.equal(result.ok, true);
    assert.equal(result.source, "local");
    assert.equal(getGovernanceScopeState().status, GOV_SCOPE_STATUS.READY);
  });

  it("offline non-PLAYER + SUPER_ADMIN unchanged", () => {
    const admin = createUserRecord({ id: "gov-offline-admin", role: ROLES.SUPER_ADMIN, status: "active" });
    const manager = createUserRecord({ id: "gov-offline-mgr", role: ROLES.CLUB_MANAGER, clubId: CLUB_ID, status: "active" });
    assert.equal(resolveGovernanceElevatedRole(admin), normalizeRole(admin.role));
    assert.equal(resolveGovernanceElevatedRole(manager), normalizeRole(manager.role));
    assert.notEqual(resolveGovernanceElevatedRole(admin), ROLES.CLUB_MANAGER);
  });
});

// ---------------------------------------------------------------------------
// CI ownership lock detects new legacy governance authorization dependencies
// ---------------------------------------------------------------------------
describe("Phase 44C.1A — governance ownership lock", () => {
  it("12. lock detects getClubById()/loadClubs() in governance authz paths", () => {
    const rule = RULES.find((r) => r.id === "governance-legacy-registry-read");
    assert.ok(rule, "governance-legacy-registry-read rule must exist");

    assert.ok(rule.onlyIn.includes("src/features/club/services/governanceRoleElevation.js"));
    assert.ok(rule.onlyIn.includes("src/auth/menuAccess.js"));

    assert.ok(rule.match("const club = getClubById(user.clubId);").length >= 1);
    assert.ok(rule.match("const all = loadClubs();").length >= 1);
    assert.ok(rule.match('localStorage.getItem("pickleball-clubs-v1")').length >= 1);

    // Canonical resolver usage is not flagged.
    assert.equal(rule.match("await rpcV2HasClubGovernanceRole(clubId, roles);").length, 0);
  });

  it("elevation logic may only be DEFINED in the canonical resolver", () => {
    const rule = RULES.find((r) => r.id === "governance-elevation-owner");
    assert.ok(rule, "governance-elevation-owner rule must exist");

    assert.ok(rule.match("export function resolveGovernanceElevatedRole(user) {").length >= 1);
    assert.ok(rule.match("function hasClubGovernanceManagerAccess(user, club) {").length >= 1);

    // Importing / re-exporting the canonical functions is NOT a definition and is allowed.
    assert.equal(rule.match("import { resolveGovernanceElevatedRole } from './x.js';").length, 0);
    assert.equal(rule.match("export { hasClubGovernanceManagerAccess, resolveGovernanceElevatedRole };").length, 0);

    assert.ok(rule.allow.includes("src/auth/governanceScopeResolver.js"));
  });
});
