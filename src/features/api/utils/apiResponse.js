import { createRequestId } from "./requestId.js";

export function apiSuccess(data, meta = {}) {
  return {
    success: true,
    data,
    meta: {
      requestId: meta.requestId || createRequestId(),
      timestamp: meta.timestamp || new Date().toISOString(),
      ...meta,
    },
  };
}

export function apiError(code, message, details, meta = {}) {
  return {
    success: false,
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
    meta: {
      requestId: meta.requestId || createRequestId(),
      timestamp: meta.timestamp || new Date().toISOString(),
      ...meta,
    },
  };
}
