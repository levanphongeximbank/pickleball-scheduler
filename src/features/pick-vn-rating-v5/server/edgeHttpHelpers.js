import { SCORING_ENGINE_VERSION } from "../constants/versions.js";

const ERROR_MESSAGES = {
  UNAUTHORIZED: "Yêu cầu đăng nhập hợp lệ.",
  FORBIDDEN: "Không có quyền thực hiện thao tác này.",
  ASSESSMENT_NOT_FOUND: "Không tìm thấy bài đánh giá.",
  ASSESSMENT_ALREADY_COMPLETED: "Bài đánh giá đã hoàn thành.",
  INVALID_QUESTION: "Câu hỏi không hợp lệ.",
  INVALID_ANSWER: "Câu trả lời không hợp lệ.",
  FORBIDDEN_PAYLOAD_FIELD: "Payload chứa trường không được phép.",
  VERSION_MISMATCH: "Phiên bản assessment không khớp.",
  SINGLES_NOT_IMPLEMENTED: "Đánh giá singles chưa được triển khai.",
  PERSISTENCE_FAILED: "Không thể lưu kết quả đánh giá.",
  INVALID_JSON: "JSON không hợp lệ.",
  METHOD_NOT_ALLOWED: "Phương thức không được hỗ trợ.",
  TENANT_UNRESOLVED: "Không xác định được tenant.",
  EDGE_MISCONFIGURED: "Edge runtime chưa được cấu hình.",
  EDGE_RUNTIME_ERROR: "Lỗi xử lý yêu cầu.",
};

const SCORE_CODE_MAP = {
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN_OWNER: "FORBIDDEN",
  TENANT_MISMATCH: "FORBIDDEN",
  ASSESSMENT_NOT_FOUND: "ASSESSMENT_NOT_FOUND",
  ALREADY_COMPLETED: "ASSESSMENT_ALREADY_COMPLETED",
  INVALID_QUESTION_ID: "INVALID_QUESTION",
  INVALID_ANSWER_ANCHOR: "INVALID_ANSWER",
  FORBIDDEN_PAYLOAD_FIELD: "FORBIDDEN_PAYLOAD_FIELD",
  FORBIDDEN_RATING_FIELDS: "FORBIDDEN_PAYLOAD_FIELD",
  UNKNOWN_FIELDS: "FORBIDDEN_PAYLOAD_FIELD",
  INVALID_ANSWERS: "INVALID_ANSWER",
  MISSING_CORE_QUESTIONS: "INVALID_ANSWER",
  ADAPTIVE_BUDGET_EXCEEDED: "INVALID_ANSWER",
  INVALID_MODE: "INVALID_ANSWER",
  SINGLES_NOT_IMPLEMENTED: "SINGLES_NOT_IMPLEMENTED",
  VERSION_MISMATCH: "VERSION_MISMATCH",
  PERSISTENCE_RPC_ERROR: "PERSISTENCE_FAILED",
  PERSISTENCE_FAILED: "PERSISTENCE_FAILED",
  PERSISTENCE_ERROR: "PERSISTENCE_FAILED",
};

export function createRequestId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeErrorCode(code) {
  return SCORE_CODE_MAP[code] ?? code ?? "EDGE_RUNTIME_ERROR";
}

export function mapHttpStatus(code) {
  switch (code) {
    case "UNAUTHORIZED":
      return 401;
    case "FORBIDDEN":
    case "TENANT_UNRESOLVED":
      return 403;
    case "ASSESSMENT_NOT_FOUND":
      return 404;
    case "ASSESSMENT_ALREADY_COMPLETED":
      return 200;
    case "SINGLES_NOT_IMPLEMENTED":
      return 422;
    case "METHOD_NOT_ALLOWED":
      return 405;
    case "PERSISTENCE_FAILED":
    case "EDGE_MISCONFIGURED":
    case "EDGE_RUNTIME_ERROR":
      return 500;
    default:
      return 400;
  }
}

export function buildCorsHeaders(origin, allowedOrigins = []) {
  const list = Array.isArray(allowedOrigins) ? allowedOrigins : [];
  const useWildcard = list.length === 0 || list.includes("*");
  const allowed = useWildcard || (origin && list.includes(origin));
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-rating-v5-staging-fault",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (allowed) {
    headers["Access-Control-Allow-Origin"] = useWildcard ? "*" : origin;
  }
  return { headers, allowed: Boolean(allowed) };
}

export function buildErrorResponse(code, requestId, extra = {}) {
  const normalized = normalizeErrorCode(code);
  const error = {
    code: normalized,
    message: ERROR_MESSAGES[normalized] ?? ERROR_MESSAGES.EDGE_RUNTIME_ERROR,
    requestId,
  };
  if (Array.isArray(extra.fields) && extra.fields.length > 0) {
    error.details = { fields: extra.fields };
  }
  const { fields: _fields, ...safeExtra } = extra;
  return {
    ok: false,
    error,
    request_id: requestId,
    ...safeExtra,
  };
}

export function buildSuccessResponse(payload, requestId) {
  return {
    ok: true,
    request_id: requestId,
    engine_version: SCORING_ENGINE_VERSION,
    ...payload,
  };
}

export function sanitizeErrorMessage(message) {
  if (!message) return ERROR_MESSAGES.PERSISTENCE_FAILED;
  const lower = String(message).toLowerCase();
  if (
    lower.includes("sql") ||
    lower.includes("plpgsql") ||
    lower.includes("relation") ||
    lower.includes("service_role") ||
    lower.includes("jwt") ||
    lower.includes("stack")
  ) {
    return ERROR_MESSAGES.PERSISTENCE_FAILED;
  }
  return ERROR_MESSAGES.PERSISTENCE_FAILED;
}

export function logEdgeRequest(meta) {
  const safe = {
    request_id: meta.request_id,
    assessment_id: meta.assessment_id ?? null,
    authenticated_user_id: meta.authenticated_user_id ?? null,
    tenant_id: meta.tenant_id ?? null,
    engine_version: meta.engine_version ?? SCORING_ENGINE_VERSION,
    result_status: meta.result_status,
    duration_ms: meta.duration_ms,
    answer_count: meta.answer_count ?? null,
  };
  console.log(JSON.stringify({ type: "rating_v5_edge_request", ...safe }));
}

export function isStagingFaultInjectionEnabled(supabaseUrl) {
  const ref = "qyewbxjsiiyufanzcjcq";
  return String(supabaseUrl || "").includes(ref) || false;
}

export const STAGING_FAULT_HEADER = "x-rating-v5-staging-fault";
