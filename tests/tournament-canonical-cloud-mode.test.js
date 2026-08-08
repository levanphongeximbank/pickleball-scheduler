import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { describe, it, beforeEach, afterEach } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { setActiveClubId, loadClubs, saveClubs, DEFAULT_CLUB } from "../src/data/club.js";
import {
  createTournamentCommand,
  updateTournamentCommand,
  deleteTournamentCommand,
  applyEngineV4StateCommand,
  listTournamentsQuery,
  listMyTournamentsQuery,
  getTournamentQuery,
  __resetTournamentRepositorySingleton,
  __setTournamentRepositoryRpcForTests,
  createInMemoryCanonicalTournamentRpc,
  resolveTournamentDataMode,
  requireExplicitTenantForClub,
  TOURNAMENT_DATA_MODES,
} from "../src/features/tournament/index.js";
import { TOURNAMENT_MODE, TOURNAMENT_STATUS } from "../src/models/tournament/constants.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const TENANT_ID = "tenant-cutover-01";
const CLUB_SCOPE = { id: DEFAULT_CLUB.id, tenantId: TENANT_ID, venueId: TENANT_ID };

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

function createLocalStorageMock() {
  const store = new Map();
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

describe("tournament canonical cloud-mode RPC", () => {
  let memory;

  beforeEach(() => {
    globalThis.localStorage = createLocalStorageMock();
    __resetTournamentRepositorySingleton();
    const clubs = loadClubs().map((club) =>
      club.id === DEFAULT_CLUB.id
        ? { ...club, tenantId: "tenant-cutover-01", venueId: "tenant-cutover-01" }
        : club
    );
    saveClubs(clubs);
    setActiveClubId(DEFAULT_CLUB.id);
    memory = createInMemoryCanonicalTournamentRpc({
      tenantId: "tenant-cutover-01",
    });
    __setTournamentRepositoryRpcForTests(memory.rpc);
  });

  afterEach(() => {
    __resetTournamentRepositorySingleton();
  });

  it("data mode is cloud only", () => {
    assert.equal(resolveTournamentDataMode(), TOURNAMENT_DATA_MODES.CLOUD);
  });

  it("cloud CRUD goes through RPC", async () => {
    const created = await createTournamentCommand(CLUB_SCOPE, {
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      name: "Cloud Internal",
      createdBy: "player-a",
    });
    assert.equal(created.ok, true);
    assert.ok(created.tournament?.id);

    const listed = await listTournamentsQuery(CLUB_SCOPE);
    assert.equal(listed.ok, true);
    assert.equal(listed.tournaments.length, 1);

    const got = await getTournamentQuery(CLUB_SCOPE, created.tournament.id);
    assert.equal(got.ok, true);
    assert.equal(got.tournament.name, "Cloud Internal");

    const updated = await updateTournamentCommand(CLUB_SCOPE, created.tournament.id, {
      name: "Cloud Internal v2",
      status: TOURNAMENT_STATUS.REGISTRATION,
    });
    assert.equal(updated.ok, true);
    assert.equal(updated.tournament.name, "Cloud Internal v2");

    const applied = await applyEngineV4StateCommand(
      CLUB_SCOPE,
      created.tournament.id,
      { seedResult: { participants: [{ id: "p1" }] } }
    );
    assert.equal(applied.ok, true);
    assert.equal(applied.tournament.settings.engineV4.seedResult.participants[0].id, "p1");

    const deleted = await deleteTournamentCommand(CLUB_SCOPE, created.tournament.id);
    assert.equal(deleted.ok, true);
    const after = await listTournamentsQuery(CLUB_SCOPE);
    assert.equal(after.tournaments.length, 0);
  });

  it("listMine semantics: creator sees mine; stranger does not", async () => {
    const created = await createTournamentCommand(CLUB_SCOPE, {
      mode: TOURNAMENT_MODE.OFFICIAL_TOURNAMENT,
      name: "Mine Official",
      createdBy: "player-a",
      ownerPlayerId: "player-a",
    });
    assert.equal(created.ok, true);

    const mineA = await listMyTournamentsQuery(CLUB_SCOPE, { playerId: "player-a" });
    assert.equal(mineA.ok, true);
    assert.equal(mineA.tournaments.length, 1);

    const mineB = await listMyTournamentsQuery(CLUB_SCOPE, { playerId: "player-b" });
    assert.equal(mineB.ok, true);
    assert.equal(mineB.tournaments.length, 0);
  });

  it("full lifecycle: create → configure → roster → engine → result → reload → list/my", async () => {
    const created = await createTournamentCommand(CLUB_SCOPE, {
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      name: "Lifecycle",
      createdBy: "player-a",
    });
    assert.equal(created.ok, true);
    const id = created.tournament.id;

    const configured = await updateTournamentCommand(CLUB_SCOPE, id, {
      events: [
        {
          id: "ev-1",
          type: "men_double",
          entries: [{ id: "e1", playerId: "player-a", name: "A" }],
        },
      ],
      status: TOURNAMENT_STATUS.REGISTRATION,
    });
    assert.equal(configured.ok, true);
    assert.equal(configured.tournament.events[0].entries.length, 1);

    const engine = await applyEngineV4StateCommand(CLUB_SCOPE, id, {
      matches: [{ id: "m1", status: "completed", scoreA: 11, scoreB: 5 }],
    });
    assert.equal(engine.ok, true);

    const resultPatch = await updateTournamentCommand(CLUB_SCOPE, id, {
      status: TOURNAMENT_STATUS.COMPLETED,
      settings: { resultsConfirmed: true },
    });
    assert.equal(resultPatch.ok, true);

    const reloaded = await getTournamentQuery(CLUB_SCOPE, id);
    assert.equal(reloaded.ok, true);
    assert.equal(reloaded.tournament.status, TOURNAMENT_STATUS.COMPLETED);
    assert.equal(reloaded.tournament.settings.engineV4.matches[0].id, "m1");

    const listed = await listTournamentsQuery(CLUB_SCOPE);
    assert.equal(listed.tournaments.some((t) => t.id === id), true);
    const mine = await listMyTournamentsQuery(CLUB_SCOPE, { playerId: "player-a" });
    assert.equal(mine.tournaments.some((t) => t.id === id), true);
  });

  it("Daily Play representative lifecycle against cloud authority", async () => {
    const created = await createTournamentCommand(CLUB_SCOPE, {
      mode: TOURNAMENT_MODE.DAILY_PLAY,
      name: "Chơi hằng ngày test",
      createdBy: "player-a",
    });
    assert.equal(created.ok, true);

    const checkIn = await updateTournamentCommand(CLUB_SCOPE, created.tournament.id, {
      settings: {
        dailyPlay: {
          checkedInPlayerIds: ["player-a", "player-b"],
          matches: [{ id: "d1", courtId: "c1", status: "ready" }],
        },
      },
    });
    assert.equal(checkIn.ok, true);

    const reloaded = await getTournamentQuery(CLUB_SCOPE, created.tournament.id);
    assert.equal(reloaded.tournament.mode, TOURNAMENT_MODE.DAILY_PLAY);
    assert.deepEqual(reloaded.tournament.settings.dailyPlay.checkedInPlayerIds, [
      "player-a",
      "player-b",
    ]);
  });

  it("fails closed without tenant / default-tenant", async () => {
    const deniedMissing = requireExplicitTenantForClub({ id: DEFAULT_CLUB.id });
    assert.equal(deniedMissing.ok, false);
    const deniedDefault = requireExplicitTenantForClub({
      id: DEFAULT_CLUB.id,
      tenantId: "default-tenant",
      venueId: "default-tenant",
    });
    assert.equal(deniedDefault.ok, false);
    const created = await createTournamentCommand(
      { id: DEFAULT_CLUB.id },
      { mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT, name: "No tenant" }
    );
    assert.equal(created.ok, false);
  });

  it("cloud repository has no sync placeholder stubs", () => {
    const src = readSrc("src/features/tournament/repositories/cloudTournamentRepository.js");
    assert.ok(!src.includes("return [];"));
    assert.ok(!src.includes("return null;"));
    assert.ok(src.includes("async list("));
    assert.ok(src.includes("async get("));
    assert.ok(src.includes("async listMine("));
    assert.ok(src.includes("async create("));
    assert.ok(src.includes("async update("));
    assert.ok(src.includes("async delete("));
    assert.ok(src.includes("async applyEngineState("));
  });

  it("SQL package has permission guards, list_mine, and REVOKE PUBLIC/anon", () => {
    const sqlPath = path.join(
      root,
      "supabase/migrations/20260808100000_canonical_tournaments_cutover.sql"
    );
    assert.equal(existsSync(sqlPath), true);
    const sql = readFileSync(sqlPath, "utf8");
    assert.ok(sql.includes("user_has_permission('tournament.view')"));
    assert.ok(sql.includes("user_has_permission('tournament.create')"));
    assert.ok(sql.includes("user_has_permission('tournament.update')"));
    assert.ok(sql.includes("user_has_permission('tournament.delete')"));
    assert.ok(sql.includes("canonical_tournament_is_mine"));
    assert.ok(sql.includes("REVOKE ALL ON FUNCTION public.canonical_tournament_list"));
    assert.ok(sql.includes("FROM anon"));
    assert.ok(sql.includes("GRANT EXECUTE"));
    assert.ok(!sql.includes("one-time migrate") && !sql.includes("club_data_v3"));
  });

  it("active setup pages do not import domain tournament CRUD", () => {
    for (const file of [
      "src/pages/tournament/DailyPlaySetup.jsx",
      "src/pages/tournament/InternalTournamentSetup.jsx",
      "src/pages/tournament/OfficialTournamentSetup.jsx",
      "src/features/tournament-engine/hooks/useTournamentEngine.js",
    ]) {
      const src = readSrc(file);
      assert.ok(!src.includes('from "../../domain/tournamentService.js"'));
      assert.ok(!src.includes('from "../../../domain/tournamentService.js"'));
      assert.ok(!src.includes("listTournaments(") || src.includes("listTournamentsQuery"));
    }
  });

  it("transitional blob repository is removed from active architecture", () => {
    assert.equal(
      existsSync(
        path.join(
          root,
          "src/features/tournament/repositories/transitionalBlobTournamentRepository.js"
        )
      ),
      false
    );
    const factory = readSrc(
      "src/features/tournament/repositories/tournamentRepositoryFactory.js"
    );
    assert.ok(factory.includes("CLOUD ONLY") || factory.includes("cloud only") || factory.includes("createCloudTournamentRepository"));
    assert.ok(!factory.includes("transitionalBlob"));
  });

  it("Official/Internal detail + VPR + Engine use canonical cloud writers", () => {
    const vprPanel = readSrc(
      "src/features/vpr-ranking/components/TournamentVprPanel.jsx"
    );
    assert.ok(vprPanel.includes("updateTournamentCommand"));
    assert.ok(!vprPanel.includes('from "../../../domain/tournamentService.js"'));

    const bridge = readSrc("src/features/vpr-ranking/services/vprTournamentBridge.js");
    assert.ok(bridge.includes("getTournamentQuery"));
    assert.ok(bridge.includes("updateTournamentCommand"));
    assert.ok(!bridge.includes("getTournament("));

    const engine = readSrc(
      "src/features/tournament-engine/hooks/useTournamentEngine.js"
    );
    assert.ok(engine.includes("applyEngineV4StateCommand"));

    const bracket = readSrc("src/pages/tournament/TournamentBracketPage.jsx");
    assert.ok(bracket.includes("assertLoadedTournamentAccess"));
    assert.ok(bracket.includes("useCanonicalTournament"));
    assert.ok(!bracket.includes("assertTournamentAccess"));
  });

  it("Team Tournament cloud_only create skips blob authority", () => {
    const service = readSrc(
      "src/features/team-tournament/services/teamTournamentService.js"
    );
    assert.ok(service.includes("createTeamTournamentCloudOnly"));
    assert.ok(service.includes("CLOUD_ONLY"));
    assert.ok(service.includes("persistedLocally: false"));

    const mirror = readSrc(
      "src/features/team-tournament/ui/teamTournamentBlobMirror.js"
    );
    assert.ok(mirror.includes("cloud_only_no_blob_mirror"));

    const createPage = readSrc(
      "src/features/tournament/pages/CanonicalTournamentCreatePage.jsx"
    );
    assert.ok(createPage.includes("createTournamentCommand"));
    assert.ok(createPage.includes("TEAM_TOURNAMENT"));
    // Team route is resolved via helper (keeps path authority in one place).
    assert.ok(createPage.includes("resolveTournamentCreateNavigatePath"));
    const helper = readSrc(
      "src/features/tournament/pages/canonicalTournamentCreateStart.js"
    );
    assert.ok(helper.includes("/tournament/team/"));
  });
});
