/**
 * Identity → Tenant-domain targeting for managed-user create.
 *
 * Tenant existence is proven from public.platform_tenants (never venues, never
 * public.tenants, never localStorage).
 *
 * profiles.tenant_id / profiles.venue_id are home/default Identity context only.
 * They are not Tenant operational entitlement and must not authorize a target.
 *
 * Policy:
 * - SUPER_ADMIN / PLATFORM_ADMIN may create under an existing explicit Tenant.
 * - Non-super-admin may target a Tenant only when platform_tenants.owner_user_id
 *   matches the authenticated actor. Foreign or unowned Tenants are denied.
 * - Venue equality is never Tenant authorization.
 * - Caller-supplied actor/authz fields are ignored by the API layer.
 */

import {
  PLATFORM_TENANTS_TABLE,
  mapPlatformTenantRow,
} from "../../../core/platform/app/platformTenantAuthority.js";
import { USER_STATUS } from "../../../models/user.js";
import { isGlobalRole, normalizeRole } from "../constants/roles.js";

export const MANAGED_USER_TARGET_CODE = Object.freeze({
  INVALID_STATUS: "INVALID_STATUS",
  TARGET_TENANT_NOT_FOUND: "TARGET_TENANT_NOT_FOUND",
  TARGET_TENANT_FORBIDDEN: "TARGET_TENANT_FORBIDDEN",
  TARGET_VENUE_NOT_FOUND: "TARGET_VENUE_NOT_FOUND",
  TARGET_VENUE_TENANT_MISMATCH: "TARGET_VENUE_TENANT_MISMATCH",
  TARGET_VENUE_RELATION_UNPROVEN: "TARGET_VENUE_RELATION_UNPROVEN",
});

export const ALLOWED_INITIAL_STATUSES = Object.freeze([
  USER_STATUS.ACTIVE,
  USER_STATUS.SUSPENDED,
  USER_STATUS.INVITED,
]);

export const CALLER_AUTHORITY_FIELDS = Object.freeze([
  "actorId",
  "actorRole",
  "authorizedTenantId",
  "permissions",
  "tenantMembership",
]);

export function stripCallerAuthorityFields(body = {}) {
  const safe = { ...(body || {}) };
  for (const key of CALLER_AUTHORITY_FIELDS) {
    delete safe[key];
  }
  return safe;
}

export function isManagedUserSuperAdmin(role) {
  return isGlobalRole(normalizeRole(role));
}

export function normalizeManagedUserStatus(status, { defaultStatus = USER_STATUS.ACTIVE } = {}) {
  if (status === undefined || status === null || String(status).trim() === "") {
    return { ok: true, status: defaultStatus };
  }
  const normalized = String(status).trim().toLowerCase();
  if (!ALLOWED_INITIAL_STATUSES.includes(normalized)) {
    return {
      ok: false,
      code: MANAGED_USER_TARGET_CODE.INVALID_STATUS,
      error: "Status không hợp lệ.",
    };
  }
  return { ok: true, status: normalized };
}

export function authorizeManagedUserTargetTenant({ actor = null, tenant = null, tenantId = null } = {}) {
  const targetId = String(tenantId || tenant?.id || "").trim();
  if (!targetId) {
    return { ok: true, policy: "NO_EXPLICIT_TENANT" };
  }
  if (!tenant || String(tenant.id) !== targetId) {
    return {
      ok: false,
      code: MANAGED_USER_TARGET_CODE.TARGET_TENANT_NOT_FOUND,
      error: "Tenant mục tiêu không tồn tại.",
    };
  }
  if (isManagedUserSuperAdmin(actor?.role)) {
    return { ok: true, policy: "SUPER_ADMIN_EXPLICIT_EXISTING_TENANT" };
  }
  const ownerUserId = String(tenant.ownerUserId || "").trim();
  const actorId = String(actor?.actorId || actor?.id || "").trim();
  if (ownerUserId && actorId && ownerUserId === actorId) {
    return { ok: true, policy: "PLATFORM_TENANT_OWNER_USER_ID" };
  }
  return {
    ok: false,
    code: MANAGED_USER_TARGET_CODE.TARGET_TENANT_FORBIDDEN,
    error: "Không được tạo user dưới Tenant ngoài phạm vi được ủy quyền.",
  };
}

export async function loadCanonicalTenantById(client, tenantId) {
  const id = String(tenantId || "").trim();
  if (!id) {
    return { ok: true, tenant: null };
  }
  if (!client || typeof client.from !== "function") {
    return {
      ok: false,
      code: MANAGED_USER_TARGET_CODE.TARGET_TENANT_NOT_FOUND,
      error: "Không đọc được Tenant canonical.",
    };
  }
  const { data, error } = await client
    .from(PLATFORM_TENANTS_TABLE)
    .select("id,name,status,owner_user_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) {
    return {
      ok: false,
      code: MANAGED_USER_TARGET_CODE.TARGET_TENANT_NOT_FOUND,
      error: "Tenant mục tiêu không tồn tại.",
    };
  }
  return { ok: true, tenant: mapPlatformTenantRow(data) };
}

export async function assertVenueCompatibleWithTenant(client, venueId, tenantId) {
  const venue = String(venueId || "").trim();
  const tenant = String(tenantId || "").trim();
  if (!venue || !tenant) {
    return { ok: true, skipped: true };
  }
  if (!client || typeof client.from !== "function") {
    return {
      ok: false,
      code: MANAGED_USER_TARGET_CODE.TARGET_VENUE_RELATION_UNPROVEN,
      error: "Không chứng minh được Venue thuộc Tenant mục tiêu.",
    };
  }
  const { data, error } = await client
    .from("venues")
    .select("id, tenant_id")
    .eq("id", venue)
    .maybeSingle();
  if (error) {
    return {
      ok: false,
      code: MANAGED_USER_TARGET_CODE.TARGET_VENUE_RELATION_UNPROVEN,
      error: "Không chứng minh được Venue thuộc Tenant mục tiêu.",
    };
  }
  if (!data) {
    return {
      ok: false,
      code: MANAGED_USER_TARGET_CODE.TARGET_VENUE_NOT_FOUND,
      error: "Venue mục tiêu không tồn tại.",
    };
  }
  const venueTenantId = String(data.tenant_id || data.tenantId || "").trim();
  if (!venueTenantId) {
    return {
      ok: false,
      code: MANAGED_USER_TARGET_CODE.TARGET_VENUE_RELATION_UNPROVEN,
      error: "Venue không có tenant_id canonical.",
    };
  }
  if (venueTenantId !== tenant) {
    return {
      ok: false,
      code: MANAGED_USER_TARGET_CODE.TARGET_VENUE_TENANT_MISMATCH,
      error: "Venue không thuộc Tenant mục tiêu.",
    };
  }
  return { ok: true, venueTenantId };
}

export async function resolveManagedUserTenantTarget({
  client,
  actor,
  tenantId,
  venueId,
} = {}) {
  const explicitTenantId = String(tenantId || "").trim() || null;
  const explicitVenueId = String(venueId || "").trim() || null;

  if (!explicitTenantId) {
    return {
      ok: true,
      tenantId: null,
      venueId: explicitVenueId,
      tenant: null,
      policy: "NO_EXPLICIT_TENANT",
    };
  }

  const loaded = await loadCanonicalTenantById(client, explicitTenantId);
  if (!loaded.ok) {
    return loaded;
  }

  const authz = authorizeManagedUserTargetTenant({
    actor,
    tenant: loaded.tenant,
    tenantId: explicitTenantId,
  });
  if (!authz.ok) {
    return authz;
  }

  const venueCheck = await assertVenueCompatibleWithTenant(
    client,
    explicitVenueId,
    explicitTenantId
  );
  if (!venueCheck.ok) {
    return venueCheck;
  }

  return {
    ok: true,
    tenantId: explicitTenantId,
    venueId: explicitVenueId,
    tenant: loaded.tenant,
    policy: authz.policy,
  };
}
