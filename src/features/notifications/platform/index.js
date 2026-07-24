/**
 * Notification Platform Core adoption surface.
 * Import only from src/core/platform/index.js via the adapter module.
 */

export {
  NOTIFICATION_PLATFORM_ADAPTER_ERROR,
  projectNotificationActor,
  projectNotificationSecurityContext,
  projectNotificationScope,
  projectNotificationRecipient,
  projectNotificationOperation,
  projectNotificationIdempotencyKey,
  projectNotificationTrace,
  projectNotificationEvent,
  projectNotificationError,
  projectNotificationVersion,
  projectNotificationCompatibility,
  projectNotificationCapability,
} from "./notificationPlatformAdapter.js";
