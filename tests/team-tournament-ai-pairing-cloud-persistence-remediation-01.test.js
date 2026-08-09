/**
 * TEAM-TOURNAMENT-AI-PAIRING-CLOUD-PERSISTENCE-REMEDIATION-01
 *
 * Owner: AI confirm used getTeamTournamentById(local blob) → NOT_FOUND for
 * cloud_only Team tournaments; groups preview was hard-cleared.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

import { saveClubs } from "../src/data/club.js";
import { getDefaultClubData, saveClubData } from "../src/domain/clubStorage.js";
import { createTeamRecord, normalizeTeamData } from "../src/features/team-tournament/models/index.js";
import { TEAM_TOURNAMENT_STORE_MODES } from "../src/features/team-tournament/repositories/teamTournamentRepository.js";
import {
  __resetTeamTournamentStoreModeForTests,
  __setTeamTournamentStoreModeForTests,
} from "../src/features/team-tournament/services/teamTournamentCloudSync.js";
import { confirmAiPairingCloudPersistence } from "../src/features/team-tournament/services/aiPairingCloudPersistence.js";
import {
  applyAiGeneratedTeamsToTournament,
  getTeamTournamentById,
} from "../src/features/team-tournament/services/teamTournamentService.js";
import { WORKFLOW_STAGE } from "../src/features/team-tournament/engines/teamTournamentWorkflowStage.js";
import { createUserRecord } from "../src/models/user.js";
import { ROLES } from "../src/features/identity/constants/roles.js";
import { enableRbac, signInAs, signOut } from "../src/auth/authService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const PROD_CLUB_ID = "club-219e4a7cbd73437eb6271f02a53314c3";
const PROD_TENANT_ID = "venue-prod-main";
const PROD_SHELL_ID = "team-tournament-f8wq3klh";

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

function buildEightTeamsWithCaptains() {
  const teams = [];
  for (let i = 1; i <= 8; i += 1) {
    const ids = [`m${i}a`, `m${i}b`, `f${i}a`, `f${i}b`];
    teams.push(
      createTeamRecord({
        id: `team-ai-${i}`,
        name: `Đội ${i}`,
        playerIds: ids,
        captainPlayerId: ids[0],
        seed: i,
        avgLevel: 4,
      })
    );
  }
  return teams;
}

function buildTwoGroups(teams) {
  return [
    {
      id: "group-a",
      name: "Bảng A",
      teamIds: teams.slice(0, 4).map((team) => team.id),
    },
    {
      id: "group-b",
      name: "Bảng B",
      teamIds: teams.slice(4).map((team) => team.id),
    },
  ];
}

describe("team-tournament-ai-pairing-cloud-persistence-remediation-01", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    globalThis.window = {
      dispatchEvent() {
        return true;
      },
      addEventListener() {},
      removeEventListener() {},
    };
    __setTeamTournamentStoreModeForTests(TEAM_TOURNAMENT_STORE_MODES.LOCAL);
    enableRbac(false);
    signOut();
  });

  afterEach(() => {
    __resetTeamTournamentStoreModeForTests();
    enableRbac(false);
    signOut();
    delete globalThis.localStorage;
    delete globalThis.window;
  });

  it("BEFORE: legacy blob lookup fails when cloud_only tournament is absent locally", async () => {
    saveClubs([
      { id: PROD_CLUB_ID, name: "Prod Club", tenantId: PROD_TENANT_ID, venueId: PROD_TENANT_ID },
    ]);
    saveClubData(PROD_CLUB_ID, getDefaultClubData(PROD_CLUB_ID));
    assert.equal(getTeamTournamentById(PROD_CLUB_ID, PROD_SHELL_ID), null);

    const teams = buildEightTeamsWithCaptains();
    const legacy = await applyAiGeneratedTeamsToTournament(
      PROD_CLUB_ID,
      PROD_SHELL_ID,
      normalizeTeamData({ teams, groups: buildTwoGroups(teams), matchups: [] })
      // no options.tournament — LOCAL mode falls back to blob
    );
    assert.equal(legacy.ok, false);
    assert.equal(legacy.code, "NOT_FOUND");
    assert.match(String(legacy.error || ""), /Không tìm thấy giải/);
  });

  it("AFTER: loaded tournament authority persists 8 captains + 2 groups without blob", async () => {
    const teams = buildEightTeamsWithCaptains();
    const groups = buildTwoGroups(teams);
    const loaded = {
      id: PROD_SHELL_ID,
      clubId: PROD_CLUB_ID,
      tenantId: PROD_TENANT_ID,
      status: "draft",
      name: "Giải đồng đội Owner",
      teamData: normalizeTeamData({ teams: [], groups: [], matchups: [] }),
    };

    let persistedGroups = null;
    const result = await confirmAiPairingCloudPersistence({
      clubId: PROD_CLUB_ID,
      tournamentId: PROD_SHELL_ID,
      tournament: loaded,
      currentTenantId: PROD_TENANT_ID,
      nextTeamData: normalizeTeamData({
        teams,
        groups,
        matchups: [{ id: "should-not-keep" }],
      }),
      rulesVersion: "ppr-runtime-v1",
      expectedTournamentVersion: 1,
      persistSetupTeamData: async (teamData) => {
        persistedGroups = teamData.groups || [];
        return {
          ok: true,
          teamData: {
            ...teamData,
            groups: persistedGroups,
            matchups: [],
          },
          readback: {
            teamData: {
              teams,
              groups: persistedGroups,
              matchups: [],
            },
          },
        };
      },
      reload: async () => ({ ok: true, version: 2 }),
    });

    assert.equal(result.ok, true, result.error);
    assert.equal(result.teamCount, 8);
    assert.equal(result.captainsExpected, 8);
    assert.equal(result.captainsPersisted, 8);
    assert.equal(result.groupsExpected, 2);
    assert.equal(result.groupsPersisted, 2);
    assert.equal(result.persistedLocally, false);
    assert.equal(result.matchupsEmptyValid, true);
    assert.equal(result.matchupsExpectedAtAiConfirm, false);
    assert.equal((persistedGroups || []).length, 2);
    assert.equal(result.workflowStage, WORKFLOW_STAGE.DISCIPLINES);
    assert.equal(getTeamTournamentById(PROD_CLUB_ID, PROD_SHELL_ID), null);
  });

  it("TRUE NOT_FOUND fail-closed when loaded tournament missing", async () => {
    const teams = buildEightTeamsWithCaptains();
    const result = await confirmAiPairingCloudPersistence({
      clubId: PROD_CLUB_ID,
      tournamentId: PROD_SHELL_ID,
      tournament: null,
      nextTeamData: { teams, groups: buildTwoGroups(teams) },
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "NOT_FOUND");
  });

  it("TENANT mismatch fail-closed", async () => {
    const teams = buildEightTeamsWithCaptains();
    const loaded = {
      id: PROD_SHELL_ID,
      clubId: PROD_CLUB_ID,
      tenantId: "venue-other",
      status: "draft",
      teamData: normalizeTeamData({ teams: [] }),
    };
    enableRbac(true);
    signInAs(
      createUserRecord({
        role: ROLES.CLUB_MANAGER,
        tenantId: PROD_TENANT_ID,
        venueId: PROD_TENANT_ID,
        clubId: PROD_CLUB_ID,
      })
    );

    const result = await applyAiGeneratedTeamsToTournament(
      PROD_CLUB_ID,
      PROD_SHELL_ID,
      { teams, groups: [], matchups: [] },
      { tournament: loaded, currentTenantId: PROD_TENANT_ID, rbacEnabled: true }
    );
    assert.equal(result.ok, false);
    assert.notEqual(result.code, "PENDING_CLOUD_LOAD");
  });

  it("apply preserves incoming groups (no hard-clear) and clears matchups", async () => {
    const teams = buildEightTeamsWithCaptains().slice(0, 2);
    const groups = [
      { id: "g1", name: "A", teamIds: [teams[0].id, teams[1].id] },
    ];
    const loaded = {
      id: "team-tournament-local-ai",
      clubId: "club-ai-local",
      tenantId: "tenant-1",
      status: "draft",
      teamData: normalizeTeamData({ teams: [] }),
    };
    saveClubs([{ id: "club-ai-local", name: "AI", tenantId: "tenant-1" }]);
    saveClubData("club-ai-local", getDefaultClubData("club-ai-local"));

    const saved = await applyAiGeneratedTeamsToTournament(
      "club-ai-local",
      loaded.id,
      normalizeTeamData({
        teams,
        groups,
        matchups: [{ id: "m1" }],
      }),
      { tournament: loaded }
    );
    assert.equal(saved.ok, true, saved.error);
    assert.equal(saved.teamData.groups.length, 1);
    assert.equal(saved.teamData.matchups.length, 0);
    assert.equal(saved.persistedLocally, false);
  });

  it("static: no legacy blob-only apply authority; preview copy not claiming save", () => {
    const service = readSrc(
      "src/features/team-tournament/services/teamTournamentService.js"
    );
    const persist = readSrc(
      "src/features/team-tournament/services/aiPairingCloudPersistence.js"
    );
    const dialog = readSrc(
      "src/components/tournament/team/TeamAiPairingDialog.jsx"
    );
    const roster = readSrc("src/components/tournament/TeamRosterPanel.jsx");

    assert.match(service, /resolveTournamentForAiApply/);
    assert.match(persist, /confirmAiPairingCloudPersistence/);
    assert.match(persist, /persistSetupTeamData/);
    assert.match(roster, /confirmAiPairingUiTransaction/);
    assert.match(dialog, /catch \(error\)/);
    assert.match(dialog, /Xem trước/);
    assert.equal(dialog.includes("Đã gắn"), false);
    assert.equal(dialog.includes("vào kết quả lưu"), false);
    assert.equal(service.includes("default-tenant"), false);
    assert.equal(persist.includes("venue-prod-main"), false);
    assert.equal(roster.includes("team_tournaments.id"), false);

    // apply no longer unconditionally hard-clears groups in normalize merge
    assert.equal(
      /groups:\s*\[\s*\],\s*matchups:\s*\[\s*\]/.test(
        service.slice(service.indexOf("export async function applyAiGeneratedTeamsToTournament"))
      ),
      false
    );
  });
});
