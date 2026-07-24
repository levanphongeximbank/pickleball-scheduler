/**
 * Communication Foundation — public facade (COMMS-01 Messaging Domain Foundation).
 *
 * Export only canonical public contracts, domain rules, errors, and ports.
 * Consumers must import from this index — not from internal file paths —
 * once wiring begins in later phases.
 *
 * Does NOT export:
 * - SQL / migrations / Supabase clients
 * - realtime runtime wiring
 * - notification delivery / inbox SoT
 * - UI / routes / React hooks
 * - Identity / Club / Player / Competition ownership surfaces
 */

export const COMMUNICATION_FOUNDATION_PHASE = Object.freeze({
  id: "COMMS-01",
  name: "messaging-domain-foundation",
  wiredToProductionRuntime: false,
  hasPersistence: false,
  hasRealtime: false,
  hasUi: false,
});

export {
  CONVERSATION_TYPE,
  CONVERSATION_TYPE_VALUES,
  isConversationType,
  CONVERSATION_STATUS,
  CONVERSATION_STATUS_VALUES,
  CONVERSATION_TERMINAL_STATUSES,
  CONVERSATION_ALLOWED_TRANSITIONS,
  isConversationStatus,
  CONVERSATION_ROLE,
  CONVERSATION_ROLE_VALUES,
  isConversationRole,
  PARTICIPANT_STATUS,
  PARTICIPANT_STATUS_VALUES,
  PARTICIPANT_TERMINAL_STATUSES,
  PARTICIPANT_ALLOWED_TRANSITIONS,
  isParticipantStatus,
  MESSAGE_STATUS,
  MESSAGE_STATUS_VALUES,
  MESSAGE_TERMINAL_STATUSES,
  MESSAGE_ALLOWED_TRANSITIONS,
  isMessageStatus,
  MODERATION_ACTION_TYPE,
  MODERATION_ACTION_TYPE_VALUES,
  isModerationActionType,
} from "./constants/index.js";

export {
  COMMUNICATION_FOUNDATION_ERROR_CODE,
  CommunicationFoundationError,
  isCommunicationFoundationError,
  isCommunicationFoundationErrorCode,
} from "./errors/index.js";

export {
  failContract,
  isNonEmptyString,
  isValidTimestamp,
  timestampSortValue,
  requireNonEmptyString,
  requireValidTimestamp,
  optionalNonEmptyString,
  deepFreeze,
  clonePlain,
  requireOpaqueId,
  createConversationId,
  createMessageId,
  createParticipantId,
  normalizeIdentifier,
  createConversationContract,
  isConversationContract,
  createConversationParticipantContract,
  isConversationParticipantContract,
  createReplyReferenceContract,
  createMessageContract,
  isMessageContract,
  MAX_REACTION_EMOJI_LENGTH,
  createReactionContract,
  createReadCursorContract,
  createAttachmentReferenceContract,
  createUserBlockContract,
  createMessageReportContract,
  createModerationActionContract,
} from "./contracts/index.js";

export {
  assertConversationType,
  createValidConversation,
  transitionConversationStatus,
  addParticipant,
  updateParticipantRole,
  transitionParticipantStatus,
  suspendOrRemoveParticipant,
  assertCanSendMessage,
  findActiveParticipant,
  createMessageForConversation,
  assertReplyTargetInConversation,
  transitionMessageStatus,
  advanceReadCursor,
  validateAttachmentReference,
  validateReaction,
  validateUserBlock,
  validateMessageReport,
  validateModerationAction,
} from "./domain/index.js";

export {
  throwPortUnimplemented,
  matchesPortMethods,
  IDENTITY_ACTOR_PORT_METHODS,
  matchesIdentityActorPort,
  createUnimplementedIdentityActorPort,
  PLAYER_DISPLAY_PORT_METHODS,
  matchesPlayerDisplayPort,
  createUnimplementedPlayerDisplayPort,
  CLUB_MEMBERSHIP_PORT_METHODS,
  matchesClubMembershipPort,
  createUnimplementedClubMembershipPort,
  TENANT_SCOPE_PORT_METHODS,
  matchesTenantScopePort,
  createUnimplementedTenantScopePort,
  NOTIFICATION_EMIT_PORT_METHODS,
  matchesNotificationEmitPort,
  createUnimplementedNotificationEmitPort,
  REALTIME_DELIVERY_PORT_METHODS,
  matchesRealtimeDeliveryPort,
  createUnimplementedRealtimeDeliveryPort,
  FILE_STORAGE_PORT_METHODS,
  matchesFileStoragePort,
  createUnimplementedFileStoragePort,
  AUDIT_EVENT_PORT_METHODS,
  matchesAuditEventPort,
  createUnimplementedAuditEventPort,
  CLOCK_PORT_METHODS,
  ID_PROVIDER_PORT_METHODS,
  matchesClockPort,
  matchesIdProviderPort,
  createUnimplementedClockPort,
  createUnimplementedIdProviderPort,
} from "./ports/index.js";
