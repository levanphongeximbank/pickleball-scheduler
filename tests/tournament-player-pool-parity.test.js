import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import {
  isSelectableTournamentPlayer,
  loadLegacyClubPlayersSafe,
  mergeLegacyPlayerPools,
  resolveClubPlayerPoolFromAwareResult,
  resolveFlowPlayersWithClubFallback,
  resolveTenantPlayerPoolFromAwareResult,
} from "../src/features/club/hooks/useClubPlayerPool.js";
import {
  buildTournamentNotFoundMessage,
  findTournamentClubId,
  resolveTournamentClubId,
} from "../src/features/club/services/clubTournamentBridge.js";
import { saveClubs } from "../src/data/club.js";
import { getDefaultClubData, saveClubData } from "../src/domain/clubStorage.js";
import { createTeamTournamentShell } from "../src/features/team-tournament/engines/teamTournamentEngine.js";
import {
  __setTeamTournamentDataModeForTests,
  __resetTeamTournamentDataModeForTests,
  createTeamTournamentRepository,
  TEAM_TOURNAMENT_DATA_MODES,
} from "../src/features/team-tournament/repositories/teamTournamentRepositoryFactory.js";
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

function clubPlayers(clubId, count) {
  return Array.from({ length: count }, (_, index) => ({
    id: `${clubId}-p${index + 1}`,
    name: `Player ${index + 1}`,
    sourceClubId: clubId,
  }));
}

describe("Tournament player pool parity (Official / Daily / Internal / Team)", () => {
  it("1. /players and Official same club share eligible pool via club fallback", () => {
    const playersPagePool = clubPlayers("club-smoke", 20);
    const tenantEmpty = [];
    const officialFlow = resolveFlowPlayersWithClubFallback(tenantEmpty, playersPagePool);
    assert.equal(officialFlow.length, 20);
    assert.deepEqual(
      officialFlow.map((p) => p.id).sort(),
      playersPagePool.map((p) => p.id).sort()
    );
  });

  it("2. Daily and Official use same club fallback when aware adapter !ok", () => {
    const blob = clubPlayers("club-1", 3);
    const clubResolved = resolveClubPlayerPoolFromAwareResult(
      { ok: false, code: "ADAPTER_DOWN", message: "fail", warnings: [] },
      "club-1",
      { loadLegacy: () => blob }
    );
    const tenantResolved = resolveTenantPlayerPoolFromAwareResult(
      { ok: false, code: "ADAPTER_DOWN", message: "fail", warnings: [] },
      "tenant-1",
      { loadLegacy: () => blob }
    );
    assert.equal(clubResolved.usedLegacyFallback, true);
    assert.equal(tenantResolved.usedLegacyFallback, true);
    assert.equal(clubResolved.players.length, 3);
    assert.equal(tenantResolved.players.length, 3);
    const officialFlow = resolveFlowPlayersWithClubFallback([], clubResolved.players);
    assert.equal(officialFlow.length, 3);
  });

  it("3. Internal player pool parity uses club resolve (no silent [])", () => {
    const resolved = resolveClubPlayerPoolFromAwareResult(
      { ok: false, code: "DEFAULT_CLUB_NOT_ALLOWED", legacyPlayers: [] },
      "club-internal",
      { loadLegacy: () => clubPlayers("club-internal", 8) }
    );
    assert.equal(resolved.usedLegacyFallback, true);
    assert.equal(resolved.players.length, 8);
    assert.equal(resolved.source, "legacy_fallback");
  });

  it("4. Team MLP player pool parity — tenant-first then club", () => {
    const tenant = clubPlayers("club-a", 4);
    const club = clubPlayers("club-host", 6);
    assert.equal(resolveFlowPlayersWithClubFallback(tenant, club).length, 4);
    assert.equal(resolveFlowPlayersWithClubFallback([], club).length, 6);
    const merged = mergeLegacyPlayerPools(tenant, club);
    assert.equal(merged.length, 10);
  });

  it("5. Empty canonical !ok does not silent [] when fallback has data", () => {
    const resolved = resolveTenantPlayerPoolFromAwareResult(
      { ok: false, code: "X", legacyPlayers: [] },
      "tenant-x",
      { loadLegacy: () => [{ id: "p1", name: "One" }] }
    );
    assert.equal(resolved.players.length, 1);
    assert.equal(resolved.usedLegacyFallback, true);
  });

  it("6. Error adapter message is preserved on fallback warning", () => {
    const resolved = resolveTenantPlayerPoolFromAwareResult(
      {
        ok: false,
        code: "PLAYER_POOL_LOAD_REJECTED",
        message: "boom rejected",
        warnings: [],
      },
      "tenant-x",
      { loadLegacy: () => [{ id: "p1" }] }
    );
    assert.ok(
      resolved.warnings.some(
        (w) => w.code === "PLAYER_POOL_LOAD_REJECTED" || String(w.message).includes("boom")
      )
    );
  });

  it("7. Wrong club scope does not take another club blob", () => {
    const resolved = resolveClubPlayerPoolFromAwareResult(
      { ok: false, code: "FAIL" },
      "club-A",
      {
        loadLegacy: (clubId) => {
          assert.equal(clubId, "club-A");
          return clubPlayers("club-A", 2);
        },
      }
    );
    assert.ok(resolved.players.every((p) => p.sourceClubId === "club-A"));
    assert.equal(resolved.players.length, 2);
  });

  it("8. Missing playerId is not selectable", () => {
    assert.equal(isSelectableTournamentPlayer({ id: "p1", name: "A" }), true);
    assert.equal(isSelectableTournamentPlayer({ name: "NoId" }), false);
    assert.equal(isSelectableTournamentPlayer({ id: "  " }), false);
    assert.equal(isSelectableTournamentPlayer(null), false);
    const merged = mergeLegacyPlayerPools(
      [{ id: "p1", name: "A" }, { name: "skip" }, { id: "", name: "empty" }],
      [{ id: "p2", name: "B" }]
    );
    assert.deepEqual(
      merged.map((p) => p.id),
      ["p1", "p2"]
    );
  });

  it("keeps successful empty canonical pool (SSOT) without silent blob fill", () => {
    const resolved = resolveTenantPlayerPoolFromAwareResult(
      { ok: true, legacyPlayers: [], source: "canonical" },
      "tenant-1",
      { loadLegacy: () => [{ id: "blob" }] }
    );
    assert.equal(resolved.usedLegacyFallback, false);
    assert.equal(resolved.players.length, 0);
  });

  it("loadLegacyClubPlayersSafe empty id → []", () => {
    assert.deepEqual(loadLegacyClubPlayersSafe(""), []);
    assert.deepEqual(loadLegacyClubPlayersSafe(null), []);
  });
});

describe("Team Tournament load club resolution + empty-state", () => {
  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    __setTeamTournamentDataModeForTests(TEAM_TOURNAMENT_DATA_MODES.LEGACY);
  });

  afterEach(() => {
    __resetTeamTournamentDataModeForTests();
    delete globalThis.localStorage;
  });

  it("9. create → persist → detail route load (wrong activeClub scans owner club)", async () => {
    const hostClubId = "club-host-tt";
    const otherClubId = "club-other-tt";
    saveClubs([
      { id: hostClubId, name: "Host", tenantId: "tenant-1" },
      { id: otherClubId, name: "Other", tenantId: "tenant-1" },
    ]);
    saveClubData(otherClubId, getDefaultClubData(otherClubId));

    const tournament = createTeamTournamentShell(hostClubId, {
      name: "QA Team MLP",
      tenantId: "tenant-1",
    });
    const hostData = getDefaultClubData(hostClubId);
    hostData.tournaments = [tournament];
    saveClubData(hostClubId, hostData);

    assert.equal(findTournamentClubId(tournament.id), hostClubId);
    assert.equal(
      resolveTournamentClubId(otherClubId, tournament.id),
      hostClubId,
      "wrong activeClub must resolve to hosting club blob"
    );
    assert.equal(
      resolveTeamTournamentLoadClubId(otherClubId, tournament.id),
      hostClubId
    );

    const repo = createTeamTournamentRepository({ forceNew: true, allowFutureModes: true });
    const loaded = await repo.getTournament(hostClubId, tournament.id);
    assert.equal(loaded.ok, true);
    assert.equal(loaded.data?.id, tournament.id);

    // Refresh-style second load still finds the same blob
    const reload = await repo.getTournament(
      resolveTournamentClubId(otherClubId, tournament.id),
      tournament.id
    );
    assert.equal(reload.ok, true);
    assert.equal(reload.data?.id, tournament.id);
  });

  it("10. refresh still finds tournament when preferred club is correct", async () => {
    const clubId = "club-refresh-tt";
    saveClubs([{ id: clubId, name: "Refresh", tenantId: "tenant-1" }]);
    const tournament = createTeamTournamentShell(clubId, { name: "Refresh TT" });
    const data = getDefaultClubData(clubId);
    data.tournaments = [tournament];
    saveClubData(clubId, data);

    const repo = createTeamTournamentRepository({ forceNew: true, allowFutureModes: true });
    const first = await repo.getTournament(clubId, tournament.id);
    const second = await repo.getTournament(clubId, tournament.id);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(second.data?.id, tournament.id);
  });

  it("11. stale/nonexistent ID gets actionable empty-state (Preview domain note)", async () => {
    saveClubs([{ id: "club-empty", name: "Empty", tenantId: "tenant-1" }]);
    saveClubData("club-empty", getDefaultClubData("club-empty"));

    const repo = createTeamTournamentRepository({ forceNew: true, allowFutureModes: true });
    const missing = await repo.getTournament("club-empty", "team-tournament-4r5wlw5f");
    assert.equal(missing.ok, false);

    const message = buildTournamentNotFoundMessage("team-tournament-4r5wlw5f", {
      kind: "giải đồng đội",
    });
    assert.match(message, /Không tìm thấy giải đồng đội/);
    assert.match(message, /team-tournament-4r5wlw5f/);
    assert.match(message, /Preview/);
    assert.match(message, /tạo lại/i);
  });

  it("12. Preview-domain localStorage scenario is documented in empty-state (no cross-origin hack)", () => {
    const message = buildTournamentNotFoundMessage("tournament-1784151175938");
    assert.match(message, /trình duyệt|Preview/);
    assert.match(message, /không dùng deep-link từ Preview cũ/i);
    // Cleared origin storage cannot invent data for a deep-linked id
    assert.equal(findTournamentClubId("team-tournament-4r5wlw5f"), null);
  });
});
