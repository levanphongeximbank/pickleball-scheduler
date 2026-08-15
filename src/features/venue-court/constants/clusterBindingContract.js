/**
 * Canonical club + physical-court cluster membership binding.
 *
 * Court Cluster != Physical Court.
 * venueId must never be substituted for clusterId.
 * Missing court.clusterId stays missing until an explicit bind.
 */

export const CLUSTER_BINDING_COMMAND = "bind_club_courts_to_cluster";
export const CLUSTER_BINDING_RPC = "bind_club_courts_to_cluster";

export const CLUSTER_BINDING_CODE = Object.freeze({
  OK: "OK",
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  REQUEST_ID_REQUIRED: "REQUEST_ID_REQUIRED",
  FORBIDDEN: "FORBIDDEN",
  VERSION_CONFLICT: "VERSION_CONFLICT",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CLUB_REQUIRED: "CLUB_REQUIRED",
  VENUE_REQUIRED: "VENUE_REQUIRED",
  CLUSTER_REQUIRED: "CLUSTER_REQUIRED",
  CLUB_NOT_FOUND: "CLUB_NOT_FOUND",
  CLUB_TENANT_MISMATCH: "CLUB_TENANT_MISMATCH",
  CLUB_BLOB_MISSING: "CLUB_BLOB_MISSING",
  AMBIGUOUS_CLUB_BLOB: "AMBIGUOUS_CLUB_BLOB",
  CLUSTER_NOT_FOUND: "CLUSTER_NOT_FOUND",
  CLUSTER_INACTIVE: "CLUSTER_INACTIVE",
  CLUSTER_VENUE_MISMATCH: "CLUSTER_VENUE_MISMATCH",
  COURT_NOT_FOUND: "COURT_NOT_FOUND",
  CROSS_CLUB_COURT: "CROSS_CLUB_COURT",
  FOREIGN_CLUSTER: "FOREIGN_CLUSTER",
  MOVE_NOT_REQUESTED: "FOREIGN_CLUSTER",
  RPC_NOT_DEPLOYED: "RPC_NOT_DEPLOYED",
  RPC_FAILED: "RPC_FAILED",
  NO_SUPABASE: "NO_SUPABASE",
});

export const CLUSTER_BINDING_MESSAGES = Object.freeze({
  [CLUSTER_BINDING_CODE.NOT_AUTHENTICATED]: "Chưa đăng nhập.",
  [CLUSTER_BINDING_CODE.FORBIDDEN]: "Không có quyền gán cụm sân.",
  [CLUSTER_BINDING_CODE.VERSION_CONFLICT]: "Dữ liệu đã thay đổi trên máy chủ. Vui lòng tải lại rồi thử lại.",
  [CLUSTER_BINDING_CODE.CLUSTER_NOT_FOUND]: "Không tìm thấy cụm sân.",
  [CLUSTER_BINDING_CODE.CLUSTER_INACTIVE]: "Cụm sân không còn hoạt động.",
  [CLUSTER_BINDING_CODE.CLUSTER_VENUE_MISMATCH]: "Cụm sân không thuộc tổ chức này.",
  [CLUSTER_BINDING_CODE.CLUB_NOT_FOUND]: "Không tìm thấy CLB.",
  [CLUSTER_BINDING_CODE.CLUB_TENANT_MISMATCH]: "CLB không thuộc tổ chức này.",
  [CLUSTER_BINDING_CODE.CLUB_BLOB_MISSING]: "Chưa có inventory sân cloud của CLB.",
  [CLUSTER_BINDING_CODE.COURT_NOT_FOUND]: "Sân được chọn không có trong inventory của CLB này.",
  [CLUSTER_BINDING_CODE.CROSS_CLUB_COURT]: "Không được gán sân của CLB khác.",
  [CLUSTER_BINDING_CODE.FOREIGN_CLUSTER]: "Sân hoặc CLB đã thuộc cụm khác. Không chuyển cụm im lặng.",
  [CLUSTER_BINDING_CODE.VALIDATION_ERROR]: "Thiếu clubId, venueId, clusterId hoặc danh sách sân.",
});
