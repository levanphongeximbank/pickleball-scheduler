/**
 * Payment domain → Notification Module pilot.
 * Does not call live Email/SMS/Zalo providers and does not use forceMock.
 */
import {
  emitDomainNotificationEvent,
  DOMAIN_EMIT_OUTCOMES,
} from "../services/domainNotificationAdapter.js";
import { NOTIFICATION_EVENT_TYPES } from "../constants/notificationEvents.js";
import { buildNotificationIdempotencyKey } from "../utils/idempotencyKey.js";

/**
 * @param {'PAYMENT_CONFIRMED'|'PAYMENT_FAILED'} eventType
 * @param {object} input
 */
export async function emitPaymentLifecycleNotification(eventType, input = {}) {
  const {
    tenantId,
    transactionId,
    orderId = null,
    amount = null,
    currency = "VND",
    buyerUserId = null,
    actorUserId = null,
    reason = null,
    version = null,
    recipientHints = null,
    directory = null,
  } = input;

  if (!tenantId || !transactionId) {
    return {
      ok: false,
      outcome: DOMAIN_EMIT_OUTCOMES.FAILED,
      error: "tenantId and transactionId are required.",
      notifications: [],
      createdCount: 0,
      duplicateCount: 0,
    };
  }

  if (
    eventType !== NOTIFICATION_EVENT_TYPES.PAYMENT_CONFIRMED &&
    eventType !== NOTIFICATION_EVENT_TYPES.PAYMENT_FAILED
  ) {
    return {
      ok: false,
      outcome: DOMAIN_EMIT_OUTCOMES.FAILED,
      error: `Unsupported payment eventType: ${eventType}`,
      notifications: [],
      createdCount: 0,
      duplicateCount: 0,
    };
  }

  const entityVersion = version || eventType;
  const idempotencyKey = buildNotificationIdempotencyKey({
    tenantId,
    eventType,
    entityId: String(transactionId),
    version: String(entityVersion),
  });

  const amountLabel =
    amount !== null && amount !== undefined
      ? `${amount} ${currency || "VND"}`
      : null;

  const hints =
    recipientHints ||
    (buyerUserId
      ? { userIds: [String(buyerUserId)] }
      : { roles: ["COURT_OWNER", "CASHIER", "ACCOUNTANT"] });

  return emitDomainNotificationEvent({
    tenantId,
    eventType,
    actorUserId,
    idempotencyKey,
    recipientHints: hints,
    directory,
    sourceEntityType: "payment_transaction",
    sourceEntityId: String(transactionId),
    domainSource: "payment-pilot",
    payload: {
      transactionId: String(transactionId),
      orderId: orderId || null,
      amount,
      amountLabel,
      currency,
      reason: reason || null,
      sourceEntityType: "payment_transaction",
      sourceEntityId: String(transactionId),
    },
  });
}
