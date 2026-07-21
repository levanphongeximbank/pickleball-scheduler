/**
 * Phase 1I-D — Safe Vietnamese UI messages for Public Player Directory detail.
 * Maps DIRECTORY_* codes only; never surfaces RPC/SQL/internal payloads.
 */
import { DIRECTORY_ERROR_CODES } from "../constants/directory.js";

export const DIRECTORY_DETAIL_NOT_FOUND_MESSAGE =
  "Không tìm thấy vận động viên hoặc hồ sơ này hiện không được công khai.";

export const DIRECTORY_DETAIL_PRIVACY_NOTICE =
  "Thông tin trên trang này thuộc danh bạ vận động viên công khai đã xác minh.";

const MESSAGES = Object.freeze({
  [DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED]:
    "Vui lòng đăng nhập để xem danh bạ vận động viên.",
  [DIRECTORY_ERROR_CODES.INVALID_REQUEST]:
    "Yêu cầu không hợp lệ. Vui lòng kiểm tra lại đường dẫn.",
  [DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE]:
    "Danh bạ tạm thời không khả dụng. Vui lòng thử lại sau.",
  [DIRECTORY_ERROR_CODES.RESPONSE_INVALID]:
    "Không thể tải hồ sơ. Vui lòng thử lại.",
});

/** Aliases from phase brief → canonical 1I-A codes. */
const ALIASES = Object.freeze({
  DIRECTORY_UNAVAILABLE: DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE,
  DIRECTORY_UNKNOWN_ERROR: DIRECTORY_ERROR_CODES.RESPONSE_INVALID,
});

/**
 * @param {string|null|undefined} code
 * @param {string|null|undefined} [fallbackMessage]
 * @returns {string}
 */
export function mapDirectoryDetailErrorMessage(code, fallbackMessage) {
  const normalized = ALIASES[code] || code;
  if (normalized && MESSAGES[normalized]) {
    return MESSAGES[normalized];
  }
  if (fallbackMessage && typeof fallbackMessage === "string" && fallbackMessage.trim()) {
    // Only use facade-safe messages; never pass through raw DB text from callers.
    return MESSAGES[DIRECTORY_ERROR_CODES.RESPONSE_INVALID];
  }
  return MESSAGES[DIRECTORY_ERROR_CODES.RESPONSE_INVALID];
}
