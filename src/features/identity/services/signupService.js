import { ROLES } from "../../../auth/roles.js";
import { fetchProfileByUserId } from "../../../auth/profileService.js";
import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { formatAuthError } from "../../../auth/authErrors.js";
import { MIN_PASSWORD_LENGTH } from "../../../config/authConfig.js";

export const SIGNUP_INTENT = Object.freeze({
  PLAYER: "player",
  COURT_OWNER: "court_owner",
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSignupForm({
  email,
  password,
  confirmPassword,
  signupType = SIGNUP_INTENT.PLAYER,
  venueName = "",
} = {}) {
  const errors = {};
  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail) {
    errors.email = "Nhập email.";
  } else if (!EMAIL_PATTERN.test(normalizedEmail)) {
    errors.email = "Email không đúng định dạng.";
  }

  if (!password) {
    errors.password = "Nhập mật khẩu.";
  } else if (String(password).length < MIN_PASSWORD_LENGTH) {
    errors.password = `Mật khẩu tối thiểu ${MIN_PASSWORD_LENGTH} ký tự.`;
  }

  if (!confirmPassword) {
    errors.confirmPassword = "Xác nhận mật khẩu.";
  } else if (password !== confirmPassword) {
    errors.confirmPassword = "Mật khẩu xác nhận không khớp.";
  }

  if (signupType === SIGNUP_INTENT.COURT_OWNER && !String(venueName || "").trim()) {
    errors.venueName = "Nhập tên sân hoặc CLB.";
  }

  const firstError = errors.email || errors.password || errors.confirmPassword || errors.venueName || null;

  return {
    ok: Object.keys(errors).length === 0,
    errors,
    error: firstError,
    normalizedEmail,
  };
}

export function buildSignupUserMetadata({ displayName, signupIntent, venueName } = {}) {
  const metadata = {
    display_name: String(displayName || "").trim(),
    signup_intent: signupIntent === SIGNUP_INTENT.COURT_OWNER ? SIGNUP_INTENT.COURT_OWNER : SIGNUP_INTENT.PLAYER,
  };

  if (metadata.signup_intent === SIGNUP_INTENT.COURT_OWNER) {
    metadata.venue_name = String(venueName || "").trim();
  }

  return metadata;
}

export async function completeCourtOwnerRegistration(venueName) {
  const trimmedVenueName = String(venueName || "").trim();
  if (!trimmedVenueName) {
    return { ok: false, error: "Nhập tên sân hoặc CLB.", code: "VENUE_NAME_REQUIRED" };
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, error: "Supabase chưa cấu hình.", code: "NO_SUPABASE" };
  }

  const { data, error } = await client.rpc("auth_register_court_owner", {
    p_venue_name: trimmedVenueName,
  });

  if (error) {
    const message = String(error.message || "");
    if (message.includes("auth_register_court_owner")) {
      return {
        ok: false,
        error: "Chức năng đăng ký chủ sân chưa sẵn sàng trên server. Liên hệ quản trị viên.",
        code: "RPC_NOT_DEPLOYED",
      };
    }
    if (message.includes("already_has_venue")) {
      return { ok: false, error: "Tài khoản đã gắn sân.", code: "ALREADY_HAS_VENUE" };
    }
    return {
      ok: false,
      error: formatAuthError(message, "COURT_OWNER_SIGNUP_FAILED"),
      code: "COURT_OWNER_SIGNUP_FAILED",
    };
  }

  return {
    ok: true,
    venueId: data?.venue_id || null,
    subscriptionId: data?.subscription_id || null,
  };
}

/**
 * Hoàn tất đăng ký chủ sân sau xác nhận email (metadata signup_intent + venue_name).
 */
export async function maybeCompletePendingCourtOwnerRegistration(authUser) {
  const metadata = authUser?.user_metadata || {};
  const venueName = String(metadata.venue_name || "").trim();

  if (metadata.signup_intent !== SIGNUP_INTENT.COURT_OWNER || !venueName) {
    return { ok: true, skipped: true };
  }

  const profileResult = await fetchProfileByUserId(authUser.id);
  if (!profileResult.ok) {
    return { ok: true, skipped: true };
  }

  if (profileResult.user.venueId) {
    return { ok: true, skipped: true, reason: "already_has_venue" };
  }

  if (profileResult.user.role !== ROLES.PLAYER) {
    return { ok: true, skipped: true, reason: "not_player" };
  }

  return completeCourtOwnerRegistration(venueName);
}
