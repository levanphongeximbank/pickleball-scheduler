import { API_SCOPES } from "../../constants/apiScopes.js";
import { sendNotification, listNotificationLogs } from "../../../notifications/services/notificationService.js";

export const notificationsRoutes = [
  {
    method: "GET",
    path: "/notifications/logs",
    scope: API_SCOPES.NOTIFICATIONS_READ,
    handler: (ctx) => ({
      items: listNotificationLogs({ tenantId: ctx.auth?.tenantId }),
    }),
  },
  {
    method: "POST",
    path: "/notifications/send",
    scope: API_SCOPES.NOTIFICATIONS_WRITE,
    handler: async (ctx) => {
      const result = await sendNotification({
        tenantId: ctx.auth?.tenantId,
        channel: ctx.body?.channel,
        templateKey: ctx.body?.templateKey,
        recipientId: ctx.body?.recipientId,
        variables: ctx.body?.variables,
        forceMock: ctx.body?.forceMock !== false,
      });
      if (!result.ok) {
        throw Object.assign(new Error(result.error), { statusCode: 400 });
      }
      return result;
    },
  },
];
