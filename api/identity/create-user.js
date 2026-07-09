import { createClient } from "@supabase/supabase-js";

import { adminCreateManagedUser } from "../../src/features/identity/services/identityAdminCreateService.js";
import {
  ApiKeyStoreConfigError,
  getSupabaseAnonKey,
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
} from "../../src/features/api/config/apiKeyStoreConfig.js";

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
}

async function authorizeUserManage(req) {
  const authHeader = String(req.headers?.authorization || req.headers?.Authorization || "");
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return { ok: false, code: "NOT_AUTHENTICATED", error: "Thiếu access token." };
  }

  const url = getSupabaseServerUrl();
  const anonKey = getSupabaseAnonKey();
  if (!url || !anonKey) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa cấu hình trên server." };
  }

  const userClient = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    return {
      ok: false,
      code: "NOT_AUTHENTICATED",
      error: userError?.message?.includes("expired")
        ? "Phiên đăng nhập đã hết hạn. Đăng xuất và đăng nhập lại."
        : "Phiên đăng nhập không hợp lệ. Đăng xuất và đăng nhập lại.",
    };
  }

  const { data: canManage, error: permError } = await userClient.rpc("user_has_permission", {
    p_permission: "user.manage",
  });

  if (permError) {
    const message = String(permError.message || "").toLowerCase();
    if (message.includes("does not exist") || permError.code === "PGRST202") {
      return {
        ok: false,
        code: "RPC_NOT_DEPLOYED",
        error: "RPC user_has_permission chưa deploy.",
      };
    }
    return { ok: false, code: "PERMISSION_CHECK_FAILED", error: permError.message };
  }

  if (!canManage) {
    return { ok: false, code: "FORBIDDEN", error: "Không có quyền user.manage." };
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
