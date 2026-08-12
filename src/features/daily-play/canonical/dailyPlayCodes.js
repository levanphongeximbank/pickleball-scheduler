/**
 * Daily Play canonical domain / RPC error + status codes.
 * Kept module-local to avoid shared PR #418 surfaces.
 */

export const DAILY_PLAY_RPC = Object.freeze({
  GET_STATE: "daily_play_get_state",
  CHECK_IN: "daily_play_check_in",
  CHECK_OUT: "daily_play_check_out",
  CREATE_MATCHES: "daily_play_create_matches",
  ASSIGN_COURT: "daily_play_assign_court",
  SUBMIT_SCORE: "daily_play_submit_score",
  CANCEL_MATCH: "daily_play_cancel_match",
  CHANGE_COURT: "daily_play_change_court",
});

export const DAILY_PLAY_CODE = Object.freeze({
  OK: "OK",
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  FORBIDDEN: "FORBIDDEN",
  TENANT_FORBIDDEN: "TENANT_FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VERSION_CONFLICT: "VERSION_CONFLICT",
  MISSING_EXPECTED_VERSION: "MISSING_EXPECTED_VERSION",
  MISSING_IDEMPOTENCY_KEY: "MISSING_IDEMPOTENCY_KEY",
  NO_COURT_CAPABILITY: "NO_COURT_CAPABILITY",
  COURT_ALREADY_LEASED: "COURT_ALREADY_LEASED",
  COURT_NOT_ELIGIBLE: "COURT_NOT_ELIGIBLE",
  PLAYER_ALREADY_ACTIVE: "PLAYER_ALREADY_ACTIVE",
  CHECKOUT_PLAYER_ACTIVE: "CHECKOUT_PLAYER_ACTIVE",
  MATCH_NOT_WAITING: "MATCH_NOT_WAITING",
  MATCH_NOT_ACTIVE: "MATCH_NOT_ACTIVE",
  MATCH_COMPLETED_IMMUTABLE: "MATCH_COMPLETED_IMMUTABLE",
  INVALID_SCORE: "INVALID_SCORE",
  SCORE_CONFLICT: "SCORE_CONFLICT",
  NOT_ENOUGH_PLAYERS: "NOT_ENOUGH_PLAYERS",
  VALIDATION: "VALIDATION",
  CLOUD_UNAVAILABLE: "CLOUD_UNAVAILABLE",
  SUBSTITUTION_UNSUPPORTED: "SUBSTITUTION_UNSUPPORTED",
});

export const DAILY_PLAY_MESSAGES = Object.freeze({
  [DAILY_PLAY_CODE.NO_COURT_CAPABILITY]:
    "Chưa có sân khả dụng được cấu hình cho Vui chơi hằng ngày.",
  [DAILY_PLAY_CODE.COURT_ALREADY_LEASED]:
    "Sân này đang được sử dụng bởi trận khác.",
  [DAILY_PLAY_CODE.VERSION_CONFLICT]:
    "Dữ liệu vừa được cập nhật ở phiên khác. Hệ thống đã tải trạng thái mới nhất.",
  [DAILY_PLAY_CODE.PLAYER_ALREADY_ACTIVE]:
    "VĐV đang có trận chưa kết thúc — không thể thêm vào trận mới.",
  [DAILY_PLAY_CODE.CHECKOUT_PLAYER_ACTIVE]:
    "Không thể bỏ check-in VĐV đang trong trận. Hủy trận hoặc hoàn thành trước.",
  [DAILY_PLAY_CODE.MATCH_COMPLETED_IMMUTABLE]:
    "Trận đã hoàn thành — không thể sửa điểm hoặc hủy thường.",
  [DAILY_PLAY_CODE.INVALID_SCORE]:
    "Điểm không hợp lệ. Điểm phải là số nguyên không âm và không hòa.",
  [DAILY_PLAY_CODE.SCORE_CONFLICT]:
    "Trận đã có kết quả khác. Không thể ghi đè điểm mâu thuẫn.",
  [DAILY_PLAY_CODE.NOT_ENOUGH_PLAYERS]:
    "Không đủ VĐV check-in rảnh để tạo trận.",
  [DAILY_PLAY_CODE.CLOUD_UNAVAILABLE]:
    "Canonical Daily Play chưa sẵn sàng trên máy chủ. Không dùng dữ liệu trình duyệt.",
  COURTS_BUSY_WAITING:
    "Hiện chưa có sân trống. Trận sẽ chờ sân.",
});

export const DAILY_PLAY_ACTIVE_MATCH_STATUSES = Object.freeze([
  "waiting",
  "assigned",
  "playing",
]);

export const DAILY_PLAY_LEASE_ACTIVE = "active";
export const DAILY_PLAY_LEASE_RELEASED = "released";
