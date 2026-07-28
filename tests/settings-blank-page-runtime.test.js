import test, { beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getLastCloudSync,
  readLastCloudSyncTimestamp,
} from "../src/ai/cloudSync.js";
import {
  assertLocalCloudDbAllowed,
  LEGACY_AUTHORITY_ERROR,
} from "../src/features/platform-hard-cutover/legacyAuthorityPolicy.js";
import { HARD_CUTOVER_FLAG } from "../src/features/platform-hard-cutover/runtimeAuthorityMatrix.js";
import {
  resolveSettingsPageState,
  SETTINGS_PAGE_STATUS,
} from "../src/pages/settings/settingsPageState.js";
import {
  clearGovernanceScope,
  getGovernanceScopeState,
  hasClubGovernanceManagerAccess,
  hydrateGovernanceScope,
  primeGovernanceScopeForTest,
  resolveGovernanceElevatedRole,
  setGovernanceScopeErrorForTest,
} from "../src/auth/governanceScopeResolver.js";
import { ROLES } from "../src/auth/roles.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROD_CLUB_ID = "club-219e4a7cbd73437eb6271f02a53314c3";

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
  globalThis.localStorage = createLocalStorageMock({
    "pickleball-clubs-v1": JSON.stringify([
      { id: PROD_CLUB_ID, name: "Production Club" },
      { id: "default-club", name: "CLB Mac dinh" },
    ]),
    "pickleball-active-club-v1": PROD_CLUB_ID,
  });
  clearGovernanceScope();
});

describe("HARD-CUTOVER-03 Settings blank-page — pre-fix reproduction evidence", () => {
  test("exact production expression: null cloud-db indexed by clubId throws TypeError", () => {
    const db = null;
    const clubId = PROD_CLUB_ID;

    assert.throws(
      () => {
        // Exact pre-remediation expression from getLastCloudSync:
        //   const db = loadCloudDatabase(); // null under secure/hard-cutover
        //   return db[clubId]?.syncedAt || null;
        void db[clubId]?.syncedAt;
      },
      (err) => {
        assert.equal(err instanceof TypeError, true);
        assert.match(
          err.message,
          /Cannot read properties of null \(reading 'club-219e4a7cbd73437eb6271f02a53314c3'\)/
        );
        return true;
      }
    );
  });

  test("secure/hard-cutover gate forbids local cloud db (loadCloudDatabase → null path)", () => {
    const gate = assertLocalCloudDbAllowed({ [HARD_CUTOVER_FLAG]: "true" });
    assert.equal(gate.ok, false);
    assert.equal(gate.code, LEGACY_AUTHORITY_ERROR.LOCAL_CLOUD_DB_FORBIDDEN);
  });

  test("getLastCloudSync source no longer indexes db without null guard", () => {
    const src = fs.readFileSync(path.join(ROOT, "src/ai/cloudSync.js"), "utf8");
    assert.match(src, /export function readLastCloudSyncTimestamp/);
    assert.match(src, /export function getLastCloudSync/);
    assert.doesNotMatch(
      src,
      /export function getLastCloudSync\([^)]*\) \{\s*const db = loadCloudDatabase\(\);\s*return db\[clubId\]/
    );
  });
});

describe("HARD-CUTOVER-03 null-safe cloud sync timestamp", () => {
  test("active clubId + null elevation/collection → no throw, null timestamp", () => {
    assert.equal(readLastCloudSyncTimestamp(null, PROD_CLUB_ID), null);
    assert.doesNotThrow(() => getLastCloudSync(PROD_CLUB_ID));
  });

  test("active clubId + undefined collection → no throw", () => {
    assert.equal(readLastCloudSyncTimestamp(undefined, PROD_CLUB_ID), null);
  });

  test("active clubId + empty object → no invented sync / elevation", () => {
    assert.equal(readLastCloudSyncTimestamp({}, PROD_CLUB_ID), null);
  });

  test("elevation/object missing clubId key → null (no fake data)", () => {
    assert.equal(
      readLastCloudSyncTimestamp(
        { "other-club": { syncedAt: "2026-01-01T00:00:00.000Z" } },
        PROD_CLUB_ID
      ),
      null
    );
  });

  test("no active clubId → null without throw", () => {
    assert.equal(readLastCloudSyncTimestamp({ [PROD_CLUB_ID]: { syncedAt: "t" } }, null), null);
    assert.equal(readLastCloudSyncTimestamp({ [PROD_CLUB_ID]: { syncedAt: "t" } }, ""), null);
  });

  test("valid entry returns syncedAt", () => {
    assert.equal(
      readLastCloudSyncTimestamp(
        { [PROD_CLUB_ID]: { syncedAt: "2026-07-28T00:00:00.000Z" } },
        PROD_CLUB_ID
      ),
      "2026-07-28T00:00:00.000Z"
    );
  });
});

describe("HARD-CUTOVER-03 Settings page state model", () => {
  test("platform runtime loading → loading state", () => {
    const state = resolveSettingsPageState({
      activeClubId: PROD_CLUB_ID,
      activeClub: { id: PROD_CLUB_ID, name: "X" },
      platformPreview: null,
    });
    assert.equal(state.status, SETTINGS_PAGE_STATUS.LOADING);
  });

  test("platform runtime error → runtime_error (not blank / not empty)", () => {
    const state = resolveSettingsPageState({
      activeClubId: PROD_CLUB_ID,
      activeClub: { id: PROD_CLUB_ID, name: "X" },
      platformPreview: { status: "error", message: "boom" },
    });
    assert.equal(state.status, SETTINGS_PAGE_STATUS.RUNTIME_ERROR);
    assert.match(state.message, /boom|Không thể/);
  });

  test("user without access → unauthorized (not system error)", () => {
    const state = resolveSettingsPageState({
      activeClubId: PROD_CLUB_ID,
      activeClub: { id: PROD_CLUB_ID, name: "X" },
      accessAllowed: false,
      platformPreview: { status: "ready" },
    });
    assert.equal(state.status, SETTINGS_PAGE_STATUS.UNAUTHORIZED);
  });

  test("no active club → empty (still resolvable UI state)", () => {
    const state = resolveSettingsPageState({
      activeClubId: null,
      activeClub: null,
      platformPreview: { status: "ready" },
    });
    assert.equal(state.status, SETTINGS_PAGE_STATUS.EMPTY);
  });

  test("local cloud db forbidden → unavailable (no fake sync)", () => {
    const state = resolveSettingsPageState({
      activeClubId: PROD_CLUB_ID,
      activeClub: { id: PROD_CLUB_ID, name: "X" },
      platformPreview: { status: "ready" },
      localCloudDbReadable: false,
      cloudSyncMode: "local",
    });
    assert.equal(state.status, SETTINGS_PAGE_STATUS.UNAVAILABLE);
  });

  test("local cloud db forbidden + supabase mode → ready (expected production)", () => {
    const state = resolveSettingsPageState({
      activeClubId: PROD_CLUB_ID,
      activeClub: { id: PROD_CLUB_ID, name: "X" },
      platformPreview: { status: "ready" },
      localCloudDbReadable: false,
      cloudSyncMode: "supabase",
    });
    assert.equal(state.status, SETTINGS_PAGE_STATUS.READY);
  });

  test("happy path → ready", () => {
    const state = resolveSettingsPageState({
      activeClubId: PROD_CLUB_ID,
      activeClub: { id: PROD_CLUB_ID, name: "X" },
      platformPreview: { status: "ready" },
      localCloudDbReadable: true,
      accessAllowed: true,
    });
    assert.equal(state.status, SETTINGS_PAGE_STATUS.READY);
  });
});

describe("HARD-CUTOVER-03 governance elevation — no fake roles / no crash", () => {
  test("null/undefined/empty governance scope does not invent CLUB_MANAGER", () => {
    clearGovernanceScope();
    const player = { id: "u1", role: ROLES.PLAYER, clubId: PROD_CLUB_ID };

    assert.equal(hasClubGovernanceManagerAccess(player), false);
    assert.equal(resolveGovernanceElevatedRole(player), ROLES.PLAYER);

    primeGovernanceScopeForTest({
      user: player,
      elevated: false,
      clubId: null,
      status: "ready",
    });
    assert.equal(resolveGovernanceElevatedRole(player), ROLES.PLAYER);

    setGovernanceScopeErrorForTest({ user: player, code: "RPC_FAILED" });
    assert.equal(hasClubGovernanceManagerAccess(player), false);
    assert.equal(resolveGovernanceElevatedRole(player), ROLES.PLAYER);
  });

  test("scope missing clubId key does not elevate", () => {
    const player = { id: "u2", role: ROLES.PLAYER, clubId: PROD_CLUB_ID };
    primeGovernanceScopeForTest({
      user: player,
      elevated: false,
      clubId: "other-club",
      status: "ready",
    });
    assert.equal(resolveGovernanceElevatedRole(player), ROLES.PLAYER);
    const snap = getGovernanceScopeState();
    assert.notEqual(snap.clubId, PROD_CLUB_ID);
  });

  test("hydrate without user stays deny-by-default", async () => {
    const result = await hydrateGovernanceScope({ user: null });
    assert.equal(result.ok, true);
    assert.equal(result.elevated, false);
  });
});

describe("HARD-CUTOVER-03 Settings route/error-boundary source contracts", () => {
  test("SettingsRoute wraps page with error boundary", () => {
    const routeSrc = fs.readFileSync(
      path.join(ROOT, "src/pages/settings/SettingsRoute.jsx"),
      "utf8"
    );
    const boundarySrc = fs.readFileSync(
      path.join(ROOT, "src/components/settings/SettingsRouteErrorBoundary.jsx"),
      "utf8"
    );
    const routerSrc = fs.readFileSync(path.join(ROOT, "src/router.jsx"), "utf8");

    assert.match(routeSrc, /SettingsRouteErrorBoundary/);
    assert.match(boundarySrc, /getDerivedStateFromError/);
    assert.match(boundarySrc, /Thử lại/);
    assert.match(boundarySrc, /Tải lại trang/);
    assert.doesNotMatch(boundarySrc, /stack trace|access_token|Authorization:/i);
    assert.match(routerSrc, /pages\/settings\/SettingsRoute/);
  });

  test("Settings page distinguishes explicit statuses (no whole-route null)", () => {
    const settingsSrc = fs.readFileSync(path.join(ROOT, "src/pages/Settings.jsx"), "utf8");
    assert.match(settingsSrc, /resolveSettingsPageState/);
    assert.match(settingsSrc, /settings-state-empty/);
    assert.match(settingsSrc, /settings-state-unavailable/);
    assert.match(settingsSrc, /settings-state-runtime-error/);
    assert.doesNotMatch(settingsSrc, /export default function Settings\(\) \{\s*return null/);
  });
});
