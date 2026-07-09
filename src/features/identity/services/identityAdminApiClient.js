import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { getResetPasswordRedirectUrl } from "../../../config/authConfig.js";

function resolveCreateUserApiUrl() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/api/identity/create-user`;
  }
  return "/api/identity/create-user";
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
    passwordSetupSent: Boolean(body.passwordSetupSent),
    passwordSetupMessage: body.passwordSetupMessage || null,
    provider: body.provider || "admin_api",
  };
}
