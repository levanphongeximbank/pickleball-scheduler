/**
 * Phase 1I-D — Public Player Directory detail UI (controller + route/source contracts).
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
import { canAccessRoute } from "../src/auth/menuAccess.js";
import { can } from "../src/auth/rbac.js";
import { ROLES } from "../src/auth/roles.js";
import { createUserRecord } from "../src/models/user.js";
import { ROUTE_PERMISSIONS } from "../src/config/navigationConfig.js";
import { DIRECTORY_ERROR_CODES } from "../src/features/player/constants/directory.js";
import {
  createPublicDirectoryDetailController,
  DIRECTORY_DETAIL_UI_STATUS,
} from "../src/features/player/utils/publicDirectoryDetailController.js";
import {
  DIRECTORY_DETAIL_NOT_FOUND_MESSAGE,
  mapDirectoryDetailErrorMessage,
} from "../src/features/player/utils/publicDirectoryDetailMessages.js";
import {
  buildPublicDirectoryPlayerPath,
  PUBLIC_DIRECTORY_LIST_PATH,
} from "../src/features/player/utils/publicDirectoryRoutes.js";
import {
  formatDirectoryGenderLabel,
  formatDirectoryHandednessLabel,
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

function createGetMock(handler) {
  const calls = [];
  const getPublicDirectoryPlayer = async (playerId, deps) => {
    calls.push({ playerId, deps });
    return handler(playerId, deps, calls);
  };
  return { getPublicDirectoryPlayer, calls };
}

test("authenticated detail route exists under MainLayout", () => {
  const router = readSrc("src/router.jsx");
  assert.match(router, /path="\/athletes\/:playerId"/);
  assert.match(router, /PublicPlayerDirectoryDetailPage/);
  assert.match(router, /element=\{\s*<MainLayout\s*\/>\s*\}/);

  // Detail route must sit inside the MainLayout route group.
  const mainLayoutOpen = router.indexOf("<Route element={<MainLayout />}>");
  const detailIdx = router.indexOf('path="/athletes/:playerId"');
  const listIdx = router.indexOf('path="/athletes"');
  assert.ok(mainLayoutOpen >= 0);
  assert.ok(listIdx > mainLayoutOpen);
  assert.ok(detailIdx > listIdx);

  // Extract MainLayout children slice through notifications (sibling after athletes).
  const slice = router.slice(mainLayoutOpen, router.indexOf('path="/notifications"') + 40);
  assert.match(slice, /path="\/athletes\/:playerId"/);
  assert.doesNotMatch(slice, /PublicLayout/);
});

test("unauthenticated detail route redirects to login; no special permission", () => {
  const detailPath = "/athletes/player-1";
  assert.equal(isAuthenticatedOnlyRoute(detailPath), true);
  assert.equal(isAuthenticatedOnlyRoute("/athletes"), true);
  // List route: empty permissions. Detail path: no special permission entry required.
  assert.deepEqual(ROUTE_PERMISSIONS["/athletes"], []);
  assert.equal(ROUTE_PERMISSIONS["/athletes/:playerId"], undefined);
  assert.equal(ROUTE_PERMISSIONS[detailPath], undefined);

  assert.equal(
    shouldRedirectToLogin(detailPath, {
      authProductionEnabled: true,
      rbacEnabled: true,
      isAuthenticated: false,
    }),
    true
  );

  const manager = createUserRecord({ role: ROLES.VENUE_MANAGER, id: "nav-mgr-d" });
  const player = createUserRecord({ role: ROLES.PLAYER, id: "nav-player-d" });

  assert.equal(
    shouldRedirectToForbidden(detailPath, {
      rbacEnabled: true,
      isAuthenticated: true,
      can: (permission, scope) => can(manager, permission, scope, true),
      scope: {},
      user: manager,
    }),
    false
  );
  assert.equal(
    canAccessRoute(
      (permission, scope) => can(player, permission, scope, true),
      detailPath,
      {},
      player
    ),
    true
  );
});

test("no anonymous PublicLayout athletes detail exposure", () => {
  const router = readSrc("src/router.jsx");
  const page = readSrc("src/pages/PublicPlayerDirectoryDetailPage.jsx");
  assert.doesNotMatch(page, /PublicLayout/);
  assert.match(router, /path="\/athletes\/:playerId"/);
  // Ensure athletes detail is not declared in a public/anonymous layout section.
  const publicLayoutIdx = router.indexOf("PublicLayout");
  const detailIdx = router.indexOf('path="/athletes/:playerId"');
  assert.ok(detailIdx > 0);
  if (publicLayoutIdx >= 0) {
    // Detail route must appear after MainLayout gate, not under PublicLayout-only trees.
    assert.ok(detailIdx > router.indexOf("<MainLayout"));
  }
});

test("valid playerId calls getPublicDirectoryPlayer exactly once with unchanged id", async () => {
  const { getPublicDirectoryPlayer, calls } = createGetMock((playerId) => ({
    ok: true,
    player: dto({ playerId }),
  }));
  const controller = createPublicDirectoryDetailController({
    getPublicDirectoryPlayer,
  });
  await controller.load("player-exact-id");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].playerId, "player-exact-id");
  assert.equal(controller.getState().uiStatus, DIRECTORY_DETAIL_UI_STATUS.READY);
  assert.equal(controller.getState().player.playerId, "player-exact-id");
});

test("successful DTO renders approved public fields only (source + helpers)", () => {
  const detail = readSrc(
    "src/features/player/components/PublicDirectoryPlayerDetail.jsx"
  );
  assert.match(detail, /displayName/);
  assert.match(detail, /activityRegion/);
  assert.match(detail, /formatDirectoryGenderLabel/);
  assert.match(detail, /formatDirectoryHandednessLabel/);
  assert.match(detail, /isVerified/);
  assert.match(detail, /avatarUrl/);
  assert.doesNotMatch(
    detail,
    /\bemail\b|\bphone\b|birthDate|birthYear|\brating\b|tenantId|clubId|authUserId|privacySettings|suspension/
  );

  assert.equal(formatDirectoryGenderLabel("female"), "Nữ");
  assert.equal(formatDirectoryHandednessLabel("right"), "Tay phải");
  assert.equal(formatDirectoryGenderLabel(null), null);
  assert.equal(formatDirectoryHandednessLabel(null), null);
});

test("null optional fields omitted cleanly on ready state", async () => {
  const { getPublicDirectoryPlayer } = createGetMock(() => ({
    ok: true,
    player: dto({
      activityRegion: null,
      gender: null,
      handedness: null,
      avatarUrl: null,
    }),
  }));
  const controller = createPublicDirectoryDetailController({
    getPublicDirectoryPlayer,
  });
  await controller.load("player-1");
  const snap = controller.getState();
  assert.equal(snap.uiStatus, DIRECTORY_DETAIL_UI_STATUS.READY);
  assert.equal(snap.player.activityRegion, null);
  assert.equal(snap.player.gender, null);
  assert.equal(snap.player.handedness, null);
  assert.equal(formatDirectoryGenderLabel(snap.player.gender), null);
  assert.equal(formatDirectoryHandednessLabel(snap.player.handedness), null);
});

test("verified indicator present in detail UI source", () => {
  const detail = readSrc(
    "src/features/player/components/PublicDirectoryPlayerDetail.jsx"
  );
  assert.match(detail, /Đã xác minh/);
  assert.match(detail, /directory-detail-verified-badge/);
  assert.match(detail, /VerifiedOutlinedIcon/);
});

test("loading state set while request in flight", async () => {
  let resolveRequest;
  const pending = new Promise((resolve) => {
    resolveRequest = resolve;
  });
  const { getPublicDirectoryPlayer } = createGetMock(() => pending);
  const controller = createPublicDirectoryDetailController({
    getPublicDirectoryPlayer,
  });
  const loadPromise = controller.load("player-loading");
  assert.equal(controller.getState().uiStatus, DIRECTORY_DETAIL_UI_STATUS.LOADING);
  assert.equal(controller.getState().player, null);
  resolveRequest({ ok: true, player: dto({ playerId: "player-loading" }) });
  await loadPromise;
  assert.equal(controller.getState().uiStatus, DIRECTORY_DETAIL_UI_STATUS.READY);
});

test("nonexistent and hidden/ineligible share identical generic not-found", async () => {
  const scenarios = [
    { label: "nonexistent", player: null },
    { label: "hidden", player: null },
    { label: "ineligible", player: null },
  ];
  const messages = [];
  for (const scenario of scenarios) {
    const { getPublicDirectoryPlayer } = createGetMock(() => ({
      ok: true,
      player: scenario.player,
    }));
    const controller = createPublicDirectoryDetailController({
      getPublicDirectoryPlayer,
    });
    await controller.load(`player-${scenario.label}`);
    const snap = controller.getState();
    assert.equal(snap.uiStatus, DIRECTORY_DETAIL_UI_STATUS.NOT_FOUND);
    assert.equal(snap.error.message, DIRECTORY_DETAIL_NOT_FOUND_MESSAGE);
    messages.push(snap.error.message);
  }
  assert.equal(new Set(messages).size, 1);
  assert.match(
    DIRECTORY_DETAIL_NOT_FOUND_MESSAGE,
    /Không tìm thấy vận động viên hoặc hồ sơ này hiện không được công khai/
  );
});

test("empty route param yields same generic not-found without facade call", async () => {
  const { getPublicDirectoryPlayer, calls } = createGetMock(() => {
    throw new Error("should not call");
  });
  const controller = createPublicDirectoryDetailController({
    getPublicDirectoryPlayer,
  });
  await controller.load("");
  assert.equal(calls.length, 0);
  assert.equal(controller.getState().uiStatus, DIRECTORY_DETAIL_UI_STATUS.NOT_FOUND);
  assert.equal(
    controller.getState().error.message,
    DIRECTORY_DETAIL_NOT_FOUND_MESSAGE
  );
});

test("recoverable error shows safe message; retry reloads; raw backend text hidden", async () => {
  let mode = "fail";
  const { getPublicDirectoryPlayer, calls } = createGetMock(() => {
    if (mode === "fail") {
      return {
        ok: false,
        code: DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE,
        message: "SQLSTATE 57014 player_directory_get stack TRACE token=abc",
        player: null,
      };
    }
    return { ok: true, player: dto() };
  });
  const controller = createPublicDirectoryDetailController({
    getPublicDirectoryPlayer,
  });
  await controller.load("player-1");
  const err = controller.getState().error;
  assert.equal(controller.getState().uiStatus, DIRECTORY_DETAIL_UI_STATUS.ERROR);
  assert.equal(err.recoverable, true);
  assert.equal(
    err.message,
    mapDirectoryDetailErrorMessage(DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE)
  );
  assert.doesNotMatch(err.message, /SQLSTATE|player_directory_get|TRACE|token=/);

  mode = "ok";
  await controller.retry();
  assert.equal(calls.length, 2);
  assert.equal(controller.getState().uiStatus, DIRECTORY_DETAIL_UI_STATUS.READY);
});

test("DIRECTORY_UNAVAILABLE / UNKNOWN aliases map safely", () => {
  assert.equal(
    mapDirectoryDetailErrorMessage("DIRECTORY_UNAVAILABLE"),
    mapDirectoryDetailErrorMessage(DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE)
  );
  assert.equal(
    mapDirectoryDetailErrorMessage("DIRECTORY_UNKNOWN_ERROR"),
    mapDirectoryDetailErrorMessage(DIRECTORY_ERROR_CODES.RESPONSE_INVALID)
  );
});

test("stale response ignored after playerId changes", async () => {
  let resolveFirst;
  const first = new Promise((resolve) => {
    resolveFirst = resolve;
  });
  const { getPublicDirectoryPlayer, calls } = createGetMock((playerId) => {
    if (playerId === "player-a") return first;
    return Promise.resolve({
      ok: true,
      player: dto({ playerId: "player-b", displayName: "B" }),
    });
  });
  const controller = createPublicDirectoryDetailController({
    getPublicDirectoryPlayer,
  });

  const p1 = controller.load("player-a");
  await controller.load("player-b");
  resolveFirst({
    ok: true,
    player: dto({ playerId: "player-a", displayName: "Stale-A" }),
  });
  await p1;

  assert.equal(calls.length, 2);
  assert.equal(controller.getState().playerId, "player-b");
  assert.equal(controller.getState().player?.displayName, "B");
  assert.notEqual(controller.getState().player?.displayName, "Stale-A");
});

test("card navigates to correct detail route and is keyboard-accessible", () => {
  const card = readSrc(
    "src/features/player/components/PublicDirectoryPlayerCard.jsx"
  );
  assert.match(card, /buildPublicDirectoryPlayerPath/);
  assert.match(card, /CardActionArea/);
  assert.match(card, /RouterLink/);
  assert.match(card, /aria-label=\{`Xem hồ sơ công khai của \$\{displayName\}`\}/);
  assert.match(card, /focus-visible/);

  assert.equal(
    buildPublicDirectoryPlayerPath("player-42"),
    "/athletes/player-42"
  );
  assert.equal(buildPublicDirectoryPlayerPath(""), null);
  assert.equal(buildPublicDirectoryPlayerPath("  "), null);
  assert.equal(
    buildPublicDirectoryPlayerPath("id with space"),
    `/athletes/${encodeURIComponent("id with space")}`
  );
});

test("back link returns to /athletes", () => {
  const detail = readSrc(
    "src/features/player/components/PublicDirectoryPlayerDetail.jsx"
  );
  assert.match(detail, /PUBLIC_DIRECTORY_LIST_PATH|to=\{PUBLIC_DIRECTORY_LIST_PATH\}/);
  assert.match(detail, /Quay lại Danh bạ vận động viên/);
  assert.equal(PUBLIC_DIRECTORY_LIST_PATH, "/athletes");
});

test("no direct RPC in React/detail sources; facade boundary only", () => {
  const files = [
    "src/features/player/components/PublicDirectoryPlayerDetail.jsx",
    "src/features/player/components/PublicDirectoryPlayerCard.jsx",
    "src/pages/PublicPlayerDirectoryDetailPage.jsx",
    "src/features/player/utils/publicDirectoryDetailController.js",
  ];
  for (const rel of files) {
    const src = readSrc(rel);
    assert.doesNotMatch(src, /\.rpc\s*\(/);
    assert.doesNotMatch(src, /player_directory_get/);
    assert.doesNotMatch(src, /player_directory_search/);
    assert.doesNotMatch(src, /createClient/);
    assert.doesNotMatch(src, /service_role/);
    assert.doesNotMatch(src, /SUPABASE_SERVICE/);
  }

  const controller = readSrc(
    "src/features/player/utils/publicDirectoryDetailController.js"
  );
  assert.match(controller, /getPublicDirectoryPlayer/);

  const detail = readSrc(
    "src/features/player/components/PublicDirectoryPlayerDetail.jsx"
  );
  assert.doesNotMatch(
    detail,
    /import\s*\{[^}]*getPublicDirectoryPlayer|from\s+["'].*getPublicDirectoryPlayer/
  );
});

test("forbidden fields never displayed in detail UI copy", () => {
  const detail = readSrc(
    "src/features/player/components/PublicDirectoryPlayerDetail.jsx"
  );
  const messages = readSrc(
    "src/features/player/utils/publicDirectoryDetailMessages.js"
  );
  for (const src of [detail, messages]) {
    assert.doesNotMatch(src, /\bemail\b|\bphone\b|authUserId|privacySettings/i);
    assert.doesNotMatch(src, /verificationStatus|accountStatus|birthDate|birthYear/i);
    assert.doesNotMatch(src, /\brating\b|ranking|tenantId|venueId|clubId/i);
    assert.doesNotMatch(src, /suspension|eligibilityReason|auth_user_id/i);
  }
});

test("docs — Phase 1I-D package present", () => {
  const docs = readSrc(
    "docs/player-management/phase-1i/08_PHASE_1I_D_DIRECTORY_DETAIL_UI.md"
  );
  assert.match(docs, /Phase 1I-D/);
  assert.match(docs, /\/athletes\/:playerId/);
  assert.match(docs, /getPublicDirectoryPlayer/);
  assert.match(docs, /READY_FOR_PHASE_1I_D_PRECOMMIT_REVIEW|Phase 1I-E/);
});
