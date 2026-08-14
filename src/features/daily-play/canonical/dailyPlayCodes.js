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
  START_MATCH: "daily_play_start_match",
  SUBMIT_SCORE: "daily_play_submit_score",
  CORRECT_SCORE: "daily_play_correct_score",
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
  PLAYER_NOT_ELIGIBLE: "PLAYER_NOT_ELIGIBLE",
  CHECKOUT_PLAYER_ACTIVE: "CHECKOUT_PLAYER_ACTIVE",
  MATCH_NOT_WAITING: "MATCH_NOT_WAITING",
  MATCH_NOT_ASSIGNED: "MATCH_NOT_ASSIGNED",
  MATCH_NOT_PLAYING: "MATCH_NOT_PLAYING",
  MATCH_NOT_ACTIVE: "MATCH_NOT_ACTIVE",
  MATCH_COMPLETED_IMMUTABLE: "MATCH_COMPLETED_IMMUTABLE",
  MATCH_NOT_COMPLETED: "MATCH_NOT_COMPLETED",
  INVALID_MATCH_SHAPE: "INVALID_MATCH_SHAPE",
  INVALID_SCORE: "INVALID_SCORE",
  SCORE_CONFLICT: "SCORE_CONFLICT",
  NOT_ENOUGH_PLAYERS: "NOT_ENOUGH_PLAYERS",
  VALIDATION: "VALIDATION",
  CLOUD_UNAVAILABLE: "CLOUD_UNAVAILABLE",
  READBACK_FAILED: "READBACK_FAILED",
  SUBSTITUTION_UNSUPPORTED: "SUBSTITUTION_UNSUPPORTED",
  TOURNAMENT_NOT_FOUND: "TOURNAMENT_NOT_FOUND",
  MATCHES_REQUIRED: "MATCHES_REQUIRED",
  MATCH_ALREADY_EXISTS: "MATCH_ALREADY_EXISTS",
  PLAYER_NOT_CHECKED_IN: "PLAYER_NOT_CHECKED_IN",
  PLAYER_ID_REQUIRED: "PLAYER_ID_REQUIRED",
  MATCH_NOT_FOUND: "MATCH_NOT_FOUND",
  COURT_NOT_AVAILABLE: "COURT_NOT_AVAILABLE",
  NO_COURT_AVAILABLE: "NO_COURT_AVAILABLE",
  COURT_ID_REQUIRED: "COURT_ID_REQUIRED",
  COURT_LEASE_NOT_ACTIVE: "COURT_LEASE_NOT_ACTIVE",
  IDEMPOTENCY_KEY_REQUIRED: "IDEMPOTENCY_KEY_REQUIRED",
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
  [DAILY_PLAY_CODE.PLAYER_NOT_ELIGIBLE]:
    "VĐV không thuộc danh sách hợp lệ của CLB/tenant.",
  [DAILY_PLAY_CODE.CHECKOUT_PLAYER_ACTIVE]:
    "Không thể bỏ check-in VĐV đang trong trận. Hủy trận hoặc hoàn thành trước.",
  [DAILY_PLAY_CODE.MATCH_COMPLETED_IMMUTABLE]:
    "Trận đã hoàn thành — không thể sửa điểm hoặc hủy thường.",
  [DAILY_PLAY_CODE.MATCH_NOT_ASSIGNED]:
    "Chỉ bắt đầu trận đã được xếp sân (assigned).",
  [DAILY_PLAY_CODE.MATCH_NOT_PLAYING]:
    "Chỉ nhập điểm khi trận đang chơi (playing).",
  [DAILY_PLAY_CODE.MATCH_NOT_COMPLETED]:
    "Chỉ sửa điểm khi trận đã hoàn tất (completed).",
  [DAILY_PLAY_CODE.INVALID_MATCH_SHAPE]:
    "Trận đôi phải có đúng 4 VĐV khác nhau (2 vs 2).",
  [DAILY_PLAY_CODE.INVALID_SCORE]:
    "Điểm không hợp lệ. Điểm phải là số nguyên không âm và không hòa.",
  [DAILY_PLAY_CODE.SCORE_CONFLICT]:
    "Trận đã có kết quả khác. Không thể ghi đè điểm mâu thuẫn.",
  [DAILY_PLAY_CODE.NOT_ENOUGH_PLAYERS]:
    "Không đủ VĐV check-in rảnh để tạo trận.",
  [DAILY_PLAY_CODE.CLOUD_UNAVAILABLE]:
    "Canonical Daily Play chưa sẵn sàng trên máy chủ. Không dùng dữ liệu trình duyệt.",
  [DAILY_PLAY_CODE.READBACK_FAILED]:
    "Thao tác đã gửi lên máy chủ nhưng không tải lại được trạng thái mới. Hãy làm mới trang.",
  [DAILY_PLAY_CODE.NOT_AUTHENTICATED]:
    "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.",
  [DAILY_PLAY_CODE.FORBIDDEN]:
    "Bạn không có quyền thực hiện thao tác Daily Play này.",
  [DAILY_PLAY_CODE.TENANT_FORBIDDEN]:
    "Thao tác không thuộc phạm vi tenant hiện tại.",
  [DAILY_PLAY_CODE.NOT_FOUND]: "Không tìm thấy trận hoặc buổi chơi.",
  [DAILY_PLAY_CODE.MISSING_EXPECTED_VERSION]:
    "Thiếu phiên bản dữ liệu — hãy tải lại trang rồi thử lại.",
  [DAILY_PLAY_CODE.MISSING_IDEMPOTENCY_KEY]: "Thiếu khóa idempotency.",
  [DAILY_PLAY_CODE.COURT_NOT_ELIGIBLE]: "Sân không thuộc buổi chơi.",
  [DAILY_PLAY_CODE.MATCH_NOT_WAITING]:
    "Chỉ xếp sân cho trận đang chờ (waiting).",
  [DAILY_PLAY_CODE.MATCH_NOT_ACTIVE]:
    "Chỉ đổi sân khi trận đang assigned hoặc playing.",
  [DAILY_PLAY_CODE.VALIDATION]: "Dữ liệu Daily Play không hợp lệ.",
  [DAILY_PLAY_CODE.SUBSTITUTION_UNSUPPORTED]:
    "Daily Play chưa hỗ trợ thay người trong trận.",
  [DAILY_PLAY_CODE.TOURNAMENT_NOT_FOUND]:
    "Không tìm thấy buổi chơi hằng ngày.",
  [DAILY_PLAY_CODE.MATCHES_REQUIRED]: "Thiếu danh sách trận đề xuất.",
  [DAILY_PLAY_CODE.MATCH_ALREADY_EXISTS]: "Trận này đã tồn tại.",
  [DAILY_PLAY_CODE.PLAYER_NOT_CHECKED_IN]: "VĐV chưa check-in.",
  [DAILY_PLAY_CODE.PLAYER_ID_REQUIRED]: "Thiếu mã VĐV.",
  [DAILY_PLAY_CODE.MATCH_NOT_FOUND]: "Không tìm thấy trận.",
  [DAILY_PLAY_CODE.COURT_NOT_AVAILABLE]:
    "Sân không khả dụng hoặc không thuộc buổi chơi.",
  [DAILY_PLAY_CODE.NO_COURT_AVAILABLE]:
    "Hiện chưa có sân trống. Trận sẽ chờ sân.",
  [DAILY_PLAY_CODE.COURT_ID_REQUIRED]: "Thiếu mã sân.",
  [DAILY_PLAY_CODE.COURT_LEASE_NOT_ACTIVE]:
    "Sân chưa được giữ cho trận này.",
  [DAILY_PLAY_CODE.IDEMPOTENCY_KEY_REQUIRED]: "Thiếu khóa idempotency.",
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
