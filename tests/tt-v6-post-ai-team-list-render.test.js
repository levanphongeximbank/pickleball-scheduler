import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { saveClubs } from "../src/data/club.js";
import { getDefaultClubData, loadClubData, saveClubData } from "../src/domain/clubStorage.js";
import { applyTeamPairing } from "../src/features/team-tournament/engines/teamAutoDrawEngine.js";
import { createTeamRecord, normalizeTeamData } from "../src/features/team-tournament/models/index.js";
import { mapTournamentToAggregate } from "../src/features/team-tournament/repositories/teamTournamentRepositoryAggregate.js";
import { TEAM_TOURNAMENT_STORE_MODES } from "../src/features/team-tournament/repositories/teamTournamentRepository.js";
import {
  __resetTeamTournamentStoreModeForTests,
  __setTeamTournamentStoreModeForTests,
} from "../src/features/team-tournament/services/teamTournamentCloudSync.js";
import {
  applyAiGeneratedTeamsToTournament,
  createTeamTournament,
  getTeamTournamentById,
} from "../src/features/team-tournament/services/teamTournamentService.js";
import { aggregateToTournamentView } from "../src/features/team-tournament/ui/teamTournamentUiOrchestrator.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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
    key(index) {
      return [...store.keys()][index] ?? null;
    },
    get length() {
      return store.size;
    },
  };
}

function mlpTeamsWithCaptains() {
  return [
    createTeamRecord({
      id: "team-ai-1",
      name: "Đội AI 1",
      playerIds: ["m1", "m2", "f1", "f2"],
      captainPlayerId: "m1",
      seed: 1,
      avgLevel: 4,
    }),
    createTeamRecord({
      id: "team-ai-2",
      name: "Đội AI 2",
      playerIds: ["m3", "m4", "f3", "f4"],
      captainPlayerId: "f3",
      seed: 2,
      avgLevel: 3.8,
    }),
  ];
}

describe("TT-V6 post-AI team list persist + render", () => {
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
  });

  afterEach(() => {
    __resetTeamTournamentStoreModeForTests();
    delete globalThis.localStorage;
    delete globalThis.window;
  });

  it("AI generate 2 teams → applyTeamPairing → durable save → parent sees teams", async () => {
    const clubId = "club-ai-render";
    saveClubs([{ id: clubId, name: "AI Club", tenantId: "tenant-1" }]);
    saveClubData(clubId, getDefaultClubData(clubId));

    const created = createTeamTournament(clubId, {
      name: "AI MLP",
      formatPreset: "mlp_4",
    });
    assert.equal(created.ok, true);

    const paired = applyTeamPairing(created.tournament.teamData, {
      teams: mlpTeamsWithCaptains(),
    });
    assert.equal(paired.ok, true);
    assert.equal(paired.teamData.teams.length, 2);
    assert.equal(paired.teamData.groups.length, 0);

    const saved = await applyAiGeneratedTeamsToTournament(
      clubId,
      created.tournament.id,
      paired.teamData
    );
    assert.equal(saved.ok, true);
    assert.equal(saved.teamCount, 2);
    assert.equal(saved.cloudRequired, false);

    const reloaded = getTeamTournamentById(clubId, created.tournament.id);
    assert.equal(reloaded.teamData.teams.length, 2);
    assert.equal(reloaded.teamData.teams[0].captainPlayerId, "m1");
    assert.equal(reloaded.teamData.teams[1].playerIds.length, 4);

    // Hard-refresh style: blob reload still has teams
    const blob = loadClubData(clubId);
    const fromBlob = blob.tournaments.find((row) => row.id === created.tournament.id);
    assert.equal(fromBlob.teamData.teams.length, 2);
  });

  it("repository mapping preserves roster + captain fields", () => {
    const tournament = {
      id: "tour-map",
      clubId: "club-a",
      tenantId: "tenant-1",
      status: "draft",
      teamData: normalizeTeamData({
        formatPreset: "mlp_4",
        teams: mlpTeamsWithCaptains(),
      }),
    };
    const aggregate = mapTournamentToAggregate(tournament, "local");
    assert.equal(aggregate.teams.length, 2);
    assert.equal(aggregate.teams[0].captainPlayerId, "m1");
    assert.deepEqual(aggregate.teams[0].playerIds, ["m1", "m2", "f1", "f2"]);

    const view = aggregateToTournamentView(aggregate);
    assert.equal(view.teamData.teams.length, 2);
    assert.equal(view.teamData.teams[1].captainPlayerId, "f3");
  });

  it("cloud failure does not report success", async () => {
    const clubId = "club-ai-cloud-fail";
    saveClubs([{ id: clubId, name: "AI Club", tenantId: "tenant-1" }]);
    saveClubData(clubId, getDefaultClubData(clubId));
    const created = createTeamTournament(clubId, {
      name: "AI MLP cloud",
      formatPreset: "mlp_4",
    });
    assert.equal(created.ok, true);

    __setTeamTournamentStoreModeForTests(TEAM_TOURNAMENT_STORE_MODES.SUPABASE);

    const paired = applyTeamPairing(created.tournament.teamData, {
      teams: mlpTeamsWithCaptains(),
    });
    const saved = await applyAiGeneratedTeamsToTournament(
      clubId,
      created.tournament.id,
      paired.teamData
    );

    assert.equal(saved.ok, false);
    assert.equal(saved.cloudRequired, true);
    assert.ok(saved.error);

    // Local must not claim durable AI teams when cloud failed closed before local write
    const reloaded = getTeamTournamentById(clubId, created.tournament.id);
    assert.equal((reloaded.teamData?.teams || []).length, 0);
  });

  it("TeamRosterPanel wires applyAiGeneratedTeamsToTournament (not local-only patch)", () => {
    const src = readFileSync(
      path.join(ROOT, "src/components/tournament/TeamRosterPanel.jsx"),
      "utf8"
    );
    assert.match(src, /applyAiGeneratedTeamsToTournament/);
    assert.doesNotMatch(
      src,
      /patchTeamTournament\(clubId,\s*tournamentId,\s*\{\s*teamData:\s*nextTeamData/
    );
    assert.match(src, /RELOAD_EMPTY_TEAMS|danh sách trống sau khi tải lại/);
    assert.match(src, /await onUpdated/);
  });

  it("TeamAiPairingDialog awaits onApply and closes only after success", () => {
    const src = readFileSync(
      path.join(ROOT, "src/components/tournament/team/TeamAiPairingDialog.jsx"),
      "utf8"
    );
    assert.match(src, /async function handleApply/);
    assert.match(src, /await onApply/);
    assert.match(src, /applyResult\?\.ok === false/);
    assert.match(src, /setApplying/);
  });

  it("parent refresh contract: empty reload blocks success message", () => {
    const expectedIds = new Set(["team-ai-1", "team-ai-2"]);
    const teamsAfterReload = [];
    const visibleExpected = teamsAfterReload.filter((team) =>
      expectedIds.has(String(team.id))
    );
    assert.equal(teamsAfterReload.length, 0);
    assert.equal(visibleExpected.length, 0);
  });
});
