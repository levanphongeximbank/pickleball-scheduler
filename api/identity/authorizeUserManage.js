import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
} from "../../src/features/api/config/apiKeyStoreConfig.js";
import { isGlobalRole, normalizeRole } from "../../src/features/identity/constants/roles.js";

/** Match browser bundle JWT issuer — SUPABASE_URL override can point at wrong project. */
export function getIdentityApiSupabaseUrl() {
  const viteUrl = String(process.env.VITE_SUPABASE_URL || "").trim();
  return viteUrl || getSupabaseServerUrl();
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

function buildActor(userId, profile) {
  const role = String(profile?.role || "").trim();
  return {
    actorId: userId,
    role,
    tenantId: profile?.tenant_id || profile?.tenantId || null,
    venueId: profile?.venue_id || profile?.venueId || null,
    isSuperAdmin: isGlobalRole(normalizeRole(role)),
  };
}

async function resolveUserManagePermission(adminClient, userId) {
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("role, status, tenant_id, venue_id")
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

  const actor = buildActor(userId, profile);
  if (actor.isSuperAdmin || String(profile.role || "").trim() === "SUPER_ADMIN") {
    return { ok: true, actor };
  }

  const { data: permRow, error: permError } = await adminClient
    .from("role_permissions")
    .select("role_id")
    .eq("role_id", actor.role)
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

  return { ok: true, actor };
}

export async function authorizeUserManage(req) {
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

  return {
    ok: true,
    actorId: userData.user.id,
    actor: permission.actor,
    adminClient,
  };
}
