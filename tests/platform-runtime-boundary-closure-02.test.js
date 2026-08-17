/**
 * Wave 2 — Platform Core runtime boundary & reverse-dependency closure tests.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import {
  AUTH_SESSION_CLEAR_REASON,
  shouldClearOperationalContextOnAuthClear,
} from "../src/auth/authSessionLifecycle.js";
import {
  registerAuthSessionClearHook,
  registerAuthSessionLoadProjector,
  runAuthSessionClearHooks,
  applyAuthSessionLoadProjectors,
  __resetAuthSessionHooksForTests,
  __authSessionHookCountsForTests,
} from "../src/auth/authSessionHooks.js";
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
} from "../src/auth/authStorage.js";
import {
  bindTournamentAccessPort,
  assertTournamentAccessViaPort,
  resolveTournamentClubIdViaPort,
  __resetTournamentAccessPortForTests,
  isTournamentAccessPortBound,
} from "../src/auth/ports/tournamentAccessPort.js";
import {
  evaluateTournamentEngineRouteAccess,
  decideTournamentEngineRouteGate,
} from "../src/auth/tournamentEngineRouteAccess.js";
import {
  bindBillingAccessCapability,
  getBillingAccessCapability,
  __resetBillingAccessCapabilityForTests,
  isBillingAccessCapabilityBound,
} from "../src/core/platform/app/billingAccessCapability.js";
import { normalizeTenant, DEFAULT_TENANT_TIMEZONE } from "../src/models/tenant.js";
import { setActiveClubIdPreference, getActiveClubIdPreference } from "../src/data/club.js";
import { saveActiveTenantId, loadActiveTenantId } from "../src/data/tenantSession.js";

function read(rel) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

function withLocalStorage(fn) {
  const store = new Map();
  const prev = globalThis.localStorage;
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
    return fn(store);
  } finally {
    if (prev === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prev;
  }
}

test("Wave2 static — Platform surfaces have zero forbidden reverse imports", () => {
  const club = read("src/context/ClubContext.jsx");
  assert.doesNotMatch(club, /ai\/cloudSync|ai\/autoCloudSync|skillLevelService/);

  const tenantModel = read("src/models/tenant.js");
  assert.doesNotMatch(tenantModel, /from\s+['"][^'"]*ai\//);
  assert.match(tenantModel, /DEFAULT_TENANT_TIMEZONE/);

  const authStorage = read("src/auth/authStorage.js");
  assert.doesNotMatch(authStorage, /offlineQueueQuarantine|governanceRoleElevation|features\/club|features\/mobile/);
  assert.match(authStorage, /authSessionHooks/);

  const routeAccess = read("src/auth/tournamentEngineRouteAccess.js");
  assert.doesNotMatch(routeAccess, /tournamentService|clubTournamentBridge/);
  assert.match(routeAccess, /tournamentAccessPort/);

  const tenantCtx = read("src/context/TenantContext.jsx");
  assert.doesNotMatch(
    tenantCtx,
    /features\/billing\/(repositories|bridges|guards)/
  );
  assert.match(tenantCtx, /billingAccessCapability/);

  assert.equal(DEFAULT_TENANT_TIMEZONE, "Asia/Ho_Chi_Minh");
  assert.equal(normalizeTenant({ id: "t1", name: "T" }).timezone, "Asia/Ho_Chi_Minh");
});

test("Wave2 — Auth F5 IDENTITY_REPLACE preserves prefs; LOGOUT clears (rehydrate PASS)", () => {
  __resetAuthSessionHooksForTests();
  withLocalStorage(() => {
    saveActiveTenantId("tenant-a", "user-1");
    setActiveClubIdPreference("club-cloud-only");
    saveAuthSession({ id: "user-1", role: "SUPER_ADMIN", email: "a@b.c" });

    assert.equal(
      shouldClearOperationalContextOnAuthClear(AUTH_SESSION_CLEAR_REASON.IDENTITY_REPLACE),
      false
    );

    clearAuthSession(AUTH_SESSION_CLEAR_REASON.IDENTITY_REPLACE);
    assert.equal(getActiveClubIdPreference(), "club-cloud-only");
    assert.equal(loadActiveTenantId("user-1"), "tenant-a");

    saveAuthSession({ id: "user-1", role: "SUPER_ADMIN", email: "a@b.c" });
    clearAuthSession(AUTH_SESSION_CLEAR_REASON.LOGOUT);
    assert.equal(getActiveClubIdPreference(), null);
    assert.equal(loadActiveTenantId("user-1"), null);
  });
});

test("Wave2 — Logout runs registered cleanup; missing cleanup cannot break logout", () => {
  __resetAuthSessionHooksForTests();
  let ran = 0;
  registerAuthSessionClearHook(() => {
    ran += 1;
  });
  registerAuthSessionClearHook(() => {
    throw new Error("boom");
  });

  withLocalStorage(() => {
    saveAuthSession({ id: "u1", role: "PLAYER", email: "p@x.com" });
    setActiveClubIdPreference("club-1");
    clearAuthSession(AUTH_SESSION_CLEAR_REASON.LOGOUT);
    assert.equal(ran, 1);
    assert.equal(getActiveClubIdPreference(), null);
  });

  // No hooks registered — still safe
  __resetAuthSessionHooksForTests();
  withLocalStorage(() => {
    saveAuthSession({ id: "u1", role: "PLAYER", email: "p@x.com" });
    clearAuthSession(AUTH_SESSION_CLEAR_REASON.LOGOUT);
  });
});

test("Wave2 — USER_SWITCH and AUTH_INVALID clear operational context (fail-closed isolation)", () => {
  assert.equal(
    shouldClearOperationalContextOnAuthClear(AUTH_SESSION_CLEAR_REASON.USER_SWITCH),
    true
  );
  assert.equal(
    shouldClearOperationalContextOnAuthClear(AUTH_SESSION_CLEAR_REASON.AUTH_INVALID),
    true
  );

  __resetAuthSessionHooksForTests();
  withLocalStorage(() => {
    saveActiveTenantId("tenant-a", "user-1");
    setActiveClubIdPreference("club-a");
    saveAuthSession({ id: "user-1", role: "SUPER_ADMIN", email: "a@b.c" });
    clearAuthSession(AUTH_SESSION_CLEAR_REASON.USER_SWITCH);
    assert.equal(getActiveClubIdPreference(), null);
    assert.equal(loadActiveTenantId("user-1"), null);

    saveActiveTenantId("tenant-a", "user-1");
    setActiveClubIdPreference("club-a");
    saveAuthSession({ id: "user-1", role: "SUPER_ADMIN", email: "a@b.c" });
    clearAuthSession(AUTH_SESSION_CLEAR_REASON.AUTH_INVALID);
    assert.equal(getActiveClubIdPreference(), null);
    assert.equal(loadActiveTenantId("user-1"), null);
  });
});

test("Wave2 — Governance elevation projector registers without authStorage importing Club", () => {
  __resetAuthSessionHooksForTests();
  registerAuthSessionLoadProjector((user) => {
    if (user?.role === "PLAYER" && user?.id === "p1") {
      return { user: { ...user, role: "CLUB_MANAGER" }, changed: true };
    }
    return { user, changed: false };
  });

  withLocalStorage(() => {
    globalThis.localStorage.setItem(
      "pickleball-auth-session-v1",
      JSON.stringify({
        user: { id: "p1", role: "PLAYER", email: "p@x.com" },
        provider: "dev",
      })
    );

    const session = loadAuthSession();
    assert.equal(session.user.role, "CLUB_MANAGER");
  });

  const projected = applyAuthSessionLoadProjectors({ id: "p1", role: "PLAYER", email: "p@x.com" });
  assert.equal(projected.changed, true);
  assert.equal(projected.user.role, "CLUB_MANAGER");
});

test("Wave2 — Tournament access port unbound is fail-closed; bound preserves gate behavior", () => {
  __resetTournamentAccessPortForTests();
  assert.equal(isTournamentAccessPortBound(), false);
  assert.equal(resolveTournamentClubIdViaPort("club-a", "t1"), null);
  assert.equal(assertTournamentAccessViaPort("club-a", "t1").ok, false);
  assert.equal(
    assertTournamentAccessViaPort("club-a", "t1").code,
    "TOURNAMENT_ACCESS_NOT_CONFIGURED"
  );

  const unboundGate = decideTournamentEngineRouteGate({
    pathname: "/tournaments/t1/engine",
    user: { id: "u1", role: "SUPER_ADMIN" },
    isAuthenticated: true,
    authProductionEnabled: true,
    rbacEnabled: true,
    activeClubId: "club-a",
  });
  assert.equal(unboundGate.apply, true);
  assert.equal(unboundGate.ok, false);

  bindTournamentAccessPort({
    resolveTournamentClubId: (preferred) => preferred || null,
    assertTournamentAccess: () => ({
      ok: true,
      tournament: { id: "t1" },
    }),
  });

  const ownership = evaluateTournamentEngineRouteAccess({
    pathname: "/tournaments/t1/engine",
    user: { id: "u1", role: "SUPER_ADMIN" },
    activeClubId: "club-a",
    forceAuthz: true,
  });
  assert.equal(ownership.ok, true);
  assert.equal(ownership.code, "OK");
  __resetTournamentAccessPortForTests();
});

test("Wave2 — Billing capability unbound fail-closed when required; bound preserves assert", () => {
  __resetBillingAccessCapabilityForTests();
  assert.equal(isBillingAccessCapabilityBound(), false);
  const unbound = getBillingAccessCapability();
  assert.equal(unbound.bound, false);
  assert.equal(unbound.assertOperational("tenant-x").ok, false);
  assert.equal(unbound.assertOperational("tenant-x").code, "BILLING_NOT_CONFIGURED");
  assert.equal(unbound.isExemptRole({ role: "PLAYER" }), false);

  bindBillingAccessCapability({
    ensureSessionReady: async () => ({ ok: true }),
    runMaintenance: () => {},
    assertOperational: (tenantId) =>
      tenantId === "tenant-ok"
        ? { ok: true, code: "SUBSCRIPTION_OK" }
        : { ok: false, code: "SUBSCRIPTION_LOCKED" },
    isExemptRole: (user) => user?.role === "PLAYER",
  });

  const bound = getBillingAccessCapability();
  assert.equal(bound.bound, true);
  assert.equal(bound.isExemptRole({ role: "PLAYER" }), true);
  assert.equal(bound.assertOperational("tenant-ok").ok, true);
  assert.equal(bound.assertOperational("tenant-bad").ok, false);
  __resetBillingAccessCapabilityForTests();
});

test("Wave2 — Club/MainLayout observers exist; ClubContext no longer owns AI/skill side effects", () => {
  const layout = read("src/layouts/MainLayout.jsx");
  assert.match(layout, /ClubCloudSyncObserver/);
  assert.match(layout, /ClubSkillLevelObserver/);
  assert.ok(fs.existsSync(path.join(process.cwd(), "src/features/club/observers/ClubCloudSyncObserver.jsx")));
  assert.ok(
    fs.existsSync(path.join(process.cwd(), "src/features/club/observers/ClubSkillLevelObserver.jsx"))
  );

  const club = read("src/context/ClubContext.jsx");
  assert.doesNotMatch(club, /ensureMonthlySkillLevelProposals|autoPullOnClubActivate|pullClubFromCloud/);
});

test("Wave2 — composition root binds ports; mobile cleanup registration exists", () => {
  const main = read("src/main.jsx");
  assert.match(main, /registerClubAuthSessionProjection/);
  assert.match(main, /registerMobileOfflineQueueAuthCleanup/);
  assert.match(main, /bindTournamentAccessPortFromDomain/);
  assert.match(main, /bindBillingAccessCapabilityFromModule/);
  assert.match(main, /wirePlatformRuntimeBoundaryBindings/);
});

test("Wave2 — architecture guard catches synthetic forbidden import (self-test)", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/ci/platform-runtime-boundary-lock.mjs", "--self-test"],
    { cwd: process.cwd(), encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /self-test OK/);
});

test("Wave2 — architecture guard PASS on current tree", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/ci/platform-runtime-boundary-lock.mjs"],
    { cwd: process.cwd(), encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /PLATFORM_CORE_REVERSE_DEPENDENCIES=0/);
});

test("Wave2 — no new circular import markers in closed surfaces", () => {
  // Static sanity: closed files must not import each other in a cycle with BM bindings.
  const authStorage = read("src/auth/authStorage.js");
  assert.doesNotMatch(authStorage, /ClubContext|TenantContext/);
  const port = read("src/auth/ports/tournamentAccessPort.js");
  assert.doesNotMatch(port, /tournamentService|clubTournamentBridge|features\//);
  const billingCap = read("src/core/platform/app/billingAccessCapability.js");
  assert.doesNotMatch(billingCap, /features\/billing/);
  assert.equal(__authSessionHookCountsForTests().clearHooks >= 0, true);
  runAuthSessionClearHooks(AUTH_SESSION_CLEAR_REASON.LOGOUT);
});
