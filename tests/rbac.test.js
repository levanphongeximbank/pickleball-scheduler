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
  resolvePostAuthRedirectPath,
} from "../src/auth/menuAccess.js";
import { completePickVnOnboarding } from "../src/features/pick-vn-rating/services/pickVnRatingService.js";
import { SIDEBAR_MENU_GROUPS } from "../src/config/sidebarMenu.js";
import {
  listFutureNavItems,
  listComingSoonNavItems,
  collectMenuItemLabels,
  resolveNavRole,
  resolveRoleMenuAccess,
} from "../src/config/navigationConfig.js";
import { filterMobileBottomNav } from "../src/features/mobile/services/mobileNavAccess.js";
import {
  canAccessOperationsDashboard,
  getOperationsDashboardMode,
} from "../src/features/mobile/services/operationsDashboardService.js";
import {
  canEditRoleForUser,
  listRolesForPermissionUi,
} from "../src/features/identity/constants/rolePermissionUiConfig.js";
import { resolveMenuItemPath, resolveRouteAccessScope } from "../src/auth/menuAccess.js";
import { resolveRouteAccessScope as resolveProfileRouteAccessScope } from "../src/features/tenant/services/profileVenueService.js";
import { enableRbac, signInAs, signOut } from "../src/auth/authService.js";
import { createClub } from "../src/domain/clubService.js";
import { guardClubAction, guardClubAccess, guardDirectorAction } from "../src/auth/guardAction.js";
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
import { setActiveClubId, DEFAULT_CLUB, saveClubs } from "../src/data/club.js";
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

test("legacy VENUE_OWNER alias → TENANT_OWNER permissions", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a" });
  assert.equal(owner.role, ROLES.TENANT_OWNER);
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

  const labels = collectMenuItemLabels(visible);
  assert.ok(labels.includes("Danh sách giải"));
  assert.ok(labels.includes("Hồ sơ cá nhân"));
  assert.ok(labels.includes("Điểm trình độ"));
  assert.ok(labels.includes("Đánh giá trình độ lần đầu"));
  assert.equal(labels.includes("CLB & Huấn luyện"), false);
  assert.equal(labels.includes("Vui chơi mỗi ngày"), false);
  assert.equal(labels.includes("Loại giải"), false);
  assert.equal(labels.includes("Điều hành"), false);
  assert.equal(labels.includes("Cấu hình"), false);
  assert.equal(labels.includes("Vận động viên"), false);
  assert.equal(labels.includes("Khách hàng"), false);
  assert.equal(labels.includes("Cài đặt"), false);
  assert.equal(labels.includes("Tạo giải"), false);
});

test("PLAYER không có tournament.create trong ma trận mặc định", () => {
  assert.equal(roleHasPermission(ROLES.PLAYER, PERMISSIONS.TOURNAMENT_CREATE), false);
  assert.equal(roleHasPermission(ROLES.PLAYER, PERMISSIONS.TOURNAMENT_VIEW), true);
});

test("route access — PLAYER bị chặn daily-play và tournament hubs", () => {
  const player = user(ROLES.PLAYER, { venueId: "venue-a", clubId: "club-1", playerId: "p-1" });
  const check = makeRouteChecker(player);

  assert.equal(check("/daily-play"), false);
  assert.equal(check("/tournament/types"), false);
  assert.equal(check("/tournament/types/individual"), false);
  assert.equal(check("/tournament/operations"), false);
  assert.equal(check("/tournament/config"), false);
  assert.equal(check("/tournament/config/format"), false);
  assert.equal(check("/tournament"), true);
});

test("menuAccess — getDefaultHomePath theo role", () => {
  assert.equal(getDefaultHomePath(user(ROLES.PLAYER), true), "/my-club");
  assert.equal(
    getDefaultHomePath(user(ROLES.PLAYER, { clubId: "c1", playerId: "p1" }), true),
    "/tournament"
  );
  assert.equal(getDefaultHomePath(user(ROLES.CASHIER), true), "/court-management/bookings");
  assert.equal(getDefaultHomePath(user(ROLES.VENUE_OWNER), true), "/dashboard");
});

test("menuAccess — resolvePostAuthRedirectPath PLAYER chưa CLB", async () => {
  const store = new Map();
  globalThis.localStorage = {
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

  const onboardingAnswers = {
    gender: "male",
    birth_year: 1992,
    playing_duration: "1_3yr",
    sessions_per_week: "3",
    has_coach: "yes",
    tournament_level: "club_internal",
    best_result: "quarter",
    was_seed: "no",
    prior_sports: ["badminton"],
    prior_sport_level: "club",
    rally_consistency: "pct_80",
    return_stability: "pct_50",
    dink_ability: "10",
    volley_ability: "basic",
    third_shot_drop: "stable",
    reset_ability: "basic",
    play_style: "all_around",
    kitchen_frequency: "often",
    stacking_knowledge: "know",
    nvz_transition: "basic",
    team_coordination: "medium",
    pace_control: "basic",
    doubles_positioning: "none",
    self_rating: "3.5",
  };

  try {
    const player = user(ROLES.PLAYER);
    assert.equal(resolvePostAuthRedirectPath("/tournament", player, true), "/my-club");
    assert.equal(resolvePostAuthRedirectPath("/", player, true), "/my-club");
    assert.equal(resolvePostAuthRedirectPath("/403", player, true), "/my-club");

    const playerWithClub = user(ROLES.PLAYER, { clubId: "c1", id: "rbac-player-club" });
    await completePickVnOnboarding("rbac-player-club", {
      answers: onboardingAnswers,
      clubId: "c1",
    });
    assert.equal(
      resolvePostAuthRedirectPath("/tournament", playerWithClub, true),
      "/tournament"
    );

    const playerNoClub = user(ROLES.PLAYER, { id: "rbac-player-noclub" });
    await completePickVnOnboarding("rbac-player-noclub", {
      answers: onboardingAnswers,
    });
    assert.equal(resolvePostAuthRedirectPath("/", playerNoClub, true), "/my-club");
    assert.equal(
      resolvePostAuthRedirectPath("/tournament", playerNoClub, true),
      "/my-club"
    );
  } finally {
    delete globalThis.localStorage;
  }
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

test("CLUB_MANAGER thiếu clubId — không truy cập CLB và không có quyền CLB scope", () => {
  const chairman = user(ROLES.CLUB_MANAGER, {
    venueId: "venue-prod-main",
    clubId: null,
  });

  assert.equal(canAccessClub(chairman, "default-club", { venueId: "venue-prod-main" }, RBAC_ON), false);
  assert.equal(
    can(chairman, PERMISSIONS.CLUB_UPDATE, { clubId: "default-club", venueId: "venue-prod-main" }, RBAC_ON),
    false
  );

  globalThis.localStorage = createLocalStorageMock();
  const access = guardClubAccess("default-club", { user: chairman, rbacEnabled: true });
  assert.equal(access.ok, false);
  assert.equal(access.code, "CLUB_UNASSIGNED");
});

test("TENANT_OWNER — canAccessClub ưu tiên registry venueId khi tenantId blob lệch", () => {
  globalThis.localStorage = createLocalStorageMock();
  saveClubs([
    {
      id: "club-stale-tenant",
      name: "CLB stale",
      venueId: "venue-prod-main",
      tenantId: "legacy-tenant",
    },
  ]);

  const owner = user(ROLES.TENANT_OWNER, { venueId: "venue-prod-main" });
  assert.equal(canAccessClub(owner, "club-stale-tenant", {}, RBAC_ON), true);
  assert.equal(canAccessClub(owner, "club-stale-tenant", { venueId: "other-venue" }, RBAC_ON), true);
});

test("resolveRouteAccessScope — club-scoped user không fallback activeClubId", () => {
  const chairman = user(ROLES.CLUB_MANAGER, {
    venueId: "venue-prod-main",
    clubId: null,
  });

  const scope = resolveProfileRouteAccessScope({
    user: chairman,
    activeClubId: "default-club",
    activeClub: { id: "default-club", venueId: "venue-prod-main" },
  });

  assert.equal(scope.clubId, null);
  assert.equal(
    can(chairman, PERMISSIONS.CLUB_UPDATE, scope, RBAC_ON),
    false
  );
});

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
  assert.equal(mapped.role, ROLES.TENANT_OWNER);
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
      SCOPE,
      roleUser
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
  const labels = collectMenuItemLabels(visible);

  assert.ok(labels.includes("Vận động viên") || labels.includes("Danh sách VĐV"));
  assert.ok(labels.includes("Đặt sân") || labels.includes("Trạng thái sân"));
  assert.ok(labels.includes("Cài đặt"));
});

test("menuAccess — VENUE_MANAGER thấy VĐV và lịch sân", () => {
  const manager = user(ROLES.VENUE_MANAGER, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(manager), SCOPE);
  const labels = collectMenuItemLabels(visible);

  assert.ok(labels.includes("Vận động viên") || labels.includes("Danh sách VĐV"));
  assert.ok(labels.includes("Lịch sân") || labels.includes("Đặt sân"));
});

test("menuAccess — CASHIER chỉ vận hành sân / đặt sân", () => {
  const cashier = user(ROLES.CASHIER, { venueId: "venue-a" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(cashier), SCOPE);
  const labels = collectMenuItemLabels(visible);

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
  const labels = collectMenuItemLabels(visible);

  assert.ok(labels.includes("Lịch sinh hoạt"));
  assert.ok(labels.includes("Danh sách CLB"));
  assert.ok(labels.includes("Danh sách giải"));
  assert.ok(labels.includes("Loại giải"));
  assert.equal(labels.includes("Trạng thái sân"), false);
});

test("menuAccess — RBAC bật, chưa đăng nhập chỉ Cài đặt", () => {
  const visible = filterMenuGroups(
    SIDEBAR_MENU_GROUPS,
    { can: () => false, rbacEnabled: true, isAuthenticated: false, user: null },
    SCOPE
  );
  const labels = collectMenuItemLabels(visible);

  assert.deepEqual(labels, ["Cài đặt"]);
});

test("menuAccess — RC1 không render mục future (ẩn hoàn toàn)", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(owner), SCOPE);
  const labels = collectMenuItemLabels(visible);
  const futureLabels = listFutureNavItems().map((item) => item.label);

  for (const label of futureLabels) {
    assert.equal(labels.includes(label), false, `future item "${label}" không được render`);
  }
});

test("menuAccess — owner coming-soon (nếu còn mục planned)", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(owner), SCOPE);
  const labels = collectMenuItemLabels(visible);
  const comingSoonLabels = listComingSoonNavItems().map((item) => item.label);

  if (comingSoonLabels.length === 0) {
    assert.ok(true, "không còn mục planned trên sidebar — gate 100%");
    return;
  }

  const visibleComingSoon = comingSoonLabels.filter((label) => labels.includes(label));
  assert.ok(visibleComingSoon.length > 0, "owner phải thấy ít nhất một mục coming-soon");
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
  const labels = collectMenuItemLabels(visible);

  assert.ok(labels.includes("Tổng quan"));
  assert.ok(labels.includes("Lịch sân") || labels.includes("Đặt sân"));
});

test("menuAccess — VENUE_OWNER không còn Trang của tôi trên sidebar (dùng Account menu)", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(owner), SCOPE);
  const labels = collectMenuItemLabels(visible);

  assert.equal(labels.includes("Trang của tôi"), false);
  assert.ok(labels.includes("Hồ sơ của tôi"));
});

test("menuAccess — không còn label USERS trong sidebar", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(owner), SCOPE);
  const labels = collectMenuItemLabels(visible);

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

test("mobile nav — PLAYER tab QR trỏ về trang cá nhân, không /mobile/check-in", () => {
  const player = user(ROLES.PLAYER, { venueId: "venue-a", clubId: "club-1", playerId: "p-1" });
  const items = filterMobileBottomNav(makeMenuAuth(player), SCOPE);
  const qr = items.find((item) => item.label === "QR");

  assert.ok(qr);
  assert.equal(qr.path, "/mobile/player?tab=qr");
  assert.ok(!items.some((item) => item.path === "/mobile/check-in"));
});

const OWNER_V5_GROUPS = [
  "Tổng quan",
  "Vận hành sân",
  "Khách hàng & VĐV",
  "CLB & Huấn luyện",
  "Giải đấu",
  "Tài chính",
  "Báo cáo",
  "Chăm sóc khách hàng",
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

test("menuAccess — lowercase owner alias map TENANT_OWNER và thấy đủ nhóm V5", () => {
  const owner = createUserRecord({
    role: "owner",
    venueId: "venue-staging-a",
    clubId: "club-1",
  });

  assert.equal(owner.role, ROLES.TENANT_OWNER);
  assert.equal(resolveNavRole("owner"), ROLES.TENANT_OWNER);
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

test("Phase 19B — STAFF blocked from court-engine", () => {
  const staff = user(ROLES.STAFF, { venueId: "venue-a", clubId: "club-1" });
  const scope = { venueId: "venue-a", clubId: "club-1" };
  const check = (path) =>
    canAccessRoute((perm, s) => can(staff, perm, s, RBAC_ON), path, scope);

  assert.equal(check("/court-engine"), false);
  assert.equal(check("/court-management/courts"), true);
});

test("Phase 19B — CASHIER cannot delete courts via permission matrix", () => {
  const cashier = user(ROLES.CASHIER, { venueId: "venue-a", clubId: "club-1" });
  const scope = { venueId: "venue-a", clubId: "club-1" };

  assert.equal(can(cashier, PERMISSIONS.COURT_VIEW, scope, RBAC_ON), true);
  assert.equal(can(cashier, PERMISSIONS.COURT_DELETE, scope, RBAC_ON), false);
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
  assert.equal(check("/manage/clubs"), true);
  assert.equal(check("/daily-play"), true);
  assert.equal(getDefaultHomePath(clubOwner, true), "/club");
});

test("Phase 19B — CLUB_OWNER thiếu clubId không bootstrap từ activeClub", () => {
  const clubOwner = user(ROLES.CLUB_OWNER, { venueId: "venue-a" });
  const scope = resolveProfileRouteAccessScope({
    user: clubOwner,
    activeClubId: "club-bootstrap",
    activeClub: { id: "club-bootstrap", venueId: "venue-a" },
  });

  assert.equal(scope.clubId, null);
  assert.equal(
    can(clubOwner, PERMISSIONS.CLUB_VIEW, scope, RBAC_ON),
    false
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
  const labels = collectMenuItemLabels(visible);

  assert.ok(labels.includes("Đặt sân") || labels.includes("Trạng thái sân"));
  assert.equal(labels.includes("Người dùng"), false);
});

test("Phase 19B — venue/court labels trong navigation config", () => {
  const owner = user(ROLES.COURT_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(owner), SCOPE);
  const groupLabels = visible.map((group) => group.label);
  const labels = collectMenuItemLabels(visible);

  assert.ok(groupLabels.includes("Vận hành sân"));
  assert.ok(labels.includes("Sân"));
});

test("Phase 19B — PLAYER không thấy admin routes", () => {
  const player = user(ROLES.PLAYER, { venueId: "venue-a", clubId: "club-1", playerId: "p-1" });
  const check = makeRouteChecker(player);

  assert.equal(check("/admin/tenants"), false);
  assert.equal(check("/users"), false);
  assert.equal(check("/audit"), false);
});

test("menuAccess — VENUE_OWNER thấy nhóm profile desktop", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const visible = filterMenuGroups(SIDEBAR_MENU_GROUPS, makeMenuAuth(owner), SCOPE);
  const groupIds = visible.map((group) => group.id);
  const labels = collectMenuItemLabels(visible);

  assert.ok(groupIds.includes("profile"));
  assert.ok(labels.includes("Hồ sơ của tôi"));
});

test("TENANT_OWNER — tenant.role.customize mở /admin/roles, chặn /admin/tenants", () => {
  const owner = user(ROLES.VENUE_OWNER, { venueId: "venue-a", clubId: "club-1" });
  const scope = { venueId: "venue-a", clubId: "club-1", tenantId: "venue-a" };
  const check = (path) =>
    canAccessRoute((perm, s) => can(owner, perm, s, RBAC_ON), path, scope);

  assert.equal(owner.role, ROLES.TENANT_OWNER);
  assert.equal(roleHasPermission(ROLES.TENANT_OWNER, PERMISSIONS.TENANT_ROLE_CUSTOMIZE), true);
  assert.equal(check("/admin/roles"), true);
  assert.equal(check("/admin/tenants"), false);
});

test("TENANT_OWNER — canEditRoleForUser với profile VENUE_OWNER legacy", () => {
  assert.equal(canEditRoleForUser(ROLES.VENUE_OWNER, ROLES.VENUE_MANAGER), true);
  assert.equal(canEditRoleForUser(ROLES.VENUE_OWNER, ROLES.PLATFORM_ADMIN), false);
  assert.equal(canEditRoleForUser(ROLES.VENUE_OWNER, ROLES.TENANT_OWNER), false);

  const tenantRoles = listRolesForPermissionUi(ROLES.VENUE_OWNER);
  assert.ok(tenantRoles.includes(ROLES.VENUE_MANAGER));
  assert.ok(!tenantRoles.includes(ROLES.PLATFORM_ADMIN));
});

test("TENANT_OWNER — operations dashboard mode owner sau normalize", () => {
  const owner = user(ROLES.COURT_OWNER, { venueId: "v1" });
  assert.equal(owner.role, ROLES.TENANT_OWNER);
  assert.equal(getOperationsDashboardMode(owner), "owner");
  assert.equal(canAccessOperationsDashboard(owner, { clubId: "c1", tenantId: "v1" }), true);
});
