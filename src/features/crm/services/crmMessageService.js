import { guardCrmLegacyLocalAccess } from "../runtime/resolveCrmLegacyRuntime.js";
import { CRM_LEGACY_ERROR_CODE } from "../runtime/constants.js";

const STORAGE_PREFIX = "pickleball-crm-messages-v1::";

function storageKey(clubId) {
  return `${STORAGE_PREFIX}${clubId}`;
}

function blockedResult(gate) {
  return {
    ok: false,
    code: gate.code || CRM_LEGACY_ERROR_CODE.MUTATION_BLOCKED,
    error: gate.error || gate.code,
    legacyBlocked: true,
  };
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

export function listMessagesResult(clubId, { status, channel } = {}, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return { ...blockedResult(gate), items: [] };

  let messages = readMessages(gate.clubId);
  if (status) messages = messages.filter((row) => row.status === status);
  if (channel) messages = messages.filter((row) => row.channel === channel);
  messages.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { ok: true, items: messages };
}

export function listMessages(clubId, options = {}, env) {
  return listMessagesResult(clubId, options, env).items;
}

export function createMessage(clubId, payload = {}, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return blockedResult(gate);

  const messages = readMessages(gate.clubId);
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
  writeMessages(gate.clubId, messages);
  return { ok: true, data: message };
}

export function updateMessage(clubId, messageId, patch = {}, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return blockedResult(gate);

  const messages = readMessages(gate.clubId);
  const index = messages.findIndex((row) => row.id === messageId);
  if (index < 0) return { ok: false, code: "CRM_MESSAGE_NOT_FOUND", error: "Không tìm thấy tin nhắn." };

  messages[index] = {
    ...messages[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeMessages(gate.clubId, messages);
  return { ok: true, data: messages[index] };
}

export function markMessageSent(clubId, messageId, env) {
  return updateMessage(
    clubId,
    messageId,
    {
      status: "sent",
      sentAt: new Date().toISOString(),
    },
    env
  );
}

export function deleteMessage(clubId, messageId, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return blockedResult(gate);
  const messages = readMessages(gate.clubId).filter((row) => row.id !== messageId);
  writeMessages(gate.clubId, messages);
  return { ok: true };
}

export function clearCrmMessages(clubId, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return blockedResult(gate);
  localStorage.removeItem(storageKey(gate.clubId));
  return { ok: true };
}
