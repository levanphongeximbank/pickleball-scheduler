/**
 * TEAM-TOURNAMENT-CLOUD-ACCESS-GATE-REMEDIATION-01
 *
 * Owner failure: cloud_only Team create persists header but Team setup access
 * consulted legacy local blob via assertTournamentAccess → "Không tìm thấy giải."
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

import { assertTournamentAccess } from "../src/domain/tournamentService.js";
import { assertLoadedTournamentAccess } from "../src/features/tournament/guards/tournamentAccess.js";
import { resolveTeamTournamentCloudPageAccess } from "../src/features/team-tournament/ui/teamTournamentCloudAccess.js";
import { TOURNAMENT_MODE } from "../src/models/tournament/constants.js";
import { ROLES } from "../src/features/identity/constants/roles.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { saveClubs } from "../src/data/club.js";
import { createUserRecord } from "../src/models/user.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const PROD_CLUB_ID = "club-219e4a7cbd73437eb6271f02a53314c3";
const PROD_TENANT_ID = "venue-prod-main";
const PROD_SHELL_ID = "team-tournament-z6o3mtv1";

const CLOUD_TOURNAMENT = {
  id: PROD_SHELL_ID,
  clubId: PROD_CLUB_ID,
  tenantId: PROD_TENANT_ID,
  mode: TOURNAMENT_MODE.TEAM_TOURNAMENT,
  status: "draft",
  name: "Giải đồng đội 8/8/2026",
  teamData: { teams: [], matchups: [], settings: {} },
};

const SUPER_ADMIN = createUserRecord({
  id: "owner-1",
  role: ROLES.SUPER_ADMIN,
  tenantId: PROD_TENANT_ID,
  venueId: PROD_TENANT_ID,
});

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

function readSrc(rel) {
  return readFileSync(path.join(root, rel), "utf8");
}

function allowAllCan(permission) {
  return (
    permission === PERMISSIONS.TEAM_MANAGE ||
    permission === PERMISSIONS.TOURNAMENT_UPDATE ||
    permission === PERMISSIONS.TEAM_VIEW ||
    permission === PERMISSIONS.TOURNAMENT_VIEW
  );
}

describe("team-tournament-cloud-access-gate-remediation-01", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    // Empty club registry is fine for platform-wide SUPER_ADMIN.
    // Club-scoped mismatch tests seed their own club row.
    saveClubs([]);
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  it("BEFORE: legacy assertTournamentAccess fails when blob lacks cloud_only Team", () => {
    const legacy = assertTournamentAccess(PROD_CLUB_ID, PROD_SHELL_ID, {
      tenantId: PROD_TENANT_ID,
      rbacEnabled: false,
      user: SUPER_ADMIN,
    });
    assert.equal(legacy.ok, false);
    assert.equal(legacy.code, "NOT_FOUND");
    assert.equal(legacy.error, "Không tìm thấy giải.");
  });

  it("AFTER: cloud-loaded tournament allows Owner/SUPER_ADMIN without local blob", () => {
    const loaded = assertLoadedTournamentAccess(PROD_CLUB_ID, CLOUD_TOURNAMENT, {
      tenantId: PROD_TENANT_ID,
      rbacEnabled: true,
      user: SUPER_ADMIN,
    });
    assert.equal(loaded.ok, true, loaded.error);
    assert.equal(loaded.tournament?.id, PROD_SHELL_ID);

    const page = resolveTeamTournamentCloudPageAccess({
      rbacEnabled: true,
      isAuthenticated: true,
      clubId: PROD_CLUB_ID,
      tournament: CLOUD_TOURNAMENT,
      currentTenantId: PROD_TENANT_ID,
      user: SUPER_ADMIN,
      can: allowAllCan,
    });
    assert.equal(page.pending, false);
    assert.equal(page.allowed, true);
    assert.equal(page.error, null);
  });

  it("does not treat pending cloud load as NOT_FOUND", () => {
    const page = resolveTeamTournamentCloudPageAccess({
      rbacEnabled: true,
      isAuthenticated: true,
      clubId: PROD_CLUB_ID,
      tournament: null,
      currentTenantId: PROD_TENANT_ID,
      user: SUPER_ADMIN,
      can: allowAllCan,
    });
    assert.equal(page.pending, true);
    assert.equal(page.allowed, false);
    assert.equal(page.error, null);
    assert.equal(page.code, "PENDING_CLOUD_LOAD");
    assert.equal(String(page.error || "").includes("Không tìm thấy giải"), false);
  });

  it("TRUE NOT_FOUND: null loaded tournament via assertLoadedTournamentAccess", () => {
    const missing = assertLoadedTournamentAccess(PROD_CLUB_ID, null, {
      tenantId: PROD_TENANT_ID,
      rbacEnabled: true,
      user: SUPER_ADMIN,
    });
    assert.equal(missing.ok, false);
    assert.equal(missing.code, "NOT_FOUND");
    assert.equal(missing.error, "Không tìm thấy giải.");
  });

  it("TENANT MISMATCH fail-closed", () => {
    saveClubs([
      {
        id: PROD_CLUB_ID,
        name: "Prod Club",
        venueId: PROD_TENANT_ID,
        tenantId: PROD_TENANT_ID,
      },
    ]);

    const mismatched = {
      ...CLOUD_TOURNAMENT,
      tenantId: "venue-other",
    };
    const clubManager = createUserRecord({
      id: "club-manager-1",
      role: ROLES.CLUB_MANAGER,
      tenantId: PROD_TENANT_ID,
      venueId: PROD_TENANT_ID,
      clubId: PROD_CLUB_ID,
    });

    const loaded = assertLoadedTournamentAccess(PROD_CLUB_ID, mismatched, {
      tenantId: PROD_TENANT_ID,
      rbacEnabled: true,
      user: clubManager,
    });
    assert.equal(loaded.ok, false);
    assert.notEqual(loaded.code, "PENDING_CLOUD_LOAD");

    const page = resolveTeamTournamentCloudPageAccess({
      rbacEnabled: true,
      isAuthenticated: true,
      clubId: PROD_CLUB_ID,
      tournament: mismatched,
      currentTenantId: PROD_TENANT_ID,
      user: clubManager,
      can: allowAllCan,
    });
    assert.equal(page.allowed, false);
    assert.equal(page.pending, false);
  });

  it("static: Team setup uses loaded-tournament access, not legacy blob assert", () => {
    const setup = readSrc("src/pages/tournament/TeamTournamentSetup.jsx");
    const helper = readSrc(
      "src/features/team-tournament/ui/teamTournamentCloudAccess.js"
    );

    assert.match(setup, /resolveTeamTournamentCloudPageAccess/);
    assert.match(helper, /assertLoadedTournamentAccess/);
    assert.equal(setup.includes("assertTournamentAccess"), false);
    assert.equal(setup.includes('from "../../domain/tournamentService.js"'), false);
    assert.equal(helper.includes("assertTournamentAccess"), false);
    assert.equal(helper.includes("domain/tournamentService"), false);
    assert.equal(helper.includes("assertTournamentAccess"), false);
    assert.equal(
      /from\s+["'][^"']*tournamentService["']/.test(helper),
      false
    );
    assert.equal(setup.includes("default-tenant"), false);
    assert.equal(setup.includes("venue-prod-main"), false);

    // Preserve Team shell id contract markers (no UUID dual lookup).
    assert.equal(setup.includes("team_tournaments.id"), false);
    assert.equal(/uuid first|primary.?uuid/i.test(setup), false);
  });
});
