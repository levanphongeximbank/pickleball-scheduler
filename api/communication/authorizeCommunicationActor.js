/**
 * COMMS-ACT-05 — authorize end-user JWT for Communication trusted backend.
 * Mirrors api/identity/authorizeUserManage.js (getUser + profile SoT).
 * Never trusts browser-claimed userId / tenantId / role.
 */

import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
} from "../../src/features/api/config/apiKeyStoreConfig.js";

export function getCommunicationApiSupabaseUrl() {
  const viteUrl = String(globalThis.process?.env?.VITE_SUPABASE_URL || "").trim();
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
    return "Token đăng nhập không hợp lệ cho project Supabase trên server.";
  }
  return "Phiên đăng nhập không hợp lệ.";
}

/**
 * @param {import('http').IncomingMessage} req
 */
export async function authorizeCommunicationActor(req) {
  const authHeader = String(
    req.headers?.authorization || req.headers?.Authorization || ""
  );
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) {
    return {
      ok: false,
      code: "NOT_AUTHENTICATED",
      error: "Thiếu access token.",
    };
  }

  const url = getCommunicationApiSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!url || !serviceKey) {
    return {
      ok: false,
      code: "NO_SUPABASE",
      error:
        "Supabase server chưa cấu hình (URL hoặc SUPABASE_SERVICE_ROLE_KEY).",
    };
  }

  // Production absolute block — refuse if URL points at Production ref.
  if (url.includes("expuvcohlcjzvrrauvud")) {
    return {
      ok: false,
      code: "PRODUCTION_REF_BLOCKED",
      error: "Production project ref is blocked for Communication ACT-05.",
    };
  }

  const serviceClient = createServiceClient(url, serviceKey);
  const { data: userData, error: userError } =
    await serviceClient.auth.getUser(token);
  if (userError || !userData?.user?.id) {
    return {
      ok: false,
      code: "NOT_AUTHENTICATED",
      error: mapAuthError(userError),
    };
  }

  const actorId = userData.user.id;
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("id, role, status, venue_id, club_id")
    .eq("id", actorId)
    .maybeSingle();

  if (profileError) {
    return {
      ok: false,
      code: "IDENTITY_LOOKUP_FAILED",
      error: "Không đọc được profile — fail-closed.",
    };
  }

  if (!profile || String(profile.status || "").toLowerCase() !== "active") {
    return {
      ok: false,
      code: "IDENTITY_INACTIVE",
      error: "Tài khoản chưa active hoặc thiếu profile.",
    };
  }

  return {
    ok: true,
    actorId,
    tenantId: profile.venue_id || null,
    profileClubId: profile.club_id || null,
    role: profile.role || null,
    serviceClient,
  };
}
