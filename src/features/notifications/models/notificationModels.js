export const NOTIFICATION_CHANNELS = Object.freeze({
  EMAIL: "email",
  SMS: "sms",
  ZALO: "zalo",
});

export const NOTIFICATION_STATUS = Object.freeze({
  PENDING: "pending",
  SENT: "sent",
  FAILED: "failed",
});

export const TEMPLATE_KEYS = Object.freeze([
  "booking_confirmed",
  "booking_cancelled",
  "tournament_created",
  "tournament_schedule_updated",
  "match_result_updated",
  "payment_success",
  "payment_failed",
  "subscription_expiring",
  "qr_checkin_success",
]);

export function createNotificationTemplate(input = {}) {
  const now = new Date().toISOString();
  return {
    id: input.id || `ntpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: input.tenantId || null,
    channel: input.channel || NOTIFICATION_CHANNELS.EMAIL,
    templateKey: input.templateKey,
    title: input.title || "",
    subject: input.subject || "",
    body: input.body || "",
    variables: input.variables || [],
    status: input.status || "active",
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

export function createNotificationJob(input = {}) {
  return {
    id: input.id || `njob_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: input.tenantId || null,
    recipientType: input.recipientType || "user",
    recipientId: input.recipientId || null,
    channel: input.channel,
    templateKey: input.templateKey,
    payload: input.payload || {},
    status: input.status || NOTIFICATION_STATUS.PENDING,
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function createNotificationLog(input = {}) {
  return {
    id: input.id || `nlog_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    jobId: input.jobId,
    tenantId: input.tenantId || null,
    channel: input.channel,
    templateKey: input.templateKey,
    status: input.status || NOTIFICATION_STATUS.PENDING,
    providerMessageId: input.providerMessageId || null,
    errorMessage: input.errorMessage || null,
    createdAt: input.createdAt || new Date().toISOString(),
    sentAt: input.sentAt || null,
  };
}

export function renderTemplate(template, variables = {}) {
  const replaceVars = (text) =>
    String(text || "").replace(/\{\{(\w+)\}\}/g, (_, key) =>
      variables[key] !== undefined ? String(variables[key]) : `{{${key}}}`
    );

  return {
    title: replaceVars(template.title),
    subject: replaceVars(template.subject),
    body: replaceVars(template.body),
  };
}
