/**
 * Wave 4 — Tenant access decision from canonical tenant_members evidence.
 *
 * tenant_members is Tenant OPERATIONAL entitlement, not universal account
 * membership. Selected Tenant and profiles.tenant_id are never operational
 * evidence. profiles.tenant_id may supply a home/default CONTEXT hint.
 */

import { isGlobalRole, isPlatformScopedRole } from "../../../auth/roles.js";
import { isUserActive } from "../../../models/user.js";
import {
  AUTHZ_CODE,
  ENTITLEMENT_KIND,
  ENTITLEMENT_STATUS,
  allowDecision,
  denyDecision,
} from "../../../core/platform/authz/decisionCodes.js";
import { getTenantEntitlementSnapshot } from "../../../core/platform/authz/entitlementPorts.js";
import { isActiveTenantMembership, mapTenantMemberRow } from "./tenantEntitlementAdapter.js";
import { isSecureRuntime } from "../../../auth/runtime.js";

function trimId(value) {
  return String(value || "").trim() || null;
}

function actorEntitlementRows(user) {
  const overlay = user?.entitlementEvidence?.tenants;
  if (!Array.isArray(overlay)) {
    return [];
  }
  return overlay.map(mapTenantMemberRow).filter(Boolean);
}

export function collectActiveTenantEntitlements(user) {
  const actorId = trimId(user?.id);
  const snapshot = getTenantEntitlementSnapshot(actorId);
  const fromSnapshot = (snapshot.entitlements || []).filter(isActiveTenantMembership);
  const fromActor = actorEntitlementRows(user).filter(isActiveTenantMembership);
  const byTenant = new Map();
  for (const row of [...fromSnapshot, ...fromActor]) {
    byTenant.set(row.tenantId, row);
  }
  return {
    snapshot,
    entitlements: [...byTenant.values()],
  };
}

/**
 * Context target / home hint. Never grants Tenant operational authorization.
 * Cross-tenant context remains denied.
 */
export function evaluateTenantContext(user, tenantId) {
  if (!user) {
    return denyDecision(AUTHZ_CODE.UNAUTHENTICATED);
  }

  if (user.identityIncomplete || !user.role) {
    return denyDecision(AUTHZ_CODE.IDENTITY_INCOMPLETE);
  }

  if (!isUserActive(user)) {
    return denyDecision(AUTHZ_CODE.IDENTITY_INACTIVE);
  }

  const target = trimId(tenantId);
  if (!target) {
    return denyDecision(AUTHZ_CODE.TARGET_REQUIRED, {
      reason: "No Tenant context target.",
    });
  }

  if (isGlobalRole(user.role)) {
    return allowDecision(AUTHZ_CODE.ALLOW, {
      evidenceKind: ENTITLEMENT_KIND.GLOBAL_PLATFORM_ADMIN,
      reason: "Super Admin may use an explicit Tenant context target.",
    });
  }

  const homeTenantId = trimId(user.tenantId);
  if (homeTenantId && homeTenantId === target) {
    return allowDecision(AUTHZ_CODE.TENANT_CONTEXT_ONLY, {
      reason: "profiles.tenant_id is a home/default context hint only.",
    });
  }

  const { entitlements } = collectActiveTenantEntitlements(user);
  const match = entitlements.find((row) => row.tenantId === target);
  if (match) {
    return allowDecision(AUTHZ_CODE.ALLOW, {
      evidenceKind: match.evidenceKind,
      reason: "Active tenant_members row may also identify a context target.",
    });
  }

  return denyDecision(AUTHZ_CODE.UNAUTHORIZED, {
    reason: "Selected Tenant is not a valid context target for this actor.",
  });
}

export function decideTenantAccess(user, tenantId, { requireTarget = true } = {}) {
  if (!user) {
    return denyDecision(AUTHZ_CODE.UNAUTHENTICATED);
  }

  if (user.identityIncomplete || !user.role) {
    return denyDecision(AUTHZ_CODE.IDENTITY_INCOMPLETE);
  }

  if (!isUserActive(user)) {
    return denyDecision(AUTHZ_CODE.IDENTITY_INACTIVE);
  }

  const target = trimId(tenantId);

  if (isGlobalRole(user.role)) {
    if (requireTarget && !target) {
      return denyDecision(AUTHZ_CODE.TARGET_REQUIRED, {
        reason: "Super Admin operational tenant action requires an explicit tenant target.",
        evidenceKind: ENTITLEMENT_KIND.GLOBAL_PLATFORM_ADMIN,
      });
    }
    if (!target) {
      return allowDecision(AUTHZ_CODE.ALLOW, {
        evidenceKind: ENTITLEMENT_KIND.GLOBAL_PLATFORM_ADMIN,
        reason: "Super Admin directory / global authorization.",
      });
    }
    return allowDecision(AUTHZ_CODE.ALLOW, {
      evidenceKind: ENTITLEMENT_KIND.GLOBAL_PLATFORM_ADMIN,
      reason: "Super Admin global authorization with explicit tenant target.",
    });
  }

  if (isPlatformScopedRole(user.role)) {
    return denyDecision(AUTHZ_CODE.UNAUTHORIZED, {
      reason: "SYSTEM_TECHNICIAN cannot operate arbitrary Tenants.",
    });
  }

  if (requireTarget && !target) {
    return denyDecision(AUTHZ_CODE.TARGET_REQUIRED);
  }

  const { snapshot, entitlements } = collectActiveTenantEntitlements(user);
  const match = entitlements.find((row) => row.tenantId === target);
  if (match) {
    return allowDecision(AUTHZ_CODE.ALLOW, {
      evidenceKind: match.evidenceKind,
    });
  }

  const status = snapshot.status;

  if (status === ENTITLEMENT_STATUS.PENDING) {
    return denyDecision(AUTHZ_CODE.CONTEXT_UNRESOLVED, {
      reason: "Tenant entitlement authority is still resolving.",
    });
  }

  if (
    status === ENTITLEMENT_STATUS.AUTHORITY_UNAVAILABLE ||
    snapshot.code === "AUTHORITY_UNAVAILABLE"
  ) {
    return denyDecision(AUTHZ_CODE.AUTHORITY_UNAVAILABLE, {
      reason: snapshot.error || "Tenant entitlement authority query failed.",
    });
  }

  if (status === ENTITLEMENT_STATUS.UNBOUND || status === ENTITLEMENT_STATUS.NOT_CONFIGURED) {
    if (isSecureRuntime()) {
      return denyDecision(AUTHZ_CODE.ENTITLEMENT_UNAVAILABLE, {
        reason: "tenant_members authority is not configured.",
      });
    }
  }

  return denyDecision(AUTHZ_CODE.TENANT_OPERATIONAL_ENTITLEMENT_MISSING, {
    reason: "No active tenant_members row for the Tenant operational action.",
  });
}
