import { adminCreateManagedUser } from "../../src/features/identity/services/identityAdminCreateService.js";
import {
  ApiKeyStoreConfigError,
  getSupabaseServiceRoleKey,
} from "../../src/features/api/config/apiKeyStoreConfig.js";
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
  const providedPassword = String(body.password || "").trim();
  const sendPasswordSetupEmail =
    body.sendPasswordSetupEmail === true && !providedPassword;

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
