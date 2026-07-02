import { API_KEY_AUDIT_ACTIONS, buildApiKeyAuditEntry } from "../constants/apiKeyAudit.js";

const AUDIT_KEY = "pickleball-api-key-audit-v1";
const AUDIT_CAP = 500;

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

export function listApiKeyAuditEvents({ tenantId = null, limit = 100 } = {}) {
  let events = readJson(AUDIT_KEY, []);
  if (tenantId) {
    events = events.filter((e) => e.tenantId === tenantId);
  }
  return events.slice(0, limit);
}

export function recordApiKeyAudit(action, meta = {}) {
  const entry = buildApiKeyAuditEntry(action, meta);
  const events = readJson(AUDIT_KEY, []);
  events.unshift({ id: `aka_${Date.now()}`, ...entry });
  writeJson(AUDIT_KEY, events.slice(0, AUDIT_CAP));
  return entry;
}

export function clearApiKeyAuditStorage() {
  localStorage.removeItem(AUDIT_KEY);
}

export { API_KEY_AUDIT_ACTIONS };
