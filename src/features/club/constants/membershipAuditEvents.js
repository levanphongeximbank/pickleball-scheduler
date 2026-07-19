/**
 * Phase 2C — Membership / join-request audit event names (API freeze).
 *
 * Server RPCs historically emit Phase 42 names (`club.member.*`).
 * This map is the client/docs alias contract: freeze name ≡ server name for G-AUDIT.
 * SQL rename is deferred for historical actions — cancel action is now
 * authored in docs/v5/phase2c-cancel-audit/PHASE_2C_CANCEL_MEMBERSHIP_REQUEST_AUDIT.sql
 * (Staging first). No Production whitelist churn from the original 2C merge alone.
 */

export const MEMBERSHIP_AUDIT_EVENTS = Object.freeze({
  ADDED: "membership.added",
  LEFT: "membership.left",
  REMOVED: "membership.removed",
  RESTORED: "membership.restored",
});

export const JOIN_REQUEST_AUDIT_EVENTS = Object.freeze({
  CREATED: "join_request.created",
  APPROVED: "join_request.approved",
  REJECTED: "join_request.rejected",
  CANCELLED: "join_request.cancelled",
});

/** Server (phase42_write_audit) action strings currently emitted by membership RPCs. */
export const SERVER_MEMBERSHIP_AUDIT_ALIASES = Object.freeze({
  "membership.added": "club.member.add",
  "membership.left": "club.leave_membership",
  "membership.removed": "club.member.remove",
  "membership.restored": "club.member.restore",
  "join_request.created": "club.membership_request.submit",
  "join_request.approved": "club.membership_request.review",
  "join_request.rejected": "club.membership_request.review",
  "join_request.cancelled": "club.membership_request.cancel",
});

/**
 * @param {string} freezeEvent
 * @returns {string} server audit action (or freezeEvent if unmapped)
 */
export function resolveServerMembershipAuditAction(freezeEvent) {
  const key = String(freezeEvent || "").trim();
  return SERVER_MEMBERSHIP_AUDIT_ALIASES[key] || key;
}

/**
 * @param {string} serverAction
 * @returns {string[]} matching freeze event names
 */
export function resolveFreezeMembershipAuditEvents(serverAction) {
  const action = String(serverAction || "").trim();
  return Object.entries(SERVER_MEMBERSHIP_AUDIT_ALIASES)
    .filter(([, server]) => server === action)
    .map(([freeze]) => freeze);
}
