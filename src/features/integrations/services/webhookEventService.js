const WEBHOOK_KEY = "pickleball-webhook-events-v1";

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function createWebhookEvent(input = {}) {
  return {
    id: input.id || `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tenantId: input.tenantId || null,
    provider: input.provider,
    eventType: input.eventType,
    payload: input.payload || {},
    signature: input.signature ? "[REDACTED]" : null,
    idempotencyKey: input.idempotencyKey || null,
    status: input.status || "received",
    errorMessage: input.errorMessage || null,
    createdAt: input.createdAt || new Date().toISOString(),
    processedAt: input.processedAt || null,
  };
}

export function loadWebhookEvents() {
  return readJson(WEBHOOK_KEY, []);
}

export function saveWebhookEvents(events) {
  writeJson(WEBHOOK_KEY, events || []);
}

export function recordWebhookEvent(input = {}) {
  const events = loadWebhookEvents();
  const idempotencyKey = input.idempotencyKey;
  if (idempotencyKey) {
    const existing = events.find(
      (e) => e.idempotencyKey === idempotencyKey && e.status === "processed"
    );
    if (existing) {
      return { ok: true, event: existing, idempotent: true };
    }
  }

  const event = createWebhookEvent(input);
  events.unshift(event);
  saveWebhookEvents(events);
  return { ok: true, event, idempotent: false };
}

export function markWebhookProcessed(eventId, { status = "processed", errorMessage = null } = {}) {
  const events = loadWebhookEvents();
  const index = events.findIndex((e) => e.id === eventId);
  if (index < 0) {
    return { ok: false, error: "Webhook event không tồn tại." };
  }
  events[index] = {
    ...events[index],
    status,
    errorMessage,
    processedAt: new Date().toISOString(),
  };
  saveWebhookEvents(events);
  return { ok: true, event: events[index] };
}

export function listWebhookEvents({ tenantId = null, limit = 100 } = {}) {
  let events = loadWebhookEvents();
  if (tenantId) {
    events = events.filter((e) => e.tenantId === tenantId);
  }
  return events.slice(0, limit);
}

export function reprocessWebhookEvent(eventId, handler) {
  const events = loadWebhookEvents();
  const event = events.find((e) => e.id === eventId);
  if (!event) {
    return { ok: false, error: "Webhook event không tồn tại." };
  }
  try {
    const result = handler(event);
    return markWebhookProcessed(eventId, { status: "processed", ...result });
  } catch (error) {
    return markWebhookProcessed(eventId, {
      status: "failed",
      errorMessage: error.message,
    });
  }
}

export function clearWebhookStorage() {
  localStorage.removeItem(WEBHOOK_KEY);
}
