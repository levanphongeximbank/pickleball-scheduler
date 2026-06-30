import test from "node:test";
import assert from "node:assert/strict";

import { ROLES } from "../src/auth/roles.js";
import { PERMISSIONS } from "../src/auth/permissions.js";
import { roleHasPermission, getPermissionsForRole } from "../src/auth/rolePermissions.js";
import {
  can,
  canAccessVenue,
  canAccessClub,
  assertCan,
  isRbacEnforced,
} from "../src/auth/rbac.js";
import { createUserRecord } from "../src/models/user.js";
import { createVenueRecord } from "../src/models/venue.js";
import {
  createSubscriptionRecord,
  isSubscriptionActive,
  planIncludesFeature,
} from "../src/models/subscription.js";
import {
  canAccessRoute,
  filterMenuGroups,
  getDefaultHomePath,
} from "../src/auth/menuAccess.js";
import { SIDEBAR_MENU_GROUPS } from "../src/config/sidebarMenu.js";
import { enableRbac, signInAs, signOut } from "../src/auth/authService.js";
import { createClub } from "../src/domain/clubService.js";
import { guardClubAction, guardDirectorAction } from "../src/auth/guardAction.js";
import { createBooking, deleteBooking } from "../src/domain/bookingService.js";
import { createTournament, updateTournament } from "../src/domain/tournamentService.js";
import {
  ensureDemoVenue,
  assignClubToVenue,
  getVenueSummaryForClub,
  upgradeSubscription,
} from "../src/domain/venueService.js";
import { mapProfileRowToUser } from "../src/auth/profileService.js";
import { SUBSCRIPTION_PLANS } from "../src/models/subscription.js";
import {
  guardPlanFeature,
} from "../src/auth/subscriptionGuard.js";
import { syncClubToCloud } from "../src/ai/cloudSync.js";
import { inviteVenueStaff, listVenueStaff } from "../src/domain/staffService.js";
import { requestPlanUpgrade, applyPaymentWebhook } from "../src/domain/paymentService.js";
import { saveClubData, getDefaultClubData } from "../src/domain/clubStorage.js";
import { setActiveClubId, DEFAULT_CLUB } from "../src/data/club.js";
import { normalizeCourt } from "../src/models/court.js";

const RBAC_ON = { rbacEnabled: true };

function user(role, extra = {}) {
  return createUserRecord({ role, ...extra });
}

test("RBAC tắt → mọi permission được phép (không phá app cũ)", () => {
  const player = user(ROLES.PLAYER, { clubId: "c1", playerId: "p1" });
  assert.equal(isRbacEnforced({ rbacEnabled: false, user: player }), false);
  assert.equal(can(player, PERMISSIONS.CLUB_DELETE, { clubId: "other" }, { rbacEnabled: false }), true);
  assert.equal(can(null, PERMISSIONS.SYSTEM_MANAGE, {}, { rbacEnabled: false }), true);
});

test("SUPER_ADMIN có toàn quyền khi RBAC bật", () => {
  const admin = user(ROLES.SUPER_ADMIN);
  assert.equal(can(admin, PERMISSIONS.SYSTEM_MANAGE, {}, RBAC_ON), true);
  assert.equal(can(admin, PERMISSIONS.CLUB_DELETE, { clubId: "any" }, RBAC_ON), true);
  assert.equal(canAccessVenue(admin, "venue-x", RBAC_ON), true);
});

test("VENUE_OWNER chỉ truy cập venue của mình", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a" });

  assert.equal(can(owner, PERMISSIONS.VENUE_MANAGE, { venueId: "venue-a" }, RBAC_ON), true);
  assert.equal(can(owner, PERMISSIONS.VENUE_MANAGE, { venueId: "venue-b" }, RBAC_ON), false);
  assert.equal(can(owner, PERMISSIONS.SYSTEM_MANAGE, {}, RBAC_ON), false);
  assert.equal(canAccessVenue(owner, "venue-a", RBAC_ON), true);
  assert.equal(canAccessVenue(owner, "venue-b", RBAC_ON), false);
});

test("CLUB_OWNER chỉ quản lý CLB được gán", () => {
  const clubOwner = user(ROLES.CLUB_OWNER, {
    venueId: "venue-a",
    clubId: "club-1",
  });

  assert.equal(can(clubOwner, PERMISSIONS.PLAYERS_MANAGE, { clubId: "club-1", venueId: "venue-a" }, RBAC_ON), true);
  assert.equal(can(clubOwner, PERMISSIONS.PLAYERS_MANAGE, { clubId: "club-2" }, RBAC_ON), false);
  assert.equal(can(clubOwner, PERMISSIONS.COURTS_MANAGE, { venueId: "venue-a" }, RBAC_ON), false);
  assert.equal(canAccessClub(clubOwner, "club-1", { venueId: "venue-a" }, RBAC_ON), true);
  assert.equal(canAccessClub(clubOwner, "club-2", { venueId: "venue-a" }, RBAC_ON), false);
});

test("PLAYER chỉ xem lịch / đăng ký / kết quả / hồ sơ", () => {
  const player = user(ROLES.PLAYER, {
    venueId: "venue-a",
    clubId: "club-1",
    playerId: "p-1",
  });

  assert.equal(can(player, PERMISSIONS.PLAYER_SCHEDULE_VIEW, { clubId: "club-1", playerId: "p-1" }, RBAC_ON), true);
  assert.equal(can(player, PERMISSIONS.PLAYER_PROFILE_EDIT, { clubId: "club-1", playerId: "p-1" }, RBAC_ON), true);
  assert.equal(can(player, PERMISSIONS.PLAYERS_MANAGE, { clubId: "club-1" }, RBAC_ON), false);
  assert.equal(can(player, PERMISSIONS.CLUB_MANAGE, { clubId: "club-1" }, RBAC_ON), false);
  assert.equal(can(player, PERMISSIONS.PLAYER_PROFILE_VIEW, { clubId: "club-1", playerId: "p-2" }, RBAC_ON), false);
});

test("CASHIER và ACCOUNTANT có quyền phù hợp", () => {
  const cashier = user(ROLES.CASHIER, { venueId: "venue-a" });
  const accountant = user(ROLES.ACCOUNTANT, { venueId: "venue-a" });

  assert.equal(can(cashier, PERMISSIONS.PAYMENTS_COLLECT, { venueId: "venue-a" }, RBAC_ON), true);
  assert.equal(can(cashier, PERMISSIONS.ACCOUNTING_EXPORT, { venueId: "venue-a" }, RBAC_ON), false);
  assert.equal(can(accountant, PERMISSIONS.ACCOUNTING_EXPORT, { venueId: "venue-a" }, RBAC_ON), true);
  assert.equal(can(accountant, PERMISSIONS.BOOKINGS_CREATE, { venueId: "venue-a" }, RBAC_ON), false);
});

test("assertCan trả về { ok, error } theo pattern domain service", () => {
  const manager = user(ROLES.VENUE_MANAGER, { venueId: "v1" });
  const denied = assertCan(manager, PERMISSIONS.SYSTEM_MANAGE, {}, RBAC_ON);
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "FORBIDDEN");

  const allowed = assertCan(manager, PERMISSIONS.COURTS_MANAGE, { venueId: "v1" }, RBAC_ON);
  assert.equal(allowed.ok, true);
});

test("role permissions map đầy đủ cho SUPER_ADMIN", () => {
  const perms = getPermissionsForRole(ROLES.SUPER_ADMIN);
  assert.ok(perms.length >= Object.keys(PERMISSIONS).length);
  assert.equal(roleHasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.SYSTEM_VENUES_MANAGE), true);
});

test("venue và subscription models", () => {
  const venue = createVenueRecord("Sân ABC", { id: "venue-abc" });
  assert.equal(venue.name, "Sân ABC");
  assert.equal(venue.id, "venue-abc");

  const sub = createSubscriptionRecord("venue-abc", "pro");
  assert.equal(sub.planId, "pro");
  assert.equal(isSubscriptionActive(sub), true);
  assert.equal(planIncludesFeature("pro", "director_mode"), true);
  assert.equal(planIncludesFeature("trial", "director_mode"), false);
});

test("menuAccess — PLAYER chỉ thấy menu giải đấu", () => {
  const player = user(ROLES.PLAYER, {
    venueId: "venue-a",
    clubId: "club-1",
    playerId: "p-1",
  });

  const auth = {
    can: (perm, scope) => can(player, perm, scope, RBAC_ON),
    rbacEnabled: true,
    isAuthenticated: true,
    user: player,
  };

  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, auth, {
    clubId: "club-1",
    venueId: "venue-a",
  });

  const labels = visible.flatMap((g) => g.items.map((i) => i.text));
  assert.ok(labels.includes("Danh sách giải"));
  assert.ok(labels.includes("Hồ sơ cá nhân"));
  assert.equal(labels.includes("Người chơi"), false);
  assert.equal(labels.includes("Cài đặt"), false);
});

test("menuAccess — getDefaultHomePath theo role", () => {
  assert.equal(getDefaultHomePath(user(ROLES.PLAYER), true), "/tournament");
  assert.equal(getDefaultHomePath(user(ROLES.CASHIER), true), "/court-management/bookings");
  assert.equal(getDefaultHomePath(user(ROLES.VENUE_OWNER), true), "/");
});

test("canAccessRoute — PLAYER vào statistics", () => {
  const player = user(ROLES.PLAYER, { clubId: "c1", playerId: "p1" });
  const check = (path) =>
    canAccessRoute(
      (perm, scope) => can(player, perm, scope, RBAC_ON),
      path,
      { clubId: "c1", playerId: "p1" }
    );

  assert.equal(check("/statistics"), true);
  assert.equal(check("/players"), false);
});

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

test("guardClubAction — chặn PLAYER xóa CLB khi RBAC bật", () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(true);
  signInAs(
    user(ROLES.PLAYER, {
      venueId: "venue-a",
      clubId: "default-club",
      playerId: "p-1",
    })
  );

  const denied = guardClubAction("default-club", PERMISSIONS.CLUB_DELETE);
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "FORBIDDEN");

  signOut();
  enableRbac(false);
});

test("createClub — cho phép khi RBAC tắt", () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(false);
  signOut();

  const result = createClub("CLB Test RBAC");
  assert.equal(result.ok, true);
});

test("CASHIER tạo booking được, xóa booking bị chặn", () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  const clubData = getDefaultClubData(DEFAULT_CLUB.id);
  clubData.courts = [
    normalizeCourt({ id: "court-1", name: "Sân 1", number: 1, active: true }),
  ];
  saveClubData(DEFAULT_CLUB.id, clubData);

  enableRbac(true);
  signInAs(
    user(ROLES.CASHIER, {
      venueId: "venue-a",
      clubId: "default-club",
    })
  );

  const created = createBooking(
    {
      courtId: "court-1",
      date: "2026-06-29",
      startTime: "08:00",
      endTime: "09:00",
      customerName: "Khách test",
      bookingType: "walk_in",
      totalAmount: 100000,
      paidAmount: 0,
      depositAmount: 0,
    },
    "default-club"
  );

  assert.equal(created.ok, true);

  const removed = deleteBooking(created.booking.id, "default-club");
  assert.equal(removed.ok, false);
  assert.match(removed.message, /quyền/i);

  signOut();
  enableRbac(false);
});

test("PLAYER không tạo giải đấu khi RBAC bật", () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  saveClubData(DEFAULT_CLUB.id, getDefaultClubData(DEFAULT_CLUB.id));

  enableRbac(true);
  signInAs(
    user(ROLES.PLAYER, {
      venueId: "venue-a",
      clubId: "default-club",
      playerId: "p-1",
    })
  );

  const result = createTournament("default-club", { name: "Giải test" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "FORBIDDEN");

  signOut();
  enableRbac(false);
});

test("venue onboarding — gán CLB vào venue demo", () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  saveClubData(DEFAULT_CLUB.id, getDefaultClubData(DEFAULT_CLUB.id));

  enableRbac(false);
  ensureDemoVenue();

  const result = assignClubToVenue(DEFAULT_CLUB.id, "venue-demo");
  assert.equal(result.ok, true);

  const summary = getVenueSummaryForClub(DEFAULT_CLUB.id);
  assert.equal(summary.venue?.id, "venue-demo");
  assert.equal(summary.subscriptionActive, true);
});

test("directorMode — PLAYER không cập nhật giải qua director", () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  const data = getDefaultClubData(DEFAULT_CLUB.id);
  data.tournaments = [
    {
      id: "t-dir",
      name: "Giải director",
      mode: "daily_play",
      status: "draft",
      clubId: DEFAULT_CLUB.id,
      events: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
  saveClubData(DEFAULT_CLUB.id, data);

  enableRbac(true);
  signInAs(
    user(ROLES.PLAYER, {
      venueId: "venue-demo",
      clubId: "default-club",
      playerId: "p-1",
    })
  );

  const denied = updateTournament(
    DEFAULT_CLUB.id,
    "t-dir",
    { name: "Hack" },
    { directorMode: true }
  );
  assert.equal(denied.ok, false);

  const directorCheck = guardDirectorAction(DEFAULT_CLUB.id);
  assert.equal(directorCheck.ok, false);

  signOut();
  enableRbac(false);
});

test("upgradeSubscription — đổi gói venue", () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(false);
  ensureDemoVenue();

  const result = upgradeSubscription("venue-demo", "pro");
  assert.equal(result.ok, true);
  assert.equal(result.subscription.planId, "pro");
  assert.equal(result.hasDirectorMode, true);

  const basic = upgradeSubscription("venue-demo", "basic");
  assert.equal(basic.ok, true);
  assert.equal(basic.hasDirectorMode, false);
});

test("mapProfileRowToUser — map từ Supabase profiles", () => {
  const mapped = mapProfileRowToUser({
    id: "uuid-1",
    email: "owner@test.com",
    display_name: "Chủ sân",
    role: "VENUE_OWNER",
    venue_id: "venue-demo",
    club_id: null,
    player_id: null,
    status: "active",
  });

  assert.equal(mapped.email, "owner@test.com");
  assert.equal(mapped.role, "VENUE_OWNER");
  assert.equal(mapped.venueId, "venue-demo");
  assert.equal(SUBSCRIPTION_PLANS.pro.features.includes("director_mode"), true);
});

test("subscription — trial không có director_mode", () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(true);
  ensureDemoVenue();
  assignClubToVenue(DEFAULT_CLUB.id, "venue-demo");

  const featureCheck = guardPlanFeature("venue-demo", "director_mode");
  assert.equal(featureCheck.ok, false);
  assert.equal(featureCheck.code, "PLAN_FEATURE_LOCKED");

  enableRbac(false);
});

test("subscription — pro có director_mode sau upgrade", () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  enableRbac(true);
  ensureDemoVenue();
  assignClubToVenue(DEFAULT_CLUB.id, "venue-demo");
  upgradeSubscription("venue-demo", "pro");

  signInAs(
    user(ROLES.VENUE_OWNER, {
      venueId: "venue-demo",
      clubId: "default-club",
    })
  );

  const directorCheck = guardDirectorAction("default-club");
  assert.equal(directorCheck.ok, true);

  signOut();
  enableRbac(false);
});

test("subscription — cloud_sync bị chặn trên gói trial", async () => {
  globalThis.localStorage = createLocalStorageMock();
  setActiveClubId(DEFAULT_CLUB.id);
  saveClubData(DEFAULT_CLUB.id, getDefaultClubData(DEFAULT_CLUB.id));

  enableRbac(true);
  ensureDemoVenue();
  assignClubToVenue(DEFAULT_CLUB.id, "venue-demo");

  signInAs(
    user(ROLES.SUPER_ADMIN, {
      venueId: null,
      clubId: null,
    })
  );

  const blocked = await syncClubToCloud();
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "PLAN_FEATURE_LOCKED");

  upgradeSubscription("venue-demo", "pro");
  const allowed = await syncClubToCloud();
  assert.equal(allowed.ok, true);

  signOut();
  enableRbac(false);
});

test("createClub — VENUE_OWNER tự gán venueId", () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(true);
  ensureDemoVenue();

  signInAs(
    user(ROLES.VENUE_OWNER, {
      venueId: "venue-demo",
    })
  );

  const result = createClub("CLB Venue Owner");
  assert.equal(result.ok, true);
  assert.equal(result.club.venueId, "venue-demo");

  signOut();
  enableRbac(false);
});

test("subscription — maxClubs chặn khi vượt giới hạn trial", () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(true);
  ensureDemoVenue();

  signInAs(user(ROLES.VENUE_OWNER, { venueId: "venue-demo" }));

  const maxClubs = SUBSCRIPTION_PLANS.trial.maxClubs;
  for (let index = 0; index < maxClubs; index += 1) {
    const created = createClub(`CLB ${index}`);
    assert.equal(created.ok, true);
  }

  const blocked = createClub("CLB vượt giới hạn");
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "PLAN_CLUB_LIMIT");

  signOut();
  enableRbac(false);
});

test("staff invite — maxUsers chặn khi đủ quota trial", () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(true);
  ensureDemoVenue();

  signInAs(user(ROLES.VENUE_OWNER, { venueId: "venue-demo" }));

  const maxUsers = SUBSCRIPTION_PLANS.trial.maxUsers;
  for (let index = 0; index < maxUsers; index += 1) {
    const invited = inviteVenueStaff("venue-demo", {
      email: `staff${index}@test.local`,
      displayName: `Staff ${index}`,
      role: ROLES.CASHIER,
    });
    assert.equal(invited.ok, true);
  }

  const blocked = inviteVenueStaff("venue-demo", {
    email: "overflow@test.local",
    role: ROLES.CASHIER,
  });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.code, "PLAN_USER_LIMIT");

  signOut();
  enableRbac(false);
});

test("payment — dev mode nâng cấp gói basic", () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(false);
  ensureDemoVenue();

  const result = requestPlanUpgrade("venue-demo", "basic");
  assert.equal(result.ok, true);
  assert.equal(result.subscription.planId, "basic");
});

test("payment — webhook áp dụng gói pro", () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(false);
  ensureDemoVenue();

  const applied = applyPaymentWebhook({
    venueId: "venue-demo",
    planId: "pro",
    status: "completed",
    provider: "stripe",
  });
  assert.equal(applied.ok, true);
  assert.equal(applied.applied, true);
  assert.equal(applied.subscription.planId, "pro");
});

test("staff — list venue staff", () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(false);
  ensureDemoVenue();

  inviteVenueStaff("venue-demo", {
    email: "cashier@test.local",
    role: ROLES.CASHIER,
  });

  const staff = listVenueStaff("venue-demo");
  assert.equal(staff.length, 1);
  assert.equal(staff[0].email, "cashier@test.local");
});

const SCOPE = { clubId: "club-1", venueId: "venue-a", playerId: "p-1" };

function makeRouteChecker(roleUser) {
  return (path) =>
    canAccessRoute(
      (perm, scope) => can(roleUser, perm, scope, RBAC_ON),
      path,
      SCOPE
    );
}

function makeMenuAuth(roleUser) {
  return {
    can: (perm, scope) => can(roleUser, perm, scope, RBAC_ON),
    rbacEnabled: true,
    isAuthenticated: true,
    user: roleUser,
  };
}

test("permission matrix — mỗi role có ít nhất một permission", () => {
  const roles = [
    ROLES.SUPER_ADMIN,
    ROLES.VENUE_OWNER,
    ROLES.VENUE_MANAGER,
    ROLES.CASHIER,
    ROLES.ACCOUNTANT,
    ROLES.CLUB_OWNER,
    ROLES.PLAYER,
  ];

  for (const role of roles) {
    const perms = getPermissionsForRole(role);
    assert.ok(perms.length > 0, `${role} phải có permissions`);
  }
});

test("route access — SUPER_ADMIN vào mọi route chính", () => {
  const admin = user(ROLES.SUPER_ADMIN);
  const check = makeRouteChecker(admin);

  assert.equal(check("/"), true);
  assert.equal(check("/players"), true);
  assert.equal(check("/court-management"), true);
  assert.equal(check("/select-players"), true);
  assert.equal(check("/club"), true);
  assert.equal(check("/settings"), true);
});

test("route access — VENUE_OWNER venue-a", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const check = makeRouteChecker(owner);

  assert.equal(check("/"), true);
  assert.equal(check("/players"), true);
  assert.equal(check("/court-management"), true);
  assert.equal(check("/select-players"), true);
  assert.equal(check("/settings"), true);
});

test("route access — VENUE_MANAGER venue-a", () => {
  const manager = user(ROLES.VENUE_MANAGER, { venueId: "venue-a", clubId: "club-1" });
  const check = makeRouteChecker(manager);

  assert.equal(check("/"), true);
  assert.equal(check("/players"), true);
  assert.equal(check("/court-management"), true);
  assert.equal(check("/select-players"), true);
});

test("route access — CASHIER chỉ court-management/bookings", () => {
  const cashier = user(ROLES.CASHIER, { venueId: "venue-a" });
  const check = makeRouteChecker(cashier);

  assert.equal(check("/court-management/bookings"), true);
  assert.equal(check("/players"), false);
  assert.equal(check("/select-players"), false);
  assert.equal(check("/club"), false);
});

test("route access — CLUB_OWNER club-1", () => {
  const clubOwner = user(ROLES.CLUB_OWNER, {
    venueId: "venue-a",
    clubId: "club-1",
  });
  const check = makeRouteChecker(clubOwner);

  assert.equal(check("/club"), true);
  assert.equal(check("/tournament"), true);
  assert.equal(check("/select-players"), true);
  assert.equal(check("/court-management/revenue"), false);
});

test("route access — ACCOUNTANT revenue, không players", () => {
  const accountant = user(ROLES.ACCOUNTANT, { venueId: "venue-a" });
  const check = makeRouteChecker(accountant);

  assert.equal(check("/court-management/revenue"), true);
  assert.equal(check("/players"), false);
  assert.equal(check("/select-players"), false);
});

test("menuAccess — VENUE_OWNER thấy Người chơi, Xếp sân", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(owner), SCOPE);
  const labels = visible.flatMap((g) => g.items.map((i) => i.text));

  assert.ok(labels.includes("Người chơi"));
  assert.ok(labels.includes("Xếp sân"));
  assert.ok(labels.includes("Cài đặt"));
});

test("menuAccess — VENUE_MANAGER thấy Xếp sân, không Cài đặt manage-only", () => {
  const manager = user(ROLES.VENUE_MANAGER, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(manager), SCOPE);
  const labels = visible.flatMap((g) => g.items.map((i) => i.text));

  assert.ok(labels.includes("Xếp sân"));
  assert.ok(labels.includes("Người chơi"));
});

test("menuAccess — CASHIER chỉ Live Courts / bookings area", () => {
  const cashier = user(ROLES.CASHIER, { venueId: "venue-a" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(cashier), SCOPE);
  const labels = visible.flatMap((g) => g.items.map((i) => i.text));

  assert.ok(labels.includes("Live Courts"));
  assert.equal(labels.includes("Người chơi"), false);
  assert.equal(labels.includes("Xếp sân"), false);
});

test("menuAccess — CLUB_OWNER thấy CLB & Giải, không Live Courts", () => {
  const clubOwner = user(ROLES.CLUB_OWNER, {
    venueId: "venue-a",
    clubId: "club-1",
  });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(clubOwner), SCOPE);
  const labels = visible.flatMap((g) => g.items.map((i) => i.text));

  assert.ok(labels.includes("CLB & Giải"));
  assert.ok(labels.includes("Danh sách giải"));
  assert.equal(labels.includes("Live Courts"), false);
});

test("menuAccess — RBAC bật, chưa đăng nhập chỉ Cài đặt", () => {
  const visible = filterMenuGroups(
    SIDEBAR_MENU_GROUPS,
    { can: () => false, rbacEnabled: true, isAuthenticated: false, user: null },
    SCOPE
  );
  const labels = visible.flatMap((g) => g.items.map((i) => i.text));

  assert.deepEqual(labels, ["Cài đặt"]);
});
