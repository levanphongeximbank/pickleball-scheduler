import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import {
  PLATFORM_CONTEXT_STATE,
  resolvePlatformContextReadiness,
  filterClubsForSelectedOperationalTenant,
  clubBelongsToSelectedTenant,
  isPlatformContextReady,
  isPlatformContextRequired,
} from "../src/core/platform/app/platformContextReadiness.js";
import { resolveActiveClubSelection } from "../src/features/club/context/clubCanonicalReadModel.js";
import {
  clearActiveClubIdPreference,
  getActiveClubIdPreference,
  setActiveClubIdPreference,
  saveClubs,
} from "../src/data/club.js";
import { setActiveClusterId, getActiveClusterId } from "../src/data/courtCluster.js";
import {
  invalidateOperationalContextForTenantSwitch,
} from "../src/features/tenant/services/tenantSelectionService.js";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

const CLUB_A = {
  id: "club-a",
  name: "Club A",
  tenantId: "tenant-a",
  venueId: "tenant-a",
};
const CLUB_B1 = {
  id: "club-b1",
  name: "Club B1",
  tenantId: "tenant-b",
  venueId: "tenant-b",
};
const CLUB_B2 = {
  id: "club-b2",
  name: "Club B2",
  tenantId: "tenant-b",
  venueId: "tenant-b",
};

test("Wave1 readiness: AUTH / TENANT / CLUB distinctions exist", () => {
  assert.equal(
    resolvePlatformContextReadiness({ authLoading: true }).state,
    PLATFORM_CONTEXT_STATE.AUTH_LOADING
  );
  assert.equal(
    resolvePlatformContextReadiness({ isAuthenticated: false }).state,
    PLATFORM_CONTEXT_STATE.AUTH_REQUIRED
  );
  assert.equal(
    resolvePlatformContextReadiness({
      isAuthenticated: true,
      rbacEnabled: true,
      canOperateWithoutTenant: true,
      requireClub: true,
    }).state,
    PLATFORM_CONTEXT_STATE.TENANT_REQUIRED
  );
  assert.equal(
    resolvePlatformContextReadiness({
      isAuthenticated: true,
      rbacEnabled: true,
      selectedTenantId: "tenant-b",
      clubReadLoading: true,
      eligibleClubs: [],
    }).state,
    PLATFORM_CONTEXT_STATE.CLUB_LOADING
  );
  assert.equal(
    resolvePlatformContextReadiness({
      isAuthenticated: true,
      rbacEnabled: true,
      selectedTenantId: "tenant-b",
      eligibleClubs: [CLUB_B1, CLUB_B2],
      activeClubReady: false,
    }).state,
    PLATFORM_CONTEXT_STATE.CLUB_REQUIRED
  );
  assert.equal(
    resolvePlatformContextReadiness({
      isAuthenticated: true,
      rbacEnabled: true,
      selectedTenantId: "tenant-b",
      eligibleClubs: [],
    }).state,
    PLATFORM_CONTEXT_STATE.CLUB_EMPTY
  );
  const ready = resolvePlatformContextReadiness({
    isAuthenticated: true,
    rbacEnabled: true,
    selectedTenantId: "tenant-b",
    eligibleClubs: [CLUB_B1],
    activeClub: CLUB_B1,
    activeClubReady: true,
  });
  assert.equal(ready.state, PLATFORM_CONTEXT_STATE.CONTEXT_READY);
  assert.equal(isPlatformContextReady(ready.state), true);
  assert.equal(isPlatformContextRequired(PLATFORM_CONTEXT_STATE.CLUB_REQUIRED), true);
});

test("Wave1: missing required club is NOT treated as ready empty business data", () => {
  const missing = resolvePlatformContextReadiness({
    isAuthenticated: true,
    rbacEnabled: true,
    selectedTenantId: "tenant-b",
    eligibleClubs: [CLUB_B1, CLUB_B2],
    activeClub: null,
    activeClubReady: false,
  });
  assert.notEqual(missing.state, PLATFORM_CONTEXT_STATE.CONTEXT_READY);
  assert.equal(missing.state, PLATFORM_CONTEXT_STATE.CLUB_REQUIRED);
});

test("Wave1 SA tenant A→B: foreign club filtered; persisted A rejected under B", () => {
  const mixed = [CLUB_A, CLUB_B1, CLUB_B2];
  const scopedB = filterClubsForSelectedOperationalTenant(mixed, "tenant-b");
  assert.deepEqual(
    scopedB.map((c) => c.id).sort(),
    ["club-b1", "club-b2"]
  );
  assert.equal(clubBelongsToSelectedTenant(CLUB_A, "tenant-b"), false);

  const rejected = resolveActiveClubSelection({
    preferredClubId: "club-a",
    visibleClubs: mixed,
    requireTenant: true,
    selectedTenantId: "tenant-b",
  });
  assert.equal(rejected.activeClubId, null);
  assert.equal(rejected.stale, true);
});

test("Wave1 tenant B 0 / 1 / N club selection policy", () => {
  assert.equal(
    resolveActiveClubSelection({
      preferredClubId: null,
      visibleClubs: [],
      requireTenant: true,
      selectedTenantId: "tenant-b",
    }).activeClubId,
    null
  );

  const one = resolveActiveClubSelection({
    preferredClubId: null,
    visibleClubs: [CLUB_B1],
    requireTenant: true,
    selectedTenantId: "tenant-b",
  });
  assert.equal(one.activeClubId, "club-b1");

  const many = resolveActiveClubSelection({
    preferredClubId: null,
    visibleClubs: [CLUB_B1, CLUB_B2],
    requireTenant: true,
    selectedTenantId: "tenant-b",
  });
  assert.equal(many.activeClubId, null);

  const keepValid = resolveActiveClubSelection({
    preferredClubId: "club-b2",
    visibleClubs: [CLUB_B1, CLUB_B2],
    requireTenant: true,
    selectedTenantId: "tenant-b",
  });
  assert.equal(keepValid.activeClubId, "club-b2");
});

test("Wave1 invalidateOperationalContextForTenantSwitch clears foreign club + cluster", () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => {
      store.set(String(key), String(value));
    },
    removeItem: (key) => {
      store.delete(String(key));
    },
    clear: () => store.clear(),
  };

  try {
    saveClubs([
      { id: "club-a", name: "A", venueId: "tenant-a", isDefault: false },
      { id: "club-b1", name: "B1", venueId: "tenant-b", isDefault: false },
    ]);
    setActiveClubIdPreference("club-a");
    setActiveClusterId("cluster-a");

    const result = invalidateOperationalContextForTenantSwitch("tenant-b");
    assert.equal(result.clubInvalidated, true);
    assert.equal(getActiveClubIdPreference(), null);
    assert.equal(getActiveClusterId(), null);

    setActiveClubIdPreference("club-b1");
    const keep = invalidateOperationalContextForTenantSwitch("tenant-b");
    assert.equal(keep.clubInvalidated, false);
    assert.equal(getActiveClubIdPreference(), "club-b1");
    clearActiveClubIdPreference();
  } finally {
    delete globalThis.localStorage;
  }
});

test("Wave1 shell + tournament list adopt readiness (no 0 giải collapse)", () => {
  const header = read("src/components/Header.jsx");
  const topbar = read("src/features/canonical-shell/components/CanonicalTopBar.jsx");
  const listPage = read("src/features/tournament/pages/CanonicalTournamentListPage.jsx");
  const clubSwitcher = read("src/components/ClubSwitcher.jsx");
  const repo = read("src/features/club/repositories/canonicalClubRepository.js");

  assert.match(header, /ClubSwitcher/);
  assert.match(header, /desktop-club-switcher|showDesktopClubSwitcher/);
  assert.match(topbar, /ClubSwitcher/);
  assert.match(topbar, /canonical-topbar-club-zone/);
  assert.match(listPage, /PlatformContextReadinessGate/);
  assert.match(listPage, /usePlatformContextReadiness/);
  assert.match(listPage, /contextReady \? activeClub : null/);
  assert.match(clubSwitcher, /Never fakes the first club|never display first club/i);
  assert.match(repo, /SELECTED_OPERATIONAL_CONTEXT|selectedOperationalTenantId/);
});

test("Wave1 logout clears club preference helper is wired in authStorage", () => {
  const authStorage = read("src/auth/authStorage.js");
  assert.match(authStorage, /clearActiveClubIdPreference/);
  assert.match(authStorage, /setActiveClusterId\(null\)/);
});

test("Wave1 Organization remains NOT_CONFIGURED; no Adapter A contract edits", () => {
  const readiness = read("src/core/platform/app/platformContextReadiness.js");
  assert.match(readiness, /organizationConfigured === false|Organization remains NOT_CONFIGURED/);
  assert.equal(
    resolvePlatformContextReadiness({
      isAuthenticated: true,
      rbacEnabled: true,
      selectedTenantId: "tenant-b",
      eligibleClubs: [CLUB_B1],
      activeClub: CLUB_B1,
      activeClubReady: true,
      organizationConfigured: false,
    }).state,
    PLATFORM_CONTEXT_STATE.CONTEXT_READY
  );
});
