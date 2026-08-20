import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

if (typeof globalThis.localStorage === "undefined") {
  const store = new Map();
  globalThis.localStorage = {
    getItem(key) {
      return store.has(String(key)) ? store.get(String(key)) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
  };
}

import {
  PLATFORM_CONTEXT_STATE,
  resolvePlatformContextReadiness,
  resolveClubOperationalTenantId,
} from "../src/core/platform/app/platformContextReadiness.js";
import {
  filterVenuesForSelectedTenant,
  venueBelongsToTenant,
  clusterBelongsToVenue,
} from "../src/core/platform/app/tenantVenueIdentity.js";
import { resolveLegacyProfileTenantId } from "../src/core/platform/app/legacyTenantVenueBridge.js";
import { normalizeUser } from "../src/models/user.js";
import { normalizeVenue, createVenueRecord } from "../src/models/venue.js";
import { normalizeTenant } from "../src/models/tenant.js";
import {
  clearActiveVenueId,
  loadActiveVenueId,
  saveActiveVenueId,
} from "../src/data/venueSession.js";
import { clearActiveTenantId, saveActiveTenantId } from "../src/data/tenantSession.js";
import { setActiveClusterId, getActiveClusterId, saveCourtClusters } from "../src/data/courtCluster.js";
import { saveVenues } from "../src/data/venue.js";
import { saveTenants } from "../src/data/tenantRegistry.js";
import { resetTenantVenueBootstrapFlagForTests } from "../src/features/venue/services/tenantVenueBootstrap.js";
import {
  commitVenueSwitch,
  invalidatePhysicalResourceForTenantSwitch,
  listVenuesForTenant,
  revalidatePhysicalResourceAccessForClubSwitch,
} from "../src/features/venue/services/venueSelectionService.js";
import { invalidateOperationalContextForTenantSwitch } from "../src/features/tenant/services/tenantSelectionService.js";
import { clearActiveClubIdPreference, setActiveClubIdPreference } from "../src/data/club.js";
import { AUTH_SESSION_CLEAR_REASON } from "../src/auth/authSessionLifecycle.js";
import { clearAuthSession } from "../src/auth/authStorage.js";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function resetStorage() {
  resetTenantVenueBootstrapFlagForTests();
  clearActiveVenueId();
  clearActiveTenantId();
  clearActiveClubIdPreference();
  setActiveClusterId(null);
  saveVenues([]);
  saveTenants([]);
  saveCourtClusters([]);
}

test("Wave3 identity: normalizeUser does not cross-fill tenantId↔venueId", () => {
  const onlyTenant = normalizeUser({ id: "u1", tenantId: "t1" });
  assert.equal(onlyTenant.tenantId, "t1");
  assert.equal(onlyTenant.venueId, null);

  const onlyVenue = normalizeUser({ id: "u2", venueId: "v1" });
  assert.equal(onlyVenue.venueId, "v1");
  assert.equal(onlyVenue.tenantId, null);
});

test("Wave3 identity: venue belongs to tenant by venue.tenantId only", () => {
  const venue = normalizeVenue({ id: "v-a", tenantId: "t-a", name: "A" });
  assert.equal(venueBelongsToTenant(venue, "t-a"), true);
  assert.equal(venueBelongsToTenant(venue, "t-b"), false);
  // Equal ids without tenantId stamp are rejected
  assert.equal(venueBelongsToTenant({ id: "t-a", name: "x" }, "t-a"), false);
});

test("Wave3 identity: createVenueRecord requires tenantId", () => {
  assert.throws(() => createVenueRecord("Court House", {}), /tenantId/);
  const venue = createVenueRecord("Court House", { tenantId: "tenant-1", id: "venue-1" });
  assert.equal(venue.tenantId, "tenant-1");
  assert.equal(venue.id, "venue-1");
  assert.notEqual(venue.id, venue.tenantId);
});

test("Wave3 readiness: requireVenue can block without making Venue globally mandatory", () => {
  const withoutVenueFlag = resolvePlatformContextReadiness({
    isAuthenticated: true,
    rbacEnabled: true,
    selectedTenantId: "t1",
    requireClub: false,
    requireVenue: false,
  });
  assert.equal(withoutVenueFlag.state, PLATFORM_CONTEXT_STATE.CONTEXT_READY);

  const withVenueFlag = resolvePlatformContextReadiness({
    isAuthenticated: true,
    rbacEnabled: true,
    selectedTenantId: "t1",
    requireClub: false,
    requireVenue: true,
    eligibleVenueCount: 2,
    selectedVenueId: null,
  });
  assert.equal(withVenueFlag.state, PLATFORM_CONTEXT_STATE.VENUE_REQUIRED);

  const emptyVenues = resolvePlatformContextReadiness({
    isAuthenticated: true,
    rbacEnabled: true,
    selectedTenantId: "t1",
    requireClub: false,
    requireVenue: true,
    eligibleVenueCount: 0,
    selectedVenueId: null,
  });
  assert.equal(emptyVenues.state, PLATFORM_CONTEXT_STATE.VENUE_EMPTY);
});

test("Wave3 club operational tenant prefers tenantId over venueId", () => {
  assert.equal(
    resolveClubOperationalTenantId({ tenantId: "t1", venueId: "v9" }),
    "t1"
  );
  assert.equal(resolveClubOperationalTenantId({ venueId: "v9" }), "v9");
});

test("Wave3 legacy profile bridge is explicit and single-purpose", () => {
  const bridged = resolveLegacyProfileTenantId({ venueId: "venue-home" });
  assert.equal(bridged.tenantId, "venue-home");
  assert.equal(bridged.bridged, true);

  const explicit = resolveLegacyProfileTenantId({
    tenantId: "tenant-real",
    venueId: "venue-home",
  });
  assert.equal(explicit.tenantId, "tenant-real");
  assert.equal(explicit.bridged, false);
});

test("Wave3 persistence: venue preference is user-scoped", () => {
  resetStorage();
  saveActiveVenueId("venue-1", "user-a", { tenantId: "tenant-1" });
  assert.equal(loadActiveVenueId("user-a"), "venue-1");
  assert.equal(loadActiveVenueId("user-b"), null);
});

test("Wave3 invalidation: tenant switch clears foreign venue and cluster", () => {
  resetStorage();
  saveTenants([
    normalizeTenant({ id: "tenant-a", name: "A" }),
    normalizeTenant({ id: "tenant-b", name: "B" }),
  ]);
  saveVenues([
    normalizeVenue({ id: "venue-a", tenantId: "tenant-a", name: "VA" }),
    normalizeVenue({ id: "venue-b", tenantId: "tenant-b", name: "VB" }),
  ]);
  saveActiveVenueId("venue-a", "user-1", { tenantId: "tenant-a" });
  setActiveClusterId("cluster-a");
  setActiveClubIdPreference("club-foreign");

  const physical = invalidatePhysicalResourceForTenantSwitch("tenant-b");
  assert.equal(physical.venueInvalidated, true);
  assert.equal(getActiveClusterId(), null);

  // Re-save venue under tenant-b and ensure same-tenant venue can survive
  saveActiveVenueId("venue-b", "user-1", { tenantId: "tenant-b" });
  const keep = invalidatePhysicalResourceForTenantSwitch("tenant-b");
  assert.equal(keep.venueInvalidated, false);
});

test("Wave3 invalidation: venue switch clears cluster only", () => {
  resetStorage();
  saveTenants([normalizeTenant({ id: "tenant-a", name: "A" })]);
  saveVenues([
    normalizeVenue({ id: "venue-a1", tenantId: "tenant-a", name: "A1" }),
    normalizeVenue({ id: "venue-a2", tenantId: "tenant-a", name: "A2" }),
  ]);
  setActiveClusterId("cluster-old");
  const result = commitVenueSwitch({
    venueId: "venue-a2",
    tenantId: "tenant-a",
    user: { id: "user-1" },
  });
  assert.equal(result.ok, true);
  assert.equal(getActiveClusterId(), null);
  assert.equal(loadActiveVenueId("user-1"), "venue-a2");
});

test("Wave3 club switch clears cluster only when access proves invalid", () => {
  resetStorage();
  saveCourtClusters([
    { id: "cluster-1", venueId: "venue-1", tenantId: "tenant-1", name: "C1", status: "active" },
  ]);
  setActiveClusterId("cluster-1");

  const ok = revalidatePhysicalResourceAccessForClubSwitch({
    club: { id: "club-1", tenantId: "tenant-1" },
    selectedVenueId: "venue-1",
    selectedTenantId: "tenant-1",
  });
  assert.equal(ok.clearCluster, false);
  assert.equal(getActiveClusterId(), "cluster-1");

  const badVenue = revalidatePhysicalResourceAccessForClubSwitch({
    club: { id: "club-1", tenantId: "tenant-1" },
    selectedVenueId: "venue-OTHER",
    selectedTenantId: "tenant-1",
  });
  assert.equal(badVenue.clearCluster, true);
  assert.equal(getActiveClusterId(), null);
});

test("Wave3 logout clears venue preference", () => {
  resetStorage();
  saveActiveTenantId("tenant-a", "user-1");
  saveActiveVenueId("venue-a", "user-1", { tenantId: "tenant-a" });
  setActiveClusterId("cluster-a");
  clearAuthSession(AUTH_SESSION_CLEAR_REASON.LOGOUT);
  assert.equal(loadActiveVenueId("user-1"), null);
  assert.equal(getActiveClusterId(), null);
});

test("Wave3 tenant switch orchestration clears venue+cluster via invalidateOperationalContext", () => {
  resetStorage();
  saveTenants([
    normalizeTenant({ id: "tenant-a", name: "A" }),
    normalizeTenant({ id: "tenant-b", name: "B" }),
  ]);
  saveVenues([
    normalizeVenue({ id: "venue-a", tenantId: "tenant-a", name: "VA" }),
    normalizeVenue({ id: "venue-b", tenantId: "tenant-b", name: "VB" }),
  ]);
  // Preference without club registry mapping — club clear still runs for unknown
  setActiveClubIdPreference("unknown-club");
  saveActiveVenueId("venue-a", "user-1", { tenantId: "tenant-a" });
  setActiveClusterId("cluster-x");

  const result = invalidateOperationalContextForTenantSwitch("tenant-b");
  assert.equal(result.venueInvalidated, true);
  assert.equal(getActiveClusterId(), null);
});

test("Wave3 listVenuesForTenant filters by tenantId", () => {
  resetStorage();
  saveVenues([
    normalizeVenue({ id: "v1", tenantId: "t1", name: "One" }),
    normalizeVenue({ id: "v2", tenantId: "t1", name: "Two" }),
    normalizeVenue({ id: "v3", tenantId: "t2", name: "Other" }),
  ]);
  saveTenants([
    normalizeTenant({ id: "t1", name: "T1" }),
    normalizeTenant({ id: "t2", name: "T2" }),
  ]);
  const list = listVenuesForTenant("t1");
  assert.deepEqual(
    list.map((v) => v.id).sort(),
    ["v1", "v2"]
  );
  assert.deepEqual(filterVenuesForSelectedTenant(list, "t2"), []);
});

test("Wave3 clusterBelongsToVenue rejects foreign venue", () => {
  assert.equal(
    clusterBelongsToVenue(
      { id: "c1", venueId: "v1", tenantId: "t1" },
      "v1",
      "t1"
    ),
    true
  );
  assert.equal(
    clusterBelongsToVenue(
      { id: "c1", venueId: "v1", tenantId: "t1" },
      "v2",
      "t1"
    ),
    false
  );
});

test("Wave3 architecture: MainLayout mounts VenueProvider under Tenant", () => {
  const layout = read("src/layouts/MainLayout.jsx");
  assert.match(layout, /TenantProvider/);
  assert.match(layout, /VenueProvider/);
  assert.match(layout, /ClusterProvider/);
  const tenantIdx = layout.indexOf("<TenantProvider>");
  const venueIdx = layout.indexOf("<VenueProvider>");
  const clusterIdx = layout.indexOf("<ClusterProvider>");
  assert.ok(tenantIdx >= 0 && venueIdx > tenantIdx && clusterIdx > venueIdx);
});

test("Wave3 architecture: venue model has no AI config import", () => {
  const venueModel = read("src/models/venue.js");
  assert.doesNotMatch(venueModel, /ai\/config/);
  assert.match(venueModel, /tenantId/);
});

test("Wave3 SQL package present for Owner review (not executed)", () => {
  assert.ok(
    fs.existsSync(
      path.join(
        process.cwd(),
        "docs/platform-core-wave3-tenant-venue-separation/sql/02_APPLY_platform_tenants_and_venue_fk.sql"
      )
    )
  );
  const owner = read(
    "docs/platform-core-wave3-tenant-venue-separation/sql/00_OWNER_README.md"
  );
  assert.match(owner, /SQL_EXECUTION_GO = NO/);
  assert.ok(
    fs.existsSync(
      path.join(
        process.cwd(),
        "docs/platform-core-wave3-tenant-venue-separation/sql/04_RLS_POLICIES.sql"
      )
    )
  );
  assert.ok(
    fs.existsSync(
      path.join(
        process.cwd(),
        "docs/platform-core-wave3-tenant-venue-separation/LEGACY_PUBLIC_TENANTS_CUTOVER.md"
      )
    )
  );
});
