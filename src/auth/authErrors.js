/** Map Supabase Auth error → thông báo tiếng Việt thân thiện. */
const AUTH_ERROR_MAP = Object.freeze({
  "Invalid login credentials": "Email hoặc mật khẩu không đúng.",
  "Email not confirmed": "Email chưa được xác nhận. Kiểm tra hộp thư.",
  "User already registered": "Email đã được đăng ký.",
  "Password should be at least 6 characters": "Mật khẩu phải có ít nhất 6 ký tự.",
  "Signup requires a valid password": "Mật khẩu không hợp lệ.",
  "Unable to validate email address: invalid format": "Email không đúng định dạng.",
});

export function formatAuthError(message, code = "") {
  const raw = String(message || "").trim();
  if (!raw) {
    if (code === "AUTH_FAILED") return "Đăng nhập thất bại. Kiểm tra email và mật khẩu.";
    if (code === "NO_SUPABASE") return "Supabase chưa cấu hình.";
    if (code === "PROFILE_NOT_FOUND") {
      return "Chưa có profile. Liên hệ quản trị viên hoặc chạy docs/supabase-rbac.sql.";
    }
    if (code === "PROFILE_INVALID") {
      return "Profile thiếu role. Liên hệ quản trị viên.";
    }
    if (code === "PROFILE_SUSPENDED") {
      return "Tài khoản chưa được kích hoạt hoặc đã bị khóa.";
    }
    if (code === "PROFILE_REQUIRED") {
      return "RBAC đang bật — cần profile hợp lệ trong bảng profiles.";
    }
    return "Đã xảy ra lỗi. Vui lòng thử lại.";
  }

  return AUTH_ERROR_MAP[raw] || raw;
}
