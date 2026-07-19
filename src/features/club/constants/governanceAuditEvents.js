/**
 * Phase 2D — Governance audit event names (API freeze).
 *
 * Server RPCs emit Phase 42 / 1B action strings (`club.assign_owner`, …).
 * This map is the client/docs alias contract: freeze name ≡ server name for G-AUDIT.
 * No Production whitelist rename in Phase 2D.
 */

export const GOVERNANCE_AUDIT_EVENTS = Object.freeze({
  OWNER_ASSIGNED: "governance.owner_assigned",
  OWNER_CLEARED: "governance.owner_cleared",
  OWNER_REPLACED: "governance.owner_replaced",
  PRESIDENT_ASSIGNED: "governance.president_assigned",
  PRESIDENT_CLEARED: "governance.president_cleared",
  PRESIDENT_REPLACED: "governance.president_replaced",
  VP_ASSIGNED: "governance.vp_assigned",
  VP_CLEARED: "governance.vp_cleared",
  VP_REPLACED: "governance.vp_replaced",
});

/** Server (phase42_write_audit) action strings currently emitted by governance RPCs. */
export const SERVER_GOVERNANCE_AUDIT_ALIASES = Object.freeze({
  "governance.owner_assigned": "club.assign_owner",
  "governance.owner_cleared": "club.clear_owner",
  "governance.owner_replaced": "club.assign_owner",
  "governance.president_assigned": "club.transfer_president",
  "governance.president_cleared": "club.transfer_president",
  "governance.president_replaced": "club.transfer_president",
  "governance.vp_assigned": "club.assign_vice_president",
  "governance.vp_cleared": "club.clear_vice_president",
  "governance.vp_replaced": "club.assign_vice_president",
});

/**
 * @param {string} freezeEvent
 * @returns {string} server audit action (or freezeEvent if unmapped)
 */
export function resolveServerGovernanceAuditAction(freezeEvent) {
  const key = String(freezeEvent || "").trim();
  return SERVER_GOVERNANCE_AUDIT_ALIASES[key] || key;
}

/**
 * @param {string} serverAction
 * @returns {string[]} matching freeze event names
 */
export function resolveFreezeGovernanceAuditEvents(serverAction) {
  const action = String(serverAction || "").trim();
  return Object.entries(SERVER_GOVERNANCE_AUDIT_ALIASES)
    .filter(([, server]) => server === action)
    .map(([freeze]) => freeze);
}
