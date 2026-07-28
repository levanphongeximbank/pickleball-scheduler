/**
 * Finance ledger UI runtime modes — Wave A1 post-wipe honesty.
 * Durable finance_* is not wired to /finance/* yet; hard cutover → UNAVAILABLE.
 */

export const FINANCE_LEDGER_RUNTIME_MODE = Object.freeze({
  UNAVAILABLE: "unavailable",
  MISSING_SCOPE: "missing_scope",
  LEGACY_LOCAL: "legacy_local",
});

export const FINANCE_LEDGER_ERROR_CODE = Object.freeze({
  AUTHORITY_UNAVAILABLE: "FINANCE_AUTHORITY_UNAVAILABLE",
  LOCALSTORAGE_FORBIDDEN: "FINANCE_LOCALSTORAGE_AUTHORITY_FORBIDDEN",
  DEMO_CLUB_FORBIDDEN: "FINANCE_DEMO_CLUB_FALLBACK_FORBIDDEN",
  MISSING_CLUB_SCOPE: "FINANCE_CLUB_SCOPE_REQUIRED",
  MUTATION_BLOCKED: "FINANCE_MUTATION_BLOCKED",
});

/** User-facing — no env / stack leakage. */
export const FINANCE_LEDGER_UNAVAILABLE_USER_MESSAGE =
  "Module Tài chính chưa sẵn sàng trên nền tảng bền vững. Sổ cái localStorage không còn là nguồn vận hành.";

export const FINANCE_LEDGER_MISSING_CLUB_USER_MESSAGE =
  "Chọn câu lạc bộ đang hoạt động để xem dữ liệu tài chính. Không dùng phạm vi demo-club.";

export const FINANCE_LEDGER_LEGACY_DEMO_BANNER =
  "Chế độ tương thích (local) — dữ liệu lưu trên máy, chưa phải sổ cái nền tảng bền vững. Không dùng cho vận hành production.";

export const FINANCE_LEDGER_EMPTY_DEBT =
  "Chưa có công nợ. Khi backend Tài chính được kích hoạt, dữ liệu sẽ hiển thị tại đây.";

export const FINANCE_LEDGER_EMPTY_RECEIPT =
  "Chưa có phiếu thu. Khi backend Tài chính được kích hoạt, dữ liệu sẽ hiển thị tại đây.";

export const FINANCE_LEDGER_EMPTY_REFUND =
  "Chưa có yêu cầu hoàn tiền. Khi backend Tài chính được kích hoạt, dữ liệu sẽ hiển thị tại đây.";

export const DEMO_CLUB_ID = "demo-club";
