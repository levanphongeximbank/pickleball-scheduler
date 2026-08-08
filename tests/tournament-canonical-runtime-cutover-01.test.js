import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { describe, it, beforeEach, afterEach } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { setActiveClubId, loadClubs, saveClubs, DEFAULT_CLUB } from "../src/data/club.js";
import {
  listTournamentsQuery,
  listMyTournamentsQuery,
  buildTournamentHubStats,
  createTournamentCommand,
  requireExplicitTenantForClub,
  resolveTournamentDataMode,
  TOURNAMENT_DATA_MODES,
  CANONICAL_TOURNAMENT_HUB_ITEMS,
  MODE_LABELS_VI,
  __resetTournamentRepositorySingleton,
  __setTournamentRepositoryRpcForTests,
  createInMemoryCanonicalTournamentRpc,
} from "../src/features/tournament/index.js";
import { TOURNAMENT_MODE } from "../src/models/tournament/constants.js";
import {
  PUBLIC_TOURNAMENTS_RANKINGS_SOURCE,
  resolvePublicTournamentsRankingsSource,
} from "../src/features/public-portal/services/publicTournamentsRankingsDataSource.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

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

function assertIncludes(src, snippet) {
  assert.ok(src.includes(snippet), `Expected source to include: ${snippet}`);
}

function assertNotIncludes(src, snippet) {
  assert.ok(!src.includes(snippet), `Expected source to omit: ${snippet}`);
}

describe("tournament-canonical-runtime-cutover-01", () => {
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
    __setTournamentRepositoryRpcForTests(
      createInMemoryCanonicalTournamentRpc({ tenantId: "tenant-cutover-01" }).rpc
    );
    delete process.env.VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE;
  });

  afterEach(() => {
    __resetTournamentRepositorySingleton();
    delete process.env.VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE;
  });

  it("1. /tournament is a real canonical hub", () => {
    const hub = readSrc("src/features/tournament/pages/CanonicalTournamentHubPage.jsx");
    const shell = readSrc("src/pages/tournament/TournamentShell.jsx");
    assertIncludes(shell, "CanonicalTournamentHubPage");
    assertIncludes(hub, "Vòng đời giải đấu");
    assert.equal(CANONICAL_TOURNAMENT_HUB_ITEMS.length >= 9, true);
    assertNotIncludes(hub, "TournamentHome");
    assertNotIncludes(hub, "InPageNavHub");
  });

  it("2. /tournament/create is a dedicated canonical create page", () => {
    const page = readSrc("src/features/tournament/pages/CanonicalTournamentCreatePage.jsx");
    const wrapper = readSrc("src/pages/tournament/TournamentCreatePage.jsx");
    assertIncludes(wrapper, "CanonicalTournamentCreatePage");
    assertIncludes(page, "createTournamentCommand");
    assertIncludes(page, "TOURNAMENT_MODE.DAILY_PLAY");
  });

  it("3+4. list and my share the same cloud reader boundary", async () => {
    const listPage = readSrc("src/features/tournament/pages/CanonicalTournamentListPage.jsx");
    const portal = readSrc("src/pages/tournament/IndividualPlayerPortalPage.jsx");
    assertIncludes(listPage, "useCanonicalTournamentList");
    assertIncludes(portal, "useCanonicalMyTournaments");
    assertNotIncludes(listPage, "domain/tournamentService");
    assertNotIncludes(portal, "domain/tournamentService");

    const created = await createTournamentCommand(DEFAULT_CLUB.id, {
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      name: "Giải list/my parity",
      createdBy: "player-a",
    });
    assert.equal(created.ok, true);
    const listed = await listTournamentsQuery(DEFAULT_CLUB.id);
    const mine = await listMyTournamentsQuery(DEFAULT_CLUB.id, { playerId: "player-a" });
    assert.equal(listed.ok, true);
    assert.equal(listed.tournaments.length >= 1, true);
    assert.equal(mine.tournaments.length, 1);
    const stats = await buildTournamentHubStats(DEFAULT_CLUB.id);
    assert.equal(stats.total, listed.tournaments.length);
  });

  it("5. canonical pages do not directly import Tournament localStorage authority", () => {
    const files = [
      "src/features/tournament/pages/CanonicalTournamentHubPage.jsx",
      "src/features/tournament/pages/CanonicalTournamentCreatePage.jsx",
      "src/features/tournament/pages/CanonicalTournamentListPage.jsx",
      "src/features/tournament/pages/CanonicalTournamentTypesPage.jsx",
      "src/features/tournament/pages/CanonicalTournamentCapabilityPages.jsx",
      "src/features/tournament/components/CanonicalTournamentPicker.jsx",
      "src/pages/tournament/DailyPlaySetup.jsx",
      "src/pages/tournament/InternalTournamentSetup.jsx",
      "src/pages/tournament/OfficialTournamentSetup.jsx",
    ];
    for (const file of files) {
      const src = readSrc(file);
      assertNotIncludes(src, "pickleball-club-data-v3");
      assertNotIncludes(src, "loadClubData");
      assertNotIncludes(src, "saveClubData");
      assertNotIncludes(src, "domain/tournamentService");
    }
  });

  it("6. no MOCK_TOURNAMENTS authority on canonical public path", () => {
    const adapter = readSrc(
      "src/features/public-portal/services/publicTournamentsRankingsDataSource.js"
    );
    assertIncludes(adapter, "allowMockFallback: false");
    assert.equal(
      resolvePublicTournamentsRankingsSource(),
      PUBLIC_TOURNAMENTS_RANKINGS_SOURCE.REMOTE
    );
  });

  it("7. fail closed on missing tenant", async () => {
    const clubs = loadClubs().map((club) =>
      club.id === DEFAULT_CLUB.id ? { ...club, tenantId: null, venueId: null } : club
    );
    saveClubs(clubs);
    assert.equal(requireExplicitTenantForClub(DEFAULT_CLUB.id).ok, false);
    const created = await createTournamentCommand(DEFAULT_CLUB.id, {
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      name: "Should fail",
    });
    assert.equal(created.ok, false);
  });

  it("8. wrappers point to canonical pages", () => {
    assertIncludes(readSrc("src/pages/tournament/TournamentShell.jsx"), "CanonicalTournamentHubPage");
    assertIncludes(readSrc("src/pages/tournament/TournamentListPage.jsx"), "CanonicalTournamentListPage");
    assertIncludes(readSrc("src/pages/tournament/TournamentCreatePage.jsx"), "CanonicalTournamentCreatePage");
  });

  it("9. EngineV4 contextual + cloud apply path", () => {
    const router = readSrc("src/router.jsx");
    assertIncludes(router, 'path="/tournaments/:tournamentId/engine"');
    const engine = readSrc("src/features/tournament-engine/hooks/useTournamentEngine.js");
    assertIncludes(engine, "applyEngineV4StateCommand");
    assertNotIncludes(engine, "domain/tournamentService");
  });

  it("10. capabilities + Vietnamese labels", () => {
    const titles = CANONICAL_TOURNAMENT_HUB_ITEMS.map((item) => item.title).join("|");
    for (const label of [
      "Tạo giải",
      "Danh sách giải",
      "Loại hình giải",
      "VĐV",
      "Đăng ký",
      "Tổ chức",
      "Trọng tài",
      "Kết quả",
      "Giải của tôi",
    ]) {
      assertIncludes(titles, label);
    }
    assert.equal(MODE_LABELS_VI[TOURNAMENT_MODE.DAILY_PLAY], "Chơi hằng ngày");
    assert.equal(resolveTournamentDataMode(), TOURNAMENT_DATA_MODES.CLOUD);
  });

  it("11. auth gates preserved", () => {
    const createPage = readSrc(
      "src/features/tournament/pages/CanonicalTournamentCreatePage.jsx"
    );
    assertIncludes(createPage, "usePageRuntimeAccess");
    assert.ok(
      createPage.includes("PERMISSIONS.TOURNAMENT_UPDATE") ||
        createPage.includes("PermissionGate")
    );
  });

  it("12. SQL migration + rollback + no legacy migration script", () => {
    assert.equal(
      existsSync(
        path.join(root, "supabase/migrations/20260808100000_canonical_tournaments_cutover.sql")
      ),
      true
    );
    assert.equal(
      existsSync(
        path.join(
          root,
          "docs/v5/qa-evidence/tournament-canonical-runtime-cutover-01/sql/90_ROLLBACK.sql"
        )
      ),
      true
    );
    const livePkg = readSrc(
      "docs/v5/qa-evidence/tournament-canonical-runtime-cutover-01/06_LIVE_CUTOVER_PACKAGE.md"
    );
    assertIncludes(livePkg, "SKIPPED_BY_OWNER_POLICY");
  });
});
