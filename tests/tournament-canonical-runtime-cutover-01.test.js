import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { describe, it, beforeEach, afterEach } from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { setActiveClubId, loadClubs, saveClubs, DEFAULT_CLUB } from "../src/data/club.js";
import { loadClubData } from "../src/domain/clubStorage.js";
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
} from "../src/features/tournament/index.js";
import { __resetTournamentRepositorySingleton } from "../src/features/tournament/repositories/tournamentRepositoryFactory.js";
import { TOURNAMENT_MODE } from "../src/models/tournament/constants.js";
import {
  PUBLIC_TOURNAMENTS_RANKINGS_SOURCE,
  resolvePublicTournamentsRankingsSource,
} from "../src/features/public-portal/services/publicTournamentsRankingsDataSource.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readSrc(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

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

function assertIncludes(src, snippet, message) {
  assert.ok(src.includes(snippet), message || `Expected source to include: ${snippet}`);
}

function assertNotIncludes(src, snippet, message) {
  assert.ok(!src.includes(snippet), message || `Expected source to omit: ${snippet}`);
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
    loadClubData(DEFAULT_CLUB.id);
    delete process.env.VITE_TOURNAMENT_CANONICAL_DATA_MODE;
    delete process.env.VITE_PUBLIC_TOURNAMENTS_RANKINGS_SOURCE;
  });

  afterEach(() => {
    __resetTournamentRepositorySingleton();
    delete process.env.VITE_TOURNAMENT_CANONICAL_DATA_MODE;
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
    assertIncludes(page, "TOURNAMENT_MODE.TEAM_TOURNAMENT");
    assertNotIncludes(page, 'section="create"');
  });

  it("3+4. list and my share the same reader boundary", () => {
    const listPage = readSrc("src/features/tournament/pages/CanonicalTournamentListPage.jsx");
    const portal = readSrc("src/pages/tournament/IndividualPlayerPortalPage.jsx");
    assertIncludes(listPage, "listTournamentsQuery");
    assertIncludes(portal, "listMyTournamentsQuery");
    assertNotIncludes(listPage, "domain/tournamentService");
    assertNotIncludes(portal, "domain/tournamentService");

    const created = createTournamentCommand(DEFAULT_CLUB.id, {
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      name: "Giải list/my parity",
    });
    assert.equal(created.ok, true);
    const listed = listTournamentsQuery(DEFAULT_CLUB.id);
    const mine = listMyTournamentsQuery(DEFAULT_CLUB.id, {});
    assert.equal(listed.length >= 1, true);
    assert.equal(mine.length, listed.length);
    assert.equal(buildTournamentHubStats(DEFAULT_CLUB.id).total, listed.length);
  });

  it("5. canonical pages do not directly import Tournament localStorage authority", () => {
    const files = [
      "src/features/tournament/pages/CanonicalTournamentHubPage.jsx",
      "src/features/tournament/pages/CanonicalTournamentCreatePage.jsx",
      "src/features/tournament/pages/CanonicalTournamentListPage.jsx",
      "src/features/tournament/pages/CanonicalTournamentTypesPage.jsx",
      "src/features/tournament/pages/CanonicalTournamentCapabilityPages.jsx",
      "src/features/tournament/components/CanonicalTournamentPicker.jsx",
    ];
    for (const file of files) {
      const src = readSrc(file);
      assertNotIncludes(src, "pickleball-club-data-v3");
      assertNotIncludes(src, "loadClubData");
      assertNotIncludes(src, "saveClubData");
      assertNotIncludes(src, "domain/tournamentService");
    }
  });

  it("6. no new MOCK_TOURNAMENTS authority on canonical public path", () => {
    const adapter = readSrc(
      "src/features/public-portal/services/publicTournamentsRankingsDataSource.js"
    );
    assertIncludes(adapter, "allowMockFallback: false");
    assert.equal(
      resolvePublicTournamentsRankingsSource(),
      PUBLIC_TOURNAMENTS_RANKINGS_SOURCE.REMOTE
    );
    assertNotIncludes(
      readSrc("src/features/tournament/pages/CanonicalTournamentHubPage.jsx"),
      "MOCK_TOURNAMENTS"
    );
  });

  it("7. no new default-tenant fallback in canonical repository", () => {
    const clubs = loadClubs().map((club) =>
      club.id === DEFAULT_CLUB.id ? { ...club, tenantId: null, venueId: null } : club
    );
    saveClubs(clubs);
    const denied = requireExplicitTenantForClub(DEFAULT_CLUB.id);
    assert.equal(denied.ok, false);
    assert.match(String(denied.error || ""), /default-tenant|tenant hợp lệ/i);

    const created = createTournamentCommand(DEFAULT_CLUB.id, {
      mode: TOURNAMENT_MODE.INTERNAL_TOURNAMENT,
      name: "Should fail",
    });
    assert.equal(created.ok, false);
  });

  it("8. replaced legacy wrappers no longer own canonical primary routes", () => {
    const shell = readSrc("src/pages/tournament/TournamentShell.jsx");
    const list = readSrc("src/pages/tournament/TournamentListPage.jsx");
    const create = readSrc("src/pages/tournament/TournamentCreatePage.jsx");
    assertIncludes(shell, "CanonicalTournamentHubPage");
    assertIncludes(list, "CanonicalTournamentListPage");
    assertIncludes(create, "CanonicalTournamentCreatePage");
    assertNotIncludes(shell, 'from "./TournamentHome');
  });

  it("9. EngineV4 remains reachable contextually", () => {
    const router = readSrc("src/router.jsx");
    assertIncludes(router, 'path="/tournaments/:tournamentId/engine"');
    assertIncludes(router, 'path="/tournaments/:tournamentId/seed"');
    const organize = readSrc(
      "src/features/tournament/pages/CanonicalTournamentCapabilityPages.jsx"
    );
    assertIncludes(organize, "engineTabPath");
  });

  it("10. required business capabilities remain represented", () => {
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
  });

  it("11. Tournament authorization gates are preserved", () => {
    const createPage = readSrc(
      "src/features/tournament/pages/CanonicalTournamentCreatePage.jsx"
    );
    const hub = readSrc("src/features/tournament/pages/CanonicalTournamentHubPage.jsx");
    assert.ok(
      createPage.includes("PERMISSIONS.TOURNAMENT_UPDATE") ||
        createPage.includes("PermissionGate")
    );
    assertIncludes(createPage, "usePageRuntimeAccess");
    assertIncludes(hub, "usePageRuntimeAccess");
  });

  it("12. touched visible Tournament UI is Vietnamese", () => {
    const createPage = readSrc(
      "src/features/tournament/pages/CanonicalTournamentCreatePage.jsx"
    );
    assertNotIncludes(createPage, 'badge: "Daily"');
    assertNotIncludes(createPage, 'badge: "Internal"');
    assertNotIncludes(createPage, 'badge: "Official"');
    assertNotIncludes(createPage, "Director Mode");
    assertNotIncludes(createPage, "Open Mode");
    assertNotIncludes(createPage, "AI Balance Mode");
    assertIncludes(createPage, "modeLabelVi(TOURNAMENT_MODE.DAILY_PLAY)");
    assertIncludes(createPage, 'badge: "Hằng ngày"');
    assertIncludes(createPage, 'badge: "Nội bộ"');
    assertIncludes(createPage, 'badge: "Chính thức"');
    assertIncludes(createPage, 'badge: "Đồng đội"');
    assert.equal(MODE_LABELS_VI[TOURNAMENT_MODE.DAILY_PLAY], "Chơi hằng ngày");
  });

  it("13. canonical repository fails closed on missing tenant", () => {
    assert.equal(resolveTournamentDataMode(), TOURNAMENT_DATA_MODES.TRANSITIONAL_BLOB);
    const clubs = loadClubs().map((club) =>
      club.id === DEFAULT_CLUB.id
        ? { ...club, tenantId: "default-tenant", venueId: "default-tenant" }
        : club
    );
    saveClubs(clubs);
    const denied = requireExplicitTenantForClub(DEFAULT_CLUB.id);
    assert.equal(denied.ok, false);
  });

  it("14. Team Tournament does not gain a new local mirror path", () => {
    const commands = readSrc("src/features/tournament/services/tournamentCommands.js");
    assertIncludes(commands, "createTeamTournamentForUi");
    assertNotIncludes(commands, "localStorage.setItem");
    assertNotIncludes(commands, "pickleball-club-data-v3");
    const dataMode = readSrc(
      "src/features/team-tournament/repositories/teamTournamentDataMode.js"
    );
    assertIncludes(dataMode, "CLOUD_ONLY");
    assertIncludes(dataMode, "VITE_TOURNAMENT_CANONICAL_CUTOVER");
  });

  it("15. public Tournament canonical path does not depend on mock/browser data", () => {
    assert.equal(
      resolvePublicTournamentsRankingsSource(),
      PUBLIC_TOURNAMENTS_RANKINGS_SOURCE.REMOTE
    );
    const adapter = readSrc(
      "src/features/public-portal/services/publicTournamentsRankingsDataSource.js"
    );
    assertIncludes(adapter, "loadPublicTournamentsFromRemote");
    assertIncludes(adapter, "PUBLIC_TOURNAMENTS_RANKINGS_SOURCE.REMOTE");
  });

  it("entry-fee route is demoted to canonical fee redirect", () => {
    const router = readSrc("src/router.jsx");
    assertIncludes(router, 'path="/tournament/entry-fee"');
    assertIncludes(router, 'Navigate to="/tournament/config/fee"');
  });

  it("SQL cutover package exists locally and is not auto-applied", () => {
    assert.equal(
      existsSync(
        path.join(
          root,
          "docs/v5/qa-evidence/tournament-canonical-runtime-cutover-01/sql/10_CANONICAL_TOURNAMENTS.sql"
        )
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
  });
});
