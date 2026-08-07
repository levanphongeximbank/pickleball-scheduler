/**
 * Wave 3 — canonical user-visible Vietnamese label SoT.
 * Applied into canonicalMenuData by scripts/apply-wave3-canonical-vietnamese-labels.mjs.
 * Approved untranslated brand/product tokens must remain: PICK_VN, AI, VPR, VPL, VPT, VPC, Zalo OA.
 */

export const APPROVED_UNTRANSLATED_TERMS = Object.freeze([
  "PICK_VN",
  "AI",
  "VPR",
  "VPL",
  "VPT",
  "VPC",
  "Zalo OA",
  "API",
  "CRM",
  "QR",
]);

/** Level-1 group id → Vietnamese label */
export const LEVEL1_VIETNAMESE_LABELS = Object.freeze({
  "01": "Tổng quan",
  "02": "Vận hành sân",
  "03": "Khách hàng & VĐV",
  "04": "CLB & Huấn luyện",
  "05": "Giải đấu",
  "06": "Xếp hạng",
  "07": "Tài chính",
  "08": "Báo cáo & Phân tích",
  "09": "Trợ lý AI",
  "10": "Thông báo",
  "11": "Cổng công khai",
  "12": "Quản trị nền tảng",
  "13": "Hỗ trợ",
});

/** level2 key → Vietnamese module label */
export const LEVEL2_VIETNAMESE_LABELS = Object.freeze({
  "AI Assistant": "Trợ lý AI",
  Audit: "Nhật ký kiểm tra",
  Director: "Điều hành sân",
  "Identity / Users": "Danh tính & Người dùng",
  Marketplace: "Cửa hàng",
  "Player mobile": "VĐV di động",
  "Private Pairing Rules": "Quy tắc ghép cặp riêng",
  Tenants: "Tổ chức",
  "Tournament Engine": "Công cụ giải đấu",
  "Venue Config": "Cấu hình sân",
  "VPR / Ranking": "Xếp hạng VPR",
  "Check-in": "Check-in",
  "Vận hành mobile": "Vận hành di động",
  "Billing nền tảng": "Thanh toán nền tảng",
  "Quản trị marketplace": "Quản trị cửa hàng",
  "CRM & Chăm sóc KH": "CRM & Chăm sóc KH",
  "Trang chủ portal": "Trang chủ cổng",
});

/** route → leaf label */
export const ROUTE_VIETNAMESE_LABELS = Object.freeze({
  "/rankings": "BXH công khai",
  "/dashboard/rankings": "Quản lý xếp hạng",
  "/court-management/bookings": "Quản lý đặt sân",
  "/court-management/revenue": "Xem doanh thu",
  "/court-management/customers": "Danh sách khách hàng",
  "/court-management/members": "Danh sách thành viên",
  "/court-management/courts": "Quản lý sân",
  "/select-players": "Hàng chờ ghép cặp",
  "/court-engine": "Điều hành sân",
  "/mobile/check-in": "Check-in di động",
  "/mobile/qr-scan": "Quét mã QR",
  "/mobile/player": "Trang VĐV",
  "/mobile/operations": "Tổng quan vận hành",
  "/mobile/notifications": "Cài đặt thông báo",
  "/players": "Danh sách nhân sự",
  "/players/skill": "Trình độ nhân sự",
  "/profile": "Hồ sơ của tôi",
  "/athletes": "Danh bạ VĐV",
  "/player/skill": "Trình độ của tôi",
  "/player/skill-assessment": "Đánh giá lần đầu",
  "/club": "Quản lý CLB",
  "/manage/clubs": "Quản trị CLB",
  "/platform/clubs": "Tất cả CLB",
  "/discover-clubs": "Khám phá CLB",
  "/my-club": "CLB của tôi",
  "/my-club/requests": "Yêu cầu thành viên",
  "/coaching/coaches": "Danh sách HLV",
  "/coaching/coach-list": "HLV cho VĐV",
  "/coaching/register": "Đăng ký gói",
  "/coaching/students": "Học viên",
  "/coaching/classes": "Lớp học",
  "/coaching/packages": "Gói huấn luyện",
  "/coaching/attendance": "Điểm danh",
  "/coaching/evaluations": "Đánh giá",
  "/tournaments/:tournamentId/engine": "Công cụ giải",
  "/referee": "Trọng tài",
  "/billing/current-plan": "Gói hiện tại",
  "/billing/payment": "Thanh toán",
  "/billing/upgrade": "Nâng cấp gói",
  "/finance/debt": "Công nợ",
  "/finance/receipts": "Biên lai",
  "/finance/refunds": "Hoàn tiền",
  "/marketplace/orders": "Đơn hàng",
  "/reports": "Trung tâm báo cáo",
  "/ai": "Trợ lý AI",
  "/notifications": "Trung tâm thông báo",
  "/crm/messages": "Tin nhắn CRM",
  "/crm/templates": "Mẫu tin",
  "/crm/campaigns": "Chiến dịch",
  "/crm/history": "Lịch sử",
  "/crm/reminders/booking": "Nhắc đặt sân",
  "/support": "Trung tâm hỗ trợ",
  "/users": "Người dùng",
  "/users/verification": "Xác minh VĐV",
  "/admin/roles": "Vai trò & quyền",
  "/audit": "Nhật ký kiểm tra",
  "/admin/tenants": "Quản lý tổ chức",
  "/admin/court-clusters": "Cụm sân",
  "/admin/hours": "Giờ hoạt động",
  "/admin/skill-level-requests": "Hàng chờ duyệt",
  "/admin/tournament-certifications": "Chứng nhận giải",
  "/admin/staff": "Nhân sự",
  "/admin/ai-pairing/private-rules": "Quy tắc quản trị",
  "/settings": "Cài đặt sân",
  "/settings/integrations": "Cài đặt tích hợp",
  "/admin/billing": "Thanh toán nền tảng",
  "/admin/billing/tenants": "Thanh toán theo tổ chức",
  "/admin/billing/invoices": "Hóa đơn quản trị",
  "/admin/billing/payments": "Thanh toán quản trị",
  "/admin/billing/audit": "Nhật ký thanh toán",
  "/admin/marketplace": "Quản trị cửa hàng",
  "/admin/marketplace/products": "Sản phẩm cửa hàng",
  "/admin/marketplace/orders": "Đơn hàng cửa hàng",
  "/admin/webhook-events": "Sự kiện tích hợp",
});

export const BADGE_VIETNAMESE_LABELS = Object.freeze({
  PARTIAL: "Một phần",
});

/**
 * Internal provenance/fallback reason codes → user-visible Vietnamese.
 * Keep internal codes in services; never render snake_case directly.
 */
export const TECHNICAL_REASON_VIETNAMESE_MESSAGES = Object.freeze({
  dashboard_no_live_rows: "Chưa có dữ liệu trực tiếp để hiển thị.",
  dashboard_live_failed: "Không tải được dữ liệu trực tiếp.",
  dashboard_payload_missing: "Thiếu dữ liệu tổng quan.",
  dashboard_hard_cutover_unavailable: "Nguồn dữ liệu tổng quan tạm thời không khả dụng.",
  no_live_rows: "Chưa có dữ liệu trực tiếp để hiển thị.",
  provenance_missing: "Thiếu thông tin nguồn dữ liệu.",
  mock_without_explicit_demo_request: "Dữ liệu demo không được yêu cầu rõ ràng.",
  explicit_demo: "Đang hiển thị dữ liệu demo.",
  explicit_preview: "Đang hiển thị bản xem trước.",
  stale_source: "Dữ liệu đã cũ, cần làm mới.",
  source_unavailable: "Nguồn dữ liệu chưa khả dụng.",
  mixed_component_sources: "Các thành phần đang dùng nguồn dữ liệu khác nhau.",
  partial_live_fields: "Chỉ một phần dữ liệu trực tiếp khả dụng.",
  unexpected_mock_without_explicit_mode: "Phát hiện dữ liệu demo ngoài chế độ cho phép.",
  availability_error: "Lỗi kiểm tra nguồn dữ liệu.",
  availability_empty: "Nguồn dữ liệu trống.",
  availability_stale: "Nguồn dữ liệu đã cũ.",
  availability_partial: "Nguồn dữ liệu chỉ khả dụng một phần.",
  availability_mixed: "Nguồn dữ liệu hỗn hợp.",
  availability_unavailable: "Nguồn dữ liệu không khả dụng.",
  REPORTING_RUNTIME_NOT_INJECTED: "Hệ thống báo cáo chưa sẵn sàng.",
  no_report_definitions: "Chưa có định nghĩa báo cáo.",
  no_saved_reports: "Chưa có báo cáo đã lưu.",
  no_saved_filters: "Chưa có bộ lọc đã lưu.",
});

export function getTechnicalReasonUserMessage(reason) {
  const key = String(reason || "").trim();
  if (!key) return null;
  if (TECHNICAL_REASON_VIETNAMESE_MESSAGES[key]) {
    return TECHNICAL_REASON_VIETNAMESE_MESSAGES[key];
  }
  if (key.startsWith("explicit_") && key.endsWith("_mode")) {
    return "Đang dùng chế độ dữ liệu được chỉ định.";
  }
  if (key.startsWith("unknown_provenance:")) {
    return "Không nhận diện được nguồn dữ liệu.";
  }
  if (key.startsWith("unknown_availability:")) {
    return "Không nhận diện được trạng thái nguồn dữ liệu.";
  }
  if (key.startsWith("authorization_denied")) {
    return "Bạn không có quyền xem nội dung này.";
  }
  // Fail closed for raw snake_case / SCREAMING_SNAKE technical tokens.
  if (/^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(key) || /^[A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(key)) {
    return "Không thể hiển thị chi tiết kỹ thuật. Vui lòng thử lại hoặc liên hệ hỗ trợ.";
  }
  return key;
}
