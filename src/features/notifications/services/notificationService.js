import {
  createNotificationJob,
  createNotificationLog,
  createNotificationTemplate,
  NOTIFICATION_STATUS,
  renderTemplate,
  TEMPLATE_KEYS,
} from "../models/notificationModels.js";
import { resolveNotificationProvider } from "../providers/index.js";
import {
  loadNotificationJobs,
  loadNotificationLogs,
  loadNotificationTemplates,
  saveNotificationJobs,
  saveNotificationLogs,
  saveNotificationTemplates,
} from "../storage/notificationStorage.js";

export function seedDefaultTemplates() {
  const existing = loadNotificationTemplates();
  if (existing.length > 0) return existing;

  const defaults = TEMPLATE_KEYS.map((templateKey) =>
    createNotificationTemplate({
      templateKey,
      channel: templateKey.includes("payment") ? "email" : "zalo",
      title: templateKey.replace(/_/g, " "),
      subject: `[Pickleball] ${templateKey}`,
      body: "Xin chào {{name}}, thông báo: {{message}}",
      variables: ["name", "message"],
      status: "active",
    })
  );

  saveNotificationTemplates(defaults);
  return defaults;
}

export function getTemplate(templateKey, channel, tenantId = null) {
  const templates = loadNotificationTemplates();
  return (
    templates.find(
      (t) =>
        t.templateKey === templateKey &&
        t.channel === channel &&
        (!tenantId || !t.tenantId || t.tenantId === tenantId)
    ) || null
  );
}

export async function sendNotification(input = {}) {
  const {
    tenantId,
    channel,
    templateKey,
    recipientType = "user",
    recipientId = null,
    variables = {},
    forceMock = false,
    simulateFailure = false,
  } = input;

  if (!channel || !templateKey) {
    return { ok: false, error: "channel và templateKey là bắt buộc." };
  }

  seedDefaultTemplates();
  const template = getTemplate(templateKey, channel, tenantId);
  if (!template) {
    return { ok: false, error: "Template không tồn tại." };
  }

  const rendered = renderTemplate(template, variables);
  const job = createNotificationJob({
    tenantId,
    recipientType,
    recipientId,
    channel,
    templateKey,
    payload: rendered,
    status: NOTIFICATION_STATUS.PENDING,
  });

  const jobs = loadNotificationJobs();
  jobs.unshift(job);
  saveNotificationJobs(jobs);

  const provider = resolveNotificationProvider(channel, { forceMock });
  const result = await provider.send({
    tenantId,
    to: recipientId,
    ...rendered,
    simulateFailure,
  });

  const log = createNotificationLog({
    jobId: job.id,
    tenantId,
    channel,
    templateKey,
    status: result.ok ? NOTIFICATION_STATUS.SENT : NOTIFICATION_STATUS.FAILED,
    providerMessageId: result.providerMessageId || null,
    errorMessage: result.error || null,
    sentAt: result.ok ? new Date().toISOString() : null,
  });

  const logs = loadNotificationLogs();
  logs.unshift(log);
  saveNotificationLogs(logs);

  const updatedJobs = loadNotificationJobs();
  const idx = updatedJobs.findIndex((j) => j.id === job.id);
  if (idx >= 0) {
    updatedJobs[idx] = {
      ...updatedJobs[idx],
      status: log.status,
    };
    saveNotificationJobs(updatedJobs);
  }

  return { ok: result.ok, job, log, error: result.error };
}

export function listNotificationLogs({ tenantId = null, limit = 100 } = {}) {
  let logs = loadNotificationLogs();
  if (tenantId) {
    logs = logs.filter((l) => l.tenantId === tenantId);
  }
  return logs.slice(0, limit);
}

export async function sendTestNotification(tenantId, channel) {
  return sendNotification({
    tenantId,
    channel,
    templateKey: "payment_success",
    recipientId: "test-recipient",
    variables: { name: "Test User", message: "Đây là tin nhắn test." },
    forceMock: true,
  });
}
