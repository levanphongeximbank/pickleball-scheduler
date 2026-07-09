import { ADMIN_DEFAULT_RESET_PASSWORD, MIN_PASSWORD_LENGTH } from "../../../config/authConfig.js";
import { getSupabaseAdminClient } from "../../api/repositories/supabaseApiKeyRepository.js";

/**
 * Admin reset mật khẩu user qua Supabase Admin API — đặt về mật khẩu mặc định.
 */
export async function adminResetManagedUserPassword({
  userId,
  password = ADMIN_DEFAULT_RESET_PASSWORD,
} = {}) {
  const targetUserId = String(userId || "").trim();
  if (!targetUserId) {
    return { ok: false, error: "Thiếu user id.", code: "USER_ID_REQUIRED" };
  }

  const nextPassword = String(password || "").trim() || ADMIN_DEFAULT_RESET_PASSWORD;
  if (nextPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      ok: false,
      error: `Mật khẩu tối thiểu ${MIN_PASSWORD_LENGTH} ký tự.`,
      code: "PASSWORD_TOO_SHORT",
    };
  }

  const admin = getSupabaseAdminClient();
  const { error } = await admin.auth.admin.updateUserById(targetUserId, {
    password: nextPassword,
    user_metadata: {
      must_change_password: true,
    },
  });

  if (error) {
    const message = String(error.message || "");
    if (message.toLowerCase().includes("not found")) {
      return { ok: false, error: "Không tìm thấy user.", code: "USER_NOT_FOUND" };
    }
    return { ok: false, error: message || "Reset mật khẩu thất bại.", code: "RESET_FAILED" };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ must_change_password: true, updated_at: new Date().toISOString() })
    .eq("id", targetUserId);

  if (profileError) {
    return {
      ok: false,
      error: profileError.message || "Không cập nhật được profile.",
      code: "PROFILE_UPDATE_FAILED",
    };
  }

  return {
    ok: true,
    userId: targetUserId,
    defaultPassword: nextPassword,
    mustChangePassword: true,
    message: `Đã reset mật khẩu về mặc định: ${nextPassword}`,
  };
}
