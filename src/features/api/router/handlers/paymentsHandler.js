import {
  createPayment,
  getPaymentStatus,
  handlePaymentCallback,
  refundPayment,
} from "../../../payments/services/paymentGatewayService.js";
import { API_SCOPES } from "../../constants/apiScopes.js";
import { recordWebhookEvent, markWebhookProcessed } from "../../../integrations/services/webhookEventService.js";
import { emitPaymentLifecycleNotification } from "../../../notifications/adapters/paymentNotificationPilot.js";
import { NOTIFICATION_EVENT_TYPES } from "../../../notifications/constants/notificationEvents.js";

export const paymentsRoutes = [
  {
    method: "POST",
    path: "/payments/create",
    scope: API_SCOPES.PAYMENTS_WRITE,
    handler: async (ctx) => {
      const result = await createPayment({
        tenantId: ctx.auth?.tenantId,
        orderId: ctx.body?.orderId,
        amount: ctx.body?.amount,
        currency: ctx.body?.currency,
        provider: ctx.body?.provider,
        idempotencyKey: ctx.body?.idempotencyKey,
      });
      if (!result.ok) {
        throw Object.assign(new Error(result.error), { statusCode: 400 });
      }
      return result;
    },
  },
  {
    method: "GET",
    path: "/payments/:transactionId/status",
    scope: API_SCOPES.PAYMENTS_READ,
    handler: (ctx) => {
      const result = getPaymentStatus(ctx.params?.transactionId);
      if (!result.ok) {
        throw Object.assign(new Error(result.error), { statusCode: 404 });
      }
      return result;
    },
  },
  {
    method: "POST",
    path: "/payments/:transactionId/refund",
    scope: API_SCOPES.PAYMENTS_WRITE,
    handler: async (ctx) => {
      const result = await refundPayment(ctx.params?.transactionId);
      if (!result.ok) {
        throw Object.assign(new Error(result.error), { statusCode: 400 });
      }
      return result;
    },
  },
  {
    method: "POST",
    path: "/payments/:provider/callback",
    scope: null,
    public: true,
    handler: async (ctx) => {
      const provider = ctx.params?.provider;
      const idempotencyKey = ctx.body?.idempotencyKey || `${provider}_${ctx.body?.transactionId}`;

      const recorded = recordWebhookEvent({
        tenantId: ctx.auth?.tenantId || ctx.body?.tenantId || null,
        provider,
        eventType: "payment_callback",
        payload: ctx.body || {},
        signature: ctx.headers?.["x-signature"] || ctx.body?.signature,
        idempotencyKey,
      });

      if (recorded.idempotent) {
        return { ok: true, idempotent: true, event: recorded.event };
      }

      const result = await handlePaymentCallback(provider, {
        transactionId: ctx.body?.transactionId,
        payload: ctx.body || {},
        signature: ctx.body?.signature,
      });

      markWebhookProcessed(recorded.event.id, {
        status: result.ok ? "processed" : "failed",
        errorMessage: result.error || null,
      });

      const tenantId =
        ctx.body?.tenantId || ctx.auth?.tenantId || result.transaction?.tenantId;
      const transactionId =
        result.transaction?.id || ctx.body?.transactionId || null;
      if (tenantId && transactionId) {
        // Phase 1.3 pilot — canonical inbox + queue (no live email / forceMock).
        await emitPaymentLifecycleNotification(
          result.ok
            ? NOTIFICATION_EVENT_TYPES.PAYMENT_CONFIRMED
            : NOTIFICATION_EVENT_TYPES.PAYMENT_FAILED,
          {
            tenantId,
            transactionId,
            orderId: result.transaction?.orderId || ctx.body?.orderId || null,
            amount: result.transaction?.amount ?? ctx.body?.amount ?? null,
            currency: result.transaction?.currency || ctx.body?.currency || "VND",
            buyerUserId: ctx.body?.buyerUserId || null,
            reason: result.error || null,
            version: result.ok ? "confirmed" : "failed",
          }
        );
      }

      if (!result.ok) {
        throw Object.assign(new Error(result.error || "Callback failed"), { statusCode: 400 });
      }
      return result;
    },
  },
];
