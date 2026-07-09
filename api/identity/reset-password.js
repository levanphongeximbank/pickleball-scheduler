import { ApiKeyStoreConfigError, getSupabaseServiceRoleKey } from "../../src/features/api/config/apiKeyStoreConfig.js";
import { adminResetManagedUserPassword } from "../../src/features/identity/services/identityAdminResetPasswordService.js";
import { authorizeUserManage } from "./authorizeUserManage.js";

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body);
  } catch {
    return {};
  }
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

  try {
    const result = await adminResetManagedUserPassword({
      userId: body.userId,
      password: body.password,
    });

    if (!result.ok) {
      const status = result.code === "USER_NOT_FOUND" ? 404 : 400;
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
      error: error?.message || "Reset mật khẩu thất bại.",
    });
  }
}
