import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { getResetPasswordRedirectUrl } from "../../../config/authConfig.js";

function resolveIdentityApiUrl(path) {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/api/identity/${path}`;
  }
  return `/api/identity/${path}`;
}

function resolveCreateUserApiUrl() {
  return resolveIdentityApiUrl("create-user");
}

function resolveResetPasswordApiUrl() {
  return resolveIdentityApiUrl("reset-password");
}

export async function callIdentityAdminCreateUser(payload = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, error: "Supabase chưa cấu hình.", code: "NO_SUPABASE" };
  }

  let { data: sessionData } = await client.auth.getSession();
  let accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    const refreshed = await client.auth.refreshSession();
    accessToken = refreshed.data?.session?.access_token;
  }

  if (!accessToken) {
    return { ok: false, error: "Chưa đăng nhập.", code: "NOT_AUTHENTICATED" };
  }

  let response;
  try {
    response = await fetch(resolveCreateUserApiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        ...payload,
        redirectTo: payload.redirectTo || getResetPasswordRedirectUrl(),
      }),
    });
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Không gọi được API tạo user.",
      code: "ADMIN_API_UNREACHABLE",
    };
  }

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    return {
      ok: false,
      error: body?.error || body?.message || "Tạo user thất bại.",
      code: body?.code || "ADMIN_CREATE_FAILED",
    };
  }

  if (body?.ok === false) {
    return {
      ok: false,
      error: body?.error || "Tạo user thất bại.",
      code: body?.code || "ADMIN_CREATE_FAILED",
    };
  }

  return {
    ok: true,
    user: body.user,
    temporaryPassword: body.temporaryPassword || null,
    mustChangePassword: Boolean(body.mustChangePassword),
    passwordSetupSent: Boolean(body.passwordSetupSent),
    passwordSetupMessage: body.passwordSetupMessage || null,
    provider: body.provider || "admin_api",
  };
}

export async function callIdentityAdminResetPassword(payload = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, error: "Supabase chưa cấu hình.", code: "NO_SUPABASE" };
  }

  let { data: sessionData } = await client.auth.getSession();
  let accessToken = sessionData?.session?.access_token;

  if (!accessToken) {
    const refreshed = await client.auth.refreshSession();
    accessToken = refreshed.data?.session?.access_token;
  }

  if (!accessToken) {
    return { ok: false, error: "Chưa đăng nhập.", code: "NOT_AUTHENTICATED" };
  }

  let response;
  try {
    response = await fetch(resolveResetPasswordApiUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      ok: false,
      error: error?.message || "Không gọi được API reset mật khẩu.",
      code: "ADMIN_API_UNREACHABLE",
    };
  }

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    return {
      ok: false,
      error: body?.error || body?.message || "Reset mật khẩu thất bại.",
      code: body?.code || "ADMIN_RESET_FAILED",
    };
  }

  if (body?.ok === false) {
    return {
      ok: false,
      error: body?.error || "Reset mật khẩu thất bại.",
      code: body?.code || "ADMIN_RESET_FAILED",
    };
  }

  return {
    ok: true,
    userId: body.userId,
    defaultPassword: body.defaultPassword,
    message: body.message,
    provider: "admin_api",
  };
}
