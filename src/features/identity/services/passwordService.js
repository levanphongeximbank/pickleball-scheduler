import { getSupabaseAuthClient, hasSupabaseConfig, PROFILES_TABLE } from "../../../auth/supabaseClient.js";
import { formatAuthError } from "../../../auth/authErrors.js";
import {
  ensureRecoverySession,
  getCurrentUser,
  isDevAuthAllowed,
  refreshAuthProfileFromSupabase,
} from "../../../auth/authService.js";
import { getResetPasswordRedirectUrl } from "../../../config/authConfig.js";
import { writeAuditLog, AUDIT_ACTIONS } from "./auditService.js";

const DEV_RESET_KEY = "pickleball-dev-password-reset-v1";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function loadDevResetTokens() {
  try {
    const raw = localStorage.getItem(DEV_RESET_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveDevResetTokens(map) {
  localStorage.setItem(DEV_RESET_KEY, JSON.stringify(map));
}

function createDevToken() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `reset-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export async function requestPasswordReset(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { ok: false, error: "Nhập email.", code: "EMAIL_REQUIRED" };
  }

  if (hasSupabaseConfig()) {
    const client = getSupabaseAuthClient();
    if (!client) {
      return { ok: false, error: "Supabase chưa cấu hình.", code: "NO_SUPABASE" };
    }

    const redirectTo = getResetPasswordRedirectUrl();
    const { error } = await client.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo,
    });

    if (error) {
      await writeAuditLog({
        action: AUDIT_ACTIONS.LOGIN_FAILED,
        resourceType: "auth",
        metadata: { reason: "reset_request_failed", email: normalizedEmail },
        actor: { email: normalizedEmail },
      });
      return {
        ok: false,
        error: formatAuthError(error.message, "RESET_FAILED"),
        code: "RESET_FAILED",
      };
    }

    await writeAuditLog({
      action: AUDIT_ACTIONS.RESET_PASSWORD,
      resourceType: "auth",
      metadata: { step: "request", email: normalizedEmail },
      actor: { email: normalizedEmail },
    });

    return {
      ok: true,
      message: "Kiểm tra email để đặt lại mật khẩu.",
    };
  }

  if (!isDevAuthAllowed()) {
    return { ok: false, error: "Chức năng chỉ khả dụng với Supabase Auth.", code: "NO_SUPABASE" };
  }

  const token = createDevToken();
  const tokens = loadDevResetTokens();
  tokens[token] = {
    email: normalizedEmail,
    expiresAt: Date.now() + RESET_TOKEN_TTL_MS,
  };
  saveDevResetTokens(tokens);

  await writeAuditLog({
    action: AUDIT_ACTIONS.RESET_PASSWORD,
    resourceType: "auth",
    metadata: { step: "request_dev", email: normalizedEmail },
    actor: { email: normalizedEmail },
  });

  return {
    ok: true,
    message: "Dev mode: dùng link đặt lại mật khẩu bên dưới.",
    devResetPath: `/reset-password?token=${token}`,
  };
}

export function validateDevResetToken(token) {
  const tokens = loadDevResetTokens();
  const entry = tokens[token];
  if (!entry) {
    return { ok: false, error: "Token không hợp lệ hoặc đã hết hạn.", code: "INVALID_TOKEN" };
  }
  if (Date.now() > entry.expiresAt) {
    delete tokens[token];
    saveDevResetTokens(tokens);
    return { ok: false, error: "Token đã hết hạn.", code: "TOKEN_EXPIRED" };
  }
  return { ok: true, email: entry.email };
}

export async function completePasswordReset({ password, token = null } = {}) {
  const nextPassword = String(password || "");
  if (nextPassword.length < 6) {
    return { ok: false, error: "Mật khẩu tối thiểu 6 ký tự.", code: "WEAK_PASSWORD" };
  }

  if (hasSupabaseConfig()) {
    const client = getSupabaseAuthClient();
    if (!client) {
      return { ok: false, error: "Supabase chưa cấu hình.", code: "NO_SUPABASE" };
    }

    const recovery = await ensureRecoverySession();
    if (!recovery.ok) {
      return recovery;
    }

    const { error } = await client.auth.updateUser({ password: nextPassword });
    if (error) {
      return {
        ok: false,
        error: formatAuthError(error.message, "RESET_FAILED"),
        code: "RESET_FAILED",
      };
    }

    try {
      await client.auth.signOut();
    } catch {
      // recovery session may already be cleared
    }

    const user = getCurrentUser();
    await writeAuditLog({
      action: AUDIT_ACTIONS.RESET_PASSWORD,
      resourceType: "auth",
      resourceId: user?.id || "",
      metadata: { step: "complete" },
    });

    return { ok: true, message: "Đặt lại mật khẩu thành công." };
  }

  if (!isDevAuthAllowed() || !token) {
    return { ok: false, error: "Token reset bắt buộc trong dev mode.", code: "TOKEN_REQUIRED" };
  }

  const check = validateDevResetToken(token);
  if (!check.ok) {
    return check;
  }

  const devPasswordsKey = "pickleball-dev-passwords-v1";
  const passwords = JSON.parse(localStorage.getItem(devPasswordsKey) || "{}");
  passwords[check.email] = nextPassword;
  localStorage.setItem(devPasswordsKey, JSON.stringify(passwords));

  const tokens = loadDevResetTokens();
  delete tokens[token];
  saveDevResetTokens(tokens);

  await writeAuditLog({
    action: AUDIT_ACTIONS.RESET_PASSWORD,
    resourceType: "auth",
    metadata: { step: "complete_dev", email: check.email },
    actor: { email: check.email },
  });

  return { ok: true, message: "Đặt lại mật khẩu dev thành công. Đăng nhập lại." };
}

export async function changePassword({ currentPassword, newPassword } = {}) {
  const current = String(currentPassword || "");
  const next = String(newPassword || "");

  if (!current || !next) {
    return { ok: false, error: "Nhập đủ mật khẩu hiện tại và mới.", code: "FIELDS_REQUIRED" };
  }
  if (next.length < 6) {
    return { ok: false, error: "Mật khẩu mới tối thiểu 6 ký tự.", code: "WEAK_PASSWORD" };
  }
  if (current === next) {
    return { ok: false, error: "Mật khẩu mới phải khác mật khẩu hiện tại.", code: "SAME_PASSWORD" };
  }

  const user = getCurrentUser();
  if (!user?.email) {
    return { ok: false, error: "Chưa đăng nhập.", code: "NOT_AUTHENTICATED" };
  }

  if (hasSupabaseConfig()) {
    const client = getSupabaseAuthClient();
    if (!client) {
      return { ok: false, error: "Supabase chưa cấu hình.", code: "NO_SUPABASE" };
    }

    const verify = await client.auth.signInWithPassword({
      email: user.email,
      password: current,
    });

    if (verify.error) {
      return { ok: false, error: "Mật khẩu hiện tại không đúng.", code: "INVALID_PASSWORD" };
    }

    const { error } = await client.auth.updateUser({ password: next });
    if (error) {
      return {
        ok: false,
        error: formatAuthError(error.message, "CHANGE_FAILED"),
        code: "CHANGE_FAILED",
      };
    }

    await writeAuditLog({
      action: AUDIT_ACTIONS.PASSWORD_CHANGE,
      resourceType: "auth",
      resourceId: user.id,
    });

    return { ok: true, message: "Đổi mật khẩu thành công." };
  }

  if (!isDevAuthAllowed()) {
    return { ok: false, error: "Đổi mật khẩu cần Supabase Auth.", code: "NO_SUPABASE" };
  }

  const devPasswordsKey = "pickleball-dev-passwords-v1";
  const passwords = JSON.parse(localStorage.getItem(devPasswordsKey) || "{}");
  const stored = passwords[user.email];

  if (stored && stored !== current) {
    return { ok: false, error: "Mật khẩu hiện tại không đúng.", code: "INVALID_PASSWORD" };
  }

  passwords[user.email] = next;
  localStorage.setItem(devPasswordsKey, JSON.stringify(passwords));

  await writeAuditLog({
    action: AUDIT_ACTIONS.PASSWORD_CHANGE,
    resourceType: "auth",
    resourceId: user.id,
  });

  return { ok: true, message: "Đổi mật khẩu dev thành công." };
}

export async function completeMandatoryPasswordChange({ currentPassword, newPassword } = {}) {
  const current = String(currentPassword || "");
  const next = String(newPassword || "");

  if (!current || !next) {
    return { ok: false, error: "Nhập đủ mật khẩu hiện tại và mới.", code: "FIELDS_REQUIRED" };
  }
  if (next.length < 6) {
    return { ok: false, error: "Mật khẩu mới tối thiểu 6 ký tự.", code: "WEAK_PASSWORD" };
  }
  if (current === next) {
    return { ok: false, error: "Mật khẩu mới phải khác mật khẩu tạm.", code: "SAME_PASSWORD" };
  }

  const user = getCurrentUser();
  if (!user?.email) {
    return { ok: false, error: "Chưa đăng nhập.", code: "NOT_AUTHENTICATED" };
  }
  if (!user.mustChangePassword) {
    return { ok: false, error: "Tài khoản không yêu cầu đổi mật khẩu.", code: "NOT_REQUIRED" };
  }

  if (hasSupabaseConfig()) {
    const client = getSupabaseAuthClient();
    if (!client) {
      return { ok: false, error: "Supabase chưa cấu hình.", code: "NO_SUPABASE" };
    }

    const verify = await client.auth.signInWithPassword({
      email: user.email,
      password: current,
    });

    if (verify.error) {
      return { ok: false, error: "Mật khẩu hiện tại không đúng.", code: "INVALID_PASSWORD" };
    }

    const { error: passwordError } = await client.auth.updateUser({
      password: next,
      data: { must_change_password: false },
    });
    if (passwordError) {
      return {
        ok: false,
        error: formatAuthError(passwordError.message, "CHANGE_FAILED"),
        code: "CHANGE_FAILED",
      };
    }

    const { error: profileError } = await client
      .from(PROFILES_TABLE)
      .update({
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (profileError) {
      return {
        ok: false,
        error: profileError.message || "Không thể cập nhật profile.",
        code: "PROFILE_UPDATE_FAILED",
      };
    }

    const refreshed = await refreshAuthProfileFromSupabase(user.id);
    if (!refreshed.ok) {
      return {
        ok: false,
        error: refreshed.error || "Không thể làm mới phiên đăng nhập.",
        code: refreshed.code || "PROFILE_REFRESH_FAILED",
      };
    }

    await writeAuditLog({
      action: AUDIT_ACTIONS.PASSWORD_CHANGE,
      resourceType: "auth",
      resourceId: user.id,
      metadata: { step: "mandatory_first_login" },
    });

    return { ok: true, message: "Đổi mật khẩu thành công.", user: refreshed.user };
  }

  return { ok: false, error: "Đổi mật khẩu cần Supabase Auth.", code: "NO_SUPABASE" };
}
