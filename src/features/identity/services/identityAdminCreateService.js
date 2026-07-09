import { randomBytes } from "node:crypto";

import { mapProfileRowToUser, mapUserToProfileRow } from "../../../auth/profileService.js";
import { createUserRecord, USER_STATUS } from "../../../models/user.js";
import { getResetPasswordRedirectUrl } from "../../../config/authConfig.js";
import { getSupabaseAdminClient } from "../../api/repositories/supabaseApiKeyRepository.js";
import { denormalizeRoleForDb, normalizeRole, ROLES, CANONICAL_ROLES } from "../constants/roles.js";

function createTemporaryPassword() {
  return `${randomBytes(24).toString("base64url")}Aa1!`;
}

function resolveRedirectTo(redirectTo) {
  const configured = String(redirectTo || getResetPasswordRedirectUrl() || "").trim();
  return configured || undefined;
}

/**
 * Tạo auth user qua Supabase Admin API (email_confirm=true), upsert profile theo auth.users.id.
 * Không có password → mật khẩu tạm + must_change_password (không gửi email reset).
 */
export async function adminCreateManagedUser({
  email,
  password = "",
  displayName = "",
  role = ROLES.PLAYER,
  venueId = null,
  clubId = null,
  phone = "",
  redirectTo = "",
  sendPasswordSetupEmail = false,
} = {}) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, error: "Email bắt buộc.", code: "EMAIL_REQUIRED" };
  }

  const targetRole = normalizeRole(role || ROLES.PLAYER);
  if (!CANONICAL_ROLES.includes(targetRole)) {
    return { ok: false, error: "Role không hợp lệ.", code: "INVALID_ROLE" };
  }

  const admin = getSupabaseAdminClient();
  const resolvedDisplayName =
    String(displayName || "").trim() || normalizedEmail.split("@")[0];
  const providedPassword = String(password || "").trim();
  const useTemporaryPassword = !providedPassword;
  const authPassword = providedPassword || createTemporaryPassword();
  const mustChangePassword = useTemporaryPassword;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: authPassword,
    email_confirm: true,
    user_metadata: {
      display_name: resolvedDisplayName,
      must_change_password: mustChangePassword,
    },
  });

  if (authError) {
    const message = String(authError.message || "");
    if (message.toLowerCase().includes("already")) {
      return { ok: false, error: "Email đã tồn tại.", code: "DUPLICATE_EMAIL" };
    }
    return { ok: false, error: message || "Tạo user thất bại.", code: "ADMIN_CREATE_FAILED" };
  }

  const authUserId = authData?.user?.id;
  if (!authUserId) {
    return { ok: false, error: "Tạo user chưa hoàn tất.", code: "SIGNUP_INCOMPLETE" };
  }

  const profileRow = mapUserToProfileRow(
    createUserRecord({
      id: authUserId,
      email: normalizedEmail,
      displayName: resolvedDisplayName,
      role: targetRole,
      venueId,
      clubId,
      phone,
      status: USER_STATUS.ACTIVE,
      mustChangePassword,
    })
  );

  if (phone) {
    profileRow.phone = phone;
  }

  profileRow.role = denormalizeRoleForDb(targetRole);
  profileRow.must_change_password = mustChangePassword;

  const { data: profileData, error: profileError } = await admin
    .from("profiles")
    .upsert(profileRow, { onConflict: "id" })
    .select("*")
    .single();

  if (profileError) {
    return {
      ok: false,
      error: profileError.message || "Không thể tạo profile.",
      code: "PROFILE_UPSERT_FAILED",
      userId: authUserId,
    };
  }

  let passwordSetupSent = false;
  let passwordSetupMessage = null;

  if (useTemporaryPassword && sendPasswordSetupEmail) {
    const resetRedirect = resolveRedirectTo(redirectTo);
    const { error: resetError } = await admin.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: resetRedirect,
    });

    if (resetError) {
      passwordSetupMessage = resetError.message || "Không gửi được email đặt mật khẩu.";
    } else {
      passwordSetupSent = true;
      passwordSetupMessage = "Đã gửi email đặt mật khẩu cho người dùng.";
    }
  }

  return {
    ok: true,
    user: mapProfileRowToUser(profileData),
    temporaryPassword: useTemporaryPassword ? authPassword : null,
    mustChangePassword,
    passwordSetupSent,
    passwordSetupMessage,
    emailConfirmed: true,
    provider: "admin_api",
  };
}
