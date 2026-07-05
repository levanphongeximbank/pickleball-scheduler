const STORAGE_PREFIX = "pickleball-crm-messages-v1::";

function storageKey(clubId) {
  return `${STORAGE_PREFIX}${clubId}`;
}

function readMessages(clubId) {
  try {
    const raw = localStorage.getItem(storageKey(clubId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeMessages(clubId, messages) {
  localStorage.setItem(storageKey(clubId), JSON.stringify(messages));
}

function makeId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function listMessages(clubId, { status, channel } = {}) {
  let messages = readMessages(clubId);
  if (status) {
    messages = messages.filter((row) => row.status === status);
  }
  if (channel) {
    messages = messages.filter((row) => row.channel === channel);
  }
  return messages.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function createMessage(clubId, payload = {}) {
  const messages = readMessages(clubId);
  const message = {
    id: makeId(),
    recipientId: String(payload.recipientId || "").trim(),
    recipientName: String(payload.recipientName || "").trim() || "Khách",
    channel: String(payload.channel || "sms").trim(),
    subject: String(payload.subject || "").trim(),
    body: String(payload.body || "").trim(),
    status: payload.sendNow ? "sent" : "draft",
    sentAt: payload.sendNow ? new Date().toISOString() : null,
    createdAt: new Date().toISOString(),
  };
  messages.push(message);
  writeMessages(clubId, messages);
  return message;
}

export function updateMessage(clubId, messageId, patch = {}) {
  const messages = readMessages(clubId);
  const index = messages.findIndex((row) => row.id === messageId);
  if (index < 0) return null;

  messages[index] = {
    ...messages[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeMessages(clubId, messages);
  return messages[index];
}

export function markMessageSent(clubId, messageId) {
  return updateMessage(clubId, messageId, {
    status: "sent",
    sentAt: new Date().toISOString(),
  });
}

export function deleteMessage(clubId, messageId) {
  const messages = readMessages(clubId).filter((row) => row.id !== messageId);
  writeMessages(clubId, messages);
  return true;
}

export function clearCrmMessages(clubId) {
  localStorage.removeItem(storageKey(clubId));
}
