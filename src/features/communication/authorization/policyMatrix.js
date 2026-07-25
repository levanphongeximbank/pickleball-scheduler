/**
 * COMMS-ACT-03 — Canonical authorization policy matrix.
 *
 * Cells use allow/deny for the intended production posture after ACT-03 SQL
 * is applied (Club SELECT only). Until Staging apply, remote remains deny-all.
 */

import {
  COMMUNICATION_AUTH_ACTOR,
  COMMUNICATION_AUTH_CAPABILITY,
} from "./capabilityMatrix.js";

const ALLOW = "ALLOW";
const DENY = "DENY";
const BACKEND = "TRUSTED_BACKEND";

/**
 * @typedef {'ALLOW'|'DENY'|'TRUSTED_BACKEND'} PolicyCell
 */

/**
 * Resource × actor matrix for Communication authorization decisions.
 * Cross-tenant / cross-club / cross-community are always DENY for clients.
 */
export function getCommsAct03PolicyMatrix() {
  const actors = COMMUNICATION_AUTH_ACTOR;
  return Object.freeze({
    phase: "COMMS-ACT-03",
    legend: Object.freeze({
      ALLOW: "Permitted for browser JWT client under scoped Client RLS (after ACT-03 apply)",
      DENY: "Denied for browser client (RLS deny / no grant / fail-closed)",
      TRUSTED_BACKEND: "Only service-role / trusted backend after application authorization",
    }),
    resources: Object.freeze({
      conversations_direct: row({
        [actors.ANON]: DENY,
        [actors.AUTHENTICATED_UNRELATED]: DENY,
        [actors.DIRECT_PARTICIPANT]: BACKEND,
        [actors.SAME_TENANT_UNRELATED]: DENY,
        [actors.ACTIVE_CLUB_MEMBER]: DENY,
        [actors.INACTIVE_CLUB_MEMBER]: DENY,
        [actors.CLUB_MANAGER_OWNER]: DENY,
        [actors.ACTIVE_COMMUNITY_MEMBER]: DENY,
        [actors.COMMUNITY_MODERATOR]: DENY,
        [actors.CROSS_CLUB_USER]: DENY,
        [actors.CROSS_COMMUNITY_USER]: DENY,
        [actors.TRUSTED_BACKEND]: ALLOW,
      }),
      conversations_system: row({
        [actors.ANON]: DENY,
        [actors.AUTHENTICATED_UNRELATED]: DENY,
        [actors.DIRECT_PARTICIPANT]: DENY,
        [actors.SAME_TENANT_UNRELATED]: DENY,
        [actors.ACTIVE_CLUB_MEMBER]: DENY,
        [actors.INACTIVE_CLUB_MEMBER]: DENY,
        [actors.CLUB_MANAGER_OWNER]: DENY,
        [actors.ACTIVE_COMMUNITY_MEMBER]: DENY,
        [actors.COMMUNITY_MODERATOR]: DENY,
        [actors.CROSS_CLUB_USER]: DENY,
        [actors.CROSS_COMMUNITY_USER]: DENY,
        [actors.TRUSTED_BACKEND]: ALLOW,
      }),
      conversations_club_select: row({
        [actors.ANON]: DENY,
        [actors.AUTHENTICATED_UNRELATED]: DENY,
        [actors.DIRECT_PARTICIPANT]: DENY,
        [actors.SAME_TENANT_UNRELATED]: DENY,
        [actors.ACTIVE_CLUB_MEMBER]: ALLOW,
        [actors.INACTIVE_CLUB_MEMBER]: DENY,
        [actors.CLUB_MANAGER_OWNER]: ALLOW,
        [actors.ACTIVE_COMMUNITY_MEMBER]: DENY,
        [actors.COMMUNITY_MODERATOR]: DENY,
        [actors.CROSS_CLUB_USER]: DENY,
        [actors.CROSS_COMMUNITY_USER]: DENY,
        [actors.TRUSTED_BACKEND]: ALLOW,
      }),
      conversations_club_mutate: row({
        [actors.ANON]: DENY,
        [actors.AUTHENTICATED_UNRELATED]: DENY,
        [actors.DIRECT_PARTICIPANT]: DENY,
        [actors.SAME_TENANT_UNRELATED]: DENY,
        [actors.ACTIVE_CLUB_MEMBER]: BACKEND,
        [actors.INACTIVE_CLUB_MEMBER]: DENY,
        [actors.CLUB_MANAGER_OWNER]: BACKEND,
        [actors.ACTIVE_COMMUNITY_MEMBER]: DENY,
        [actors.COMMUNITY_MODERATOR]: DENY,
        [actors.CROSS_CLUB_USER]: DENY,
        [actors.CROSS_COMMUNITY_USER]: DENY,
        [actors.TRUSTED_BACKEND]: ALLOW,
      }),
      conversations_community: row({
        [actors.ANON]: DENY,
        [actors.AUTHENTICATED_UNRELATED]: DENY,
        [actors.DIRECT_PARTICIPANT]: DENY,
        [actors.SAME_TENANT_UNRELATED]: DENY,
        [actors.ACTIVE_CLUB_MEMBER]: DENY,
        [actors.INACTIVE_CLUB_MEMBER]: DENY,
        [actors.CLUB_MANAGER_OWNER]: DENY,
        [actors.ACTIVE_COMMUNITY_MEMBER]: DENY,
        [actors.COMMUNITY_MODERATOR]: DENY,
        [actors.CROSS_CLUB_USER]: DENY,
        [actors.CROSS_COMMUNITY_USER]: DENY,
        [actors.TRUSTED_BACKEND]: ALLOW,
      }),
      participants_club_select: row({
        [actors.ANON]: DENY,
        [actors.AUTHENTICATED_UNRELATED]: DENY,
        [actors.DIRECT_PARTICIPANT]: DENY,
        [actors.SAME_TENANT_UNRELATED]: DENY,
        [actors.ACTIVE_CLUB_MEMBER]: ALLOW,
        [actors.INACTIVE_CLUB_MEMBER]: DENY,
        [actors.CLUB_MANAGER_OWNER]: ALLOW,
        [actors.ACTIVE_COMMUNITY_MEMBER]: DENY,
        [actors.COMMUNITY_MODERATOR]: DENY,
        [actors.CROSS_CLUB_USER]: DENY,
        [actors.CROSS_COMMUNITY_USER]: DENY,
        [actors.TRUSTED_BACKEND]: ALLOW,
      }),
      participants_forge_insert: row({
        [actors.ANON]: DENY,
        [actors.AUTHENTICATED_UNRELATED]: DENY,
        [actors.DIRECT_PARTICIPANT]: DENY,
        [actors.SAME_TENANT_UNRELATED]: DENY,
        [actors.ACTIVE_CLUB_MEMBER]: DENY,
        [actors.INACTIVE_CLUB_MEMBER]: DENY,
        [actors.CLUB_MANAGER_OWNER]: DENY,
        [actors.ACTIVE_COMMUNITY_MEMBER]: DENY,
        [actors.COMMUNITY_MODERATOR]: DENY,
        [actors.CROSS_CLUB_USER]: DENY,
        [actors.CROSS_COMMUNITY_USER]: DENY,
        [actors.TRUSTED_BACKEND]: ALLOW,
      }),
      messages_club_select: row({
        [actors.ANON]: DENY,
        [actors.AUTHENTICATED_UNRELATED]: DENY,
        [actors.DIRECT_PARTICIPANT]: DENY,
        [actors.SAME_TENANT_UNRELATED]: DENY,
        [actors.ACTIVE_CLUB_MEMBER]: ALLOW,
        [actors.INACTIVE_CLUB_MEMBER]: DENY,
        [actors.CLUB_MANAGER_OWNER]: ALLOW,
        [actors.ACTIVE_COMMUNITY_MEMBER]: DENY,
        [actors.COMMUNITY_MODERATOR]: DENY,
        [actors.CROSS_CLUB_USER]: DENY,
        [actors.CROSS_COMMUNITY_USER]: DENY,
        [actors.TRUSTED_BACKEND]: ALLOW,
      }),
      messages_send_or_spoof: row({
        [actors.ANON]: DENY,
        [actors.AUTHENTICATED_UNRELATED]: DENY,
        [actors.DIRECT_PARTICIPANT]: BACKEND,
        [actors.SAME_TENANT_UNRELATED]: DENY,
        [actors.ACTIVE_CLUB_MEMBER]: BACKEND,
        [actors.INACTIVE_CLUB_MEMBER]: DENY,
        [actors.CLUB_MANAGER_OWNER]: BACKEND,
        [actors.ACTIVE_COMMUNITY_MEMBER]: DENY,
        [actors.COMMUNITY_MODERATOR]: DENY,
        [actors.CROSS_CLUB_USER]: DENY,
        [actors.CROSS_COMMUNITY_USER]: DENY,
        [actors.TRUSTED_BACKEND]: ALLOW,
      }),
      read_cursors_own_club_select: row({
        [actors.ANON]: DENY,
        [actors.AUTHENTICATED_UNRELATED]: DENY,
        [actors.DIRECT_PARTICIPANT]: BACKEND,
        [actors.SAME_TENANT_UNRELATED]: DENY,
        [actors.ACTIVE_CLUB_MEMBER]: ALLOW,
        [actors.INACTIVE_CLUB_MEMBER]: DENY,
        [actors.CLUB_MANAGER_OWNER]: ALLOW,
        [actors.ACTIVE_COMMUNITY_MEMBER]: DENY,
        [actors.COMMUNITY_MODERATOR]: DENY,
        [actors.CROSS_CLUB_USER]: DENY,
        [actors.CROSS_COMMUNITY_USER]: DENY,
        [actors.TRUSTED_BACKEND]: ALLOW,
      }),
      read_cursors_other_user: row({
        [actors.ANON]: DENY,
        [actors.AUTHENTICATED_UNRELATED]: DENY,
        [actors.DIRECT_PARTICIPANT]: DENY,
        [actors.SAME_TENANT_UNRELATED]: DENY,
        [actors.ACTIVE_CLUB_MEMBER]: DENY,
        [actors.INACTIVE_CLUB_MEMBER]: DENY,
        [actors.CLUB_MANAGER_OWNER]: DENY,
        [actors.ACTIVE_COMMUNITY_MEMBER]: DENY,
        [actors.COMMUNITY_MODERATOR]: DENY,
        [actors.CROSS_CLUB_USER]: DENY,
        [actors.CROSS_COMMUNITY_USER]: DENY,
        [actors.TRUSTED_BACKEND]: ALLOW,
      }),
      pins_club_select: row({
        [actors.ANON]: DENY,
        [actors.AUTHENTICATED_UNRELATED]: DENY,
        [actors.DIRECT_PARTICIPANT]: DENY,
        [actors.SAME_TENANT_UNRELATED]: DENY,
        [actors.ACTIVE_CLUB_MEMBER]: ALLOW,
        [actors.INACTIVE_CLUB_MEMBER]: DENY,
        [actors.CLUB_MANAGER_OWNER]: ALLOW,
        [actors.ACTIVE_COMMUNITY_MEMBER]: DENY,
        [actors.COMMUNITY_MODERATOR]: DENY,
        [actors.CROSS_CLUB_USER]: DENY,
        [actors.CROSS_COMMUNITY_USER]: DENY,
        [actors.TRUSTED_BACKEND]: ALLOW,
      }),
      pins_mutate: row({
        [actors.ANON]: DENY,
        [actors.AUTHENTICATED_UNRELATED]: DENY,
        [actors.DIRECT_PARTICIPANT]: DENY,
        [actors.SAME_TENANT_UNRELATED]: DENY,
        [actors.ACTIVE_CLUB_MEMBER]: BACKEND,
        [actors.INACTIVE_CLUB_MEMBER]: DENY,
        [actors.CLUB_MANAGER_OWNER]: BACKEND,
        [actors.ACTIVE_COMMUNITY_MEMBER]: DENY,
        [actors.COMMUNITY_MODERATOR]: DENY,
        [actors.CROSS_CLUB_USER]: DENY,
        [actors.CROSS_COMMUNITY_USER]: DENY,
        [actors.TRUSTED_BACKEND]: ALLOW,
      }),
      reports: row({
        [actors.ANON]: DENY,
        [actors.AUTHENTICATED_UNRELATED]: DENY,
        [actors.DIRECT_PARTICIPANT]: BACKEND,
        [actors.SAME_TENANT_UNRELATED]: DENY,
        [actors.ACTIVE_CLUB_MEMBER]: BACKEND,
        [actors.INACTIVE_CLUB_MEMBER]: DENY,
        [actors.CLUB_MANAGER_OWNER]: BACKEND,
        [actors.ACTIVE_COMMUNITY_MEMBER]: DENY,
        [actors.COMMUNITY_MODERATOR]: DENY,
        [actors.CROSS_CLUB_USER]: DENY,
        [actors.CROSS_COMMUNITY_USER]: DENY,
        [actors.TRUSTED_BACKEND]: ALLOW,
      }),
      moderation_actions: row({
        [actors.ANON]: DENY,
        [actors.AUTHENTICATED_UNRELATED]: DENY,
        [actors.DIRECT_PARTICIPANT]: DENY,
        [actors.SAME_TENANT_UNRELATED]: DENY,
        [actors.ACTIVE_CLUB_MEMBER]: DENY,
        [actors.INACTIVE_CLUB_MEMBER]: DENY,
        [actors.CLUB_MANAGER_OWNER]: BACKEND,
        [actors.ACTIVE_COMMUNITY_MEMBER]: DENY,
        [actors.COMMUNITY_MODERATOR]: DENY,
        [actors.CROSS_CLUB_USER]: DENY,
        [actors.CROSS_COMMUNITY_USER]: DENY,
        [actors.TRUSTED_BACKEND]: ALLOW,
      }),
      idempotency_keys: row({
        [actors.ANON]: DENY,
        [actors.AUTHENTICATED_UNRELATED]: DENY,
        [actors.DIRECT_PARTICIPANT]: DENY,
        [actors.SAME_TENANT_UNRELATED]: DENY,
        [actors.ACTIVE_CLUB_MEMBER]: DENY,
        [actors.INACTIVE_CLUB_MEMBER]: DENY,
        [actors.CLUB_MANAGER_OWNER]: DENY,
        [actors.ACTIVE_COMMUNITY_MEMBER]: DENY,
        [actors.COMMUNITY_MODERATOR]: DENY,
        [actors.CROSS_CLUB_USER]: DENY,
        [actors.CROSS_COMMUNITY_USER]: DENY,
        [actors.TRUSTED_BACKEND]: ALLOW,
      }),
      rpc_execution: row({
        [actors.ANON]: DENY,
        [actors.AUTHENTICATED_UNRELATED]: DENY,
        [actors.DIRECT_PARTICIPANT]: DENY,
        [actors.SAME_TENANT_UNRELATED]: DENY,
        [actors.ACTIVE_CLUB_MEMBER]: DENY,
        [actors.INACTIVE_CLUB_MEMBER]: DENY,
        [actors.CLUB_MANAGER_OWNER]: DENY,
        [actors.ACTIVE_COMMUNITY_MEMBER]: DENY,
        [actors.COMMUNITY_MODERATOR]: DENY,
        [actors.CROSS_CLUB_USER]: DENY,
        [actors.CROSS_COMMUNITY_USER]: DENY,
        [actors.TRUSTED_BACKEND]: ALLOW,
      }),
    }),
    failClosedRules: Object.freeze([
      "Missing auth.uid() → DENY all client paths",
      "Missing phase42_active_club_member_id helper → ACT-03 SQL apply refuses (exception)",
      "Inactive/left/removed club membership → DENY Club SELECT",
      "Cross-club / cross-community / cross-tenant → DENY",
      "Unknown conversation type / missing club_id on CLUB row → DENY",
      "Community membership helper absent → keep deny-all",
      "Identity unclear → production gateway UNAVAILABLE / typed authorization error",
    ]),
    capabilityAlignment: Object.freeze({
      clubSelect: COMMUNICATION_AUTH_CAPABILITY.CLIENT_RLS_READY,
      direct: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
      system: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
      community: COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED,
    }),
  });
}

/**
 * @param {Record<string, PolicyCell>} cells
 */
function row(cells) {
  return Object.freeze({ ...cells });
}

/**
 * Evaluate a matrix cell.
 * @param {string} resource
 * @param {string} actor
 * @returns {PolicyCell}
 */
export function evaluateCommsAct03PolicyCell(resource, actor) {
  const matrix = getCommsAct03PolicyMatrix();
  const resourceRow = matrix.resources[resource];
  if (!resourceRow) {
    return DENY;
  }
  const cell = resourceRow[actor];
  return cell || DENY;
}

export const COMMUNICATION_AUTH_POLICY_CELL = Object.freeze({
  ALLOW,
  DENY,
  TRUSTED_BACKEND: BACKEND,
});
