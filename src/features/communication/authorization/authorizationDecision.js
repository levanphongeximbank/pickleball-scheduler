/**
 * COMMS-ACT-03 — typed authorization decision helpers (fail-closed).
 */

import { COMMUNICATION_FOUNDATION_ERROR_CODE } from "../errors/errorCodes.js";
import { CommunicationFoundationError } from "../errors/CommunicationFoundationError.js";
import {
  COMMUNICATION_AUTH_CAPABILITY,
  getCommsAct03CapabilityMatrix,
} from "./capabilityMatrix.js";
import {
  COMMUNICATION_AUTH_POLICY_CELL,
  evaluateCommsAct03PolicyCell,
} from "./policyMatrix.js";

export const COMMUNICATION_AUTHORIZATION_DECISION = Object.freeze({
  ALLOW: "ALLOW",
  DENY: "DENY",
  TRUSTED_BACKEND_REQUIRED: "TRUSTED_BACKEND_REQUIRED",
  BLOCKED_FAIL_CLOSED: "BLOCKED_FAIL_CLOSED",
});

/**
 * @param {{
 *   resource: string,
 *   actor: string,
 *   reason?: string,
 *   detail?: Record<string, unknown>,
 * }} input
 */
export function createCommunicationAuthorizationDecision(input = {}) {
  const resource = String(input.resource || "").trim();
  const actor = String(input.actor || "").trim();
  if (!resource || !actor) {
    return Object.freeze({
      decision: COMMUNICATION_AUTHORIZATION_DECISION.DENY,
      resource: resource || null,
      actor: actor || null,
      cell: COMMUNICATION_AUTH_POLICY_CELL.DENY,
      reason: "Missing resource or actor — fail-closed",
      detail: Object.freeze({ ...(input.detail || {}), failClosed: true }),
    });
  }

  const cell = evaluateCommsAct03PolicyCell(resource, actor);
  let decision = COMMUNICATION_AUTHORIZATION_DECISION.DENY;
  if (cell === COMMUNICATION_AUTH_POLICY_CELL.ALLOW) {
    decision = COMMUNICATION_AUTHORIZATION_DECISION.ALLOW;
  } else if (cell === COMMUNICATION_AUTH_POLICY_CELL.TRUSTED_BACKEND) {
    decision = COMMUNICATION_AUTHORIZATION_DECISION.TRUSTED_BACKEND_REQUIRED;
  }

  return Object.freeze({
    decision,
    resource,
    actor,
    cell,
    reason:
      input.reason ||
      (decision === COMMUNICATION_AUTHORIZATION_DECISION.ALLOW
        ? "Policy matrix allows"
        : decision ===
            COMMUNICATION_AUTHORIZATION_DECISION.TRUSTED_BACKEND_REQUIRED
          ? "Trusted backend required"
          : "Policy matrix denies — fail-closed"),
    detail: Object.freeze({ ...(input.detail || {}) }),
  });
}

/**
 * @param {ReturnType<typeof createCommunicationAuthorizationDecision>} decision
 * @param {string} [message]
 */
export function assertCommunicationAuthorizationAllowed(decision, message) {
  if (
    decision &&
    decision.decision === COMMUNICATION_AUTHORIZATION_DECISION.ALLOW
  ) {
    return decision;
  }
  throw new CommunicationFoundationError(
    COMMUNICATION_FOUNDATION_ERROR_CODE.AUTHORIZATION_DENIED,
    message || "Communication authorization denied",
    {
      decision: decision?.decision || COMMUNICATION_AUTHORIZATION_DECISION.DENY,
      resource: decision?.resource || null,
      actor: decision?.actor || null,
      cell: decision?.cell || COMMUNICATION_AUTH_POLICY_CELL.DENY,
      reason: decision?.reason || "fail-closed",
      detail: decision?.detail || null,
    }
  );
}

/**
 * Resolve whether a conversation type may use Client RLS SELECT.
 * @param {'DIRECT'|'CLUB'|'COMMUNITY'|'SYSTEM'|string} conversationType
 */
export function resolveClientRlsSelectCapability(conversationType) {
  const type = String(conversationType || "").toUpperCase();
  const matrix = getCommsAct03CapabilityMatrix();
  if (type === "CLUB") {
    return matrix.capabilities.club.readSelect;
  }
  if (type === "DIRECT") {
    return matrix.capabilities.direct.read;
  }
  if (type === "SYSTEM") {
    return matrix.capabilities.system.read;
  }
  if (type === "COMMUNITY") {
    return matrix.capabilities.community.read;
  }
  return COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED;
}

/**
 * Canonical membership dependency map for ACT-03.
 */
export function getCommsAct03MembershipDependencyMap() {
  return Object.freeze({
    identity: Object.freeze({
      userId: "auth.uid()",
      profile: "public.profiles",
      venueTenant: "public.user_venue_id() → venues.id === tenant_id",
      notAuthority: Object.freeze([
        "localStorage",
        "browser menu/UI gates",
        "client-supplied tenantId/clubId as sole authority",
      ]),
    }),
    club: Object.freeze({
      table: "public.club_members",
      activePredicate: "status = 'active'",
      inactiveStatuses: Object.freeze(["left", "removed"]),
      helper: "public.phase42_active_club_member_id(p_club_id text)",
      helperSecurity: "SECURITY DEFINER, search_path=public",
      communicationWrapper:
        "public.communication_auth_is_active_club_member(p_club_id text)",
      governanceNote:
        "club_governance_assignments is NOT required for baseline Club SELECT; manager/owner still need active membership.",
      inventedByCommunication: false,
    }),
    community: Object.freeze({
      table: null,
      helper: null,
      gate: "ACTIVATION_BLOCKER",
      communicationOwns: Object.freeze([
        "communication_community_restrictions",
        "conversation participants",
      ]),
      inventedByCommunication: false,
      clientRls: COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED,
    }),
    tenant: Object.freeze({
      rule: "tenant_id === venues.id",
      clubBound: "clubs.tenant_id / club_members.tenant_id",
      crossTenant: "DENY",
    }),
  });
}
