/**
 * Map canonical Team Tournament failures to operator-facing Vietnamese.
 * Raw Postgres / SQL internals stay in diagnostic fields only.
 */

const RAW_SQL_LEAK =
  /duplicate key|violates unique constraint|sqlstate|postgres|relation "|column "|permission denied for/i;

export const TEAM_TOURNAMENT_DOMAIN_CODES = Object.freeze({
  REFEREE_ASSIGNMENT_CONFLICT: "REFEREE_ASSIGNMENT_CONFLICT",
  MATCHUP_TEAMS_UNRESOLVED: "MATCHUP_TEAMS_UNRESOLVED",
  CROSS_TENANT_DENIED: "CROSS_TENANT_DENIED",
  RPC_FAILED: "RPC_FAILED",
  REPOSITORY_FAILED: "REPOSITORY_FAILED",
});

const MESSAGE_BY_CODE = Object.freeze({
  UNKNOWN_DISCIPLINE:
    "Nội dung (discipline) không khớp dữ liệu giải — kiểm tra Format MLP trước khi tạo lịch.",
  UNKNOWN_TEAM:
    "Đội trong lịch không tồn tại trên server — hoặc trận knockout còn slot trống chưa được SQL cho phép. Lưu đội rồi tạo lại; nếu tạo Bán kết thất bại, cần Staging package matchups.replace cho placeholder.",
  VALIDATION_ERROR: "Envelope lịch không hợp lệ (thiếu rulesVersion / version / payload).",
  VERSION_CONFLICT: "Xung đột phiên bản giải — tải lại rồi thử lại.",
  EMPTY_SETUP_CONFIG: "Không có khóa cấu hình hợp lệ để lưu.",
  RULES_VERSION_REQUIRED: "Thiếu rulesVersion cho lệnh setup/lịch.",
  FORBIDDEN: "Không đủ quyền thực hiện thao tác này.",
  NOT_FOUND: "Không tìm thấy giải hoặc tài nguyên liên quan.",
  CROSS_TENANT_DENIED: "Từ chối truy cập ngoài tenant.",
  cross_tenant_denied: "Từ chối truy cập ngoài tenant.",
  ALREADY_CLOSED: "Giải đã được đóng (completed).",
  CLOSE_PRECONDITION_FAILED: "Chưa đủ điều kiện đóng giải theo lifecycle hiện tại.",
  GROUP_STAGE_INCOMPLETE: "Vòng bảng chưa hoàn tất — chưa thể đóng giải.",
  ELIMINATION_INCOMPLETE: "Nhánh loại trực tiếp chưa hoàn tất — chưa thể đóng giải.",
  FINAL_NOT_COMPLETED: "Trận chung kết chưa hoàn tất — chưa thể đóng giải.",
  CHAMPION_UNRESOLVED: "Chưa xác định được nhà vô địch từ kết quả canonical.",
  INVALID_QUALIFICATION_TOTAL:
    "Tổng đội vượt bảng phải thuộc {2,4,8,16} — cloud bye chưa hỗ trợ.",
  INVALID_STAGE_SCORING_POLICY: "stageScoringPolicy không hợp lệ.",
  REFEREE_NOT_FOUND: "Không tìm thấy hồ sơ trọng tài (profiles id).",
  REFEREE_ASSIGNMENT_CONFLICT:
    "Trọng tài này đã được gán cho trận. Tải lại danh sách — không tạo assignment trùng.",
  MATCHUP_TEAMS_UNRESOLVED:
    "Trận chưa đủ hai đội (placeholder knockout). Không mở lineup / không gán trọng tài.",
  RPC_FAILED: "Không gọi được máy chủ giải đồng đội. Thử lại sau khi tải lại trang.",
  COURT_CONFLICT: "Trùng sân / giờ thi đấu — chọn khung giờ hoặc sân khác.",
  NOT_AUTHENTICATED: "Phiên đăng nhập hết hạn — đăng nhập lại.",
  REVOKE_REASON_REQUIRED: "Cần lý do khi thu hồi trọng tài.",
});

export function isRawSqlInternalMessage(message) {
  return RAW_SQL_LEAK.test(String(message || ""));
}

export function describeTeamTournamentDomainCode(code) {
  const key = String(code || "").trim();
  return MESSAGE_BY_CODE[key] || "";
}

function detectUniqueRefereeConflict(code, message) {
  const combined = `${code || ""} ${message || ""}`.toLowerCase();
  return (
    String(code) === "23505" ||
    String(code) === TEAM_TOURNAMENT_DOMAIN_CODES.REFEREE_ASSIGNMENT_CONFLICT ||
    combined.includes("referee_assignments_tenant_id_tournament_id_match_id_role") ||
    (combined.includes("duplicate key") && combined.includes("referee_assignments"))
  );
}

/**
 * @param {{ code?: string, error?: string, message?: string, details?: object }} raw
 * @returns {{ code: string, error: string, diagnosticCode: string, originalServerError: string }}
 */
export function mapTeamTournamentDomainFailure(raw = {}) {
  const original = String(raw.error || raw.message || "").trim();
  const inboundCode = String(raw.code || "").trim();

  if (detectUniqueRefereeConflict(inboundCode, original)) {
    return {
      code: TEAM_TOURNAMENT_DOMAIN_CODES.REFEREE_ASSIGNMENT_CONFLICT,
      error: MESSAGE_BY_CODE.REFEREE_ASSIGNMENT_CONFLICT,
      diagnosticCode: inboundCode || "23505",
      originalServerError: original,
    };
  }

  const described = describeTeamTournamentDomainCode(inboundCode);
  if (described) {
    const safeOriginal = isRawSqlInternalMessage(original) ? "" : original;
    return {
      code: inboundCode || TEAM_TOURNAMENT_DOMAIN_CODES.REPOSITORY_FAILED,
      error: safeOriginal || described,
      diagnosticCode: inboundCode || TEAM_TOURNAMENT_DOMAIN_CODES.REPOSITORY_FAILED,
      originalServerError: original,
    };
  }

  if (original && !isRawSqlInternalMessage(original)) {
    return {
      code: inboundCode || TEAM_TOURNAMENT_DOMAIN_CODES.REPOSITORY_FAILED,
      error: original,
      diagnosticCode: inboundCode || TEAM_TOURNAMENT_DOMAIN_CODES.REPOSITORY_FAILED,
      originalServerError: original,
    };
  }

  return {
    code: inboundCode || TEAM_TOURNAMENT_DOMAIN_CODES.REPOSITORY_FAILED,
    error: inboundCode
      ? `Không thực hiện được thao tác. Mã: ${inboundCode}`
      : "Không thực hiện được thao tác.",
    diagnosticCode: inboundCode || TEAM_TOURNAMENT_DOMAIN_CODES.REPOSITORY_FAILED,
    originalServerError: original,
  };
}
