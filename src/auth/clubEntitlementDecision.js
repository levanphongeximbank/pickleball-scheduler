/**
 * Wave 4 — Club membership evidence decision.
 * Reads the bound Club entitlement port. Does not import Club implementation.
 */

import { isGlobalRole, isPlatformScopedRole } from "./roles.js";
import { isSecureRuntime } from "./runtime.js";
import { isUserActive } from "../models/user.js";
import { hasCanonicalClubGovernanceEvidence } from "./governanceScopeResolver.js";
import {
  AUTHZ_CODE,
  ENTITLEMENT_KIND,
  ENTITLEMENT_STATUS,
  allowDecision,
  denyDecision,
} from "../core/platform/authz/decisionCodes.js";
import { getClubEntitlementSnapshot } from "../core/platform/authz/entitlementPorts.js";

function trimId(value) {
  return String(value || "").trim() || null;
}

function isActiveClubMembership(entitlement) {
  return Boolean(
    entitlement &&
      entitlement.clubId &&
      String(entitlement.status || "active").toLowerCase() === "active"
  );
}

export function collectActiveClubEntitlements(user) {
  const actorId = trimId(user?.id);
  const snapshot = getClubEntitlementSnapshot(actorId);
  const fromSnapshot = (snapshot.entitlements || []).filter(isActiveClubMembership);
  const overlay = Array.isArray(user?.entitlementEvidence?.clubs)
    ? user.entitlementEvidence.clubs.filter(isActiveClubMembership)
    : [];
  const byClub = new Map();
  for (const row of [...fromSnapshot, ...overlay]) {
    byClub.set(row.clubId, row);
  }
  return { snapshot, entitlements: [...byClub.values()] };
}

export function decideClubMembershipAccess(user, clubId) {
  if (!user) {
    return denyDecision(AUTHZ_CODE.UNAUTHENTICATED);
  }
  if (user.identityIncomplete || !user.role) {
    return denyDecision(AUTHZ_CODE.IDENTITY_INCOMPLETE);
  }
  if (!isUserActive(user)) {
    return denyDecision(AUTHZ_CODE.IDENTITY_INACTIVE);
  }

  const target = trimId(clubId);
  if (isGlobalRole(user.role)) {
    if (!target) {
      return denyDecision(AUTHZ_CODE.TARGET_REQUIRED, {
        evidenceKind: ENTITLEMENT_KIND.GLOBAL_PLATFORM_ADMIN,
      });
    }
    return allowDecision(AUTHZ_CODE.ALLOW, {
      evidenceKind: ENTITLEMENT_KIND.GLOBAL_PLATFORM_ADMIN,
    });
  }

  if (isPlatformScopedRole(user.role)) {
    return denyDecision(AUTHZ_CODE.UNAUTHORIZED, {
      reason: "SYSTEM_TECHNICIAN cannot operate arbitrary Clubs.",
    });
  }

  if (!target) {
    return denyDecision(AUTHZ_CODE.TARGET_REQUIRED);
  }

  const { snapshot, entitlements } = collectActiveClubEntitlements(user);
  if (snapshot.status === ENTITLEMENT_STATUS.PENDING) {
    return denyDecision(AUTHZ_CODE.CONTEXT_UNRESOLVED);
  }
  if (
    snapshot.status === ENTITLEMENT_STATUS.AUTHORITY_UNAVAILABLE ||
    snapshot.code === "AUTHORITY_UNAVAILABLE"
  ) {
    return denyDecision(AUTHZ_CODE.AUTHORITY_UNAVAILABLE);
  }
  if (
    (snapshot.status === ENTITLEMENT_STATUS.UNBOUND ||
      snapshot.status === ENTITLEMENT_STATUS.NOT_CONFIGURED) &&
    isSecureRuntime() &&
    entitlements.length === 0
  ) {
    return denyDecision(AUTHZ_CODE.ENTITLEMENT_UNAVAILABLE);
  }

  const match = entitlements.find((row) => row.clubId === target);
  if (match) {
    return allowDecision(AUTHZ_CODE.ALLOW, { evidenceKind: match.evidenceKind });
  }

  if (hasCanonicalClubGovernanceEvidence(user, target)) {
    return allowDecision(AUTHZ_CODE.ALLOW, {
      evidenceKind: ENTITLEMENT_KIND.CLUB_GOVERNANCE,
    });
  }

  return denyDecision(AUTHZ_CODE.ENTITLEMENT_MISSING);
}
