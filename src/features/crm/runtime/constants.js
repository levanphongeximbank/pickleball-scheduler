/**
 * CRM legacy UI runtime — Wave A1 post-wipe honesty.
 */

export const CRM_LEGACY_RUNTIME_MODE = Object.freeze({
  UNAVAILABLE: "unavailable",
  MISSING_SCOPE: "missing_scope",
  LEGACY_LOCAL: "legacy_local",
});

export const CRM_LEGACY_ERROR_CODE = Object.freeze({
  AUTHORITY_UNAVAILABLE: "CRM_AUTHORITY_UNAVAILABLE",
  LOCALSTORAGE_FORBIDDEN: "CRM_LOCALSTORAGE_AUTHORITY_FORBIDDEN",
  DEMO_CLUB_FORBIDDEN: "CRM_DEMO_CLUB_FALLBACK_FORBIDDEN",
  MISSING_CLUB_SCOPE: "CRM_CLUB_SCOPE_REQUIRED",
  MUTATION_BLOCKED: "CRM_MUTATION_BLOCKED",
});

export const CRM_LEGACY_UNAVAILABLE_USER_MESSAGE =
  "Module CRM chưa sẵn sàng trên nền tảng bền vững. Dữ liệu/mock localStorage không còn là nguồn vận hành.";

export const CRM_LEGACY_MISSING_CLUB_USER_MESSAGE =
  "Chọn câu lạc bộ đang hoạt động để dùng CRM. Không dùng phạm vi demo-club.";

export const CRM_LEGACY_DEMO_BANNER =
  "Chế độ demo/tương thích (local) — thao tác lưu trên máy, chưa gửi thật qua kênh CRM nền tảng.";

export const CRM_LEGACY_EMPTY_MESSAGES = "Chưa có tin nhắn.";
export const CRM_LEGACY_EMPTY_TEMPLATES = "Chưa có mẫu tin nhắn.";
export const CRM_LEGACY_EMPTY_CAMPAIGNS = "Chưa có chiến dịch.";
export const CRM_LEGACY_EMPTY_HISTORY = "Chưa có lịch sử liên hệ.";

export const DEMO_CLUB_ID = "demo-club";
