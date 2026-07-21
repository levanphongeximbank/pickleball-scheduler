/**
 * Phase 1I-E — Public Player Directory QA / hardening coverage.
 * Deterministic local matrix; Staging smoke is documented separately when run.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  isAuthenticatedOnlyRoute,
  shouldRedirectToForbidden,
  shouldRedirectToLogin,
} from "../src/auth/authGuard.js";
import { canAccessRoute, filterMenuGroups } from "../src/auth/menuAccess.js";
import { can } from "../src/auth/rbac.js";
import { ROLES } from "../src/auth/roles.js";
import { createUserRecord } from "../src/models/user.js";
import { MENU_GROUPS, ROUTE_PERMISSIONS } from "../src/config/navigationConfig.js";
import { DIRECTORY_ERROR_CODES } from "../src/features/player/constants/directory.js";
import {
  appendDirectoryItems,
  createPublicDirectoryListController,
  DIRECTORY_LIST_UI_STATUS,
  resolveDirectorySearchInput,
} from "../src/features/player/utils/publicDirectoryListController.js";
import {
  createPublicDirectoryDetailController,
  DIRECTORY_DETAIL_UI_STATUS,
} from "../src/features/player/utils/publicDirectoryDetailController.js";
import { DIRECTORY_DETAIL_NOT_FOUND_MESSAGE } from "../src/features/player/utils/publicDirectoryDetailMessages.js";
import {
  buildPublicDirectoryPlayerPath,
  PUBLIC_DIRECTORY_LIST_PATH,
} from "../src/features/player/utils/publicDirectoryRoutes.js";

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

function menuCtx(user, { rbacEnabled = true } = {}) {
  return {
    can: (permission, scope) => can(user, permission, scope, true),
    rbacEnabled,
    isAuthenticated: true,
    user,
  };
}

test("1I-E auth — list and detail authenticated-only; unauth redirects; no special permission", () => {
  for (const path of ["/athletes", "/athletes/player-1"]) {
    assert.equal(isAuthenticatedOnlyRoute(path), true);
    assert.equal(
      shouldRedirectToLogin(path, {
        authProductionEnabled: true,
        rbacEnabled: true,
        isAuthenticated: false,
      }),
      true
    );
    assert.equal(
      shouldRedirectToForbidden(path, {
        rbacEnabled: true,
        isAuthenticated: true,
        can: () => false,
        scope: {},
        user: createUserRecord({ role: ROLES.PLAYER, id: "p1" }),
      }),
      false
    );
  }
  assert.deepEqual(ROUTE_PERMISSIONS["/athletes"], []);
});

test("1I-E nav — athletes entry exactly once for PLAYER and non-PLAYER (RBAC on and off)", () => {
  const player = createUserRecord({ role: ROLES.PLAYER, id: "nav-e-player" });
  const manager = createUserRecord({ role: ROLES.VENUE_MANAGER, id: "nav-e-mgr" });

  for (const rbacEnabled of [true, false]) {
    assert.deepEqual(
      collectAthletePaths(filterMenuGroups(MENU_GROUPS, menuCtx(player, { rbacEnabled }))),
      ["/athletes"],
      `PLAYER rbac=${rbacEnabled}`
    );
    assert.deepEqual(
      collectAthletePaths(filterMenuGroups(MENU_GROUPS, menuCtx(manager, { rbacEnabled }))),
      ["/athletes"],
      `MANAGER rbac=${rbacEnabled}`
    );
  }

  const referee = createUserRecord({ role: ROLES.REFEREE, id: "nav-e-ref" });
  assert.deepEqual(
    collectAthletePaths(filterMenuGroups(MENU_GROUPS, menuCtx(referee, { rbacEnabled: true }))),
    ["/athletes"]
  );
  assert.equal(
    canAccessRoute(
      (permission, scope) => can(referee, permission, scope, true),
      "/athletes/player-9",
      {},
      referee
    ),
    true
  );
});

test("1I-E list — one-char suppress; two-char search; region reset; opaque cursor; dedupe; stale; invalid cursor", async () => {
  assert.deepEqual(resolveDirectorySearchInput("x"), { mode: "idle", query: null });
  assert.deepEqual(resolveDirectorySearchInput("xy"), { mode: "search", query: "xy" });

  const calls = [];
  const searchPublicDirectoryPlayers = async (request) => {
    calls.push(request);
    if (request.cursor === "bad-cursor") {
      return { ok: false, code: DIRECTORY_ERROR_CODES.INVALID_CURSOR, items: [] };
    }
    if (request.cursor === "opaque-token-1") {
      return {
        ok: true,
        items: [
          dto({ playerId: "player-1", displayName: "Dup" }),
          dto({ playerId: "s2", displayName: "Next" }),
        ],
        nextCursor: null,
      };
    }
    if (request.query === "ab") {
      return {
        ok: true,
        items: [dto({ playerId: "s1", displayName: "Search" })],
        nextCursor: "opaque-token-1",
      };
    }
    if (request.activityRegion === "Hà Nội") {
      return { ok: true, items: [dto({ playerId: "r1" })], nextCursor: null };
    }
    return { ok: true, items: [dto()], nextCursor: "opaque-token-1" };
  };

  const controller = createPublicDirectoryListController({ searchPublicDirectoryPlayers });

  await controller.applySearchInput("a");
  assert.equal(calls.length, 0);

  await controller.applySearchInput("ab");
  assert.equal(calls.at(-1).query, "ab");
  assert.equal(calls.at(-1).cursor, null);

  await controller.setActivityRegion("Hà Nội");
  assert.equal(calls.at(-1).activityRegion, "Hà Nội");
  assert.equal(calls.at(-1).cursor, null);

  await controller.setActivityRegion(null);
  assert.equal(calls.at(-1).activityRegion, null);

  await controller.loadInitial();
  assert.equal(controller.getState().nextCursor, "opaque-token-1");
  const beforeMore = controller.getState().items.map((p) => p.playerId);
  await controller.loadMore();
  assert.equal(calls.at(-1).cursor, "opaque-token-1");
  const afterMore = controller.getState().items.map((p) => p.playerId);
  assert.ok(afterMore.includes("s2"));
  assert.equal(new Set(afterMore).size, afterMore.length);
  assert.ok(afterMore.length >= beforeMore.length);

  const merged = appendDirectoryItems(
    [dto({ playerId: "a" }), dto({ playerId: "b" })],
    [dto({ playerId: "b" }), dto({ playerId: "c" })]
  );
  assert.deepEqual(
    merged.map((p) => p.playerId),
    ["a", "b", "c"]
  );

  let resolveSlow;
  const slow = new Promise((resolve) => {
    resolveSlow = resolve;
  });
  const staleCalls = [];
  const staleSearch = async (request) => {
    staleCalls.push(request);
    if (staleCalls.length === 1) return slow;
    return { ok: true, items: [dto({ playerId: "fresh" })], nextCursor: null };
  };
  const staleController = createPublicDirectoryListController({
    searchPublicDirectoryPlayers: staleSearch,
  });
  const p1 = staleController.loadInitial();
  await staleController.applySearchInput("zz");
  resolveSlow({
    ok: true,
    items: [dto({ playerId: "stale" })],
    nextCursor: null,
  });
  await p1;
  assert.equal(staleController.getState().items[0]?.playerId, "fresh");

  const badCursor = createPublicDirectoryListController({ searchPublicDirectoryPlayers });
  await badCursor.fetchDirectory({
    query: null,
    activityRegion: null,
    cursor: "bad-cursor",
    append: true,
  });
  assert.equal(badCursor.getState().uiStatus, DIRECTORY_LIST_UI_STATUS.ERROR);
  assert.equal(badCursor.getState().nextCursor, null);
  assert.equal(badCursor.getState().error.invalidCursor, true);
  assert.equal(badCursor.getState().error.recoverable, true);
});

test("1I-E detail — success optional fields; generic not-found indistinguishability; stale; retry", async () => {
  const getOk = async (playerId) => ({
    ok: true,
    player: dto({
      playerId,
      activityRegion: "Đà Nẵng",
      gender: "female",
      handedness: null,
    }),
  });
  const okController = createPublicDirectoryDetailController({
    getPublicDirectoryPlayer: getOk,
  });
  await okController.load("player-ok");
  assert.equal(okController.getState().uiStatus, DIRECTORY_DETAIL_UI_STATUS.READY);
  assert.equal(okController.getState().player.handedness, null);
  assert.equal(okController.getState().player.activityRegion, "Đà Nẵng");

  const messages = new Set();
  for (const id of ["missing", "hidden", "suspended", "ineligible"]) {
    const c = createPublicDirectoryDetailController({
      getPublicDirectoryPlayer: async () => ({ ok: true, player: null }),
    });
    await c.load(id);
    assert.equal(c.getState().uiStatus, DIRECTORY_DETAIL_UI_STATUS.NOT_FOUND);
    messages.add(c.getState().error.message);
  }
  assert.equal(messages.size, 1);
  assert.equal([...messages][0], DIRECTORY_DETAIL_NOT_FOUND_MESSAGE);

  let resolveFirst;
  const first = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  const getStale = async (playerId) => {
    if (playerId === "a") return first;
    return { ok: true, player: dto({ playerId: "b", displayName: "B" }) };
  };
  const stale = createPublicDirectoryDetailController({
    getPublicDirectoryPlayer: getStale,
  });
  const pending = stale.load("a");
  await stale.load("b");
  resolveFirst({ ok: true, player: dto({ playerId: "a", displayName: "Stale" }) });
  await pending;
  assert.equal(stale.getState().player?.displayName, "B");

  let failOnce = true;
  const retryCtrl = createPublicDirectoryDetailController({
    getPublicDirectoryPlayer: async () => {
      if (failOnce) {
        failOnce = false;
        return {
          ok: false,
          code: DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE,
          message: "SQLSTATE 57014 player_directory_get",
        };
      }
      return { ok: true, player: dto() };
    },
  });
  await retryCtrl.load("player-1");
  assert.equal(retryCtrl.getState().error.recoverable, true);
  assert.doesNotMatch(retryCtrl.getState().error.message, /SQLSTATE|player_directory/);
  await retryCtrl.retry();
  assert.equal(retryCtrl.getState().uiStatus, DIRECTORY_DETAIL_UI_STATUS.READY);
});

test("1I-E navigation helpers — card path and back target", () => {
  assert.equal(PUBLIC_DIRECTORY_LIST_PATH, "/athletes");
  assert.equal(buildPublicDirectoryPlayerPath("abc"), "/athletes/abc");
  assert.equal(buildPublicDirectoryPlayerPath(""), null);

  const card = readSrc("src/features/player/components/PublicDirectoryPlayerCard.jsx");
  assert.match(card, /CardActionArea/);
  assert.match(card, /focus-visible/);
  assert.match(card, /aria-label=\{`Xem hồ sơ công khai/);

  const detail = readSrc("src/features/player/components/PublicDirectoryPlayerDetail.jsx");
  assert.match(detail, /Quay lại Danh bạ vận động viên/);
  assert.match(detail, /to=\{PUBLIC_DIRECTORY_LIST_PATH\}/);

  const list = readSrc("src/features/player/components/PublicPlayerDirectoryList.jsx");
  assert.match(list, /aria-label="Thử lại tải danh bạ vận động viên"/);
  assert.match(list, /aria-label":\s*"Tìm theo tên hiển thị"/);
  assert.match(list, /aria-busy/);
});

test("1I-E privacy — strict DTO only; forbidden fields and direct RPC absent in UI sources", () => {
  const files = [
    "src/features/player/components/PublicPlayerDirectoryList.jsx",
    "src/features/player/components/PublicDirectoryPlayerCard.jsx",
    "src/features/player/components/PublicDirectoryPlayerDetail.jsx",
    "src/pages/PublicPlayerDirectoryPage.jsx",
    "src/pages/PublicPlayerDirectoryDetailPage.jsx",
    "src/features/player/utils/publicDirectoryListController.js",
    "src/features/player/utils/publicDirectoryDetailController.js",
  ];
  for (const rel of files) {
    const src = readSrc(rel);
    assert.doesNotMatch(src, /\.rpc\s*\(/);
    assert.doesNotMatch(src, /player_directory_(search|get)/);
    assert.doesNotMatch(src, /createClient|service_role|SUPABASE_SERVICE/);
    assert.doesNotMatch(src, /\bemail\b|\bphone\b|birthDate|birthYear|\brating\b|tenantId|clubId|authUserId|privacySettings/);
  }

  const listUi = readSrc("src/features/player/components/PublicPlayerDirectoryList.jsx");
  assert.doesNotMatch(listUi, /Tổng số|totalCount|hidden count|hasMore\b/);
});

test("1I-E responsive/a11y source contracts", () => {
  const list = readSrc("src/features/player/components/PublicPlayerDirectoryList.jsx");
  assert.match(list, /xs=\{12\}/);
  assert.match(list, /sm=\{6\}/);
  assert.match(list, /md=\{4\}/);
  assert.match(list, /Tải thêm/);

  const detail = readSrc("src/features/player/components/PublicDirectoryPlayerDetail.jsx");
  assert.match(detail, /direction=\{\{\s*xs:\s*"column",\s*sm:\s*"row"/);
  assert.match(detail, /Ảnh đại diện của/);
  assert.match(detail, /Đã xác minh/);
});

test("1I-E docs package present", () => {
  const docs = readSrc(
    "docs/player-management/phase-1i/09_PHASE_1I_E_QA_HARDENING.md"
  );
  assert.match(docs, /Phase 1I-E/);
  assert.match(docs, /qyewbxjsiiyufanzcjcq/);
  assert.match(docs, /expuvcohlcjzvrrauvud/);
  assert.match(docs, /READY_FOR_PHASE_1I_E_PRECOMMIT_REVIEW/);
});
