import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import { saveClubs } from "../src/data/club.js";
import { getDefaultClubData, loadClubData, saveClubData } from "../src/domain/clubStorage.js";
import {
  createTeamTournament,
  createTeamTournamentForUi,
} from "../src/features/team-tournament/services/teamTournamentService.js";
import {
  __resetTeamTournamentDataModeForTests,
  __setTeamTournamentDataModeForTests,
  createTeamTournamentRepository,
  TEAM_TOURNAMENT_DATA_MODES,
} from "../src/features/team-tournament/repositories/teamTournamentRepositoryFactory.js";
import {
  __resetTeamTournamentStoreModeForTests,
  __setTeamTournamentStoreModeForTests,
} from "../src/features/team-tournament/services/teamTournamentCloudSync.js";
import { TEAM_TOURNAMENT_STORE_MODES } from "../src/features/team-tournament/repositories/teamTournamentRepository.js";
import { createTeamTournamentUiOrchestrator } from "../src/features/team-tournament/ui/teamTournamentUiOrchestrator.js";
import { resolveTeamTournamentLoadClubId } from "../src/features/team-tournament/ui/useTeamTournamentPage.js";
import { loadClubPairingCandidatePool } from "../src/features/pairing-candidates/screenCandidateAdapters.js";
import { PAIRING_CANDIDATE_REASON_CODES } from "../src/features/pairing-candidates/pairingCandidateReasonCodes.js";
import { PAIRING_CANDIDATE_STATUS } from "../src/features/pairing-candidates/pairingCandidateContract.js";

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

describe("Preview blocker — create cloud sync + candidate diagnostics", () => {
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
    __resetTeamTournamentStoreModeForTests();
  });

  afterEach(() => {
    __resetTeamTournamentDataModeForTests();
    __resetTeamTournamentStoreModeForTests();
    delete globalThis.localStorage;
    delete globalThis.window;
  });

  it("create persists before navigation and clubId stays stable", async () => {
    const clubId = "club-preview-stable";
    saveClubs([{ id: clubId, name: "Stable", tenantId: "tenant-1" }]);
    saveClubData(clubId, getDefaultClubData(clubId));

    const created = await createTeamTournamentForUi(clubId, {
      name: "Stable MLP",
      formatPreset: "mlp_4",
    });
    assert.equal(created.ok, true);
    assert.equal(created.clubId, clubId);
    assert.equal(created.tournament.clubId, clubId);

    const loadClub = resolveTeamTournamentLoadClubId(clubId, created.tournament.id);
    assert.equal(loadClub, clubId);

    const repo = createTeamTournamentRepository({ allowFutureModes: true });
    const orch = createTeamTournamentUiOrchestrator({ repository: repo });
    const loaded = await orch.loadTournament(clubId, created.tournament.id);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.tournament.id, created.tournament.id);
    assert.equal(String(loaded.tournament.clubId || clubId), clubId);
  });

  it("detail reload finds new tournament after create (legacy blob)", async () => {
    const clubId = "club-preview-reload";
    saveClubs([{ id: clubId, name: "Reload", tenantId: "tenant-1" }]);
    saveClubData(clubId, getDefaultClubData(clubId));

    const created = createTeamTournament(clubId, { name: "Reload MLP" });
    assert.equal(created.ok, true);

    const again = (loadClubData(clubId).tournaments || []).find(
      (item) => item.id === created.tournament.id
    );
    assert.ok(again);

    __setTeamTournamentDataModeForTests(TEAM_TOURNAMENT_DATA_MODES.LEGACY);
    const repo = createTeamTournamentRepository({ allowFutureModes: true });
    const orch = createTeamTournamentUiOrchestrator({ repository: repo });
    const loaded = await orch.loadTournament(clubId, created.tournament.id);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.tournament.id, created.tournament.id);
  });

  it("cloud_primary create fails closed when cloud header sync fails (no fake navigate)", async () => {
    const clubId = "club-preview-cloud-fail";
    saveClubs([{ id: clubId, name: "CloudFail", tenantId: "tenant-1" }]);
    saveClubData(clubId, getDefaultClubData(clubId));

    __setTeamTournamentStoreModeForTests(TEAM_TOURNAMENT_STORE_MODES.SUPABASE);
    __setTeamTournamentDataModeForTests(TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY);

    // Force cloud header failure by leaving no supabase client — shouldUseTeamTournamentCloud true
    // but cloudEnsureTournamentHeader returns NO_SUPABASE without client.
    const created = await createTeamTournamentForUi(clubId, { name: "CloudFail MLP" });
    assert.equal(created.ok, false);
    assert.equal(created.persistedLocally, true);
    assert.ok(created.tournament?.id);
    assert.match(String(created.code || ""), /CLOUD_HEADER_FAILED|NO_SUPABASE/);
  });

  it("cloud repository falls back to blob when cloud setup missing", async () => {
    const clubId = "club-preview-cloud-fallback";
    saveClubs([{ id: clubId, name: "Fallback", tenantId: "tenant-1" }]);
    saveClubData(clubId, getDefaultClubData(clubId));
    const created = createTeamTournament(clubId, { name: "Fallback MLP" });
    assert.equal(created.ok, true);

    __setTeamTournamentDataModeForTests(TEAM_TOURNAMENT_DATA_MODES.CLOUD_PRIMARY);
    const repo = createTeamTournamentRepository({
      allowFutureModes: true,
      forceNew: true,
    });
    // Without supabase RPC, getSetup fails — fallback should still open local draft.
    const loaded = await repo.getTournament(clubId, created.tournament.id);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.data?.id, created.tournament.id);
    assert.ok(
      (loaded.warnings || []).some((w) => w.code === "CLOUD_SETUP_FALLBACK_BLOB"),
      "expected CLOUD_SETUP_FALLBACK_BLOB warning"
    );
  });

  it("repository error is not shown as zero members success", async () => {
    const result = await loadClubPairingCandidatePool("club-err", {
      service: {
        async listCandidates() {
          return {
            status: PAIRING_CANDIDATE_STATUS.ERROR,
            candidates: [],
            excluded: [],
            summary: { sourceCount: 0, eligibleCount: 0, excludedCount: 0, byReason: {} },
            diagnostics: {
              error: { code: "REPOSITORY_ERROR", message: "RPC club_list_members failed" },
            },
          };
        },
      },
    });
    assert.equal(result.ok, false);
    assert.notEqual(result.empty, true);
    assert.match(result.message, /RPC club_list_members failed|Không tải được/);
    assert.equal(result.players.length, 0);
  });

  it("active canonical athletes appear; missing identity is diagnostic not silent zero-members copy", async () => {
    const result = await loadClubPairingCandidatePool("club-ok", {
      service: {
        async listCandidates() {
          return {
            status: PAIRING_CANDIDATE_STATUS.READY,
            candidates: [
              {
                athleteId: "ath-1",
                pairingIdentityId: "ath-1",
                displayName: "A",
                clubId: "club-ok",
                athleteStatus: "active",
                membershipStatus: "active",
                gender: "male",
                metadata: { identity: { coverageBucket: "mapped" } },
              },
            ],
            excluded: [],
            summary: {
              sourceCount: 1,
              eligibleCount: 1,
              excludedCount: 0,
              byReason: {},
            },
          };
        },
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.empty, false);
    assert.equal(result.players.length, 1);
    assert.equal(result.players[0].id, "ath-1");

    const emptyIdentity = await loadClubPairingCandidatePool("club-miss", {
      service: {
        async listCandidates() {
          return {
            status: PAIRING_CANDIDATE_STATUS.READY,
            candidates: [],
            excluded: [
              {
                reasonCode: PAIRING_CANDIDATE_REASON_CODES.MISSING_IDENTITY_LINK,
                displayName: "X",
              },
            ],
            summary: {
              sourceCount: 1,
              eligibleCount: 0,
              excludedCount: 1,
              byReason: { [PAIRING_CANDIDATE_REASON_CODES.MISSING_IDENTITY_LINK]: 1 },
            },
          };
        },
      },
    });
    assert.equal(emptyIdentity.ok, true);
    assert.equal(emptyIdentity.empty, true);
    assert.match(emptyIdentity.message, /Athlete|MISSING_IDENTITY_LINK|thiếu liên kết/i);
    assert.doesNotMatch(emptyIdentity.message, /CLB này chưa có thành viên/);
  });

  it("wrong scope produces explicit diagnostic", async () => {
    const result = await loadClubPairingCandidatePool("", {});
    assert.equal(result.ok, false);
    assert.equal(result.code, PAIRING_CANDIDATE_REASON_CODES.WRONG_SCOPE);
    assert.match(result.message, /Chưa chọn CLB/);
  });
});
