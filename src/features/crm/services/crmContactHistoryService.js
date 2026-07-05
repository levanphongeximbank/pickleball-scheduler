const STORAGE_PREFIX = "pickleball-crm-contact-history-v1::";

function storageKey(clubId) {
  return `${STORAGE_PREFIX}${clubId}`;
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

export function listContactHistory(clubId, { customerId, channel } = {}) {
  let rows = readHistory(clubId);
  if (customerId) {
    rows = rows.filter((row) => row.customerId === customerId);
  }
  if (channel) {
    rows = rows.filter((row) => row.channel === channel);
  }
  return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

export function addContactHistory(clubId, payload = {}) {
  const rows = readHistory(clubId);
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
  writeHistory(clubId, rows);
  return entry;
}

export function deleteContactHistory(clubId, entryId) {
  const rows = readHistory(clubId).filter((row) => row.id !== entryId);
  writeHistory(clubId, rows);
  return true;
}

export function clearCrmContactHistory(clubId) {
  localStorage.removeItem(storageKey(clubId));
}
