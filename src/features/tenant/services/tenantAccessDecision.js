/**
 * Wave 4 — Tenant access decision from canonical tenant_members evidence.
 *
 * Selected Tenant and profiles.tenant_id are never entitlement evidence.
 * profiles.tenant_id may only be used as a preferred/default hint by context
 * reauthorization after membership is proven.
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

  return denyDecision(AUTHZ_CODE.ENTITLEMENT_MISSING, {
    reason: "No active tenant_members row for the target tenant.",
  });
}
