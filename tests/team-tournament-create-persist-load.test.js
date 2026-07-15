import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { saveClubs, setActiveClubIdPreference } from "../src/data/club.js";
import {
  findTournamentClubId,
  resolveTournamentClubId,
} from "../src/features/club/services/clubTournamentBridge.js";
import { getDefaultClubData, loadClubData, saveClubData } from "../src/domain/clubStorage.js";
import { isTeamTournament } from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import { createTeamTournament } from "../src/features/team-tournament/services/teamTournamentService.js";
import {
  __resetTeamTournamentDataModeForTests,
  __setTeamTournamentDataModeForTests,
  createTeamTournamentRepository,
  TEAM_TOURNAMENT_DATA_MODES,
} from "../src/features/team-tournament/repositories/teamTournamentRepositoryFactory.js";
import {
  createTeamTournamentUiOrchestrator,
} from "../src/features/team-tournament/ui/teamTournamentUiOrchestrator.js";
import { resolveTeamTournamentLoadClubId } from "../src/features/team-tournament/ui/useTeamTournamentPage.js";

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

describe("Team Tournament create → persist → detail load", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    globalThis.window = {
      dispatchEvent() {
        return true;
      },
      addEventListener() {},
      removeEventListener() {},
    };
    __setTeamTournamentDataModeForTests(TEAM_TOURNAMENT_DATA_MODES.LEGACY);
  });

  afterEach(() => {
    __resetTeamTournamentDataModeForTests();
    delete globalThis.localStorage;
    delete globalThis.window;
  });

  it("1. MLP create builds full object (not ID-only) with teamData + mode", () => {
    const clubId = "club-mlp-create";
    saveClubs([{ id: clubId, name: "MLP", tenantId: "tenant-1" }]);
    saveClubData(clubId, getDefaultClubData(clubId));

    const result = createTeamTournament(clubId, {
      name: "Giải đồng đội MLP",
      formatPreset: "mlp_4",
    });

    assert.equal(result.ok, true);
    assert.ok(result.tournament?.id);
    assert.equal(result.tournament.mode, "team_tournament");
    assert.ok(result.tournament.teamData, "draft must include teamData");
    assert.equal(isTeamTournament(result.tournament), true);
  });

  it("2–3. Persist before navigate contract: blob readback + detail loader OK", async () => {
    const clubId = "club-mlp-persist";
    saveClubs([{ id: clubId, name: "Persist", tenantId: "tenant-1" }]);
    saveClubData(clubId, getDefaultClubData(clubId));

    const created = createTeamTournament(clubId, {
      name: "Persist MLP",
      formatPreset: "mlp_4",
    });
    assert.equal(created.ok, true);

    const inBlob = (loadClubData(clubId).tournaments || []).find(
      (item) => item.id === created.tournament.id
    );
    assert.ok(inBlob, "must be in pickleball-club-data-v3::{clubId}");
    assert.equal(inBlob.mode, "team_tournament");

    const loadClub = resolveTeamTournamentLoadClubId(clubId, created.tournament.id);
    assert.equal(loadClub, clubId);

    const repo = createTeamTournamentRepository({ forceNew: true, allowFutureModes: true });
    const orch = createTeamTournamentUiOrchestrator({ repository: repo, forceNew: true });
    const loaded = await orch.loadTournament(loadClub, created.tournament.id);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.tournament.id, created.tournament.id);
    assert.equal(isTeamTournament(loaded.tournament), true);
  });

  it("4. Refresh-style second load still finds the same draft", async () => {
    const clubId = "club-mlp-refresh";
    saveClubs([{ id: clubId, name: "Refresh", tenantId: "tenant-1" }]);
    saveClubData(clubId, getDefaultClubData(clubId));
    const created = createTeamTournament(clubId, { name: "Refresh MLP", formatPreset: "mlp_4" });

    const repo = createTeamTournamentRepository({ forceNew: true, allowFutureModes: true });
    const first = await repo.getTournament(clubId, created.tournament.id);
    const second = await repo.getTournament(clubId, created.tournament.id);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.data.id, created.tournament.id);
  });

  it("5–6. activeClubId host wins; wrong active club still resolves owner", () => {
    const hostClubId = "club-host-mlp";
    const otherClubId = "club-other-mlp";
    saveClubs([
      { id: hostClubId, name: "Host", tenantId: "tenant-1" },
      { id: otherClubId, name: "Other", tenantId: "tenant-1" },
    ]);
    saveClubData(hostClubId, getDefaultClubData(hostClubId));
    saveClubData(otherClubId, getDefaultClubData(otherClubId));

    const created = createTeamTournament(hostClubId, {
      name: "Hosted MLP",
      formatPreset: "mlp_4",
    });
    assert.equal(created.ok, true);
    assert.equal(created.clubId, hostClubId);
    assert.equal(findTournamentClubId(created.tournament.id), hostClubId);
    assert.equal(resolveTournamentClubId(otherClubId, created.tournament.id), hostClubId);
    assert.equal(
      resolveTeamTournamentLoadClubId(otherClubId, created.tournament.id),
      hostClubId
    );
  });

  it("7. Create failure (missing club) does not invent a navigable id", () => {
    const result = createTeamTournament("", { name: "No club", formatPreset: "mlp_4" });
    assert.equal(result.ok, false);
    assert.equal(result.code, "CLUB_REQUIRED");
    assert.equal(result.tournament, undefined);
  });

  it("8. Create id matches loader id contract", async () => {
    const clubId = "club-mlp-id";
    saveClubs([{ id: clubId, name: "Id", tenantId: "tenant-1" }]);
    saveClubData(clubId, getDefaultClubData(clubId));
    const created = createTeamTournament(clubId, { name: "Id MLP", formatPreset: "mlp_4" });

    const repo = createTeamTournamentRepository({ forceNew: true, allowFutureModes: true });
    const loaded = await repo.getTournament(clubId, created.tournament.id);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.data.id, created.tournament.id);
    assert.match(created.tournament.id, /^team-tournament-/);
  });

  it("canonical preference club (not in registry list) is still discoverable", () => {
    const preferredClubId = "club-canonical-only";
    // Registry empty of this club — preference still points at it.
    saveClubs([]);
    setActiveClubIdPreference(preferredClubId);
    saveClubData(preferredClubId, getDefaultClubData(preferredClubId));

    const created = createTeamTournament(preferredClubId, {
      name: "Canonical MLP",
      formatPreset: "mlp_4",
    });
    assert.equal(created.ok, true);
    assert.equal(findTournamentClubId(created.tournament.id), preferredClubId);
    assert.equal(
      resolveTeamTournamentLoadClubId(null, created.tournament.id),
      preferredClubId
    );
  });
});
