/** User-facing error messages for V5 assessment Edge/RPC responses. */
export const ASSESSMENT_ERROR_MESSAGES = Object.freeze({
  UNAUTHORIZED: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
  FORBIDDEN: "Bạn không có quyền thực hiện bài đánh giá này.",
  FORBIDDEN_OWNER: "Bạn không có quyền thực hiện bài đánh giá này.",
  TENANT_UNRESOLVED: "Bạn không có quyền thực hiện bài đánh giá này.",
  ASSESSMENT_NOT_FOUND: "Không tìm thấy bài đánh giá.",
  ASSESSMENT_ALREADY_COMPLETED: "Bài đánh giá đã được hoàn thành.",
  ALREADY_COMPLETED: "Bài đánh giá đã được hoàn thành.",
  INVALID_QUESTION: "Bộ câu hỏi không hợp lệ.",
  INVALID_QUESTION_ID: "Bộ câu hỏi không hợp lệ.",
  INVALID_ANSWER: "Có câu trả lời không hợp lệ.",
  INVALID_ANSWER_ANCHOR: "Có câu trả lời không hợp lệ.",
  FORBIDDEN_PAYLOAD_FIELD: "Yêu cầu chứa dữ liệu không được phép.",
  VERSION_MISMATCH: "Phiên bản đánh giá đã thay đổi. Vui lòng bắt đầu lại.",
  SINGLES_NOT_IMPLEMENTED: "Đánh giá trình độ đánh đơn chưa được hỗ trợ.",
  PERSISTENCE_FAILED: "Chưa thể lưu kết quả. Vui lòng thử lại.",
  MISSING_CORE_QUESTIONS: "Vui lòng hoàn thành tất cả câu hỏi cốt lõi.",
  ADAPTIVE_BUDGET_EXCEEDED: "Vượt quá số câu thích ứng cho phép.",
  ROLLOUT_BLOCKED: "Bài đánh giá V5 chưa mở cho tài khoản của bạn.",
  FEATURE_DISABLED: "Đánh giá V5 chưa được bật trong môi trường này.",
  NO_SUPABASE: "Kết nối máy chủ chưa sẵn sàng. Vui lòng thử lại.",
  RPC_FAILED: "Chưa thể khởi tạo bài đánh giá. Vui lòng thử lại.",
  NETWORK_ERROR: "Không thể kết nối máy chủ. Vui lòng thử lại.",
});

export function resolveAssessmentErrorMessage(code, fallback = "Đã xảy ra lỗi. Vui lòng thử lại.") {
  const key = String(code ?? "").trim().toUpperCase();
  return ASSESSMENT_ERROR_MESSAGES[key] ?? fallback;
}
