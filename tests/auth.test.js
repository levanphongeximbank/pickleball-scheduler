import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

import { ROLES } from "../src/auth/roles.js";
import {
  buildUserSecurityScopeKey,
  buildClubRehydrateScopeKey,
  areAuthStatesSemanticallyEqual,
  selectStableAuthState,
  shouldRehydrateClubScope,
} from "../src/auth/authSemanticScope.js";
import { formatAuthError } from "../src/auth/authErrors.js";
import {
  isAuthRequired,
  isPublicAuthPath,
  shouldRedirectToLogin,
  shouldBlockRouteForAuthLoading,
} from "../src/auth/authGuard.js";
import {
  enableRbac,
  getAuthState,
  getCurrentUser,
  signInAs,
  signInDev,
  signOut,
  listDevUsers,
  isDevAuthAllowed,
  isAuthProductionEnabled,
} from "../src/auth/authService.js";
import { getSupabaseConfigError, hasSupabaseConfig, getSupabaseAnonKeyPrefix, isValidSupabaseAnonKey } from "../src/auth/supabaseClient.js";
import {
  mapProfileRowToUser,
  mapUserToProfileRow,
  resolveAuthUserFromProfile,
  PROFILE_FIELD_MAP,
} from "../src/auth/profileService.js";
import { createUserRecord } from "../src/models/user.js";

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

test("formatAuthError — map lỗi Supabase sang tiếng Việt", () => {
  assert.equal(
    formatAuthError("Invalid login credentials"),
    "Email hoặc mật khẩu không đúng."
  );
  assert.match(formatAuthError("", "AUTH_FAILED"), /email/i);
});

test("getSupabaseConfigError — trả thông báo rõ khi thiếu env", () => {
  const error = getSupabaseConfigError();
  assert.ok(error === null || typeof error === "string");
  if (error) {
    assert.match(error, /Supabase/i);
  }
});

test("isValidSupabaseAnonKey — chấp nhận JWT và publishable key", () => {
  assert.equal(isValidSupabaseAnonKey("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test"), true);
  assert.equal(isValidSupabaseAnonKey("sb_publishable_abc123"), true);
  assert.equal(isValidSupabaseAnonKey(""), false);
  assert.equal(getSupabaseAnonKeyPrefix("sb_publishable_x"), "sb_publishable");
  assert.equal(getSupabaseAnonKeyPrefix("eyJabc"), "eyJ");
});

test("authGuard — auth production bắt login, dev RBAC cho /settings", () => {
  assert.equal(isAuthRequired({ authProductionEnabled: true, rbacEnabled: false }), true);
  assert.equal(isAuthRequired({ authProductionEnabled: false, rbacEnabled: false }), false);

  assert.equal(
    isPublicAuthPath("/settings", { authProductionEnabled: true, rbacEnabled: false }),
    false
  );
  assert.equal(
    isPublicAuthPath("/settings", { authProductionEnabled: false, rbacEnabled: true }),
    true
  );
  assert.equal(
    isPublicAuthPath("/login", { authProductionEnabled: true, rbacEnabled: false }),
    true
  );

  assert.equal(
    shouldRedirectToLogin("/", {
      authProductionEnabled: true,
      rbacEnabled: false,
      isAuthenticated: false,
    }),
    true
  );
  assert.equal(
    shouldRedirectToLogin("/login", {
      authProductionEnabled: true,
      rbacEnabled: false,
      isAuthenticated: false,
    }),
    false
  );
});

test("signInDev / signOut / getCurrentUser — dev fallback", () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(false);
  signOut();

  assert.equal(isDevAuthAllowed(), !hasSupabaseConfig());

  if (!isDevAuthAllowed()) {
    const blocked = signInDev("owner@venue.local");
    assert.equal(blocked.ok, false);
    return;
  }

  const denied = signInDev("unknown@test.local");
  assert.equal(denied.ok, false);

  const result = signInDev("owner@venue.local");
  assert.equal(result.ok, true);
  assert.equal(result.user.role, ROLES.TENANT_OWNER);

  const current = getCurrentUser();
  assert.equal(current.email, "owner@venue.local");

  const state = getAuthState();
  assert.equal(state.isAuthenticated, true);
  assert.equal(state.authProvider, "dev");

  signOut();
  assert.equal(getCurrentUser(), null);
});

test("listDevUsers — trả registry dev khi không có Supabase env", () => {
  if (isAuthProductionEnabled()) {
    assert.equal(listDevUsers().length, 0);
    return;
  }

  const users = listDevUsers();
  assert.ok(users.length >= 5);
  assert.ok(users.some((u) => u.email === "admin@pickleball.local"));
});

test("mapProfileRowToUser / mapUserToProfileRow — mapping profiles", () => {
  const row = {
    id: "uuid-1",
    email: "player@test.vn",
    display_name: "VĐV A",
    role: "PLAYER",
    venue_id: "venue-1",
    club_id: "club-1",
    status: "active",
  };

  const user = mapProfileRowToUser(row);
  assert.equal(user.id, "uuid-1");
  assert.equal(user.displayName, "VĐV A");
  assert.equal(user.venueId, "venue-1");
  assert.equal(user.clubId, "club-1");
  assert.equal(user.status, "active");

  const back = mapUserToProfileRow(user);
  assert.equal(back.id, row.id);
  assert.equal(back.display_name, row.display_name);
  assert.equal(back.venue_id, row.venue_id);
  assert.equal(PROFILE_FIELD_MAP.userId, "id");
});

test("resolveAuthUserFromProfile — RBAC bật, thiếu profile → từ chối", () => {
  const authUser = { id: "uuid-x", email: "x@test.vn", user_metadata: { role: "PLAYER" } };
  const profileResult = { ok: false, error: "Không tìm thấy profile.", code: "PROFILE_NOT_FOUND" };

  const denied = resolveAuthUserFromProfile(authUser, profileResult, { rbacEnabled: true });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "PROFILE_NOT_FOUND");
});

test("resolveAuthUserFromProfile — RBAC bật, profile suspended → từ chối", () => {
  const authUser = { id: "uuid-x", email: "x@test.vn", user_metadata: {} };
  const profileResult = {
    ok: true,
    user: mapProfileRowToUser({
      id: "uuid-x",
      email: "x@test.vn",
      display_name: "User",
      role: "PLAYER",
      venue_id: "v1",
      club_id: "c1",
      status: "suspended",
    }),
  };

  const denied = resolveAuthUserFromProfile(authUser, profileResult, { rbacEnabled: true });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "PROFILE_SUSPENDED");
});

test("resolveAuthUserFromProfile — RBAC tắt, thiếu profile → fallback PLAYER", () => {
  const authUser = { id: "uuid-x", email: "x@test.vn", user_metadata: {} };
  const profileResult = { ok: false, code: "PROFILE_NOT_FOUND" };

  const allowed = resolveAuthUserFromProfile(authUser, profileResult, { rbacEnabled: false });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.user.role, ROLES.PLAYER);
  assert.equal(allowed.warning, "Dùng metadata fallback");
});

test("resolveAuthUserFromProfile — RBAC bật, profile hợp lệ → dùng profiles", () => {
  const authUser = { id: "uuid-1", email: "owner@test.com", user_metadata: { role: "PLAYER" } };
  const profileResult = {
    ok: true,
    user: mapProfileRowToUser({
      id: "uuid-1",
      email: "owner@test.com",
      display_name: "Chủ sân",
      role: "VENUE_OWNER",
      venue_id: "venue-demo",
      club_id: null,
      status: "active",
    }),
  };

  const allowed = resolveAuthUserFromProfile(authUser, profileResult, { rbacEnabled: true });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.user.role, ROLES.TENANT_OWNER);
  assert.equal(allowed.user.venueId, "venue-demo");
});

test("signInAs — lưu session qua localStorage", () => {
  globalThis.localStorage = createLocalStorageMock();
  signOut();

  if (!isDevAuthAllowed()) {
    return;
  }

  const user = createUserRecord({
    id: "test-user",
    email: "test@local.dev",
    role: ROLES.CLUB_OWNER,
    clubId: "club-x",
  });

  const result = signInAs(user, { provider: "test" });
  assert.equal(result.ok, true);
  assert.equal(getAuthState().authProvider, "test");
});

test("DP-13B — same logical user new object does not publish a new auth state", () => {
  const baseUser = {
    id: "user-1",
    email: "owner@club.local",
    role: "TENANT_OWNER",
    tenantId: "tenant-a",
    venueId: "venue-a",
    clubId: "club-a",
    tournamentId: null,
    teamId: null,
    playerId: null,
    assignedClusterIds: ["c2", "c1"],
    status: "active",
    mustChangePassword: false,
    displayName: "Owner",
    loggedInAt: "2026-08-13T10:00:00.000Z",
  };
  const refreshedUser = {
    ...baseUser,
    displayName: "Owner Updated",
    avatarUrl: "https://cdn.example/a.png",
    loggedInAt: "2026-08-13T10:00:30.000Z",
    updatedAt: "2026-08-13T10:00:30.000Z",
  };
  const previous = {
    user: baseUser,
    isAuthenticated: true,
    rbacEnabled: true,
    authProductionEnabled: true,
    authProvider: "supabase",
  };
  const next = {
    user: refreshedUser,
    isAuthenticated: true,
    rbacEnabled: true,
    authProductionEnabled: true,
    authProvider: "supabase",
  };

  assert.equal(buildUserSecurityScopeKey(baseUser), buildUserSecurityScopeKey(refreshedUser));
  assert.equal(areAuthStatesSemanticallyEqual(previous, next), true);
  assert.equal(selectStableAuthState(previous, next), previous);
  assert.equal(shouldRehydrateClubScope(
    buildUserSecurityScopeKey(baseUser),
    buildUserSecurityScopeKey(refreshedUser)
  ), false);

  const switched = selectStableAuthState(previous, {
    ...next,
    user: { ...refreshedUser, id: "user-2" },
  });
  assert.notEqual(switched, previous);
  assert.equal(shouldRehydrateClubScope(
    buildUserSecurityScopeKey(baseUser),
    buildUserSecurityScopeKey({ ...baseUser, id: "user-2" })
  ), true);

  assert.equal(shouldRehydrateClubScope(
    buildUserSecurityScopeKey(baseUser),
    buildUserSecurityScopeKey({ ...baseUser, tenantId: "tenant-b" })
  ), true);
  assert.equal(shouldRehydrateClubScope(
    buildUserSecurityScopeKey(baseUser),
    buildUserSecurityScopeKey({ ...baseUser, role: "CLUB_MANAGER" })
  ), true);
  assert.equal(shouldRehydrateClubScope(
    buildUserSecurityScopeKey(baseUser),
    buildUserSecurityScopeKey(null)
  ), true);

  const authSource = fs.readFileSync(path.resolve("src/context/AuthContext.jsx"), "utf8");
  assert.match(authSource, /selectStableAuthState\(previous, getAuthState\(\)\)/);
  assert.match(authSource, /TOKEN_REFRESHED/);
});

test("DP-13B — TOKEN_REFRESHED / repeated SIGNED_IN do not block an established session", () => {
  const user = { id: "user-1", role: "TENANT_OWNER" };
  assert.equal(
    shouldBlockRouteForAuthLoading({
      authLoading: true,
      isAuthenticated: true,
      user,
      pathname: "/tournament/daily/t1",
    }),
    false
  );
  assert.equal(
    shouldBlockRouteForAuthLoading({
      authLoading: true,
      isAuthenticated: true,
      user,
      pathname: "/tournaments",
    }),
    false
  );
  assert.equal(
    shouldBlockRouteForAuthLoading({
      authLoading: true,
      isAuthenticated: false,
      user: null,
      pathname: "/tournament/daily/t1",
    }),
    true
  );
  assert.equal(
    shouldBlockRouteForAuthLoading({
      authLoading: false,
      isAuthenticated: false,
      user: null,
      pathname: "/tournament/daily/t1",
    }),
    false
  );
  const gate = fs.readFileSync(path.resolve("src/components/auth/RouteAccessGate.jsx"), "utf8");
  assert.match(gate, /shouldBlockRouteForAuthLoading/);
});

test("PROD-DP-02 — cluster/player enrichment does not rehydrate club scope", () => {
  const base = {
    id: "user-1",
    email: "owner@club.local",
    role: "TENANT_OWNER",
    tenantId: "tenant-a",
    venueId: "venue-a",
    clubId: "club-a",
    status: "active",
    mustChangePassword: false,
  };
  const enriched = {
    ...base,
    assignedClusterIds: ["cluster-1"],
    playerId: "player-9",
    tournamentId: "t-1",
    teamId: "team-1",
  };
  assert.equal(buildClubRehydrateScopeKey(base), buildClubRehydrateScopeKey(enriched));
  assert.equal(
    shouldRehydrateClubScope(
      buildClubRehydrateScopeKey(base),
      buildClubRehydrateScopeKey(enriched)
    ),
    false
  );
  assert.notEqual(buildUserSecurityScopeKey(base), buildUserSecurityScopeKey(enriched));
  assert.equal(
    shouldRehydrateClubScope(
      buildClubRehydrateScopeKey(base),
      buildClubRehydrateScopeKey({ ...base, tenantId: "tenant-b" })
    ),
    true
  );
  assert.equal(
    shouldRehydrateClubScope(
      buildClubRehydrateScopeKey(base),
      buildClubRehydrateScopeKey({ ...base, role: "CLUB_MANAGER" })
    ),
    true
  );
});
