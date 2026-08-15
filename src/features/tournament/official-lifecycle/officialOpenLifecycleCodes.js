export const OFFICIAL_OPEN_LIFECYCLE_RPC = Object.freeze({
  ENSURE_LIVE: "official_open_ensure_match_live",
  REVOKE_LIVE: "official_open_revoke_match_live",
  REFEREE_GET: "official_open_referee_get_match",
  ADJUST_LIVE: "official_open_adjust_live_score",
  COMMIT_RESULT: "official_open_commit_match_result",
  ADMIN_COMMIT: "official_open_admin_commit_match_result",
  GENERATE_KNOCKOUT: "official_open_generate_knockout",
  COMPLETE: "official_open_complete_tournament",
  PUBLIC_RESULTS: "official_open_get_public_results",
});

export const OFFICIAL_OPEN_LIFECYCLE_CODE = Object.freeze({
  CLOUD_UNAVAILABLE: "CLOUD_UNAVAILABLE",
  SQL_NOT_APPLIED: "SQL_NOT_APPLIED",
  INVALID_TOKEN: "INVALID_TOKEN",
  LIVE_VERSION_CONFLICT: "LIVE_VERSION_CONFLICT",
  VERSION_CONFLICT: "VERSION_CONFLICT",
  ALREADY_FINALIZED: "ALREADY_FINALIZED",
  UNFINISHED_SCORE: "UNFINISHED_SCORE",
  TOURNAMENT_COMPLETED: "TOURNAMENT_COMPLETED",
  QUALIFICATION_TIE_UNRESOLVED: "QUALIFICATION_TIE_UNRESOLVED",
  IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
  GROUP_INCOMPLETE: "GROUP_INCOMPLETE",
  KO_ALREADY_GENERATED: "KO_ALREADY_GENERATED",
  KO_ALREADY_STARTED: "KO_ALREADY_STARTED",
});

export const OFFICIAL_OPEN_LIFECYCLE_MESSAGES = Object.freeze({
  [OFFICIAL_OPEN_LIFECYCLE_CODE.CLOUD_UNAVAILABLE]: "Không kết nối được máy chủ giải.",
  [OFFICIAL_OPEN_LIFECYCLE_CODE.SQL_NOT_APPLIED]:
    "Lệnh trọng tài Official chưa được cài trên máy chủ. Cần Owner GO Staging Apply.",
  [OFFICIAL_OPEN_LIFECYCLE_CODE.INVALID_TOKEN]: "Liên kết trọng tài không hợp lệ hoặc đã thu hồi.",
  [OFFICIAL_OPEN_LIFECYCLE_CODE.LIVE_VERSION_CONFLICT]: "Điểm live đã đổi. Tải lại rồi chấm tiếp.",
  [OFFICIAL_OPEN_LIFECYCLE_CODE.VERSION_CONFLICT]: "Giải đã được cập nhật. Tải lại rồi thử lại.",
  [OFFICIAL_OPEN_LIFECYCLE_CODE.ALREADY_FINALIZED]: "Trận đã chốt — không nhận điểm khác.",
  [OFFICIAL_OPEN_LIFECYCLE_CODE.UNFINISHED_SCORE]: "Điểm chưa đạt điểm đích của vòng.",
  [OFFICIAL_OPEN_LIFECYCLE_CODE.TOURNAMENT_COMPLETED]: "Giải đã đóng — không thể sửa.",
  [OFFICIAL_OPEN_LIFECYCLE_CODE.IDEMPOTENCY_CONFLICT]:
    "Khóa idempotency đã dùng cho một yêu cầu khác.",
  [OFFICIAL_OPEN_LIFECYCLE_CODE.QUALIFICATION_TIE_UNRESOLVED]:
    "Hòa chỉ số thể thao tại ranh giới suất — không bốc KO.",
  [OFFICIAL_OPEN_LIFECYCLE_CODE.GROUP_INCOMPLETE]: "Cần hoàn tất vòng bảng trước khi tạo knockout.",
  [OFFICIAL_OPEN_LIFECYCLE_CODE.KO_ALREADY_GENERATED]: "Bracket knockout đã tồn tại.",
  [OFFICIAL_OPEN_LIFECYCLE_CODE.KO_ALREADY_STARTED]: "Knockout đã bắt đầu — không tạo lại nhánh.",
});
