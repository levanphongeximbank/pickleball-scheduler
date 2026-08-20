import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { USER_STATUS } from "../src/models/user.js";
import { ROLES } from "../src/features/identity/constants/roles.js";
import { adminCreateManagedUser } from "../src/features/identity/services/identityAdminCreateService.js";
import {
  authorizeManagedUserTargetTenant,
  CALLER_AUTHORITY_FIELDS,
  MANAGED_USER_TARGET_CODE,
  normalizeManagedUserStatus,
  stripCallerAuthorityFields,
} from "../src/features/identity/services/identityManagedUserTargetPolicy.js";
import handler from "../api/identity/create-user.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TENANT_A = "tenant-a";
const TENANT_B = "tenant-b";
const OWNER_A = "owner-a";
const SUPER_ADMIN = "super-admin-1";

function createAdminHarness({
  tenants = [],
  venues = [],
  createError = null,
  upsertError = null,
  deleteError = null,
} = {}) {
  const created = [];
  const deleted = [];
  let seq = 0;

  function tableApi(table) {
    const state = { filters: {}, row: null };
    const api = {
      select() {
        return api;
      },
      eq(col, val) {
        state.filters[col] = val;
        return api;
      },
      upsert(row) {
        state.row = row;
        return api;
      },
      async maybeSingle() {
        if (table === "platform_tenants") {
          const hit = tenants.find((item) => item.id === state.filters.id) || null;
          return { data: hit, error: null };
        }
        if (table === "venues") {
          const hit = venues.find((item) => item.id === state.filters.id) || null;
          return { data: hit, error: null };
        }
        return { data: null, error: null };
      },
      async single() {
        if (upsertError) {
          return { data: null, error: upsertError };
        }
        return { data: { ...(state.row || {}) }, error: null };
      },
    };
    return api;
  }

  return {
    created,
    deleted,
    client: {
      from(table) {
        return tableApi(table);
      },
      auth: {
        admin: {
          async createUser(payload) {
            if (createError) {
              return { data: null, error: createError };
            }
            seq += 1;
            const id = `auth-user-${seq}`;
            created.push({ id, email: payload.email });
            return { data: { user: { id } }, error: null };
          },
          async deleteUser(id) {
            deleted.push(id);
            if (deleteError) {
              return { data: null, error: deleteError };
            }
            return { data: {}, error: null };
          },
        },
      },
    },
  };
}

function superActor() {
  return { actorId: SUPER_ADMIN, role: "SUPER_ADMIN" };
}

function tenantOwnerActor() {
  return { actorId: OWNER_A, role: "VENUE_OWNER" };
}

const TENANT_ROWS = [
  { id: TENANT_A, name: "Tenant A", status: "active", owner_user_id: OWNER_A },
  { id: TENANT_B, name: "Tenant B", status: "active", owner_user_id: "owner-b" },
];

test("normalizeManagedUserStatus allows ACTIVE SUSPENDED INVITED and denies others", () => {
  assert.equal(normalizeManagedUserStatus(undefined).status, USER_STATUS.ACTIVE);
  assert.equal(normalizeManagedUserStatus("ACTIVE").status, USER_STATUS.ACTIVE);
  assert.equal(normalizeManagedUserStatus("SUSPENDED").status, USER_STATUS.SUSPENDED);
  assert.equal(normalizeManagedUserStatus("INVITED").status, USER_STATUS.INVITED);
  assert.equal(normalizeManagedUserStatus("inactive").ok, false);
  assert.equal(normalizeManagedUserStatus("nope").code, MANAGED_USER_TARGET_CODE.INVALID_STATUS);
  assert.equal(normalizeManagedUserStatus(" ").ok, true);
});

test("stripCallerAuthorityFields ignores crafted authorization claims", () => {
  const safe = stripCallerAuthorityFields({
    email: "new@example.com",
    tenantId: TENANT_B,
    actorId: SUPER_ADMIN,
    actorRole: "SUPER_ADMIN",
    authorizedTenantId: TENANT_B,
    permissions: ["user.manage"],
    tenantMembership: [TENANT_B],
  });
  for (const key of CALLER_AUTHORITY_FIELDS) {
    assert.equal(Object.prototype.hasOwnProperty.call(safe, key), false);
  }
  assert.equal(safe.email, "new@example.com");
  assert.equal(safe.tenantId, TENANT_B);
});

test("authorizeManagedUserTargetTenant denies non-super-admin foreign tenant", () => {
  const denied = authorizeManagedUserTargetTenant({
    actor: tenantOwnerActor(),
    tenant: { id: TENANT_B, ownerUserId: "owner-b" },
    tenantId: TENANT_B,
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, MANAGED_USER_TARGET_CODE.TARGET_TENANT_FORBIDDEN);
});

test("authorizeManagedUserTargetTenant allows tenant owner for own tenant", () => {
  const allowed = authorizeManagedUserTargetTenant({
    actor: tenantOwnerActor(),
    tenant: { id: TENANT_A, ownerUserId: OWNER_A },
    tenantId: TENANT_A,
  });
  assert.equal(allowed.ok, true);
});

test("venue equality is not tenant authorization", () => {
  const denied = authorizeManagedUserTargetTenant({
    actor: { actorId: "venue-actor", role: "VENUE_OWNER", venueId: TENANT_A, tenantId: TENANT_A },
    tenant: { id: TENANT_A, ownerUserId: OWNER_A },
    tenantId: TENANT_A,
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, MANAGED_USER_TARGET_CODE.TARGET_TENANT_FORBIDDEN);
});

test("SUPER_ADMIN can create ACTIVE user under existing Tenant A", async () => {
  const harness = createAdminHarness({ tenants: TENANT_ROWS });
  const result = await adminCreateManagedUser(
    {
      email: "active@example.com",
      role: ROLES.PLAYER,
      status: USER_STATUS.ACTIVE,
      tenantId: TENANT_A,
      actor: superActor(),
    },
    { getAdminClient: () => harness.client }
  );
  assert.equal(result.ok, true);
  assert.equal(result.user.status, USER_STATUS.ACTIVE);
  assert.equal(result.identityEvidence.tenantId, TENANT_A);
  assert.equal(result.identityEvidence.active, true);
  assert.equal(harness.created.length, 1);
  assert.equal(harness.deleted.length, 0);
});

test("SUPER_ADMIN can create INVITED user under existing tenant", async () => {
  const harness = createAdminHarness({ tenants: TENANT_ROWS });
  const result = await adminCreateManagedUser(
    {
      email: "invited@example.com",
      role: ROLES.PLAYER,
      status: USER_STATUS.INVITED,
      tenantId: TENANT_A,
      actor: superActor(),
    },
    { getAdminClient: () => harness.client }
  );
  assert.equal(result.ok, true);
  assert.equal(result.identityEvidence.status, USER_STATUS.INVITED);
  assert.equal(result.identityEvidence.active, false);
});

test("invalid status is denied before Auth create", async () => {
  const harness = createAdminHarness({ tenants: TENANT_ROWS });
  const result = await adminCreateManagedUser(
    {
      email: "bad-status@example.com",
      status: "INACTIVE",
      tenantId: TENANT_A,
      actor: superActor(),
    },
    { getAdminClient: () => harness.client }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, MANAGED_USER_TARGET_CODE.INVALID_STATUS);
  assert.equal(harness.created.length, 0);
});

test("missing target Tenant is denied before Auth create", async () => {
  const harness = createAdminHarness({ tenants: TENANT_ROWS });
  const result = await adminCreateManagedUser(
    {
      email: "missing-tenant@example.com",
      tenantId: "tenant-missing",
      actor: superActor(),
    },
    { getAdminClient: () => harness.client }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, MANAGED_USER_TARGET_CODE.TARGET_TENANT_NOT_FOUND);
  assert.equal(harness.created.length, 0);
});

test("explicit tenant and venue persist independently", async () => {
  const harness = createAdminHarness({
    tenants: TENANT_ROWS,
    venues: [{ id: "venue-home", tenant_id: TENANT_A }],
  });
  const result = await adminCreateManagedUser(
    {
      email: "both@example.com",
      role: ROLES.STAFF,
      tenantId: TENANT_A,
      venueId: "venue-home",
      actor: superActor(),
    },
    { getAdminClient: () => harness.client }
  );
  assert.equal(result.ok, true);
  assert.equal(result.identityEvidence.tenantId, TENANT_A);
  assert.equal(result.identityEvidence.venueId, "venue-home");
  assert.notEqual(result.identityEvidence.tenantId, result.identityEvidence.venueId);
});

test("tenant-only create is valid without venueId", async () => {
  const harness = createAdminHarness({ tenants: TENANT_ROWS });
  const result = await adminCreateManagedUser(
    {
      email: "tenant-only@example.com",
      tenantId: TENANT_A,
      actor: superActor(),
    },
    { getAdminClient: () => harness.client }
  );
  assert.equal(result.ok, true);
  assert.equal(result.identityEvidence.tenantId, TENANT_A);
  assert.equal(result.identityEvidence.venueId, null);
});

test("omitted tenantId does not invent Tenant from venue", async () => {
  const harness = createAdminHarness({
    tenants: TENANT_ROWS,
    venues: [{ id: "venue-home", tenant_id: TENANT_A }],
  });
  const result = await adminCreateManagedUser(
    {
      email: "legacy-venue@example.com",
      venueId: "venue-home",
      actor: superActor(),
    },
    { getAdminClient: () => harness.client }
  );
  assert.equal(result.ok, true);
  assert.equal(result.identityEvidence.tenantId, null);
  assert.equal(result.identityEvidence.venueId, "venue-home");
  assert.equal(harness.created.length, 1);
});

test("non-super-admin Tenant A owner targeting Tenant B is denied with no Auth user", async () => {
  const harness = createAdminHarness({ tenants: TENANT_ROWS });
  const result = await adminCreateManagedUser(
    {
      email: "foreign@example.com",
      tenantId: TENANT_B,
      actor: tenantOwnerActor(),
    },
    { getAdminClient: () => harness.client }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, MANAGED_USER_TARGET_CODE.TARGET_TENANT_FORBIDDEN);
  assert.equal(harness.created.length, 0);
});

test("non-super-admin may create under owned Tenant A", async () => {
  const harness = createAdminHarness({ tenants: TENANT_ROWS });
  const result = await adminCreateManagedUser(
    {
      email: "owned@example.com",
      tenantId: TENANT_A,
      actor: tenantOwnerActor(),
    },
    { getAdminClient: () => harness.client }
  );
  assert.equal(result.ok, true);
  assert.equal(result.identityEvidence.tenantId, TENANT_A);
});

test("foreign venue under target Tenant is denied before Auth create", async () => {
  const harness = createAdminHarness({
    tenants: TENANT_ROWS,
    venues: [{ id: "venue-b", tenant_id: TENANT_B }],
  });
  const result = await adminCreateManagedUser(
    {
      email: "venue-mismatch@example.com",
      tenantId: TENANT_A,
      venueId: "venue-b",
      actor: superActor(),
    },
    { getAdminClient: () => harness.client }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, MANAGED_USER_TARGET_CODE.TARGET_VENUE_TENANT_MISMATCH);
  assert.equal(harness.created.length, 0);
});

test("profile failure compensates the newly created Auth user", async () => {
  const harness = createAdminHarness({
    tenants: TENANT_ROWS,
    upsertError: { message: "profile write failed" },
  });
  const result = await adminCreateManagedUser(
    {
      email: "compensate@example.com",
      tenantId: TENANT_A,
      actor: superActor(),
    },
    { getAdminClient: () => harness.client }
  );
  assert.equal(result.ok, false);
  assert.equal(result.code, "PROFILE_UPSERT_FAILED");
  assert.equal(harness.created.length, 1);
  assert.deepEqual(harness.deleted, [harness.created[0].id]);
  assert.equal(result.compensation.ok, true);
});

test("suspended referee Contract #01 evidence is active=false", async () => {
  const harness = createAdminHarness({ tenants: TENANT_ROWS });
  const result = await adminCreateManagedUser(
    {
      email: "inactive-ref@example.com",
      role: ROLES.REFEREE,
      status: USER_STATUS.SUSPENDED,
      tenantId: TENANT_A,
      actor: superActor(),
    },
    { getAdminClient: () => harness.client }
  );
  assert.equal(result.ok, true);
  assert.equal(result.identityEvidence.role, ROLES.REFEREE);
  assert.equal(result.identityEvidence.status, USER_STATUS.SUSPENDED);
  assert.equal(result.identityEvidence.active, false);
  assert.equal(result.identityEvidence.tenantId, TENANT_A);
});

test("create-user API strips caller authority fields and uses JWT actor", () => {
  const source = readFileSync(path.join(ROOT, "api/identity/create-user.js"), "utf8");
  assert.equal(source.includes("stripCallerAuthorityFields"), true);
  assert.equal(source.includes("actor: auth.actor"), true);
  assert.equal(source.includes("body.tenantId"), true);
  assert.equal(source.includes("body.status"), true);
  assert.equal(source.includes("actor: body.actor"), false);
});

test("handler default export remains the trusted POST transport", () => {
  assert.equal(typeof handler, "function");
});
