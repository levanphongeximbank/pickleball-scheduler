/**
 * PICK_VN Notification Module — public API (Phase 1.3).
 *
 * Domain modules may import only from this barrel.
 * Providers and storage implementations are intentionally NOT exported.
 */

// --- Canonical public API ---
export { emitNotificationEvent } from "./services/notificationEmitService.js";
export {
  emitDomainNotificationEvent,
  DOMAIN_EMIT_OUTCOMES,
} from "./services/domainNotificationAdapter.js";
export {
  listInbox,
  markNotificationRead,
  markAllNotificationsRead,
  countUnreadNotifications,
} from "./services/notificationInboxService.js";
export { getNotificationPreferences } from "./services/notificationPreferencesService.js";

export {
  enqueueNotificationDelivery,
  listQueuedDeliveryJobs,
  markDeliveryJobResult,
  DELIVERY_CHANNELS,
  DELIVERY_JOB_STATUSES,
} from "./services/notificationQueueService.js";

export {
  createNotificationRepository,
  getNotificationRepository,
  setNotificationRepository,
  resetNotificationRepository,
  resolveNotificationStoreMode,
  NOTIFICATION_STORE_MODES,
} from "./repositories/notificationRepository.js";

export {
  NOTIFICATION_EVENT_TYPES,
  NOTIFICATION_EVENT_CATALOGUE,
  isKnownNotificationEventType,
} from "./constants/notificationEvents.js";

export {
  NOTIFICATION_STATUSES,
  NOTIFICATION_STATUS_VALUES,
  isValidNotificationStatus,
} from "./constants/notificationStatuses.js";

export {
  NOTIFICATION_PRIORITIES,
  NOTIFICATION_PRIORITY_VALUES,
  isValidNotificationPriority,
} from "./constants/notificationPriorities.js";

export {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_VALUES,
  isValidNotificationCategory,
} from "./constants/notificationCategories.js";

export {
  EVENT_CLASSIFICATION,
  getEventClassification,
} from "./constants/eventClassification.js";

export {
  validateNotificationEventEnvelope,
  createNotificationEventEnvelope,
  ENVELOPE_ERROR_CODES,
  getEmptyRecipientHints,
} from "./contracts/notificationEventEnvelope.js";

export {
  buildNotificationIdempotencyKey,
  buildRecipientIdempotencyKey,
} from "./utils/idempotencyKey.js";

export {
  createMemoryRecipientDirectory,
  createEmptyRecipientDirectory,
  setRecipientDirectory,
  resetRecipientDirectory,
  getRecipientDirectory,
} from "./recipients/recipientDirectory.js";

export {
  createIdentityMembershipDirectory,
  createDefaultIdentityDirectory,
} from "./recipients/identityMembershipDirectory.js";

export {
  ensureIdentityRecipientDirectory,
} from "./recipients/recipientBootstrap.js";

export { resolveNotificationRecipients } from "./recipients/resolveRecipients.js";

export { emitMatchScheduledFromBoundary } from "./adapters/competitionMatchScheduledAdapter.js";
export { emitBookingLifecycleNotification } from "./adapters/bookingNotificationPilot.js";
export { emitPaymentLifecycleNotification } from "./adapters/paymentNotificationPilot.js";

export { NOTIFICATION_COMPATIBILITY } from "./COMPATIBILITY.js";

// --- Legacy channel/template API (compat; not for new domain emitters) ---
export {
  NOTIFICATION_CHANNELS,
  TEMPLATE_KEYS,
  renderTemplate,
} from "./models/notificationModels.js";
export {
  sendNotification,
  sendTestNotification,
  listNotificationLogs,
  seedDefaultTemplates,
} from "./services/notificationService.js";
