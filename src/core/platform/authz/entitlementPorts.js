/**
 * Wave 4 — neutral Tenant / Club entitlement ports.
 *
 * Platform Core owns the bind/snapshot contract only.
 * Feature adapters are injected at the composition root.
 * This module must not import features/*, auth, or Club/Tenant implementations.
 */

import { ENTITLEMENT_STATUS } from "./decisionCodes.js";

/** @type {{ getSnapshot?: Function, hydrate?: Function } | null} */
let tenantAuthority = null;

/** @type {{ getSnapshot?: Function, hydrate?: Function } | null} */
let clubAuthority = null;

function emptySnapshot(actorId, status = ENTITLEMENT_STATUS.UNBOUND) {
  return {
    actorId: actorId || null,
    status,
    entitlements: [],
    error: null,
    code: status,
  };
}

export function bindTenantEntitlementAuthority(adapter) {
  tenantAuthority = adapter && typeof adapter === "object" ? adapter : null;
}

export function bindClubEntitlementAuthority(adapter) {
  clubAuthority = adapter && typeof adapter === "object" ? adapter : null;
}

export function isTenantEntitlementAuthorityBound() {
  return tenantAuthority != null;
}

export function isClubEntitlementAuthorityBound() {
  return clubAuthority != null;
}

export function getTenantEntitlementSnapshot(actorId) {
  if (!tenantAuthority || typeof tenantAuthority.getSnapshot !== "function") {
    return emptySnapshot(actorId, ENTITLEMENT_STATUS.UNBOUND);
  }
  const snap = tenantAuthority.getSnapshot(actorId);
  if (!snap || typeof snap !== "object") {
    return emptySnapshot(actorId, ENTITLEMENT_STATUS.UNBOUND);
  }
  return {
    actorId: actorId || null,
    status: snap.status || ENTITLEMENT_STATUS.UNBOUND,
    entitlements: Array.isArray(snap.entitlements) ? snap.entitlements : [],
    error: snap.error || null,
    code: snap.code || snap.status || ENTITLEMENT_STATUS.UNBOUND,
  };
}

export function getClubEntitlementSnapshot(actorId) {
  if (!clubAuthority || typeof clubAuthority.getSnapshot !== "function") {
    return emptySnapshot(actorId, ENTITLEMENT_STATUS.UNBOUND);
  }
  const snap = clubAuthority.getSnapshot(actorId);
  if (!snap || typeof snap !== "object") {
    return emptySnapshot(actorId, ENTITLEMENT_STATUS.UNBOUND);
  }
  return {
    actorId: actorId || null,
    status: snap.status || ENTITLEMENT_STATUS.UNBOUND,
    entitlements: Array.isArray(snap.entitlements) ? snap.entitlements : [],
    error: snap.error || null,
    code: snap.code || snap.status || ENTITLEMENT_STATUS.UNBOUND,
  };
}

export async function hydrateTenantEntitlements(actorId, options = {}) {
  if (!tenantAuthority || typeof tenantAuthority.hydrate !== "function") {
    return {
      ok: false,
      status: ENTITLEMENT_STATUS.UNBOUND,
      code: "NOT_CONFIGURED",
      entitlements: [],
    };
  }
  return tenantAuthority.hydrate(actorId, options);
}

export async function hydrateClubEntitlements(actorId, options = {}) {
  if (!clubAuthority || typeof clubAuthority.hydrate !== "function") {
    return {
      ok: false,
      status: ENTITLEMENT_STATUS.UNBOUND,
      code: "NOT_CONFIGURED",
      entitlements: [],
    };
  }
  return clubAuthority.hydrate(actorId, options);
}

export function __resetEntitlementPortsForTests() {
  tenantAuthority = null;
  clubAuthority = null;
}
