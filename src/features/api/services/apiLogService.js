import { createApiLogRecord } from "../models/apiModels.js";
import { appendApiLog, loadApiLogs } from "../storage/apiStorage.js";

const SENSITIVE_HEADERS = new Set([
  "authorization",
  "x-api-key",
  "cookie",
  "set-cookie",
]);

export function sanitizeHeaders(headers = {}) {
  return Object.entries(headers).reduce((acc, [key, value]) => {
    if (SENSITIVE_HEADERS.has(String(key).toLowerCase())) {
      acc[key] = "[REDACTED]";
    } else {
      acc[key] = value;
    }
    return acc;
  }, {});
}

export function logApiRequest(input = {}) {
  const log = createApiLogRecord({
    requestId: input.requestId,
    tenantId: input.tenantId || null,
    apiClientId: input.apiClientId || null,
    method: input.method,
    path: input.path,
    statusCode: input.statusCode,
    durationMs: input.durationMs,
    ipAddress: input.ipAddress || null,
    userAgent: input.userAgent ? String(input.userAgent).slice(0, 512) : null,
  });
  appendApiLog(log);
  return log;
}

export function listApiLogs({ tenantId = null, limit = 100 } = {}) {
  let logs = loadApiLogs();
  if (tenantId) {
    logs = logs.filter((l) => l.tenantId === tenantId);
  }
  return logs.slice(0, limit);
}
