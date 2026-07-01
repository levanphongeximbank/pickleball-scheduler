import test from "node:test";
import assert from "node:assert/strict";

import { ROLES } from "../src/auth/roles.js";
import { canAccessRoute } from "../src/auth/menuAccess.js";
import { can } from "../src/auth/rbac.js";
import { createUserRecord } from "../src/models/user.js";
import { USER_STATUS } from "../src/models/user.js";
import { enableRbac, signInAs, signOut } from "../src/auth/authService.js";
import { listAuditLogs } from "../src/features/identity/services/auditService.js";
import { writeAuditLog, AUDIT_ACTIONS } from "../src/features/identity/services/auditService.js";
import { listUsers } from "../src/features/identity/services/userManagementService.js";

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem: (key) => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => store.set(key, String(value)),
    removeItem: (key) => store.delete(key),
    clear: () => store.clear(),
  };
}

function user(role, extra = {}) {
  return createUserRecord({ role, status: USER_STATUS.ACTIVE, ...extra });
}

const RBAC_ON = { rbacEnabled: true };

test("Phase C — /audit requires USER_MANAGE", () => {
  const admin = user(ROLES.SUPER_ADMIN);
  const player = user(ROLES.PLAYER, { clubId: "c1" });

  const check = (u, path) =>
    canAccessRoute(
      (perm, scope) => can(u, perm, scope, RBAC_ON),
      path,
      { clubId: "c1" }
    );

  assert.equal(check(admin, "/audit"), true);
  assert.equal(check(player, "/audit"), false);
});

test("Phase C — listAuditLogs requires USER_MANAGE (dev)", async () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(true);
  signInAs(user(ROLES.PLAYER));

  const denied = await listAuditLogs();
  assert.equal(denied.ok, false);
  assert.equal(denied.code, "FORBIDDEN");

  signInAs(user(ROLES.SUPER_ADMIN));
  await writeAuditLog({
    action: AUDIT_ACTIONS.LOGIN,
    resourceType: "session",
    resourceId: "test",
    metadata: { password: "secret", email: "a@b.c" },
  });

  const result = await listAuditLogs({ limit: 10 });
  assert.equal(result.ok, true);
  assert.ok(result.logs.length >= 1);
  const last = result.logs[0];
  assert.equal(last.metadata?.password, undefined);

  signOut();
  enableRbac(false);
});

test("Phase C — listUsers dev with USER_MANAGE", async () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(true);
  signInAs(user(ROLES.COURT_OWNER, { venueId: "venue-demo" }));

  const result = await listUsers();
  assert.equal(result.ok, true);
  assert.ok(Array.isArray(result.users));

  signOut();
  enableRbac(false);
});

test("Phase C — PLAYER cannot list users", async () => {
  globalThis.localStorage = createLocalStorageMock();
  enableRbac(true);
  signInAs(user(ROLES.PLAYER));

  const result = await listUsers();
  assert.equal(result.ok, false);

  signOut();
  enableRbac(false);
});
