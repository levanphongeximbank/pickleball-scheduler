/**
 * COMMS-ACT-03 — Authorization capability matrix (canonical decisions).
 *
 * Authored SQL does NOT mean applied. Staging/Production remain unchanged
 * until a separate Owner GO for remote activation.
 */

export const COMMUNICATION_AUTH_CAPABILITY = Object.freeze({
  TRUSTED_BACKEND_ONLY: "TRUSTED_BACKEND_ONLY",
  CLIENT_RLS_READY: "CLIENT_RLS_READY",
  BLOCKED_FAIL_CLOSED: "BLOCKED_FAIL_CLOSED",
});

export const COMMUNICATION_AUTH_ACTOR = Object.freeze({
  ANON: "anon",
  AUTHENTICATED_UNRELATED: "authenticated_unrelated",
  DIRECT_PARTICIPANT: "valid_direct_participant",
  SAME_TENANT_UNRELATED: "same_tenant_unrelated",
  ACTIVE_CLUB_MEMBER: "active_club_member",
  INACTIVE_CLUB_MEMBER: "inactive_or_removed_club_member",
  CLUB_MANAGER_OWNER: "club_manager_or_owner",
  ACTIVE_COMMUNITY_MEMBER: "active_community_member",
  COMMUNITY_MODERATOR: "community_moderator",
  CROSS_CLUB_USER: "cross_club_user",
  CROSS_COMMUNITY_USER: "cross_community_user",
  TRUSTED_BACKEND: "trusted_backend_service_role",
});

/**
 * High-level capability posture after ACT-03 authoring (not remote apply).
 */
export function getCommsAct03CapabilityMatrix() {
  return Object.freeze({
    phase: "COMMS-ACT-03",
    authoredSqlApplied: false,
    remoteActivationAllowed: false,
    realtimePublication: COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED,
    capabilities: Object.freeze({
      direct: Object.freeze({
        read: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        createConversation: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        sendMessage: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        mutateContent: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        reason:
          "DIRECT remains trusted-backend only. Participant-based client policy designed but not certified for Client RLS open.",
      }),
      system: Object.freeze({
        read: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        createConversation: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        sendMessage: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        mutateContent: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        reason: "SYSTEM is trusted-backend only by hard architecture default.",
      }),
      club: Object.freeze({
        readSelect:
          COMMUNICATION_AUTH_CAPABILITY.CLIENT_RLS_READY,
        createConversation:
          COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        sendMessage: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        mutateContent: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        participantAdmin:
          COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        pinAdmin: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        reason:
          "Canonical Club membership proven via public.club_members + phase42_active_club_member_id. ACT-03 authors SELECT-only Client RLS. Writes stay trusted-backend.",
        membershipSource: "public.club_members.status='active' via phase42_active_club_member_id(club_id)",
      }),
      community: Object.freeze({
        read: COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED,
        createConversation:
          COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED,
        sendMessage: COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED,
        mutateContent: COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED,
        moderation: COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED,
        reason:
          "No Platform Community membership/moderation SQL helper published. Keep deny-all Client RLS.",
        membershipSource: null,
      }),
      reports: Object.freeze({
        client: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        reason: "Report integrity requires trusted-backend after app authorization.",
      }),
      moderationActions: Object.freeze({
        client: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        reason: "Moderation integrity requires trusted-backend after app authorization.",
      }),
      readCursors: Object.freeze({
        clubOwnSelect: COMMUNICATION_AUTH_CAPABILITY.CLIENT_RLS_READY,
        write: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        reason:
          "Club members may SELECT own cursor rows for Club conversations. Cursor writes stay trusted-backend.",
      }),
      idempotencyKeys: Object.freeze({
        client: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
        reason: "Idempotency keys are server authority — deny client access.",
      }),
      rpcAllocatePosition: Object.freeze({
        client: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
      }),
      rpcAdvanceReadCursor: Object.freeze({
        client: COMMUNICATION_AUTH_CAPABILITY.TRUSTED_BACKEND_ONLY,
      }),
      attachments: Object.freeze({
        client: COMMUNICATION_AUTH_CAPABILITY.BLOCKED_FAIL_CLOSED,
        reason: "Storage bucket RLS deferred.",
      }),
    }),
    nextGate: "CLIENT_RLS_READY_FOR_STAGING_APPLY",
    nextGateScope: "CLUB_SELECT_ONLY",
    nextGateBlockedSurfaces: Object.freeze([
      "DIRECT_CLIENT_RLS",
      "SYSTEM_CLIENT_RLS",
      "COMMUNITY_CLIENT_RLS",
      "CLIENT_WRITES",
      "REALTIME_PUBLICATION",
      "PRODUCTION",
    ]),
  });
}
