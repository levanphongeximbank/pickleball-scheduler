/**
 * Phase 1I-C — Safe Vietnamese UI messages for Public Player Directory errors.
 * Maps DIRECTORY_* codes only; never surfaces RPC/SQL/internal payloads.
 */
import { DIRECTORY_ERROR_CODES } from "../constants/directory.js";

const MESSAGES = Object.freeze({
  [DIRECTORY_ERROR_CODES.NOT_AUTHENTICATED]:
    "Vui lòng đăng nhập để xem danh bạ vận động viên.",
  [DIRECTORY_ERROR_CODES.INVALID_REQUEST]:
    "Yêu cầu tìm kiếm không hợp lệ. Vui lòng kiểm tra lại bộ lọc.",
  [DIRECTORY_ERROR_CODES.INVALID_CURSOR]:
    "Phiên phân trang không còn hợp lệ. Vui lòng tải lại danh sách.",
  [DIRECTORY_ERROR_CODES.BACKEND_UNAVAILABLE]:
    "Danh bạ tạm thời không khả dụng. Vui lòng thử lại sau.",
  [DIRECTORY_ERROR_CODES.RESPONSE_INVALID]:
    "Không thể tải danh bạ. Vui lòng thử lại.",
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
export function mapDirectoryListErrorMessage(code, fallbackMessage) {
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

/**
 * @param {string|null|undefined} gender
 * @returns {string|null}
 */
export function formatDirectoryGenderLabel(gender) {
  if (gender == null || gender === "") return null;
  const key = String(gender).trim().toLowerCase();
  if (key === "male") return "Nam";
  if (key === "female") return "Nữ";
  if (key === "unknown") return null;
  return null;
}

/**
 * @param {string|null|undefined} handedness
 * @returns {string|null}
 */
export function formatDirectoryHandednessLabel(handedness) {
  if (handedness == null || handedness === "") return null;
  const key = String(handedness).trim().toLowerCase();
  if (key === "right") return "Tay phải";
  if (key === "left") return "Tay trái";
  if (key === "ambidextrous") return "Hai tay";
  return null;
}
