/**
 * Public Portal post-wipe honesty — runtime constants (Wave A3).
 */

export const PUBLIC_PORTAL_RUNTIME_MODE = Object.freeze({
  LOADING: "LOADING",
  CANONICAL_READY: "CANONICAL_READY",
  CANONICAL_EMPTY: "CANONICAL_EMPTY",
  UNAVAILABLE: "UNAVAILABLE",
  ERROR: "ERROR",
  MISSING_SCOPE: "MISSING_SCOPE",
  LEGACY_DEMO: "LEGACY_DEMO",
  UNAUTHORIZED: "UNAUTHORIZED",
});

export const PUBLIC_PORTAL_RUNTIME_ERROR_CODE = Object.freeze({
  AUTHORITY_UNAVAILABLE: "PUBLIC_CATALOG_UNAVAILABLE",
  LOCAL_AUTHORITY_FORBIDDEN: "PUBLIC_PORTAL_LOCALSTORAGE_AUTHORITY_FORBIDDEN",
  MOCK_FALLBACK_FORBIDDEN: "PUBLIC_PORTAL_MOCK_FALLBACK_FORBIDDEN",
  INVALID_PUBLIC_ID: "PUBLIC_PORTAL_INVALID_PUBLIC_ID",
  SANITIZED_ERROR: "PUBLIC_PORTAL_SANITIZED_ERROR",
});

export const PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE =
  "Danh mục công khai chưa khả dụng sau hard cutover. Không có dữ liệu CLB/sân canonical đáng tin cậy để hiển thị trong môi trường này.";

export const PUBLIC_PORTAL_EMPTY_CLUBS_MESSAGE =
  "Hiện chưa có câu lạc bộ công khai nào được xuất bản. Vui lòng quay lại sau.";

export const PUBLIC_PORTAL_EMPTY_COURTS_MESSAGE =
  "Hiện chưa có sân công khai nào được xuất bản. Vui lòng quay lại sau.";

export const PUBLIC_PORTAL_ERROR_USER_MESSAGE =
  "Không tải được dữ liệu công khai. Vui lòng thử lại. Hệ thống không thay thế bằng nội dung minh họa.";

export const PUBLIC_PORTAL_MISSING_ID_USER_MESSAGE =
  "Không tìm thấy mục công khai với mã đã cho. Liên kết có thể đã hết hạn hoặc không còn công khai.";

export const PUBLIC_PORTAL_LEGACY_DEMO_BANNER =
  "Cổng công khai đang chạy chế độ tương thích local/demo. Dữ liệu minh họa hoặc dự phòng chỉ để kiểm thử, không bền vững và không phải nguồn sự thật vận hành.";

export const PUBLIC_PORTAL_USER_MESSAGES = Object.freeze({
  unavailable: PUBLIC_PORTAL_UNAVAILABLE_USER_MESSAGE,
  emptyClubs: PUBLIC_PORTAL_EMPTY_CLUBS_MESSAGE,
  emptyCourts: PUBLIC_PORTAL_EMPTY_COURTS_MESSAGE,
  error: PUBLIC_PORTAL_ERROR_USER_MESSAGE,
  missingId: PUBLIC_PORTAL_MISSING_ID_USER_MESSAGE,
  legacyDemo: PUBLIC_PORTAL_LEGACY_DEMO_BANNER,
});
