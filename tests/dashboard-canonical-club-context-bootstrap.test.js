/**
 * Dashboard blank-screen remediation — canonical Club context bootstrap gate.
 *
 * AUTHORIZATION_ALLOWED ≠ OPERATIONAL_TARGET_READY.
 * UNRESOLVED CLUB ≠ EMPTY BUSINESS DATA.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  DASHBOARD_CLUB_CONTEXT_STATE,
  resolveDashboardClubOperationsGate,
} from "../src/features/dashboard-analytics/services/dashboardClubOperationsGate.js";
import { resolveDashboardAccess } from "../src/features/dashboard-analytics/services/dashboardScope.js";
import { CLUB_READ_STATE } from "../src/features/club/context/clubCanonicalReadModel.js";
import {
  assertExplicitClubId,
  CLUB_CONTEXT_ERROR_CODE,
} from "../src/features/club/context/requireExplicitClubId.js";
import { loadAIData } from "../src/ai/storage.js";
import { ROLES } from "../src/auth/roles.js";
import { PERMISSIONS } from "../src/auth/permissions.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

test("A. activeClubId=null → gate denies ClubOperations mount (no throw)", () => {
  const gate = resolveDashboardClubOperationsGate({
    authLoading: false,
    isAuthenticated: true,
    canonicalClubRead: true,
    clubReadState: CLUB_READ_STATE.READY,
    clubReadReady: true,
    activeClubReady: false,
    activeClubId: null,
    activeClub: null,
    permissionAllowsClubOperations: true,
  });
  assert.equal(gate.mountClubOperations, false);
  assert.equal(gate.state, DASHBOARD_CLUB_CONTEXT_STATE.CLUB_CONTEXT_READY_NO_CLUB);
  assert.equal(gate.showClubOperationsPlaceholder, true);
});

test("B. canonical Club context loading → ClubOperations does not mount", () => {
  const gate = resolveDashboardClubOperationsGate({
    authLoading: false,
    isAuthenticated: true,
    canonicalClubRead: true,
    clubReadState: CLUB_READ_STATE.LOADING,
    clubReadReady: false,
    activeClubReady: false,
    activeClubId: "hint-club",
    activeClub: null,
    permissionAllowsClubOperations: true,
  });
  assert.equal(gate.mountClubOperations, false);
  assert.equal(gate.state, DASHBOARD_CLUB_CONTEXT_STATE.CLUB_CONTEXT_LOADING);
});

test("C. canonical ready + zero clubs → Dashboard gate stays visible (no mount)", () => {
  const gate = resolveDashboardClubOperationsGate({
    authLoading: false,
    isAuthenticated: true,
    canonicalClubRead: true,
    clubReadState: CLUB_READ_STATE.READY,
    clubReadReady: true,
    activeClubReady: false,
    activeClubId: null,
    activeClub: null,
    permissionAllowsClubOperations: true,
  });
  assert.equal(gate.mountClubOperations, false);
  assert.equal(gate.state, DASHBOARD_CLUB_CONTEXT_STATE.CLUB_CONTEXT_READY_NO_CLUB);
  assert.equal(gate.showClubOperationsPlaceholder, true);
});

test("D. valid explicit activeClubId + ready → ClubOperations may mount", () => {
  const gate = resolveDashboardClubOperationsGate({
    authLoading: false,
    isAuthenticated: true,
    canonicalClubRead: true,
    clubReadState: CLUB_READ_STATE.READY,
    clubReadReady: true,
    activeClubReady: true,
    activeClubId: "club-1",
    activeClub: { id: "club-1", tenantId: "tenant-1" },
    permissionAllowsClubOperations: true,
  });
  assert.equal(gate.mountClubOperations, true);
  assert.equal(gate.state, DASHBOARD_CLUB_CONTEXT_STATE.CLUB_CONTEXT_READY_WITH_CLUB);
});

test("E. permission allows Tournament/Statistics/Scheduling but clubId absent → no mount", () => {
  const can = (permission) =>
    [
      PERMISSIONS.STATISTICS_VIEW,
      PERMISSIONS.TOURNAMENT_VIEW,
      PERMISSIONS.SCHEDULING_VIEW,
    ].includes(permission);

  const access = resolveDashboardAccess(
    { role: ROLES.CLUB_MANAGER },
    can,
    { clubId: null }
  );
  assert.equal(access.sections.clubOperations, true);

  const gate = resolveDashboardClubOperationsGate({
    authLoading: false,
    isAuthenticated: true,
    canonicalClubRead: true,
    clubReadState: CLUB_READ_STATE.READY,
    clubReadReady: true,
    activeClubReady: false,
    activeClubId: null,
    activeClub: null,
    permissionAllowsClubOperations: access.sections.clubOperations,
  });
  assert.equal(gate.mountClubOperations, false);
  assert.notEqual(gate.reason, "permission_denied");
});

test("F. assertExplicitClubId still throws when domain caller illegally omits clubId", () => {
  assert.throws(
    () => assertExplicitClubId(null),
    (err) =>
      err?.name === "ClubContextError" &&
      err?.code === CLUB_CONTEXT_ERROR_CODE.CLUB_REQUIRED
  );
  assert.throws(
    () => assertExplicitClubId(""),
    (err) => err?.code === CLUB_CONTEXT_ERROR_CODE.CLUB_REQUIRED
  );

  globalThis.localStorage = createLocalStorageMock();
  assert.throws(
    () => loadAIData(null),
    (err) => err?.code === CLUB_CONTEXT_ERROR_CODE.CLUB_REQUIRED
  );
  assert.throws(
    () => loadAIData(undefined),
    (err) => err?.code === CLUB_CONTEXT_ERROR_CODE.CLUB_REQUIRED
  );
});

test("G. no localStorage fallback introduced in Dashboard gate / page", () => {
  const gateSrc = readSrc(
    "src/features/dashboard-analytics/services/dashboardClubOperationsGate.js"
  );
  const dashSrc = readSrc("src/pages/Dashboard.jsx");
  assert.doesNotMatch(gateSrc, /localStorage\.(getItem|setItem)/);
  assert.doesNotMatch(gateSrc, /getActiveClubId\(/);
  assert.match(gateSrc, /Does NOT read localStorage/);
  assert.doesNotMatch(dashSrc, /getActiveClubId\(/);
  assert.match(dashSrc, /resolveDashboardClubOperationsGate/);
  assert.match(dashSrc, /mountClubOperations/);
});

test("H. Super Admin with no selected operational Club → no crash / no mount", () => {
  const can = () => true;
  const access = resolveDashboardAccess(
    { role: ROLES.PLATFORM_ADMIN },
    can,
    { clubId: null }
  );
  assert.equal(access.allowed, true);
  assert.equal(access.sections.clubOperations, true);

  const gate = resolveDashboardClubOperationsGate({
    authLoading: false,
    isAuthenticated: true,
    canonicalClubRead: true,
    clubReadState: CLUB_READ_STATE.READY,
    clubReadReady: true,
    activeClubReady: false,
    activeClubId: null,
    activeClub: null,
    permissionAllowsClubOperations: access.sections.clubOperations,
  });
  assert.equal(gate.mountClubOperations, false);
  assert.equal(gate.state, DASHBOARD_CLUB_CONTEXT_STATE.CLUB_CONTEXT_READY_NO_CLUB);
});

test("I. unauthenticated / auth bootstrapping → no ClubOperations mount (no white-screen path)", () => {
  const boot = resolveDashboardClubOperationsGate({
    authLoading: true,
    isAuthenticated: false,
    permissionAllowsClubOperations: true,
  });
  assert.equal(boot.mountClubOperations, false);
  assert.equal(boot.state, DASHBOARD_CLUB_CONTEXT_STATE.AUTH_BOOTSTRAPPING);

  const unauth = resolveDashboardClubOperationsGate({
    authLoading: false,
    isAuthenticated: false,
    permissionAllowsClubOperations: true,
  });
  assert.equal(unauth.mountClubOperations, false);
  assert.equal(unauth.state, DASHBOARD_CLUB_CONTEXT_STATE.UNAUTHENTICATED);
});

test("id mismatch between activeClubId and activeClub denies mount", () => {
  const gate = resolveDashboardClubOperationsGate({
    authLoading: false,
    isAuthenticated: true,
    canonicalClubRead: true,
    clubReadState: CLUB_READ_STATE.READY,
    clubReadReady: true,
    activeClubReady: true,
    activeClubId: "club-a",
    activeClub: { id: "club-b", tenantId: "t1" },
    permissionAllowsClubOperations: true,
  });
  assert.equal(gate.mountClubOperations, false);
});

test("club read error is distinct from empty business data", () => {
  const gate = resolveDashboardClubOperationsGate({
    authLoading: false,
    isAuthenticated: true,
    canonicalClubRead: true,
    clubReadState: CLUB_READ_STATE.ERROR,
    clubReadReady: false,
    activeClubReady: false,
    activeClubId: null,
    activeClub: null,
    permissionAllowsClubOperations: true,
  });
  assert.equal(gate.state, DASHBOARD_CLUB_CONTEXT_STATE.CLUB_CONTEXT_ERROR);
  assert.equal(gate.mountClubOperations, false);
  assert.equal(gate.showClubOperationsPlaceholder, true);
});

test("source: Dashboard does not mount ClubOperations on permission alone", () => {
  const dashSrc = readSrc("src/pages/Dashboard.jsx");
  assert.doesNotMatch(
    dashSrc,
    /showClubOperations\s*=\s*useMemo\(\s*\(\)\s*=>\s*\{\s*const access/
  );
  assert.match(dashSrc, /resolveDashboardClubOperationsGate/);
  assert.match(dashSrc, /dashboard-club-operations-placeholder/);
});

test("source: Wave5 assertExplicitClubId retained in loadAIData / clubStorage", () => {
  const storageSrc = readSrc("src/ai/storage.js");
  const clubStorageSrc = readSrc("src/domain/clubStorage.js");
  const requireSrc = readSrc("src/features/club/context/requireExplicitClubId.js");
  assert.match(storageSrc, /assertExplicitClubId\(clubId\)/);
  assert.match(clubStorageSrc, /assertExplicitClubId\(clubId\)/);
  assert.match(requireSrc, /CLUB_REQUIRED/);
  assert.doesNotMatch(requireSrc, /getActiveClubId\(/);
});
