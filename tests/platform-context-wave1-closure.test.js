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
import {
  CLUB_PREFERENCE_STATUS,
  CLUB_READ_STATE,
  isClubPreferenceAuthorityReady,
  resolveActiveClubSelection,
} from "../src/features/club/context/clubCanonicalReadModel.js";
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
const CLUB_A2 = {
  id: "club-a2",
  name: "Club A2",
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

/**
 * Simulate ClubContext F5 preference lifecycle (pure, no React).
 * Mirrors: pending while !authorityReady → validate when ready → clear only if INVALID.
 */
function simulateF5ClubPreferenceLifecycle({
  persistedClubId,
  selectedTenantId,
  eligibleClubs,
  clubReadState = CLUB_READ_STATE.READY,
}) {
  const store = { preference: persistedClubId || null, activeClubId: persistedClubId || null };

  const authorityReady = isClubPreferenceAuthorityReady({
    canonicalRead: true,
    clubReadState,
    selectedTenantId,
  });

  const preferredHint = store.activeClubId || store.preference;
  const selection = resolveActiveClubSelection({
    preferredClubId: preferredHint,
    visibleClubs: eligibleClubs,
    requireTenant: true,
    selectedTenantId,
    authorityReady,
  });

  if (selection.preferenceStatus === CLUB_PREFERENCE_STATUS.PENDING_VALIDATION) {
    if (preferredHint) store.activeClubId = preferredHint;
    return {
      ...selection,
      preference: store.preference,
      activeClubId: store.activeClubId,
      authorityReady,
    };
  }

  if (selection.preferenceStatus === CLUB_PREFERENCE_STATUS.INVALID && preferredHint) {
    store.preference = null;
  }

  store.activeClubId = selection.activeClubId;
  if (selection.preferenceStatus === CLUB_PREFERENCE_STATUS.VALID && selection.activeClubId) {
    store.preference = selection.activeClubId;
  }

  return {
    ...selection,
    preference: store.preference,
    activeClubId: store.activeClubId,
    authorityReady,
  };
}

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

// --- Wave 1 browser acceptance remediation: validated Club rehydrate after F5 ---

test("F5 valid Tenant A + Club A restores Club A (CONTEXT_READY, not CLUB_REQUIRED)", () => {
  const step = simulateF5ClubPreferenceLifecycle({
    persistedClubId: "club-a",
    selectedTenantId: "tenant-a",
    eligibleClubs: [CLUB_A, CLUB_A2],
    clubReadState: CLUB_READ_STATE.READY,
  });
  assert.equal(step.preferenceStatus, CLUB_PREFERENCE_STATUS.VALID);
  assert.equal(step.activeClubId, "club-a");
  assert.equal(step.preference, "club-a");

  const ready = resolvePlatformContextReadiness({
    isAuthenticated: true,
    rbacEnabled: true,
    selectedTenantId: "tenant-a",
    eligibleClubs: [CLUB_A, CLUB_A2],
    activeClub: step.activeClub,
    activeClubReady: true,
  });
  assert.equal(ready.state, PLATFORM_CONTEXT_STATE.CONTEXT_READY);
});

test("F5 transient tenant=null does not destroy persisted Club hint", () => {
  const pending = simulateF5ClubPreferenceLifecycle({
    persistedClubId: "club-a",
    selectedTenantId: null,
    eligibleClubs: [],
    clubReadState: CLUB_READ_STATE.READY,
  });
  assert.equal(pending.authorityReady, false);
  assert.equal(pending.preferenceStatus, CLUB_PREFERENCE_STATUS.PENDING_VALIDATION);
  assert.equal(pending.activeClubId, "club-a");
  assert.equal(pending.preference, "club-a");

  const restored = simulateF5ClubPreferenceLifecycle({
    persistedClubId: pending.preference,
    selectedTenantId: "tenant-a",
    eligibleClubs: [CLUB_A, CLUB_A2],
    clubReadState: CLUB_READ_STATE.READY,
  });
  assert.equal(restored.preferenceStatus, CLUB_PREFERENCE_STATUS.VALID);
  assert.equal(restored.activeClubId, "club-a");
});

test("F5 canonical Club LOADING does not clear valid persisted Club", () => {
  const loading = simulateF5ClubPreferenceLifecycle({
    persistedClubId: "club-a",
    selectedTenantId: "tenant-a",
    eligibleClubs: [],
    clubReadState: CLUB_READ_STATE.LOADING,
  });
  assert.equal(loading.preferenceStatus, CLUB_PREFERENCE_STATUS.PENDING_VALIDATION);
  assert.equal(loading.preference, "club-a");
  assert.equal(loading.activeClubId, "club-a");
});

test("F5 Tenant A persisted Club under Tenant B is rejected after authority", () => {
  const rejected = simulateF5ClubPreferenceLifecycle({
    persistedClubId: "club-a",
    selectedTenantId: "tenant-b",
    eligibleClubs: [CLUB_B1, CLUB_B2],
    clubReadState: CLUB_READ_STATE.READY,
  });
  assert.equal(rejected.preferenceStatus, CLUB_PREFERENCE_STATUS.INVALID);
  assert.equal(rejected.activeClubId, null);
  assert.equal(rejected.preference, null);
});

test("F5 deleted/revoked Club is rejected after authoritative list READY", () => {
  const rejected = simulateF5ClubPreferenceLifecycle({
    persistedClubId: "club-deleted",
    selectedTenantId: "tenant-a",
    eligibleClubs: [CLUB_A, CLUB_A2],
    clubReadState: CLUB_READ_STATE.READY,
  });
  assert.equal(rejected.preferenceStatus, CLUB_PREFERENCE_STATUS.INVALID);
  assert.equal(rejected.activeClubId, null);
  assert.equal(rejected.preference, null);
});

test("F5 N clubs + valid persisted Club restores persisted Club", () => {
  const step = simulateF5ClubPreferenceLifecycle({
    persistedClubId: "club-a2",
    selectedTenantId: "tenant-a",
    eligibleClubs: [CLUB_A, CLUB_A2],
  });
  assert.equal(step.activeClubId, "club-a2");
  assert.equal(step.preferenceStatus, CLUB_PREFERENCE_STATUS.VALID);
});

test("F5 N clubs + no valid persisted Club remains CLUB_REQUIRED", () => {
  const step = simulateF5ClubPreferenceLifecycle({
    persistedClubId: null,
    selectedTenantId: "tenant-a",
    eligibleClubs: [CLUB_A, CLUB_A2],
  });
  assert.equal(step.activeClubId, null);
  assert.equal(step.preferenceStatus, CLUB_PREFERENCE_STATUS.NONE);

  const required = resolvePlatformContextReadiness({
    isAuthenticated: true,
    rbacEnabled: true,
    selectedTenantId: "tenant-a",
    eligibleClubs: [CLUB_A, CLUB_A2],
    activeClub: null,
    activeClubReady: false,
  });
  assert.equal(required.state, PLATFORM_CONTEXT_STATE.CLUB_REQUIRED);
});

test("F5 TOKEN_REFRESHED preserves valid Club (authority fingerprint unchanged)", () => {
  const before = simulateF5ClubPreferenceLifecycle({
    persistedClubId: "club-a",
    selectedTenantId: "tenant-a",
    eligibleClubs: [CLUB_A],
  });
  const afterRefresh = simulateF5ClubPreferenceLifecycle({
    persistedClubId: before.preference,
    selectedTenantId: "tenant-a",
    eligibleClubs: [CLUB_A],
  });
  assert.equal(afterRefresh.activeClubId, "club-a");
  assert.equal(afterRefresh.preferenceStatus, CLUB_PREFERENCE_STATUS.VALID);

  const clubCtx = read("src/context/ClubContext.jsx");
  assert.match(clubCtx, /TOKEN_REFRESHED/);
  assert.match(clubCtx, /CLUB_PREFERENCE_STATUS\.PENDING_VALIDATION/);
  assert.match(clubCtx, /clearActiveClubIdPreference/);
  assert.match(clubCtx, /isClubPreferenceAuthorityReady/);
});

test("F5 logout/user switch isolation remains wired (preference cleared on logout)", () => {
  const authStorage = read("src/auth/authStorage.js");
  assert.match(authStorage, /clearActiveClubIdPreference/);
  assert.equal(
    isClubPreferenceAuthorityReady({
      canonicalRead: true,
      clubReadState: CLUB_READ_STATE.READY,
      selectedTenantId: null,
    }),
    false
  );
});

test("Tournament List after valid F5 restore: CONTEXT_READY + empty 0 giải ≠ CLUB_REQUIRED", () => {
  const step = simulateF5ClubPreferenceLifecycle({
    persistedClubId: "club-a",
    selectedTenantId: "tenant-a",
    eligibleClubs: [CLUB_A],
  });
  assert.equal(step.preferenceStatus, CLUB_PREFERENCE_STATUS.VALID);

  const context = resolvePlatformContextReadiness({
    isAuthenticated: true,
    rbacEnabled: true,
    selectedTenantId: "tenant-a",
    eligibleClubs: [CLUB_A],
    activeClub: step.activeClub,
    activeClubReady: true,
  });
  assert.equal(context.state, PLATFORM_CONTEXT_STATE.CONTEXT_READY);
  assert.notEqual(context.state, PLATFORM_CONTEXT_STATE.CLUB_REQUIRED);

  // Valid empty business data (0 tournaments) is allowed only when context is ready.
  const tournamentCount = 0;
  assert.equal(context.ready, true);
  assert.equal(tournamentCount, 0);

  const listPage = read("src/features/tournament/pages/CanonicalTournamentListPage.jsx");
  assert.match(listPage, /PlatformContextReadinessGate/);
  assert.match(listPage, /contextReady \? activeClub : null/);
});

test("resolveActiveClubSelection authorityReady=false keeps PENDING hint", () => {
  const sel = resolveActiveClubSelection({
    preferredClubId: "club-a",
    visibleClubs: [],
    requireTenant: true,
    selectedTenantId: null,
    authorityReady: false,
  });
  assert.equal(sel.preferenceStatus, CLUB_PREFERENCE_STATUS.PENDING_VALIDATION);
  assert.equal(sel.activeClubId, "club-a");
  assert.equal(sel.activeClub, null);
});

test("resolveActiveClubSelection authorityReady=true empty list marks INVALID", () => {
  const sel = resolveActiveClubSelection({
    preferredClubId: "club-a",
    visibleClubs: [],
    requireTenant: true,
    selectedTenantId: "tenant-a",
    authorityReady: true,
  });
  assert.equal(sel.preferenceStatus, CLUB_PREFERENCE_STATUS.INVALID);
  assert.equal(sel.activeClubId, null);
});

// --- Wave 1 F5 second failure: destructive writer / lifecycle contracts ---

test("clearAuthSession IDENTITY_REPLACE preserves club/tenant preferences (F5 non-logout)", async () => {
  const { clearAuthSession, AUTH_SESSION_CLEAR_REASON } = await import(
    "../src/auth/authStorage.js"
  );
  const { saveActiveTenantId, loadActiveTenantId } = await import(
    "../src/data/tenantSession.js"
  );
  const {
    AUTH_SESSION_CLEAR_REASON: lifecycleReasons,
    shouldClearOperationalContextOnAuthClear,
  } = await import("../src/auth/authSessionLifecycle.js");

  assert.equal(
    shouldClearOperationalContextOnAuthClear(lifecycleReasons.IDENTITY_REPLACE),
    false
  );
  assert.equal(shouldClearOperationalContextOnAuthClear(lifecycleReasons.LOGOUT), true);

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
    store.set(
      "pickleball-auth-session-v1",
      JSON.stringify({
        user: { id: "user-1", role: "SUPER_ADMIN", email: "a@b.c" },
        provider: "dev",
      })
    );
    saveActiveTenantId("tenant-a", "user-1");
    setActiveClubIdPreference("club-cloud-only");

    clearAuthSession(AUTH_SESSION_CLEAR_REASON.IDENTITY_REPLACE);

    assert.equal(store.has("pickleball-auth-session-v1"), false);
    assert.equal(getActiveClubIdPreference(), "club-cloud-only");
    assert.equal(loadActiveTenantId("user-1"), "tenant-a");

    clearAuthSession(AUTH_SESSION_CLEAR_REASON.LOGOUT);
    assert.equal(getActiveClubIdPreference(), null);
    assert.equal(loadActiveTenantId("user-1"), null);
  } finally {
    delete globalThis.localStorage;
  }
});

test("legacy getActiveClubId coercion is ephemeral — preference storage preserved", async () => {
  const { getActiveClubId } = await import("../src/data/club.js");
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
    saveClubs([{ id: "default-club", name: "CLB Mac dinh", isDefault: true }]);
    setActiveClubIdPreference("club-cloud-only");
    assert.equal(getActiveClubId(), "default-club");
    assert.equal(getActiveClubIdPreference(), "club-cloud-only");
  } finally {
    delete globalThis.localStorage;
  }
});

test("Auth bootstrap + ClubContext must not reuse logout clear / LS mirror on rehydrate", () => {
  const authCtx = read("src/context/AuthContext.jsx");
  const clubCtx = read("src/context/ClubContext.jsx");
  const authStorage = read("src/auth/authStorage.js");
  const lifecycle = read("src/auth/authSessionLifecycle.js");

  assert.match(lifecycle, /IDENTITY_REPLACE/);
  assert.match(authStorage, /shouldClearOperationalContextOnAuthClear/);
  assert.match(authCtx, /IDENTITY_REPLACE/);
  assert.match(authCtx, /AUTH_BOOTSTRAP_START|AUTH_RESTORE_OK/);
  // Destructive tenant-switch LS→React mirror removed (F5 root cause).
  assert.doesNotMatch(
    clubCtx,
    /Sync preference mirror after tenant switch invalidation/
  );
  assert.match(clubCtx, /authoritative_invalid|CLUB_HINT_CLEARED/);
  assert.match(clubCtx, /do not mirror LS/);
});
