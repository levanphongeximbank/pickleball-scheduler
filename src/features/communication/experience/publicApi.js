/**
 * Non-React public API for Messaging Experience (safe for node:test).
 * React page/provider live under experience/*.jsx and are imported by the router.
 */

export {
  MESSAGING_EXPERIENCE_PHASE,
  MESSAGING_ROUTE_PATH,
  MESSAGING_MENU_KEY,
  MESSAGING_TAB,
  MESSAGING_TAB_VALUES,
  MESSAGING_TAB_LABEL,
  MESSAGE_BODY_MAX_LENGTH,
  MESSAGE_PREVIEW_MAX_LENGTH,
  DEMO_GATEWAY_MARKER,
} from "./constants.js";

export {
  COMMUNICATION_EXPERIENCE_GATEWAY_METHODS,
  matchesCommunicationExperienceGateway,
} from "./gatewayPort.js";

export {
  asPlainText,
  sanitizeMessageBodyForDisplay,
  truncatePreview,
  createParticipantProjectionVm,
  createDirectConversationListItemVm,
  createDirectRequestListItemVm,
  createClubChannelListItemVm,
  createCommunityChannelListItemVm,
  createMessageItemVm,
  createAccessDecisionVm,
  createUnreadBadgeVm,
  validateComposerBody,
  assertNotRawPersistenceRow,
} from "./viewModels.js";

export { createDemoMessagingExperienceGateway } from "./createDemoMessagingExperienceGateway.js";
