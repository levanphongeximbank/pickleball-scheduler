import { createRequestId } from "./requestId.js";

/**
 * Phase 11C — standardized Edge API JSON envelope.
 * { ok, code, message, data, requestId }
 */
export function edgeSuccess(data, { requestId, code = "ok", message = "OK" } = {}) {
  const rid = requestId || createRequestId();
  return {
    ok: true,
    code,
    message,
    data: data ?? null,
    requestId: rid,
  };
}

export function edgeError(code, message, { requestId, data = null } = {}) {
  const rid = requestId || createRequestId();
  return {
    ok: false,
    code,
    message,
    data,
    requestId: rid,
  };
}
