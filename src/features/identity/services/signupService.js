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
    errors.venueName = "Nhập ghi chú hoặc tên gợi ý cho cụm sân.";
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
    metadata.claim_note = String(venueName || "").trim();
    metadata.venue_name = String(venueName || "").trim();
  }

  return metadata;
}

export async function completeCourtOwnerRegistration(note = "") {
  const trimmedNote = String(note || "").trim();

  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, error: "Supabase chưa cấu hình.", code: "NO_SUPABASE" };
  }

  const { data, error } = await client.rpc("auth_register_court_owner_intent", {
    p_note: trimmedNote,
  });

  if (error) {
    const message = String(error.message || "");
    if (
      message.includes("auth_register_court_owner_intent") ||
      message.includes("auth_register_court_owner")
    ) {
      return {
        ok: false,
        error: "Chức năng đăng ký chủ sân chưa sẵn sàng trên server. Liên hệ quản trị viên.",
        code: "RPC_NOT_DEPLOYED",
      };
    }
    if (message.includes("already_has_venue")) {
      return { ok: false, error: "Tài khoản đã gắn sân.", code: "ALREADY_HAS_VENUE" };
    }
    if (message.includes("already_assigned")) {
      return { ok: false, error: "Tài khoản đã có cụm sân.", code: "ALREADY_ASSIGNED" };
    }
    return {
      ok: false,
      error: formatAuthError(message, "COURT_OWNER_SIGNUP_FAILED"),
      code: "COURT_OWNER_SIGNUP_FAILED",
    };
  }

  return {
    ok: true,
    intent: data?.intent || "court_owner",
    nextStep: data?.next_step || "claim_cluster",
    message:
      "Đăng ký chủ sân thành công. Chọn cụm sân tại mục Cơ sở hiện tại (sidebar) và gửi yêu cầu xác nhận.",
  };
}

export async function maybeCompletePendingCourtOwnerRegistration(authUser) {
  const metadata = authUser?.user_metadata || {};
  const claimNote = String(metadata.claim_note || metadata.venue_name || "").trim();

  if (metadata.signup_intent !== SIGNUP_INTENT.COURT_OWNER) {
    return { ok: true, skipped: true };
  }

  const profileResult = await fetchProfileByUserId(authUser.id);
  if (!profileResult.ok) {
    return { ok: true, skipped: true };
  }

  if (profileResult.user.venueId) {
    return { ok: true, skipped: true, reason: "already_has_venue" };
  }

  if (profileResult.user.role !== ROLES.PLAYER && profileResult.user.role !== ROLES.COURT_OWNER) {
    return { ok: true, skipped: true, reason: "not_player" };
  }

  return completeCourtOwnerRegistration(claimNote);
}
