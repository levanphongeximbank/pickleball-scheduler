import { API_SCOPES } from "../../constants/apiScopes.js";
import { WEBHOOK_EVENT_TYPES } from "../../../integrations/constants/webhookFoundation.js";
import { listWebhookEvents } from "../../../integrations/services/webhookEventService.js";

export const webhooksRoutes = [
  {
    method: "GET",
    path: "/webhooks/test",
    scope: API_SCOPES.WEBHOOKS_READ,
    handler: ({ auth, requestId }) => ({
      mode: "placeholder",
      tenantId: auth.tenantId,
      message: "Webhook ingress chưa mở production — chỉ test nội bộ.",
      supportedEventTypes: Object.values(WEBHOOK_EVENT_TYPES),
      recentEvents: listWebhookEvents({ tenantId: auth.tenantId, limit: 5 }),
      echoRequestId: requestId,
    }),
  },
  {
    method: "POST",
    path: "/webhooks/test",
    scope: API_SCOPES.WEBHOOKS_WRITE,
    handler: ({ auth, body, requestId }) => ({
      accepted: true,
      tenantId: auth.tenantId,
      received: {
        eventType: body?.eventType || "test.ping",
        payload: body?.payload ?? null,
      },
      requestId,
      note: "Không gửi outbound webhook thật trong Phase 11C.",
    }),
  },
];
