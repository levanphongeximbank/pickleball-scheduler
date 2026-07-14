export const REFEREE_V5_ERROR = Object.freeze({
  MATCH_NOT_FOUND: "MATCH_NOT_FOUND",
  REFEREE_NOT_ASSIGNED: "REFEREE_NOT_ASSIGNED",
  ASSIGNMENT_EXPIRED: "ASSIGNMENT_EXPIRED",
  ASSIGNMENT_REVOKED: "ASSIGNMENT_REVOKED",
  MATCH_NOT_STARTED: "MATCH_NOT_STARTED",
  MATCH_LOCKED: "MATCH_LOCKED",
  MATCH_STATE_CONFLICT: "MATCH_STATE_CONFLICT",
  EVENT_SEQUENCE_CONFLICT: "EVENT_SEQUENCE_CONFLICT",
  DUPLICATE_COMMAND: "DUPLICATE_COMMAND",
  INVALID_MATCH_COMMAND: "INVALID_MATCH_COMMAND",
  INVALID_MATCH_STATE: "INVALID_MATCH_STATE",
  UNSUPPORTED_SCORING_FORMAT: "UNSUPPORTED_SCORING_FORMAT",
  SCORING_FORMAT_REQUIRED: "SCORING_FORMAT_REQUIRED",
  UNSUPPORTED_SCORING_SYSTEM: "UNSUPPORTED_SCORING_SYSTEM",
  UNSUPPORTED_SCORING_VARIANT: "UNSUPPORTED_SCORING_VARIANT",
  SCORING_FORMAT_IMMUTABLE: "SCORING_FORMAT_IMMUTABLE",
  SCORING_STRATEGY_NOT_FOUND: "SCORING_STRATEGY_NOT_FOUND",
  UNDO_NOT_ALLOWED: "UNDO_NOT_ALLOWED",
  RESULT_NOT_READY: "RESULT_NOT_READY",
  TENANT_ACCESS_DENIED: "TENANT_ACCESS_DENIED",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  FINALIZE_FAILED: "FINALIZE_FAILED",
  IDEMPOTENCY_KEY_REUSE_MISMATCH: "IDEMPOTENCY_KEY_REUSE_MISMATCH",
  APPEND_ONLY_VIOLATION: "APPEND_ONLY_VIOLATION",
  INTERNAL_RPC_FORBIDDEN: "INTERNAL_RPC_FORBIDDEN",
  ATOMIC_COMMIT_ABORTED: "ATOMIC_COMMIT_ABORTED",
});

export const REFEREE_V5_ERROR_VI = Object.freeze({
  [REFEREE_V5_ERROR.MATCH_NOT_FOUND]: "Không tìm thấy trận đấu.",
  [REFEREE_V5_ERROR.REFEREE_NOT_ASSIGNED]: "Bạn chưa được phân công trận này.",
  [REFEREE_V5_ERROR.ASSIGNMENT_EXPIRED]: "Phân công trọng tài đã hết hạn.",
  [REFEREE_V5_ERROR.ASSIGNMENT_REVOKED]: "Phân công trọng tài đã bị thu hồi.",
  [REFEREE_V5_ERROR.MATCH_NOT_STARTED]: "Trận chưa bắt đầu.",
  [REFEREE_V5_ERROR.MATCH_LOCKED]: "Trận đã khóa, không thể thay đổi.",
  [REFEREE_V5_ERROR.MATCH_STATE_CONFLICT]:
    "Trạng thái trận đã thay đổi trên thiết bị khác. Vui lòng tải lại.",
  [REFEREE_V5_ERROR.EVENT_SEQUENCE_CONFLICT]: "Chuỗi sự kiện không liên tục.",
  [REFEREE_V5_ERROR.DUPLICATE_COMMAND]: "Lệnh đã được xử lý trước đó.",
  [REFEREE_V5_ERROR.INVALID_MATCH_COMMAND]: "Lệnh không hợp lệ.",
  [REFEREE_V5_ERROR.INVALID_MATCH_STATE]: "Trạng thái trận không hợp lệ.",
  [REFEREE_V5_ERROR.UNSUPPORTED_SCORING_FORMAT]: "Thể thức tính điểm chưa được hỗ trợ.",
  [REFEREE_V5_ERROR.SCORING_FORMAT_REQUIRED]: "Thiếu thông tin thể thức tính điểm.",
  [REFEREE_V5_ERROR.UNSUPPORTED_SCORING_SYSTEM]: "Hệ thống tính điểm không được hỗ trợ.",
  [REFEREE_V5_ERROR.UNSUPPORTED_SCORING_VARIANT]: "Biến thể tính điểm không được hỗ trợ.",
  [REFEREE_V5_ERROR.SCORING_FORMAT_IMMUTABLE]: "Không được đổi thể thức tính điểm sau khi bắt đầu.",
  [REFEREE_V5_ERROR.SCORING_STRATEGY_NOT_FOUND]: "Không tìm thấy chiến lược tính điểm.",
  [REFEREE_V5_ERROR.UNDO_NOT_ALLOWED]: "Không thể hoàn tác.",
  [REFEREE_V5_ERROR.RESULT_NOT_READY]: "Trận chưa sẵn sàng để chốt kết quả.",
  [REFEREE_V5_ERROR.TENANT_ACCESS_DENIED]: "Không có quyền truy cập tenant này.",
  [REFEREE_V5_ERROR.IDEMPOTENCY_KEY_REUSE_MISMATCH]:
    "Idempotency key đã dùng cho request khác.",
  [REFEREE_V5_ERROR.APPEND_ONLY_VIOLATION]: "Không được sửa hoặc xóa sự kiện trận đấu.",
  [REFEREE_V5_ERROR.INTERNAL_RPC_FORBIDDEN]: "RPC nội bộ không khả dụng từ client.",
  [REFEREE_V5_ERROR.ATOMIC_COMMIT_ABORTED]: "Giao dịch bị hủy — không có thay đổi một phần.",
  [REFEREE_V5_ERROR.FINALIZE_FAILED]: "Không thể chốt kết quả trận.",
});

export function createPersistenceError(code, message, extra = {}) {
  return {
    ok: false,
    code,
    error: message || REFEREE_V5_ERROR_VI[code] || code,
    ...extra,
  };
}

export function createPersistenceSuccess(payload) {
  return { ok: true, ...payload };
}

const SCORING_ENGINE_ERROR_CODES = new Set([
  REFEREE_V5_ERROR.SCORING_FORMAT_REQUIRED,
  REFEREE_V5_ERROR.UNSUPPORTED_SCORING_SYSTEM,
  REFEREE_V5_ERROR.UNSUPPORTED_SCORING_VARIANT,
  REFEREE_V5_ERROR.SCORING_FORMAT_IMMUTABLE,
  REFEREE_V5_ERROR.SCORING_STRATEGY_NOT_FOUND,
  // Legacy aliases retained for older snapshots / messages.
  "SCORING_VARIANT_REQUIRED",
  "UNKNOWN_SCORING_SYSTEM",
  "UNKNOWN_SCORING_VARIANT",
  "UNKNOWN_RULE_SET",
  "UNSUPPORTED_MATCH_TYPE",
]);

function resolveScoringPersistenceCode(engineCode, engineMessage) {
  const candidates = [engineCode, engineMessage].filter(Boolean).map(String);
  for (const candidate of candidates) {
    if (candidate === "SCORING_VARIANT_REQUIRED") {
      return REFEREE_V5_ERROR.SCORING_FORMAT_REQUIRED;
    }
    if (candidate === "UNKNOWN_SCORING_SYSTEM") {
      return REFEREE_V5_ERROR.UNSUPPORTED_SCORING_SYSTEM;
    }
    if (candidate === "UNKNOWN_SCORING_VARIANT" || candidate === "UNSUPPORTED_MATCH_TYPE") {
      return REFEREE_V5_ERROR.UNSUPPORTED_SCORING_VARIANT;
    }
    if (candidate === "UNKNOWN_RULE_SET") {
      return REFEREE_V5_ERROR.SCORING_STRATEGY_NOT_FOUND;
    }
    if (
      candidate === REFEREE_V5_ERROR.SCORING_FORMAT_REQUIRED ||
      candidate === REFEREE_V5_ERROR.UNSUPPORTED_SCORING_SYSTEM ||
      candidate === REFEREE_V5_ERROR.UNSUPPORTED_SCORING_VARIANT ||
      candidate === REFEREE_V5_ERROR.SCORING_FORMAT_IMMUTABLE ||
      candidate === REFEREE_V5_ERROR.SCORING_STRATEGY_NOT_FOUND
    ) {
      return candidate;
    }
  }
  return null;
}

export function mapEngineErrorToPersistence(engineResult, extra = {}) {
  if (engineResult.ok) {
    return engineResult;
  }
  const scoringCode = resolveScoringPersistenceCode(engineResult.code, engineResult.error);
  if (scoringCode) {
    return createPersistenceError(scoringCode, engineResult.error, extra);
  }
  const codeMap = {
    VERSION_CONFLICT: REFEREE_V5_ERROR.MATCH_STATE_CONFLICT,
    SEQUENCE_GAP: REFEREE_V5_ERROR.EVENT_SEQUENCE_CONFLICT,
    MATCH_LOCKED: REFEREE_V5_ERROR.MATCH_LOCKED,
    MATCH_NOT_STARTED: REFEREE_V5_ERROR.MATCH_NOT_STARTED,
    UNDO_NOT_ALLOWED: REFEREE_V5_ERROR.UNDO_NOT_ALLOWED,
    VALIDATION_FAILED: REFEREE_V5_ERROR.INVALID_MATCH_COMMAND,
  };
  // Prefer structured scoring codes even when wrapped as VALIDATION_FAILED.
  if (
    engineResult.code === "VALIDATION_FAILED" &&
    SCORING_ENGINE_ERROR_CODES.has(String(engineResult.error || ""))
  ) {
    const nested = resolveScoringPersistenceCode(engineResult.error, engineResult.error);
    if (nested) {
      return createPersistenceError(nested, engineResult.error, extra);
    }
  }
  return createPersistenceError(
    codeMap[engineResult.code] || REFEREE_V5_ERROR.INVALID_MATCH_COMMAND,
    engineResult.error,
    engineResult.code === "VERSION_CONFLICT"
      ? { currentVersion: engineResult.currentVersion, ...extra }
      : extra
  );
}
