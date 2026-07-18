/**
 * PICK_VN Notification Module — public API (Phase 1.1 Source of Truth).
 *
 * Domain modules may import only from this barrel.
 * Providers and storage implementations are intentionally NOT exported.
 */

// --- Phase 1.1 canonical public API ---
export { emitNotificationEvent } from "./services/notificationEmitService.js";
export {
  listInbox,
  markNotificationRead,
  markAllNotificationsRead,
} from "./services/notificationInboxService.js";
export { getNotificationPreferences } from "./services/notificationPreferencesService.js";

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
  validateNotificationEventEnvelope,
  createNotificationEventEnvelope,
  ENVELOPE_ERROR_CODES,
  getEmptyRecipientHints,
} from "./contracts/notificationEventEnvelope.js";

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
