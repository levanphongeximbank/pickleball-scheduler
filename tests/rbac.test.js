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
  normalizePlanId,
} from "../src/models/subscription.js";
import {
  canAccessRoute,
  filterMenuGroups,
  getDefaultHomePath,
} from "../src/auth/menuAccess.js";
import { SIDEBAR_MENU_GROUPS } from "../src/config/sidebarMenu.js";
import {
  listFutureNavItems,
  listComingSoonNavItems,
  resolveNavRole,
  resolveRoleMenuAccess,
} from "../src/config/navigationConfig.js";
import { filterMobileBottomNav } from "../src/features/mobile/services/mobileNavAccess.js";
import { resolveMenuItemPath, resolveRouteAccessScope } from "../src/auth/menuAccess.js";
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
  assert.equal(can(null, PERMISSIONS.SYSTEM_SETTING, {}, { rbacEnabled: false }), true);
});

test("SUPER_ADMIN có toàn quyền khi RBAC bật", () => {
  const admin = user(ROLES.SUPER_ADMIN);
  assert.equal(can(admin, PERMISSIONS.SYSTEM_SETTING, {}, RBAC_ON), true);
  assert.equal(can(admin, PERMISSIONS.CLUB_DELETE, { clubId: "any" }, RBAC_ON), true);
  assert.equal(canAccessVenue(admin, "venue-x", RBAC_ON), true);
});

test("VENUE_OWNER chỉ truy cập venue của mình", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a" });

  assert.equal(can(owner, PERMISSIONS.VENUE_UPDATE, { venueId: "venue-a" }, RBAC_ON), true);
  assert.equal(can(owner, PERMISSIONS.VENUE_UPDATE, { venueId: "venue-b" }, RBAC_ON), false);
  assert.equal(can(owner, PERMISSIONS.SYSTEM_SETTING, {}, RBAC_ON), false);
  assert.equal(canAccessVenue(owner, "venue-a", RBAC_ON), true);
  assert.equal(canAccessVenue(owner, "venue-b", RBAC_ON), false);
});

test("CLUB_OWNER chỉ quản lý CLB được gán", () => {
  const clubOwner = user(ROLES.CLUB_OWNER, {
    venueId: "venue-a",
    clubId: "club-1",
  });

  assert.equal(can(clubOwner, PERMISSIONS.PLAYER_UPDATE, { clubId: "club-1", venueId: "venue-a" }, RBAC_ON), true);
  assert.equal(can(clubOwner, PERMISSIONS.PLAYER_UPDATE, { clubId: "club-2" }, RBAC_ON), false);
  assert.equal(can(clubOwner, PERMISSIONS.COURT_UPDATE, { venueId: "venue-a" }, RBAC_ON), false);
  assert.equal(canAccessClub(clubOwner, "club-1", { venueId: "venue-a" }, RBAC_ON), true);
  assert.equal(canAccessClub(clubOwner, "club-2", { venueId: "venue-a" }, RBAC_ON), false);
});

test("PLAYER chỉ xem lịch / đăng ký / kết quả / hồ sơ", () => {
  const player = user(ROLES.PLAYER, {
    venueId: "venue-a",
    clubId: "club-1",
    playerId: "p-1",
  });

  assert.equal(can(player, PERMISSIONS.TOURNAMENT_VIEW, { clubId: "club-1", playerId: "p-1" }, RBAC_ON), true);
  assert.equal(can(player, PERMISSIONS.PLAYER_UPDATE, { clubId: "club-1", playerId: "p-1" }, RBAC_ON), true);
  assert.equal(can(player, PERMISSIONS.PLAYER_UPDATE, { clubId: "club-1" }, RBAC_ON), false);
  assert.equal(can(player, PERMISSIONS.CLUB_UPDATE, { clubId: "club-1" }, RBAC_ON), false);
  assert.equal(can(player, PERMISSIONS.PLAYER_VIEW, { clubId: "club-1", playerId: "p-2" }, RBAC_ON), false);
});

test("CASHIER và ACCOUNTANT có quyền phù hợp", () => {
  const cashier = user(ROLES.CASHIER, { venueId: "venue-a" });
  const accountant = user(ROLES.ACCOUNTANT, { venueId: "venue-a" });

  assert.equal(can(cashier, PERMISSIONS.FINANCE_EDIT, { venueId: "venue-a" }, RBAC_ON), true);
  assert.equal(can(cashier, PERMISSIONS.STATISTICS_EXPORT, { venueId: "venue-a" }, RBAC_ON), false);
  assert.equal(can(accountant, PERMISSIONS.FINANCE_EDIT, { venueId: "venue-a" }, RBAC_ON), true);
  assert.equal(can(accountant, PERMISSIONS.BOOKING_CREATE, { venueId: "venue-a" }, RBAC_ON), false);
});

test("assertCan trả về { ok, error } theo pattern domain service", () => {
  const manager = user(ROLES.VENUE_MANAGER, { venueId: "v1" });
  const denied = assertCan(manager, PERMISSIONS.SYSTEM_SETTING, {}, RBAC_ON);
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "FORBIDDEN");

  const allowed = assertCan(manager, PERMISSIONS.COURT_UPDATE, { venueId: "v1" }, RBAC_ON);
  assert.equal(allowed.ok, true);
});

test("REFEREE — xem giải và cập nhật điểm trong venue", () => {
  const referee = user(ROLES.REFEREE, { venueId: "venue-a", clubId: "club-1" });

  assert.equal(can(referee, PERMISSIONS.TOURNAMENT_VIEW, { venueId: "venue-a" }, RBAC_ON), true);
  assert.equal(can(referee, PERMISSIONS.MATCH_UPDATE, { venueId: "venue-a", clubId: "club-1" }, RBAC_ON), true);
  assert.equal(can(referee, PERMISSIONS.TOURNAMENT_UPDATE, { clubId: "club-1" }, RBAC_ON), false);
  assert.equal(can(referee, PERMISSIONS.PLAYER_UPDATE, { clubId: "club-1" }, RBAC_ON), false);
});

test("legacy VENUE_OWNER alias → COURT_OWNER permissions", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a" });
  assert.equal(owner.role, ROLES.COURT_OWNER);
  assert.equal(can(owner, PERMISSIONS.VENUE_UPDATE, { venueId: "venue-a" }, RBAC_ON), true);
});

test("role permissions map đầy đủ cho SUPER_ADMIN", () => {
  const perms = getPermissionsForRole(ROLES.SUPER_ADMIN);
  assert.ok(perms.length >= Object.keys(PERMISSIONS).length);
  assert.equal(roleHasPermission(ROLES.SUPER_ADMIN, PERMISSIONS.VENUE_UPDATE), true);
});

test("venue và subscription models", () => {
  const venue = createVenueRecord("Sân ABC", { id: "venue-abc" });
  assert.equal(venue.name, "Sân ABC");
  assert.equal(venue.id, "venue-abc");

  const sub = createSubscriptionRecord("venue-abc", "professional");
  assert.equal(sub.planId, "professional");
  assert.equal(isSubscriptionActive(sub), true);
  assert.equal(planIncludesFeature("professional", "director_mode"), true);
  assert.equal(planIncludesFeature("trial", "director_mode"), false);
  assert.equal(normalizePlanId("pro"), "professional");
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
    playerId: "p-1",
  });

  const labels = visible.flatMap((g) => g.items.map((i) => i.text));
  assert.ok(labels.includes("Danh sách giải"));
  assert.ok(labels.includes("Giải nội bộ CLB"));
  assert.ok(labels.includes("Hồ sơ cá nhân"));
  assert.equal(labels.includes("Vận động viên"), false);
  assert.equal(labels.includes("Danh sách VĐV"), false);
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

  enableRbac(false);
  ensureDemoVenue();
  assignClubToVenue(DEFAULT_CLUB.id, "venue-demo");

  enableRbac(true);
  signInAs(
    user(ROLES.CASHIER, {
      venueId: "venue-demo",
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

  const result = upgradeSubscription("venue-demo", "professional");
  assert.equal(result.ok, true);
  assert.equal(result.subscription.planId, "professional");
  assert.equal(result.hasDirectorMode, true);

  const starter = upgradeSubscription("venue-demo", "starter");
  assert.equal(starter.ok, true);
  assert.equal(starter.hasDirectorMode, false);
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
  assert.equal(mapped.role, ROLES.COURT_OWNER);
  assert.equal(mapped.venueId, "venue-demo");
  assert.equal(SUBSCRIPTION_PLANS.professional.features.includes("director_mode"), true);
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
  upgradeSubscription("venue-demo", "professional");

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

  upgradeSubscription("venue-demo", "professional");
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

test("payment — dev mode nâng cấp gói starter", () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(false);
  ensureDemoVenue();

  const result = requestPlanUpgrade("venue-demo", "starter");
  assert.equal(result.ok, true);
  assert.equal(result.subscription.planId, "starter");
});

test("payment — webhook áp dụng gói professional", () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(false);
  ensureDemoVenue();

  const applied = applyPaymentWebhook({
    venueId: "venue-demo",
    planId: "professional",
    status: "completed",
    provider: "stripe",
  });
  assert.equal(applied.ok, true);
  assert.equal(applied.applied, true);
  assert.equal(applied.subscription.planId, "professional");
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

test("menuAccess — VENUE_OWNER thấy VĐV và vận hành sân", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(owner), SCOPE);
  const labels = visible.flatMap((g) => g.items.map((i) => i.text));

  assert.ok(labels.includes("Vận động viên") || labels.includes("Danh sách VĐV"));
  assert.ok(labels.includes("Đặt sân") || labels.includes("Trạng thái sân"));
  assert.ok(labels.includes("Cài đặt"));
});

test("menuAccess — VENUE_MANAGER thấy VĐV và lịch sân", () => {
  const manager = user(ROLES.VENUE_MANAGER, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(manager), SCOPE);
  const labels = visible.flatMap((g) => g.items.map((i) => i.text));

  assert.ok(labels.includes("Vận động viên") || labels.includes("Danh sách VĐV"));
  assert.ok(labels.includes("Lịch sân") || labels.includes("Đặt sân"));
});

test("menuAccess — CASHIER chỉ vận hành sân / đặt sân", () => {
  const cashier = user(ROLES.CASHIER, { venueId: "venue-a" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(cashier), SCOPE);
  const labels = visible.flatMap((g) => g.items.map((i) => i.text));

  assert.ok(labels.includes("Đặt sân") || labels.includes("Trạng thái sân"));
  assert.equal(labels.includes("Vận động viên"), false);
  assert.equal(labels.includes("Danh sách VĐV"), false);
  assert.equal(labels.includes("Danh sách chờ"), false);
});

test("menuAccess — CLUB_OWNER thấy CLB & Giải, không Live Courts", () => {
  const clubOwner = user(ROLES.CLUB_OWNER, {
    venueId: "venue-a",
    clubId: "club-1",
  });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(clubOwner), SCOPE);
  const labels = visible.flatMap((g) => g.items.map((i) => i.text));

  assert.ok(labels.includes("Lịch sinh hoạt") || labels.includes("Danh sách CLB"));
  assert.ok(labels.includes("Danh sách giải"));
  assert.ok(labels.includes("Giải nội bộ CLB"));
  assert.equal(labels.includes("Trạng thái sân"), false);
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

test("menuAccess — RC1 không render mục future (ẩn hoàn toàn)", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(owner), SCOPE);
  const labels = visible.flatMap((g) => g.items.map((i) => i.text));
  const futureLabels = listFutureNavItems().map((item) => item.label);

  for (const label of futureLabels) {
    assert.equal(labels.includes(label), false, `future item "${label}" không được render`);
  }
});

test("menuAccess — owner thấy mục coming-soon với route placeholder", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(owner), SCOPE);
  const labels = visible.flatMap((g) => g.items.map((i) => i.text));
  const comingSoonLabels = listComingSoonNavItems().map((item) => item.label);

  assert.ok(comingSoonLabels.length > 0);
  for (const label of comingSoonLabels) {
    if (label === "Cảnh báo bất hợp lý") continue;
    assert.ok(labels.includes(label), `coming-soon item "${label}" phải hiển thị`);
  }
});

test("menuAccess — VENUE_OWNER legacy DB vẫn thấy menu đầy đủ", () => {
  const legacyOwner = {
    id: "u-legacy",
    role: ROLES.VENUE_OWNER,
    venueId: "venue-a",
    clubId: "club-1",
    status: "active",
  };
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(legacyOwner), SCOPE);
  const labels = visible.flatMap((g) => g.items.map((i) => i.text));

  assert.ok(labels.includes("Tổng quan"));
  assert.ok(labels.includes("Lịch sân") || labels.includes("Đặt sân"));
});

test("menuAccess — VENUE_OWNER thấy Trang của tôi", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(owner), SCOPE);
  const labels = visible.flatMap((g) => g.items.map((i) => i.text));

  assert.ok(labels.includes("Trang của tôi"));
});

test("menuAccess — không còn label USERS trong sidebar", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(owner), SCOPE);
  const labels = visible.flatMap((g) => [g.label, ...g.items.map((i) => i.text)]);

  assert.equal(labels.some((label) => String(label).toUpperCase() === "USERS"), false);
  assert.ok(labels.includes("Người dùng"));
});

test("menuAccess — owner RC1 không thấy nhóm Trợ lý AI khi flag tắt", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(owner), SCOPE);
  const groupLabels = visible.map((g) => g.label);

  assert.equal(groupLabels.includes("Trợ lý AI"), false);
  assert.equal(groupLabels.includes("AI Assistant"), false);
  assert.equal(groupLabels.some((label) => /AI Director Platform/i.test(label)), false);
});

test("route access — VENUE_OWNER vào mọi path menu RC1 visible", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const check = makeRouteChecker(owner);
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(owner), SCOPE);

  for (const group of visible) {
    for (const item of group.items) {
      const path = resolveMenuItemPath(item, owner);
      if (!path || path.includes("?")) continue;
      assert.equal(check(path.split("?")[0]), true, `owner phải vào được ${path}`);
    }
  }
});

test("mobile nav — PLAYER thấy Trang của tôi", () => {
  const player = user(ROLES.PLAYER, { venueId: "venue-a", clubId: "club-1", playerId: "p-1" });
  const items = filterMobileBottomNav(makeMenuAuth(player), SCOPE);
  const labels = items.map((item) => item.label);

  assert.ok(labels.includes("Trang của tôi"));
});

const OWNER_V5_GROUPS = [
  "Tổng quan",
  "Vận hành cụm sân",
  "Khách hàng & VĐV",
  "CLB",
  "Giải đấu",
  "Tài chính",
  "Báo cáo",
  "Quản trị",
  "Hỗ trợ",
];

function assertOwnerSidebarGroups(visible, contextLabel) {
  const groupLabels = visible.map((group) => group.label);
  assert.notDeepEqual(
    groupLabels,
    ["Hỗ trợ"],
    `${contextLabel}: sidebar không được chỉ còn Hỗ trợ`
  );
  for (const label of OWNER_V5_GROUPS) {
    assert.ok(groupLabels.includes(label), `${contextLabel}: thiếu nhóm ${label}`);
  }
}

test("menuAccess — owner thấy đủ nhóm V5 khi CLB local có venueId lệch profile", () => {
  const owner = user(ROLES.VENUE_OWNER, {
    venueId: "venue-staging-a",
    clubId: "club-1",
  });
  const staleClub = {
    id: "default-club",
    venueId: "venue-demo-stale",
    tenantId: "venue-demo-stale",
  };
  const scope = resolveRouteAccessScope({
    user: owner,
    activeClubId: staleClub.id,
    activeClub: staleClub,
  });

  assert.equal(scope.venueId, "venue-staging-a");

  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(owner), scope);
  assertOwnerSidebarGroups(visible, "stale club venue");
});

test("menuAccess — lowercase owner alias map COURT_OWNER và thấy đủ nhóm V5", () => {
  const owner = createUserRecord({
    role: "owner",
    venueId: "venue-staging-a",
    clubId: "club-1",
  });

  assert.equal(owner.role, ROLES.COURT_OWNER);
  assert.equal(resolveNavRole("owner"), ROLES.COURT_OWNER);
  assert.ok(resolveRoleMenuAccess("owner").includes("dashboard"));

  const scope = resolveRouteAccessScope({
    user: owner,
    activeClubId: "club-1",
    activeClub: { id: "club-1", venueId: "venue-demo-stale" },
  });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(owner), scope);
  assertOwnerSidebarGroups(visible, "lowercase owner");
});

test("menuAccess — PLAYER/REFEREE không thấy menu admin owner", () => {
  const player = user(ROLES.PLAYER, { venueId: "venue-a", clubId: "club-1", playerId: "p-1" });
  const referee = user(ROLES.REFEREE, { venueId: "venue-a", clubId: "club-1" });

  const playerGroups = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(player), SCOPE).map(
    (group) => group.label
  );
  const refereeGroups = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(referee), SCOPE).map(
    (group) => group.label
  );

  assert.equal(playerGroups.includes("Quản trị"), false);
  assert.equal(playerGroups.includes("Tài chính"), false);
  assert.equal(refereeGroups.includes("Quản trị"), false);
  assert.equal(refereeGroups.includes("Tài chính"), false);
});

test("Phase 19B — SUPER_ADMIN route access platform/admin paths", () => {
  const admin = user(ROLES.SUPER_ADMIN);
  const check = makeRouteChecker(admin);

  assert.equal(check("/admin/tenants"), true);
  assert.equal(check("/admin/billing"), true);
  assert.equal(check("/tournament"), true);
  assert.equal(check("/court-engine"), true);
  assert.equal(check("/audit"), true);
});

test("Phase 19B — COURT_OWNER venue-scoped dashboard, billing, court-engine, tournament", () => {
  const owner = user(ROLES.COURT_OWNER, { venueId: "venue-prod-main", clubId: "club-1" });
  const scope = { venueId: "venue-prod-main", clubId: "club-1" };
  const check = (path) =>
    canAccessRoute((perm, s) => can(owner, perm, s, RBAC_ON), path, scope);

  assert.equal(check("/"), true);
  assert.equal(check("/billing"), true);
  assert.equal(check("/court-engine"), true);
  assert.equal(check("/tournament"), true);
  assert.equal(check("/court-management/courts"), true);
});

test("Phase 19B — COURT_OWNER không truy cập venue khác", () => {
  const owner = user(ROLES.COURT_OWNER, { venueId: "venue-prod-main", clubId: "club-1" });
  assert.equal(can(owner, PERMISSIONS.VENUE_UPDATE, { venueId: "venue-other" }, RBAC_ON), false);
  assert.equal(canAccessVenue(owner, "venue-other", RBAC_ON), false);
});

test("Phase 19B — CLUB_OWNER vào /club không 403", () => {
  const clubOwner = user(ROLES.CLUB_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const scope = { clubId: "club-1", venueId: "venue-a" };
  const check = (path) =>
    canAccessRoute((perm, s) => can(clubOwner, perm, s, RBAC_ON), path, scope);

  assert.equal(check("/club"), true);
  assert.equal(check("/clubs"), true);
  assert.equal(check("/daily-play"), true);
  assert.equal(getDefaultHomePath(clubOwner, true), "/club");
});

test("Phase 19B — CLUB_OWNER bootstrap clubId từ activeClub", () => {
  const clubOwner = user(ROLES.CLUB_OWNER, { venueId: "venue-a" });
  const scope = resolveRouteAccessScope({
    user: clubOwner,
    activeClubId: "club-bootstrap",
    activeClub: { id: "club-bootstrap", venueId: "venue-a" },
  });

  assert.equal(scope.clubId, "club-bootstrap");
  assert.equal(
    can(clubOwner, PERMISSIONS.CLUB_VIEW, scope, RBAC_ON),
    true
  );
});

test("Phase 19B — REFEREE menu tối giản", () => {
  const referee = user(ROLES.REFEREE, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(referee), SCOPE);
  const groupLabels = visible.map((group) => group.label);
  const itemLabels = visible.flatMap((group) => group.items.map((item) => item.text));

  assert.equal(groupLabels.includes("Giải đấu"), false);
  assert.equal(groupLabels.includes("Vận hành cụm sân"), false);
  assert.equal(groupLabels.includes("Tài chính"), false);
  assert.equal(groupLabels.includes("CLB"), false);
  assert.ok(groupLabels.includes("Trọng tài"));
  assert.ok(itemLabels.includes("Chấm trận"));
  assert.ok(itemLabels.includes("Quét QR"));
});

test("Phase 19B — CASHIER menu vẫn pass", () => {
  const cashier = user(ROLES.CASHIER, { venueId: "venue-a" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(cashier), SCOPE);
  const labels = visible.flatMap((group) => group.items.map((item) => item.text));

  assert.ok(labels.includes("Đặt sân") || labels.includes("Trạng thái sân"));
  assert.equal(labels.includes("Người dùng"), false);
});

test("Phase 19B — venue/court labels trong navigation config", () => {
  const owner = user(ROLES.COURT_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(owner), SCOPE);
  const groupLabels = visible.map((group) => group.label);
  const itemLabels = visible.flatMap((group) => group.items.map((item) => item.text));

  assert.ok(groupLabels.includes("Vận hành cụm sân"));
  assert.ok(itemLabels.includes("Sân thi đấu"));
});

test("Phase 19B — PLAYER không thấy admin routes", () => {
  const player = user(ROLES.PLAYER, { venueId: "venue-a", clubId: "club-1", playerId: "p-1" });
  const check = makeRouteChecker(player);

  assert.equal(check("/admin/tenants"), false);
  assert.equal(check("/users"), false);
  assert.equal(check("/audit"), false);
});
