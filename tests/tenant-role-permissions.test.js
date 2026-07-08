import test from "node:test";
import assert from "node:assert/strict";

import { ROLES } from "../src/features/identity/constants/roles.js";
import {
  applyTenantOverrides,
  getPermissionUiState,
  isRoleTenantCustomizable,
} from "../src/features/identity/constants/rolePermissionUiConfig.js";
import {
  clearTenantRoleOverrides,
  getEffectivePermissionsForTenantRole,
  saveTenantRoleOverrides,
} from "../src/features/identity/services/tenantRolePermissionService.js";
import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";
import { getPermissionsForRole } from "../src/features/identity/matrix/rolePermissions.js";
import { can } from "../src/auth/rbac.js";
import { createUserRecord } from "../src/models/user.js";

const tenantId = "test-tenant-roles";

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

test("tenant role permissions — applies add/remove overrides on top of defaults", () => {
  const defaults = new Set(getPermissionsForRole(ROLES.CASHIER));
  const effective = applyTenantOverrides(defaults, {
    added: [PERMISSIONS.COURT_DELETE],
    removed: [PERMISSIONS.BOOKING_CREATE],
  });

  assert.equal(effective.has(PERMISSIONS.COURT_DELETE), true);
  assert.equal(effective.has(PERMISSIONS.BOOKING_CREATE), false);
});

test("tenant role permissions — persists tenant overrides in localStorage", () => {
  globalThis.localStorage = createLocalStorageMock();
  clearTenantRoleOverrides(tenantId, ROLES.CASHIER);

  const defaults = getPermissionsForRole(ROLES.CASHIER);
  const draft = new Set(defaults);
  draft.add(PERMISSIONS.TOURNAMENT_VIEW);
  draft.delete(PERMISSIONS.FINANCE_EDIT);

  saveTenantRoleOverrides(tenantId, ROLES.CASHIER, draft);
  const effective = getEffectivePermissionsForTenantRole(tenantId, ROLES.CASHIER);

  assert.equal(effective.has(PERMISSIONS.TOURNAMENT_VIEW), true);
  assert.equal(effective.has(PERMISSIONS.FINANCE_EDIT), false);

  clearTenantRoleOverrides(tenantId, ROLES.CASHIER);
  delete globalThis.localStorage;
});

test("tenant role permissions — marks UI state for added and removed permissions", () => {
  const defaults = new Set(getPermissionsForRole(ROLES.CASHIER));
  const effective = new Set(defaults);
  effective.add(PERMISSIONS.TOURNAMENT_VIEW);
  effective.delete(PERMISSIONS.FINANCE_EDIT);

  assert.equal(getPermissionUiState(PERMISSIONS.TOURNAMENT_VIEW, defaults, effective), "added");
  assert.equal(getPermissionUiState(PERMISSIONS.FINANCE_EDIT, defaults, effective), "removed");
  assert.equal(getPermissionUiState(PERMISSIONS.COURT_VIEW, defaults, effective), "default");
});

test("tenant role permissions — flags tenant-customizable operational roles", () => {
  assert.equal(isRoleTenantCustomizable(ROLES.CASHIER), true);
  assert.equal(isRoleTenantCustomizable(ROLES.PLATFORM_ADMIN), false);
});

test("tenant role permissions — TENANT_OWNER có tenant.role.customize", () => {
  assert.equal(
    getPermissionsForRole(ROLES.TENANT_OWNER).includes(PERMISSIONS.TENANT_ROLE_CUSTOMIZE),
    true
  );
  assert.equal(
    getPermissionsForRole(ROLES.VENUE_OWNER).includes(PERMISSIONS.TENANT_ROLE_CUSTOMIZE),
    true
  );
});

test("tenant role permissions — can() áp dụng override theo tenantId", () => {
  globalThis.localStorage = createLocalStorageMock();
  const tenantId = "tenant-rbac-runtime";
  clearTenantRoleOverrides(tenantId, ROLES.PLAYER);

  const player = createUserRecord({
    role: ROLES.PLAYER,
    tenantId,
    clubId: "club-1",
    playerId: "p-1",
  });
  const rbacOn = { rbacEnabled: true };

  assert.equal(can(player, PERMISSIONS.TOURNAMENT_CREATE, { clubId: "club-1" }, rbacOn), false);

  const draft = new Set(getPermissionsForRole(ROLES.PLAYER));
  draft.add(PERMISSIONS.TOURNAMENT_CREATE);
  saveTenantRoleOverrides(tenantId, ROLES.PLAYER, draft);

  assert.equal(can(player, PERMISSIONS.TOURNAMENT_CREATE, { clubId: "club-1" }, rbacOn), true);

  clearTenantRoleOverrides(tenantId, ROLES.PLAYER);
  delete globalThis.localStorage;
});
