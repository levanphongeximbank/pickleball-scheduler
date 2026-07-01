import test from "node:test";
import assert from "node:assert/strict";

import {
  isPublicAuthPath,
  isAuthenticatedOnlyRoute,
  isPermissionExemptPath,
  shouldRedirectToLogin,
  shouldRedirectToForbidden,
} from "../src/auth/authGuard.js";
import { canAccessRoute } from "../src/auth/menuAccess.js";
import { can } from "../src/auth/rbac.js";
import { ROLES } from "../src/auth/roles.js";
import { createUserRecord } from "../src/models/user.js";
import {
  validateDevResetToken,
  changePassword,
  requestPasswordReset,
} from "../src/features/identity/services/passwordService.js";
import { writeAuditLog, AUDIT_ACTIONS } from "../src/features/identity/services/auditService.js";
import { listUsers } from "../src/features/identity/services/userManagementService.js";
import {
  updateSelfProfile,
} from "../src/features/identity/services/selfProfileService.js";
import {
  canAccessRefereeSession,
} from "../src/features/identity/services/refereeSessionService.js";
import {
  enableRbac,
  signInAs,
  signOut,
} from "../src/auth/authService.js";

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

test("authGuard — public paths forgot/reset/login", () => {
  assert.equal(isPublicAuthPath("/login", { authProductionEnabled: true, rbacEnabled: true }), true);
  assert.equal(isPublicAuthPath("/forgot-password", { authProductionEnabled: true, rbacEnabled: true }), true);
  assert.equal(isPublicAuthPath("/reset-password", { authProductionEnabled: true, rbacEnabled: true }), true);
  assert.equal(isPublicAuthPath("/referee/abc-token-legacy-1234", { authProductionEnabled: true, rbacEnabled: true }), true);
  assert.equal(isPublicAuthPath("/users", { authProductionEnabled: true, rbacEnabled: true }), false);
});

test("authGuard — /profile authenticated-only, /403 exempt", () => {
  assert.equal(isAuthenticatedOnlyRoute("/profile"), true);
  assert.equal(isPermissionExemptPath("/403"), true);
});

test("authGuard — shouldRedirectToForbidden for PLAYER on /users", () => {
  const player = createUserRecord({
    role: ROLES.PLAYER,
    clubId: "c1",
    playerId: "p1",
  });

  const denied = shouldRedirectToForbidden("/users", {
    rbacEnabled: true,
    isAuthenticated: true,
    can: (perm, scope) => can(player, perm, scope, RBAC_ON),
    scope: { clubId: "c1" },
  });

  assert.equal(denied, true);
});

test("authGuard — SUPER_ADMIN passes /users", () => {
  const admin = createUserRecord({ role: ROLES.SUPER_ADMIN });

  const denied = shouldRedirectToForbidden("/users", {
    rbacEnabled: true,
    isAuthenticated: true,
    can: (perm, scope) => can(admin, perm, scope, RBAC_ON),
    scope: {},
  });

  assert.equal(denied, false);
});

test("passwordService dev — reset token flow", async () => {
  globalThis.localStorage = createLocalStorageMock();

  const requested = await requestPasswordReset("player@club.local");
  assert.equal(requested.ok, true);
  assert.ok(requested.devResetPath);

  const token = requested.devResetPath.split("token=")[1];
  const valid = validateDevResetToken(token);
  assert.equal(valid.ok, true);

  signInAs(createUserRecord({
    id: "dev-player",
    email: "player@club.local",
    role: ROLES.PLAYER,
    clubId: "c1",
    playerId: "p1",
  }));

  const changed = await changePassword({
    currentPassword: "old",
    newPassword: "newpass123",
  });
  assert.equal(changed.ok, true);

  const changedAgain = await changePassword({
    currentPassword: "newpass123",
    newPassword: "another123",
  });
  assert.equal(changedAgain.ok, true);

  signOut();
});

test("auditService — dev write without secrets", async () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(false);
  signInAs(createUserRecord({
    id: "dev-admin",
    email: "admin@pickleball.local",
    role: ROLES.SUPER_ADMIN,
  }));

  const result = await writeAuditLog({
    action: AUDIT_ACTIONS.LOGIN,
    resourceType: "auth",
    metadata: { password: "secret", email: "admin@pickleball.local" },
  });

  assert.equal(result.ok, true);
  assert.equal(result.entry.metadata.password, undefined);

  signOut();
});

test("userManagement — dev list requires USER_MANAGE", async () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(true);

  signInAs(createUserRecord({ role: ROLES.PLAYER, clubId: "c1", playerId: "p1" }));
  const denied = await listUsers();
  assert.equal(denied.ok, false);

  signInAs(createUserRecord({ role: ROLES.SUPER_ADMIN, email: "admin@pickleball.local" }));
  const allowed = await listUsers();
  assert.equal(allowed.ok, true);
  assert.ok(allowed.users.length >= 1);

  signOut();
  enableRbac(false);
});

test("selfProfile — dev update", async () => {
  globalThis.localStorage = createLocalStorageMock();
  signInAs(createUserRecord({
    id: "dev-player",
    email: "player@club.local",
    role: ROLES.PLAYER,
    clubId: "c1",
    playerId: "p1",
    displayName: "Old",
  }));

  const result = await updateSelfProfile({
    displayName: "New Name",
    phone: "0901234567",
  });

  assert.equal(result.ok, true);
  assert.equal(result.user.displayName, "New Name");
  assert.equal(result.user.phone, "0901234567");

  signOut();
});

test("referee session — REFEREE role can access match update", () => {
  const referee = createUserRecord({
    role: ROLES.REFEREE,
    venueId: "venue-a",
    clubId: "c1",
  });

  enableRbac(true);
  assert.equal(
    canAccessRefereeSession(referee, { clubId: "c1", venueId: "venue-a" }),
    true
  );
  assert.equal(
    canAccessRefereeSession(
      createUserRecord({ role: ROLES.PLAYER, clubId: "c1", playerId: "p1" }),
      { clubId: "c1" }
    ),
    false
  );
  enableRbac(false);
});

test("route access — /profile no RBAC permission required via authenticated-only", () => {
  const player = createUserRecord({ role: ROLES.PLAYER, clubId: "c1", playerId: "p1" });
  const perms = canAccessRoute(
    (perm, scope) => can(player, perm, scope, RBAC_ON),
    "/profile",
    { clubId: "c1", playerId: "p1" }
  );
  assert.equal(perms, true);
});

test("login redirect — unauthenticated /players when auth required", () => {
  assert.equal(
    shouldRedirectToLogin("/players", {
      authProductionEnabled: true,
      rbacEnabled: false,
      isAuthenticated: false,
    }),
    true
  );
});
