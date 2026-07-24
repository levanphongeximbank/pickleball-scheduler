/**
 * COMMS-05 Communication schema mapping constants.
 * Targets public.communication_* only.
 */

export const COMMUNICATION_SCHEMA = "public";

export const COMMUNICATION_TABLES = Object.freeze({
  conversations: "communication_conversations",
  participants: "communication_conversation_participants",
  positionCounters: "communication_message_position_counters",
  messages: "communication_messages",
  reactions: "communication_message_reactions",
  readCursors: "communication_read_cursors",
  directRequests: "communication_direct_requests",
  pinnedMessages: "communication_pinned_messages",
  userBlocks: "communication_user_blocks",
  messageReports: "communication_message_reports",
  moderationActions: "communication_moderation_actions",
  communityRestrictions: "communication_community_restrictions",
  idempotency: "communication_idempotency",
  persistenceEvents: "communication_persistence_events",
});

export const COMMUNICATION_TABLE_NAME_VALUES = Object.freeze(
  Object.values(COMMUNICATION_TABLES)
);

/** Tables that must never be targeted by Communication adapters. */
export const FORBIDDEN_NON_COMMUNICATION_TABLES = Object.freeze([
  "profiles",
  "venues",
  "clubs",
  "club_members",
  "audit_logs",
  "notification_inbox",
  "finance_events",
  "match_live_states",
]);

export const COMMUNICATION_RPC = Object.freeze({
  allocateMessagePosition: "communication_allocate_message_position",
  advanceReadCursor: "communication_advance_read_cursor",
});

export const ACTIVATION_GATES = Object.freeze({
  CLIENT_RLS_POLICY: "DEFERRED_FAIL_CLOSED",
  REALTIME_PUBLICATION: "DEFERRED_NOT_ENABLED",
  SQL_APPLY: "DEFERRED_STAGING_FIRST_GATE",
  NOTIFICATION_OUTBOX: "DEFERRED_INTEGRATION_GATE",
  ATTACHMENT_STORAGE_BUCKET_RLS: "DEFERRED",
  CLUB_MEMBERSHIP_SQL_HELPER: "OWNER_APPROVAL_REQUIRED",
  COMMUNITY_MEMBERSHIP_SQL_HELPER: "ACTIVATION_BLOCKER",
});
