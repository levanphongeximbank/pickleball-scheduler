import { guardCrmLegacyLocalAccess } from "../runtime/resolveCrmLegacyRuntime.js";
import { CRM_LEGACY_ERROR_CODE } from "../runtime/constants.js";

const STORAGE_PREFIX = "pickleball-crm-contact-history-v1::";

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

function readHistory(clubId) {
  try {
    const raw = localStorage.getItem(storageKey(clubId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeHistory(clubId, rows) {
  localStorage.setItem(storageKey(clubId), JSON.stringify(rows));
}

function makeId() {
  return `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function listContactHistoryResult(clubId, { customerId, channel } = {}, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return { ...blockedResult(gate), items: [] };

  let rows = readHistory(gate.clubId);
  if (customerId) rows = rows.filter((row) => row.customerId === customerId);
  if (channel) rows = rows.filter((row) => row.channel === channel);
  rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  return { ok: true, items: rows };
}

export function listContactHistory(clubId, options = {}, env) {
  return listContactHistoryResult(clubId, options, env).items;
}

export function addContactHistory(clubId, payload = {}, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return blockedResult(gate);

  const rows = readHistory(gate.clubId);
  const entry = {
    id: makeId(),
    customerId: String(payload.customerId || "").trim(),
    customerName: String(payload.customerName || "").trim() || "Khách",
    channel: String(payload.channel || "sms").trim(),
    direction: payload.direction === "inbound" ? "inbound" : "outbound",
    summary: String(payload.summary || "").trim(),
    relatedMessageId: payload.relatedMessageId || null,
    createdAt: new Date().toISOString(),
  };
  rows.push(entry);
  writeHistory(gate.clubId, rows);
  return { ok: true, data: entry };
}

export function deleteContactHistory(clubId, entryId, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return blockedResult(gate);
  const rows = readHistory(gate.clubId).filter((row) => row.id !== entryId);
  writeHistory(gate.clubId, rows);
  return { ok: true };
}

export function clearCrmContactHistory(clubId, env) {
  const gate = guardCrmLegacyLocalAccess(clubId, env);
  if (!gate.ok) return blockedResult(gate);
  localStorage.removeItem(storageKey(gate.clubId));
  return { ok: true };
}
