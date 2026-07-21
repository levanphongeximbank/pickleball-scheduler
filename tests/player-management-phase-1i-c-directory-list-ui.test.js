/**
 * Phase 1I-C — Public Player Directory list UI (controller + route/source contracts).
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isAuthenticatedOnlyRoute, shouldRedirectToLogin } from "../src/auth/authGuard.js";
import { canAccessRoute, filterMenuGroups } from "../src/auth/menuAccess.js";
import { can } from "../src/auth/rbac.js";
import { ROLES } from "../src/auth/roles.js";
import { createUserRecord } from "../src/models/user.js";
import {
  MENU_GROUPS,
  ROUTE_PERMISSIONS,
} from "../src/config/navigationConfig.js";
import {
  DIRECTORY_ERROR_CODES,
  DIRECTORY_SEARCH_DEFAULT_LIMIT,
  DIRECTORY_SEARCH_MIN_QUERY_LENGTH,
} from "../src/features/player/constants/directory.js";
import {
  appendDirectoryItems,
  createPublicDirectoryListController,
  DIRECTORY_LIST_UI_STATUS,
  resolveDirectorySearchInput,
} from "../src/features/player/utils/publicDirectoryListController.js";
import {
  formatDirectoryGenderLabel,
  formatDirectoryHandednessLabel,
  mapDirectoryListErrorMessage,
} from "../src/features/player/utils/publicDirectoryListMessages.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function readSrc(rel) {
  return readFileSync(join(root, rel), "utf8");
}

function dto(overrides = {}) {
  return {
    playerId: "player-1",
    displayName: "Nguyen Van A",
    isVerified: true,
    avatarUrl: null,
    activityRegion: null,
    gender: null,
    handedness: null,
    ...overrides,
  };
}

function createSearchMock(handler) {
  const calls = [];
  const searchPublicDirectoryPlayers = async (request, deps) => {
    calls.push({ request, deps });
    return handler(request, deps, calls);
  };
  return { searchPublicDirectoryPlayers, calls };
}

test("resolveDirectorySearchInput — browse / idle / search thresholds", () => {
  assert.deepEqual(resolveDirectorySearchInput(""), { mode: "browse", query: null });
  assert.deepEqual(resolveDirectorySearchInput("   "), { mode: "browse", query: null });
  assert.deepEqual(resolveDirectorySearchInput("a"), { mode: "idle", query: null });
  assert.deepEqual(resolveDirectorySearchInput(" ab "), {
    mode: "search",
    query: "ab",
  });
  assert.equal(DIRECTORY_SEARCH_MIN_QUERY_LENGTH, 2);
});

test("appendDirectoryItems — preserves order and dedupes by playerId", () => {
  const merged = appendDirectoryItems(
    [dto({ playerId: "a", displayName: "A" }), dto({ playerId: "b", displayName: "B" })],
    [
      dto({ playerId: "b", displayName: "B-dup" }),
      dto({ playerId: "c", displayName: "C" }),
    ]
  );
  assert.deepEqual(
    merged.map((p) => p.playerId),
    ["a", "b", "c"]
  );
  assert.equal(merged[1].displayName, "B");
});

test("navigation — /athletes discoverable once for PLAYER and non-PLAYER; blocked when unauthenticated", () => {
  const player = createUserRecord({ role: ROLES.PLAYER, id: "nav-player-1" });
  const manager = createUserRecord({ role: ROLES.VENUE_MANAGER, id: "nav-mgr-1" });

  const playerGroups = filterMenuGroups(MENU_GROUPS, {
    can: (permission, scope) => can(player, permission, scope, true),
    rbacEnabled: true,
    isAuthenticated: true,
    user: player,
  });
  const managerGroups = filterMenuGroups(MENU_GROUPS, {
    can: (permission, scope) => can(manager, permission, scope, true),
    rbacEnabled: true,
    isAuthenticated: true,
    user: manager,
  });
  const anonGroups = filterMenuGroups(MENU_GROUPS, {
    can: () => false,
    rbacEnabled: true,
    isAuthenticated: false,
    user: null,
  });

  function collectAthletePaths(groups) {
    const paths = [];
    function walk(items) {
      for (const item of items || []) {
        if (item.key === "athletes-directory" || item.path === "/athletes") {
          paths.push(item.path);
        }
        if (item.children?.length) walk(item.children);
      }
    }
    for (const group of groups) walk(group.items);
    return paths;
  }

  assert.deepEqual(collectAthletePaths(playerGroups), ["/athletes"]);
  assert.deepEqual(collectAthletePaths(managerGroups), ["/athletes"]);
  assert.deepEqual(collectAthletePaths(anonGroups), []);

  assert.equal(isAuthenticatedOnlyRoute("/athletes"), true);
  assert.deepEqual(ROUTE_PERMISSIONS["/athletes"], []);
  assert.equal(
    canAccessRoute(
      (permission, scope) => can(manager, permission, scope, true),
      "/athletes",
      {},
      manager
    ),
    true
  );
  assert.equal(
    shouldRedirectToLogin("/athletes", {
      authProductionEnabled: true,
      rbacEnabled: true,
      isAuthenticated: false,
    }),
    true
  );
});

test("router — /athletes registered under MainLayout; no detail route", () => {
  const router = readSrc("src/router.jsx");
  assert.match(router, /path="\/athletes"/);
  assert.match(router, /PublicPlayerDirectoryPage/);
  assert.doesNotMatch(router, /path="\/athletes\/:playerId"/);
  assert.doesNotMatch(router, /path="\/athletes\/:/);
});

test("UI sources — facade only; no direct RPC; no forbidden fields rendered", () => {
  const list = readSrc("src/features/player/components/PublicPlayerDirectoryList.jsx");
  const card = readSrc("src/features/player/components/PublicDirectoryPlayerCard.jsx");
  const page = readSrc("src/pages/PublicPlayerDirectoryPage.jsx");
  const controller = readSrc(
    "src/features/player/utils/publicDirectoryListController.js"
  );

  for (const src of [list, card, page, controller]) {
    assert.doesNotMatch(src, /\.rpc\s*\(/);
    assert.doesNotMatch(src, /player_directory_search/);
    assert.doesNotMatch(src, /createClient/);
    assert.doesNotMatch(src, /service_role/);
    assert.doesNotMatch(src, /SUPABASE_SERVICE/);
  }

  assert.match(controller, /searchPublicDirectoryPlayers/);
  assert.doesNotMatch(
    list,
    /import\s*\{[^}]*searchPublicDirectoryPlayers|from\s+["'].*searchPublicDirectoryPlayers/
  );
  assert.doesNotMatch(card, /\bemail\b|\bphone\b|birthDate|birthYear|\brating\b|tenantId|clubId|authUserId/);
  assert.doesNotMatch(list, /Tổng số|total count|totalCount|hasMore/);
  assert.match(card, /isVerified/);
  assert.match(card, /Đã xác minh/);
  assert.match(list, /"aria-label":\s*"Tìm theo tên hiển thị"/);
  assert.match(list, /"aria-label":\s*"Lọc theo khu vực hoạt động"/);
  assert.match(list, /Tải thêm/);
});

test("initial browse request — query/region/cursor null, limit 20", async () => {
  const { searchPublicDirectoryPlayers, calls } = createSearchMock(() => ({
    ok: true,
    items: [dto()],
    nextCursor: null,
  }));
  const controller = createPublicDirectoryListController({
    searchPublicDirectoryPlayers,
  });
  await controller.loadInitial();
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].request, {
    query: null,
    activityRegion: null,
    cursor: null,
    limit: DIRECTORY_SEARCH_DEFAULT_LIMIT,
  });
  assert.equal(controller.getState().uiStatus, DIRECTORY_LIST_UI_STATUS.READY);
  assert.equal(controller.getState().items.length, 1);
});

test("initial loading then browse empty state", async () => {
  let resolveSearch;
  const gate = new Promise((resolve) => {
    resolveSearch = resolve;
  });
  const { searchPublicDirectoryPlayers } = createSearchMock(async () => {
    await gate;
    return { ok: true, items: [], nextCursor: null };
  });
  const controller = createPublicDirectoryListController({
    searchPublicDirectoryPlayers,
  });
  const pending = controller.loadInitial();
  assert.equal(controller.getState().uiStatus, DIRECTORY_LIST_UI_STATUS.INITIAL_LOADING);
  resolveSearch();
  await pending;
  assert.equal(controller.getState().uiStatus, DIRECTORY_LIST_UI_STATUS.EMPTY_BROWSE);
});

test("two-character search request; one-character does not call facade", async () => {
  const { searchPublicDirectoryPlayers, calls } = createSearchMock(() => ({
    ok: true,
    items: [dto({ displayName: "An" })],
    nextCursor: null,
  }));
  const controller = createPublicDirectoryListController({
    searchPublicDirectoryPlayers,
  });
  await controller.loadInitial();
  assert.equal(calls.length, 1);

  await controller.applySearchInput("x");
  assert.equal(calls.length, 1, "one-character must not call facade");
  assert.equal(controller.getState().items.length, 1);

  await controller.applySearchInput("an");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].request.query, "an");
  assert.equal(calls[1].request.cursor, null);
});

test("search change resets pagination", async () => {
  const { searchPublicDirectoryPlayers, calls } = createSearchMock((request) => {
    if (!request.query) {
      return {
        ok: true,
        items: [dto({ playerId: "p1" })],
        nextCursor: "opaque-cursor-1",
      };
    }
    return {
      ok: true,
      items: [dto({ playerId: "p2", displayName: "Lan" })],
      nextCursor: "opaque-cursor-2",
    };
  });
  const controller = createPublicDirectoryListController({
    searchPublicDirectoryPlayers,
  });
  await controller.loadInitial();
  assert.equal(controller.getState().nextCursor, "opaque-cursor-1");
  await controller.applySearchInput("la");
  assert.equal(calls[1].request.cursor, null);
  assert.equal(controller.getState().nextCursor, "opaque-cursor-2");
  assert.deepEqual(
    controller.getState().items.map((i) => i.playerId),
    ["p2"]
  );
});

test("region change resets pagination", async () => {
  const { searchPublicDirectoryPlayers, calls } = createSearchMock(() => ({
    ok: true,
    items: [dto()],
    nextCursor: "cursor-keep",
  }));
  const controller = createPublicDirectoryListController({
    searchPublicDirectoryPlayers,
  });
  await controller.loadInitial();
  await controller.setActivityRegion("Hà Nội");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].request.activityRegion, "Hà Nội");
  assert.equal(calls[1].request.cursor, null);
  await controller.setActivityRegion(null);
  assert.equal(calls[2].request.activityRegion, null);
  assert.equal(calls[2].request.cursor, null);
});

test("load-more passes opaque nextCursor and appends without duplicates", async () => {
  const opaque = "v1.ZW5jb2RlZC1vcGFxdWUtY3Vyc29y";
  let page = 0;
  const { searchPublicDirectoryPlayers, calls } = createSearchMock(() => {
    page += 1;
    if (page === 1) {
      return {
        ok: true,
        items: [dto({ playerId: "p1" }), dto({ playerId: "p2" })],
        nextCursor: opaque,
      };
    }
    return {
      ok: true,
      items: [dto({ playerId: "p2" }), dto({ playerId: "p3" })],
      nextCursor: null,
    };
  });
  const controller = createPublicDirectoryListController({
    searchPublicDirectoryPlayers,
  });
  await controller.loadInitial();
  await controller.loadMore();
  assert.equal(calls[1].request.cursor, opaque);
  assert.equal(calls[1].request.query, null);
  assert.deepEqual(
    controller.getState().items.map((i) => i.playerId),
    ["p1", "p2", "p3"]
  );
  assert.equal(controller.getState().nextCursor, null);
});

test("stale response is ignored", async () => {
  const resolvers = [];
  const { searchPublicDirectoryPlayers } = createSearchMock(() => {
    return new Promise((resolve) => {
      resolvers.push(resolve);
    });
  });
  const controller = createPublicDirectoryListController({
    searchPublicDirectoryPlayers,
  });

  const first = controller.fetchDirectory({ query: null, cursor: null, append: false });
  const second = controller.fetchDirectory({
    query: "lan",
    cursor: null,
    append: false,
  });

  resolvers[0]({
    ok: true,
    items: [dto({ playerId: "stale", displayName: "Stale" })],
    nextCursor: null,
  });
  resolvers[1]({
    ok: true,
    items: [dto({ playerId: "fresh", displayName: "Fresh" })],
    nextCursor: null,
  });

  await first;
  await second;

  assert.deepEqual(
    controller.getState().items.map((i) => i.playerId),
    ["fresh"]
  );
});

test("invalid cursor clears pagination and exposes recoverable retry", async () => {
  const { searchPublicDirectoryPlayers, calls } = createSearchMock((request) => {
    if (request.cursor) {
      return {
        ok: false,
        code: DIRECTORY_ERROR_CODES.INVALID_CURSOR,
        message: "Invalid directory cursor",
        items: [],
        nextCursor: null,
      };
    }
    return {
      ok: true,
      items: [dto({ playerId: "ok" })],
      nextCursor: "bad-later",
    };
  });
  const controller = createPublicDirectoryListController({
    searchPublicDirectoryPlayers,
  });
  await controller.loadInitial();
  await controller.loadMore();
  const errState = controller.getState();
  assert.equal(errState.uiStatus, DIRECTORY_LIST_UI_STATUS.ERROR);
  assert.equal(errState.error?.code, DIRECTORY_ERROR_CODES.INVALID_CURSOR);
  assert.equal(errState.error?.recoverable, true);
  assert.equal(errState.items.length, 0);
  assert.equal(errState.nextCursor, null);

  await controller.retry();
  assert.equal(calls.at(-1).request.cursor, null);
  assert.equal(controller.getState().uiStatus, DIRECTORY_LIST_UI_STATUS.READY);
});

test("generic retry and unauthenticated mapping", async () => {
  let mode = "fail";
  const { searchPublicDirectoryPlayers } = createSearchMock(() => {
    if (mode === "fail") {
      return {
        ok: false,
        code: DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE,
        message: "down",
        items: [],
        nextCursor: null,
      };
    }
    if (mode === "auth") {
      return {
        ok: false,
        code: DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED,
        message: "auth",
        items: [],
        nextCursor: null,
      };
    }
    return { ok: true, items: [dto()], nextCursor: null };
  });
  const controller = createPublicDirectoryListController({
    searchPublicDirectoryPlayers,
  });
  await controller.loadInitial();
  assert.equal(controller.getState().uiStatus, DIRECTORY_LIST_UI_STATUS.ERROR);
  assert.match(controller.getState().error.message, /không khả dụng/i);

  mode = "ok";
  await controller.retry();
  assert.equal(controller.getState().uiStatus, DIRECTORY_LIST_UI_STATUS.READY);

  mode = "auth";
  await controller.loadInitial();
  assert.equal(controller.getState().uiStatus, DIRECTORY_LIST_UI_STATUS.UNAUTHENTICATED);
});

test("empty search vs browse empty differentiation", async () => {
  const { searchPublicDirectoryPlayers } = createSearchMock(() => ({
    ok: true,
    items: [],
    nextCursor: null,
  }));
  const controller = createPublicDirectoryListController({
    searchPublicDirectoryPlayers,
  });
  await controller.loadInitial();
  assert.equal(controller.getState().uiStatus, DIRECTORY_LIST_UI_STATUS.EMPTY_BROWSE);
  await controller.applySearchInput("zz");
  assert.equal(controller.getState().uiStatus, DIRECTORY_LIST_UI_STATUS.EMPTY_SEARCH);
});

test("strict DTO display helpers omit unknown optional values", () => {
  assert.equal(formatDirectoryGenderLabel("male"), "Nam");
  assert.equal(formatDirectoryGenderLabel("female"), "Nữ");
  assert.equal(formatDirectoryGenderLabel(null), null);
  assert.equal(formatDirectoryGenderLabel("unknown"), null);
  assert.equal(formatDirectoryHandednessLabel("left"), "Tay trái");
  assert.equal(formatDirectoryHandednessLabel(null), null);
  assert.equal(
    mapDirectoryListErrorMessage("DIRECTORY_UNAVAILABLE"),
    mapDirectoryListErrorMessage(DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE)
  );
  assert.equal(
    mapDirectoryListErrorMessage("DIRECTORY_UNKNOWN_ERROR"),
    mapDirectoryListErrorMessage(DIRECTORY_ERROR_CODES.RESPONSE_INVALID)
  );
});

test("clear search returns to browse", async () => {
  const { searchPublicDirectoryPlayers, calls } = createSearchMock((request) => ({
    ok: true,
    items: request.query ? [] : [dto()],
    nextCursor: null,
  }));
  const controller = createPublicDirectoryListController({
    searchPublicDirectoryPlayers,
  });
  await controller.applySearchInput("lan");
  await controller.clearSearch();
  assert.equal(calls.at(-1).request.query, null);
  assert.equal(controller.getState().searchInput, "");
  assert.equal(controller.getState().effectiveQuery, null);
  assert.equal(controller.getState().uiStatus, DIRECTORY_LIST_UI_STATUS.READY);
});

test("no SQL / migration files touched by 1I-C sources", () => {
  const docs = readSrc("docs/player-management/phase-1i/07_PHASE_1I_C_DIRECTORY_LIST_UI.md");
  assert.match(docs, /Phase 1I-C/);
  assert.match(docs, /\/athletes/);
  assert.match(docs, /searchPublicDirectoryPlayers/);
  assert.match(docs, /READY_FOR_PHASE_1I_C_PRECOMMIT_REVIEW|Phase 1I-D/);
});
