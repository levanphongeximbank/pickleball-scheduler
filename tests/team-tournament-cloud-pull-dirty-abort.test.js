import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { pullClubFromCloud, syncClubToCloud } from "../src/ai/cloudSync.js";
import { saveClubs } from "../src/data/club.js";
import {
  getDefaultClubData,
  loadClubData,
  saveClubData,
} from "../src/domain/clubStorage.js";
import { isClubDataDirty, markClubDataSynced } from "../src/domain/clubSyncMetadata.js";
import {
  createTeamTournament,
  getTeamTournamentById,
} from "../src/features/team-tournament/services/teamTournamentService.js";

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

describe("Team Tournament cloud pull dirty abort (A)", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    globalThis.window = {
      dispatchEvent() {
        return true;
      },
      addEventListener() {},
      removeEventListener() {},
    };
  });

  afterEach(() => {
    delete globalThis.localStorage;
    delete globalThis.window;
  });

  it("cloud pull starts, MLP create marks dirty, pull completes → draft kept", async () => {
    const clubId = "club-mlp-pull-race";
    saveClubs([{ id: clubId, name: "Pull Race", tenantId: "tenant-1" }]);
    saveClubData(clubId, getDefaultClubData(clubId));
    markClubDataSynced(clubId, { push: true });

    // Baseline cloud snapshot WITHOUT any team tournament.
    const sync = await syncClubToCloud({ clubId });
    assert.equal(sync.ok, true);
    assert.equal(isClubDataDirty(clubId), false);

    // Simulate in-flight pull vs local create: draft lands + dirty before apply.
    const created = createTeamTournament(clubId, {
      name: "Race MLP",
      formatPreset: "mlp_4",
    });
    assert.equal(created.ok, true);
    assert.equal(isClubDataDirty(clubId), true);
    assert.ok(getTeamTournamentById(clubId, created.tournament.id));

    const pull = await pullClubFromCloud({ clubId });
    assert.equal(pull.ok, false);
    assert.equal(pull.code, "LOCAL_DIRTY_ABORT");
    assert.equal(pull.aborted, true);
    assert.equal(isClubDataDirty(clubId), true);

    const after = getTeamTournamentById(clubId, created.tournament.id);
    assert.ok(after, "draft must survive aborted cloud overwrite");
    assert.equal(after.id, created.tournament.id);
    assert.equal(
      (loadClubData(clubId).tournaments || []).some((t) => t.id === created.tournament.id),
      true
    );
  });

  it("clean local (not dirty) still allows cloud pull overwrite", async () => {
    const clubId = "club-mlp-pull-clean";
    saveClubs([{ id: clubId, name: "Pull Clean", tenantId: "tenant-1" }]);
    saveClubData(clubId, {
      ...getDefaultClubData(clubId),
      tournaments: [
        {
          id: "team-tournament-only-local",
          clubId,
          name: "Local only",
          mode: "team_tournament",
          status: "draft",
          teamData: { teams: [], matchups: [], settings: {} },
        },
      ],
    });
    markClubDataSynced(clubId, { push: true });
    assert.equal(isClubDataDirty(clubId), false);

    // Cloud snapshot is empty tournaments (sync current then wipe local then pull).
    const sync = await syncClubToCloud({ clubId });
    assert.equal(sync.ok, true);

    saveClubData(clubId, getDefaultClubData(clubId), { source: "cloud" });
    markClubDataSynced(clubId, { pull: true });
    assert.equal(isClubDataDirty(clubId), false);
    assert.equal(getTeamTournamentById(clubId, "team-tournament-only-local"), null);

    // Re-seed cloud with the team tournament via sync from a re-save.
    saveClubData(clubId, {
      ...getDefaultClubData(clubId),
      tournaments: [
        {
          id: "team-tournament-from-cloud",
          clubId,
          name: "From cloud",
          mode: "team_tournament",
          status: "draft",
          teamData: { teams: [], matchups: [], settings: {} },
        },
      ],
    });
    const sync2 = await syncClubToCloud({ clubId });
    assert.equal(sync2.ok, true);

    saveClubData(clubId, getDefaultClubData(clubId), { source: "cloud" });
    markClubDataSynced(clubId, { pull: true });

    const pull = await pullClubFromCloud({ clubId });
    assert.equal(pull.ok, true);
    assert.ok(getTeamTournamentById(clubId, "team-tournament-from-cloud"));
  });
});
