import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";

import { ROLES } from "../src/auth/roles.js";
import { can } from "../src/auth/rbac.js";
import { createUserRecord } from "../src/models/user.js";
import {
  filterMobileBottomNav,
  filterMobileQuickLinks,
  canAccessMobileRoute,
} from "../src/features/mobile/services/mobileNavAccess.js";
import {
  createQrToken,
  validateQrToken,
} from "../src/features/mobile/services/qrTokenService.js";
import {
  processQrCheckin,
  resolveManualQrInput,
  canPerformCheckin,
} from "../src/features/mobile/services/checkInService.js";
import {
  enqueueOfflineAction,
  flushOfflineQueue,
  resetOfflineQueueForTests,
  OFFLINE_ACTION_TYPES,
} from "../src/features/mobile/services/offlineQueue.js";
import {
  guardOfflineAction,
  guardRiskyMutationWhenOffline,
  canEnqueueOfflineAction,
} from "../src/features/mobile/services/offlineGuardService.js";
import {
  getOfflineCapability,
  OFFLINE_CAPABILITY_MODE,
} from "../src/features/mobile/services/offlineCapabilityMatrix.js";
import {
  guardRefereeMatchAction,
  guardRefereeSessionRoute,
  REFEREE_MATCH_ACTIONS,
} from "../src/features/mobile/services/refereeMatchGuard.js";
import { signInAs, enableRbac, signOut } from "../src/auth/authService.js";
import { buildPwaInstallBannerModel } from "../src/features/mobile/utils/pwaInstallState.js";
import { MATCH_LIVE_STATUS } from "../src/domain/matchLiveSync.js";
import { QR_ENTITY_TYPES } from "../src/features/mobile/constants/qrEntityTypes.js";

const RBAC_ON = { rbacEnabled: true };

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

function authContext(user) {
  return {
    user,
    rbacEnabled: true,
    isAuthenticated: Boolean(user),
    can: (permission, scope) => can(user, permission, scope, RBAC_ON),
  };
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  globalThis.sessionStorage = createLocalStorageMock();
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true, userAgent: "test" },
    configurable: true,
    writable: true,
  });
});

afterEach(() => {
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
});

describe("mobile phase 8 — permission navigation", () => {
  it("PLAYER chỉ thấy giải và màn của tôi", () => {
    const player = createUserRecord({
      role: ROLES.PLAYER,
      clubId: "c1",
      playerId: "p1",
    });
    const items = filterMobileBottomNav(authContext(player), { clubId: "c1", playerId: "p1" });
    const keys = items.map((item) => item.key);
    assert.ok(keys.includes("player-tournament") || keys.includes("player-home-main"));
    assert.ok(keys.includes("player-profile") || keys.includes("player-home-main"));
    assert.equal(keys.includes("dashboard"), false);
    assert.equal(keys.includes("venue-checkin"), false);
  });

  it("REFEREE thấy nav chấm trận, không thấy billing/admin", () => {
    const referee = createUserRecord({
      role: ROLES.REFEREE,
      clubId: "c1",
      venueId: "venue-a",
    });
    const items = filterMobileBottomNav(authContext(referee), { clubId: "c1", venueId: "venue-a" });
    const keys = items.map((item) => item.key);
    assert.ok(keys.includes("referee-matches") || keys.includes("referee-score"));
    assert.equal(keys.includes("dashboard"), false);
    assert.equal(keys.includes("players"), false);
  });

  it("STAFF/COURT_MANAGER không thấy subscription trong quick links", () => {
    const manager = createUserRecord({
      role: ROLES.COURT_MANAGER,
      clubId: "c1",
      venueId: "venue-a",
    });
    const quick = filterMobileQuickLinks(authContext(manager), {
      clubId: "c1",
      venueId: "venue-a",
    });
    assert.equal(
      quick.some((item) => item.path.startsWith("/billing")),
      false
    );
  });

  it("chặn PLAYER vào /mobile/check-in", () => {
    const player = createUserRecord({ role: ROLES.PLAYER, clubId: "c1", playerId: "p1" });
    const allowed = canAccessMobileRoute("/mobile/check-in", authContext(player), {
      clubId: "c1",
      playerId: "p1",
    });
    assert.equal(allowed, false);
  });

  it("VENUE_OWNER vào /mobile/player", () => {
    const owner = createUserRecord({
      role: ROLES.COURT_OWNER,
      clubId: "c1",
      venueId: "venue-a",
    });
    const allowed = canAccessMobileRoute("/mobile/player", authContext(owner), {
      clubId: "c1",
      venueId: "venue-a",
    });
    assert.equal(allowed, true);
  });

  it("tenant expired khóa check-in nhưng vẫn cho /mobile/player", () => {
    const player = createUserRecord({ role: ROLES.PLAYER, clubId: "c1", playerId: "p1" });
    const auth = authContext(player);
    assert.equal(
      canAccessMobileRoute("/mobile/check-in", auth, { clubId: "c1" }, { subscriptionOk: false }),
      false
    );
    assert.equal(
      canAccessMobileRoute("/mobile/player", auth, { clubId: "c1", playerId: "p1" }, {
        subscriptionOk: false,
      }),
      true
    );
  });
});

describe("mobile phase 8 — QR check-in validation", () => {
  it("check-in đúng tenant", async () => {
    const created = await createQrToken({
      entityType: QR_ENTITY_TYPES.PLAYER,
      entityId: "player-ok",
      tenantId: "tenant-a",
      venueId: "venue-a",
    });
    const result = await processQrCheckin({
      rawToken: created.rawToken,
      tenantId: "tenant-a",
      venueId: "venue-a",
      skipPermissionCheck: true,
    });
    assert.equal(result.ok, true);
  });

  it("check-in sai tenant", async () => {
    const created = await createQrToken({
      entityType: QR_ENTITY_TYPES.PLAYER,
      entityId: "player-wrong-tenant",
      tenantId: "tenant-a",
    });
    const result = await processQrCheckin({
      rawToken: created.rawToken,
      tenantId: "tenant-b",
      skipPermissionCheck: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "WRONG_TENANT");
  });

  it("check-in sai venue cho QR sân", async () => {
    const created = await createQrToken({
      entityType: QR_ENTITY_TYPES.COURT,
      entityId: "court-1",
      tenantId: "tenant-a",
      venueId: "venue-a",
    });
    const result = await processQrCheckin({
      rawToken: created.rawToken,
      tenantId: "tenant-a",
      venueId: "venue-b",
      skipPermissionCheck: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "WRONG_VENUE");
  });

  it("check-in trùng", async () => {
    const created = await createQrToken({
      entityType: QR_ENTITY_TYPES.PLAYER,
      entityId: "player-dup-2",
      tenantId: "tenant-a",
    });
    await processQrCheckin({
      rawToken: created.rawToken,
      tenantId: "tenant-a",
      skipPermissionCheck: true,
    });
    const second = await processQrCheckin({
      rawToken: created.rawToken,
      tenantId: "tenant-a",
      skipPermissionCheck: true,
    });
    assert.equal(second.ok, false);
    assert.equal(second.code, "DUPLICATE");
  });

  it("QR invalid", async () => {
    const result = await processQrCheckin({
      rawToken: "not-a-real-token",
      tenantId: "tenant-a",
      skipPermissionCheck: true,
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "NOT_FOUND");
  });

  it("QR expired", async () => {
    const created = await createQrToken({
      entityType: QR_ENTITY_TYPES.MATCH,
      entityId: "match-exp",
      tenantId: "tenant-a",
      ttlHours: -1,
    });
    const valid = await validateQrToken(created.rawToken, { expectedTenantId: "tenant-a" });
    assert.equal(valid.ok, false);
    assert.equal(valid.code, "EXPIRED");
  });

  it("user không có quyền check-in", async () => {
    enableRbac(true);
    const player = createUserRecord({ role: ROLES.PLAYER, clubId: "c1", playerId: "p1" });
    signInAs(player);
    assert.equal(canPerformCheckin(player), false);

    const created = await createQrToken({
      entityType: QR_ENTITY_TYPES.PLAYER,
      entityId: "player-forbidden",
      tenantId: "tenant-a",
    });
    const result = await processQrCheckin({
      rawToken: created.rawToken,
      tenantId: "tenant-a",
    });
    assert.equal(result.ok, false);
    assert.equal(result.code, "FORBIDDEN");
    await signOut();
    enableRbac(false);
  });

  it("manual code fallback parses payload", () => {
    const parsed = resolveManualQrInput("pbs://checkin/abc123def456789012345678");
    assert.equal(parsed.ok, true);
    assert.equal(parsed.token, "abc123def456789012345678");
  });
});

describe("mobile phase 8 — referee guard", () => {
  const referee = createUserRecord({
    role: ROLES.REFEREE,
    displayName: "Trọng tài A",
    clubId: "c1",
    venueId: "venue-a",
  });

  const matchRow = {
    matchId: "m1",
    refereeName: "Trọng tài A",
    refereeToken: "token-abc",
    status: MATCH_LIVE_STATUS.PLAYING,
    scoreA: 5,
    scoreB: 3,
  };

  it("referee authorized cho trận được phân công", () => {
    const guard = guardRefereeMatchAction({
      user: referee,
      matchRow,
      action: REFEREE_MATCH_ACTIONS.SCORE_INCREMENT,
      scope: { clubId: "c1", venueId: "venue-a" },
      sessionToken: "token-abc",
    });
    assert.equal(guard.ok, true);
  });

  it("referee unauthorized khi token sai", () => {
    const guard = guardRefereeMatchAction({
      user: referee,
      matchRow,
      action: REFEREE_MATCH_ACTIONS.SCORE_INCREMENT,
      scope: { clubId: "c1", venueId: "venue-a" },
      sessionToken: "wrong-token",
    });
    assert.equal(guard.ok, false);
    assert.equal(guard.code, "WRONG_TOKEN");
  });

  it("không sửa điểm khi match finished", () => {
    const finished = {
      ...matchRow,
      status: MATCH_LIVE_STATUS.LOCKED,
    };
    const guard = guardRefereeMatchAction({
      user: referee,
      matchRow: finished,
      action: REFEREE_MATCH_ACTIONS.SCORE_INCREMENT,
      scope: { clubId: "c1", venueId: "venue-a" },
      sessionToken: "token-abc",
    });
    assert.equal(guard.ok, false);
    assert.equal(guard.code, "MATCH_LOCKED");
  });

  it("finish match cần guard pass trước", () => {
    const guard = guardRefereeMatchAction({
      user: referee,
      matchRow,
      action: REFEREE_MATCH_ACTIONS.FINALIZE,
      scope: { clubId: "c1", venueId: "venue-a" },
      sessionToken: "token-abc",
    });
    assert.equal(guard.ok, true);
  });

  it("session route guard theo assignment list", () => {
    const routeGuard = guardRefereeSessionRoute({
      user: referee,
      matchId: "m1",
      assignments: [{ matchId: "m1" }],
      scope: { clubId: "c1" },
    });
    assert.equal(routeGuard.ok, true);

    const denied = guardRefereeSessionRoute({
      user: referee,
      matchId: "m99",
      assignments: [{ matchId: "m1" }],
      scope: { clubId: "c1" },
    });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, "NOT_ASSIGNED");
  });
});

describe("mobile phase 8 — offline strategy", () => {
  it("offline read-only capability", () => {
    const cap = getOfflineCapability("read_cache");
    assert.equal(cap.mode, OFFLINE_CAPABILITY_MODE.READ_ONLY);
  });

  it("offline restricted action bị chặn", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: false, userAgent: "test" },
      configurable: true,
      writable: true,
    });
    const blocked = guardRiskyMutationWhenOffline("payment");
    assert.equal(blocked.ok, false);
    assert.equal(blocked.code, "OFFLINE_BLOCKED");
  });

  it("match score không được enqueue", () => {
    const result = canEnqueueOfflineAction(OFFLINE_ACTION_TYPES.MATCH_SCORE);
    assert.equal(result.ok, false);
  });

  it("check-in offline lưu pending draft", () => {
    Object.defineProperty(globalThis, "navigator", {
      value: { onLine: false, userAgent: "test" },
      configurable: true,
      writable: true,
    });
    const guard = guardOfflineAction(OFFLINE_ACTION_TYPES.CHECKIN);
    assert.equal(guard.ok, true);
    assert.equal(guard.pendingDraft, true);
  });

  it("flush không sync match score từ queue", async () => {
    resetOfflineQueueForTests();
    signInAs({
      id: "mobile-p8-offline-user",
      role: ROLES.PLAYER,
      venueId: "tenant-a",
      tenantId: "tenant-a",
      status: "active",
    });
    enqueueOfflineAction({
      type: OFFLINE_ACTION_TYPES.REFEREE_NOTE,
      payload: { matchId: "m1", note: "safe" },
      tenantId: "tenant-a",
    });
    const enqueueScore = enqueueOfflineAction({
      type: OFFLINE_ACTION_TYPES.MATCH_SCORE,
      payload: { token: "t1", team: "A", delta: 1 },
    });
    assert.equal(enqueueScore.ok, false);

    const flush = await flushOfflineQueue();
    assert.equal(flush.ok, true);
    assert.equal(flush.synced, 1);
  });
});

describe("mobile phase 8 — PWA install regression", () => {
  it("PWA install prompt model", () => {
    const installable = buildPwaInstallBannerModel({
      canInstall: true,
      isInstalled: false,
      isStandalone: false,
    });
    assert.equal(installable.showAction, true);
    assert.equal(installable.actionLabel, "Cài đặt ứng dụng");
  });
});
