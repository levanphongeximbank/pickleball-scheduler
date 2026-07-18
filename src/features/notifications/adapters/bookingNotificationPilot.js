/**
 * Booking domain → Notification Module pilot.
 *
 * Distinct from booking start reminders (`src/domain/bookingReminderService.js`):
 * - BOOKING_CREATED / BOOKING_CANCELLED = lifecycle event notifications (this adapter)
 * - Browser/local reminders = time-based "booking sắp tới" (kept separate, not replaced)
 */
import {
  emitDomainNotificationEvent,
  DOMAIN_EMIT_OUTCOMES,
} from "../services/domainNotificationAdapter.js";
import { NOTIFICATION_EVENT_TYPES } from "../constants/notificationEvents.js";
import { buildNotificationIdempotencyKey } from "../utils/idempotencyKey.js";

const BOOKING_STAFF_ROLES = Object.freeze([
  "COURT_OWNER",
  "COURT_MANAGER",
  "CASHIER",
]);

/**
 * @param {'BOOKING_CREATED'|'BOOKING_CANCELLED'} eventType
 * @param {object} input
 */
export function emitBookingLifecycleNotification(eventType, input = {}) {
  const {
    tenantId,
    clubId = null,
    venueId = null,
    booking,
    actorUserId = null,
    recipientHints = null,
    directory = null,
    version = null,
  } = input;

  if (!tenantId || !booking?.id) {
    return {
      ok: false,
      outcome: DOMAIN_EMIT_OUTCOMES.FAILED,
      error: "tenantId and booking.id are required.",
      notifications: [],
      createdCount: 0,
      duplicateCount: 0,
    };
  }

  if (
    eventType !== NOTIFICATION_EVENT_TYPES.BOOKING_CREATED &&
    eventType !== NOTIFICATION_EVENT_TYPES.BOOKING_CANCELLED
  ) {
    return {
      ok: false,
      outcome: DOMAIN_EMIT_OUTCOMES.FAILED,
      error: `Unsupported booking eventType: ${eventType}`,
      notifications: [],
      createdCount: 0,
      duplicateCount: 0,
    };
  }

  const entityVersion =
    version ||
    booking.updatedAt ||
    booking.createdAt ||
    eventType;

  const idempotencyKey = buildNotificationIdempotencyKey({
    tenantId,
    eventType,
    entityId: String(booking.id),
    version: String(entityVersion),
  });

  return emitDomainNotificationEvent({
    tenantId,
    clubId,
    venueId: venueId || tenantId,
    eventType,
    actorUserId,
    idempotencyKey,
    recipientHints: recipientHints || { roles: [...BOOKING_STAFF_ROLES] },
    directory,
    sourceEntityType: "booking",
    sourceEntityId: String(booking.id),
    domainSource: "booking-pilot",
    payload: {
      bookingId: booking.id,
      courtName: booking.courtName || null,
      courtId: booking.courtId || null,
      startTime: booking.startTime || null,
      customerName: booking.customerName || null,
      bookingStatus: booking.bookingStatus || null,
      sourceEntityType: "booking",
      sourceEntityId: String(booking.id),
    },
  });
}
