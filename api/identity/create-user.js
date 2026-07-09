import { createClient } from "@supabase/supabase-js";

import { adminCreateManagedUser } from "../../src/features/identity/services/identityAdminCreateService.js";
import {
  ApiKeyStoreConfigError,
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
} from "../../src/features/api/config/apiKeyStoreConfig.js";

/** Match browser bundle JWT issuer — SUPABASE_URL override can point at wrong project. */
function getIdentityApiSupabaseUrl() {
  const viteUrl = String(process.env.VITE_SUPABASE_URL || "").trim();
  return viteUrl || getSupabaseServerUrl();
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

function createServiceClient(url, serviceKey) {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function mapAuthError(userError) {
  const message = String(userError?.message || "").toLowerCase();
  if (message.includes("expired")) {
    return "Phiên đăng nhập đã hết hạn. Đăng xuất và đăng nhập lại.";
  }
  if (message.includes("invalid") || message.includes("jwt")) {
    return "Token đăng nhập không khớp project Supabase trên server. Kiểm tra VITE_SUPABASE_URL Production trên Vercel.";
  }
  return "Phiên đăng nhập không hợp lệ. Đăng xuất và đăng nhập lại.";
}

async function resolveUserManagePermission(adminClient, userId) {
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role, status")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      code: "PERMISSION_CHECK_FAILED",
      error: profileError.message || "Không đọc được profile.",
    };
  }

  if (!profile || profile.status !== "active") {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Tài khoản chưa active hoặc thiếu profile.",
    };
  }

  const role = String(profile.role || "").trim();
  if (role === "SUPER_ADMIN") {
    return { ok: true };
  }

  const { data: permRow, error: permError } = await adminClient
    .from("role_permissions")
    .select("role_id")
    .eq("role_id", role)
    .eq("permission_id", "user.manage")
    .maybeSingle();

  if (permError) {
    return {
      ok: false,
      code: "PERMISSION_CHECK_FAILED",
      error: permError.message || "Không kiểm tra được quyền.",
    };
  }

  if (!permRow) {
    return { ok: false, code: "FORBIDDEN", error: "Không có quyền user.manage." };
  }

  return { ok: true };
}

async function authorizeUserManage(req) {
  const authHeader = String(req.headers?.authorization || req.headers?.Authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return { ok: false, code: "NOT_AUTHENTICATED", error: "Thiếu access token." };
  }

  const url = getIdentityApiSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!url || !serviceKey) {
    return {
      ok: false,
      code: "NO_SUPABASE",
      error: "Supabase server chưa cấu hình (URL hoặc SUPABASE_SERVICE_ROLE_KEY).",
    };
  }

  const adminClient = createServiceClient(url, serviceKey);
  const { data: userData, error: userError } = await adminClient.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    return {
      ok: false,
      code: "NOT_AUTHENTICATED",
      error: mapAuthError(userError),
    };
  }

  const permission = await resolveUserManagePermission(adminClient, userData.user.id);
  if (!permission.ok) {
    return permission;
  }

  return { ok: true, actorId: userData.user.id };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, code: "METHOD_NOT_ALLOWED", error: "Chỉ hỗ trợ POST." });
  }

  const auth = await authorizeUserManage(req);
  if (!auth.ok) {
    const status =
      auth.code === "FORBIDDEN"
        ? 403
        : auth.code === "NOT_AUTHENTICATED"
          ? 401
          : 400;
    return res.status(status).json(auth);
  }

  if (!getSupabaseServiceRoleKey()) {
    return res.status(503).json({
      ok: false,
      code: "SERVICE_ROLE_MISSING",
      error: "Thiếu SUPABASE_SERVICE_ROLE_KEY trên server.",
    });
  }

  const body = parseBody(req);
  const providedPassword = String(body.password || "").trim();
  const sendPasswordSetupEmail =
    body.sendPasswordSetupEmail === undefined
      ? !providedPassword
      : body.sendPasswordSetupEmail !== false;

  try {
    const result = await adminCreateManagedUser({
      email: body.email,
      password: body.password,
      displayName: body.displayName,
      role: body.role,
      venueId: body.venueId,
      clubId: body.clubId,
      phone: body.phone,
      redirectTo: body.redirectTo,
      sendPasswordSetupEmail,
    });

    if (!result.ok) {
      const status = result.code === "DUPLICATE_EMAIL" ? 409 : 400;
      return res.status(status).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    if (error instanceof ApiKeyStoreConfigError) {
      return res.status(503).json({
        ok: false,
        code: "SERVICE_ROLE_MISSING",
        error: error.message,
      });
    }

    return res.status(500).json({
      ok: false,
      code: "INTERNAL_ERROR",
      error: error?.message || "Tạo user thất bại.",
    });
  }
}
