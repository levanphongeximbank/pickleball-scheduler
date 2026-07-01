import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ROLES } from "../src/auth/roles.js";
import { can } from "../src/auth/rbac.js";
import { createUserRecord } from "../src/models/user.js";
import { CLUB_DATA_KEY } from "../src/domain/clubStorage.js";
import {
  canUserReceiveEvent,
  dispatchNotification,
  isPushSupported,
  NOTIFICATION_EVENTS,
  resolveEventRecipients,
} from "../src/features/mobile/services/notificationDispatchService.js";
import { loadPlayerMobileHome } from "../src/features/mobile/services/playerMobileService.js";
import {
  canAccessOperationsDashboard,
  getOperationsDashboardMode,
  loadOperationsDashboard,
} from "../src/features/mobile/services/operationsDashboardService.js";
import {
  canAccessMobileRoute,
  filterMobileBottomNav,
} from "../src/features/mobile/services/mobileNavAccess.js";
import { getNotificationPermission } from "../src/features/mobile/services/notificationService.js";

const RBAC_ON = { rbacEnabled: true };
const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

function seedClub(clubId, data) {
  const key = `${CLUB_DATA_KEY}::${clubId}`;
  localStorage.setItem(key, JSON.stringify(data));
  localStorage.setItem("pickleball-active-club-v1", clubId);
  localStorage.setItem(
    "pickleball-clubs-v1",
    JSON.stringify([{ id: clubId, name: "Test CLB", isDefault: true }])
  );
}

beforeEach(() => {
  globalThis.localStorage = createLocalStorageMock();
  globalThis.sessionStorage = createLocalStorageMock();
  Object.defineProperty(globalThis, "navigator", {
    value: { onLine: true, userAgent: "test" },
    configurable: true,
    writable: true,
  });
  delete globalThis.Notification;
  delete globalThis.PushManager;
});

afterEach(() => {
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
  delete globalThis.Notification;
  delete globalThis.PushManager;
});

describe("mobile phase 8 product — push notification dispatch", () => {
  it("tenant A user không nhận event tenant B", () => {
    const user = createUserRecord({
      id: "u1",
      role: ROLES.COURT_OWNER,
      tenantId: "tenant-a",
      venueId: "tenant-a",
    });
    const ok = canUserReceiveEvent(user, NOTIFICATION_EVENTS.BOOKING_CREATED, {
      tenantId: "tenant-b",
      payload: { tenantId: "tenant-b" },
    });
    assert.equal(ok, false);
  });

  it("PLAYER không nhận BookingCreated", () => {
    const user = createUserRecord({
      id: "p1",
      role: ROLES.PLAYER,
      tenantId: "tenant-a",
      playerId: "player-1",
    });
    const ok = canUserReceiveEvent(user, NOTIFICATION_EVENTS.BOOKING_CREATED, {
      tenantId: "tenant-a",
    });
    assert.equal(ok, false);
  });

  it("COURT_OWNER nhận BookingCreated trong tenant", () => {
    const user = createUserRecord({
      id: "o1",
      role: ROLES.COURT_OWNER,
      tenantId: "tenant-a",
      venueId: "tenant-a",
    });
    const ok = canUserReceiveEvent(user, NOTIFICATION_EVENTS.BOOKING_CREATED, {
      tenantId: "tenant-a",
    });
    assert.equal(ok, true);
  });

  it("dispatch chỉ gửi eligible recipients", async () => {
    const owner = createUserRecord({
      id: "o1",
      role: ROLES.COURT_OWNER,
      tenantId: "tenant-a",
      venueId: "tenant-a",
    });
    const player = createUserRecord({
      id: "p1",
      role: ROLES.PLAYER,
      tenantId: "tenant-a",
      playerId: "player-1",
    });
    const eligible = resolveEventRecipients([owner, player], {
      tenantId: "tenant-a",
      eventType: NOTIFICATION_EVENTS.MATCH_STARTED,
    });
    assert.equal(eligible.length, 1);
    assert.equal(eligible[0].id, "p1");

    const result = await dispatchNotification({
      tenantId: "tenant-a",
      eventType: NOTIFICATION_EVENTS.BOOKING_CREATED,
      title: "Booking mới",
      body: "Test",
      recipients: [owner, player],
    });
    assert.equal(result.ok, true);
    assert.equal(result.dispatched, 1);
    assert.equal(result.skipped, 1);
  });

  it("unsupported browser — permission unsupported", () => {
    assert.equal(isPushSupported(), false);
    assert.equal(getNotificationPermission(), "unsupported");
  });
});

describe("mobile phase 8 product — player shell real data", () => {
  it("loadPlayerMobileHome trả schedule và stats từ club blob", () => {
    const clubId = "club-test";
    seedClub(clubId, {
      schemaVersion: 3,
      players: [{ id: "player-1", name: "Nguyen A", active: true }],
      courts: [{ id: "c1", name: "San 1", number: 1, active: true }],
      bookings: [
        {
          id: "b1",
          date: new Date().toISOString().slice(0, 10),
          startTime: "08:00",
          endTime: "09:00",
          courtId: "c1",
          customerName: "Nguyen A",
          status: "confirmed",
        },
      ],
      tournaments: [],
      leagues: [],
      seasons: [],
      seasonStandings: {},
    });

    const result = loadPlayerMobileHome({
      clubId,
      playerId: "player-1",
      tenantId: "tenant-a",
    });
    assert.equal(result.ok, true);
    assert.equal(result.player?.name, "Nguyen A");
    assert.ok(result.bookings.length >= 1);
    assert.ok(Array.isArray(result.schedule));
  });

  it("empty state khi không có player", () => {
    const clubId = "club-empty";
    seedClub(clubId, {
      schemaVersion: 3,
      players: [],
      courts: [],
      bookings: [],
      tournaments: [],
    });
    const result = loadPlayerMobileHome({ clubId, playerId: "missing", tenantId: "t1" });
    assert.equal(result.ok, true);
    assert.equal(result.player, null);
    assert.equal(result.schedule.length, 0);
  });
});

describe("mobile phase 8 product — operations dashboard", () => {
  it("PLAYER không truy cập operations dashboard", () => {
    const player = createUserRecord({ role: ROLES.PLAYER, playerId: "p1" });
    assert.equal(canAccessOperationsDashboard(player, { clubId: "c1" }), false);
  });

  it("COURT_OWNER có mode owner", () => {
    const owner = createUserRecord({ role: ROLES.COURT_OWNER, venueId: "v1" });
    assert.equal(getOperationsDashboardMode(owner), "owner");
    assert.equal(canAccessOperationsDashboard(owner, { clubId: "c1", tenantId: "v1" }), true);
  });

  it("CASHIER có mode cashier và unpaid list", async () => {
    const clubId = "club-ops";
    const today = new Date().toISOString().slice(0, 10);
    seedClub(clubId, {
      schemaVersion: 3,
      players: [],
      courts: [{ id: "c1", name: "San 1", number: 1, active: true }],
      bookings: [
        {
          id: "b-unpaid",
          date: today,
          startTime: "10:00",
          endTime: "11:00",
          courtId: "c1",
          customerName: "Khach",
          paymentStatus: "pending",
        },
      ],
      tournaments: [],
    });
    const cashier = createUserRecord({ role: ROLES.CASHIER, venueId: "v1" });
    const dash = await loadOperationsDashboard({
      clubId,
      tenantId: "v1",
      user: cashier,
    });
    assert.equal(dash.ok, true);
    assert.equal(dash.mode, "cashier");
    assert.ok(dash.unpaidBookings.length >= 1);
    assert.equal(dash.quickActions.canManageBilling, false);
  });

  it("owner bottom nav trỏ /mobile/operations", () => {
    const owner = createUserRecord({ role: ROLES.COURT_OWNER, venueId: "v1" });
    const nav = filterMobileBottomNav(authContext(owner), { clubId: "c1", tenantId: "v1" });
    const ops = nav.find((item) => item.key === "dashboard");
    assert.ok(ops);
    assert.equal(ops.path, "/mobile/operations");
    assert.equal(ops.label, "Vận hành");
  });

  it("PLAYER không vào /mobile/operations", () => {
    const player = createUserRecord({ role: ROLES.PLAYER, playerId: "p1" });
    const allowed = canAccessMobileRoute("/mobile/operations", authContext(player), {
      clubId: "c1",
    });
    assert.equal(allowed, false);
  });
});

describe("mobile phase 8 product — PWA assets", () => {
  it("icon PNG 192/512 tồn tại trong public", () => {
    const publicDir = path.join(__dirname, "..", "public");
    assert.ok(fs.existsSync(path.join(publicDir, "icon-192.png")));
    assert.ok(fs.existsSync(path.join(publicDir, "icon-512.png")));
    assert.ok(fs.existsSync(path.join(publicDir, "apple-touch-icon.png")));
  });

  it("vite manifest khai báo icon 192/512", () => {
    const config = fs.readFileSync(path.join(__dirname, "..", "vite.config.js"), "utf8");
    assert.match(config, /icon-192\.png/);
    assert.match(config, /icon-512\.png/);
    assert.match(config, /192x192/);
    assert.match(config, /512x512/);
  });
});
