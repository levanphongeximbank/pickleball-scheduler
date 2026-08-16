/**
 * Authenticated JWT authorize for canonical Referee trusted backend.
 * Mirrors api/communication/authorizeCommunicationActor.js.
 * Never trusts browser-claimed userId / tenantId / role.
 */

import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
} from "../../src/features/api/config/apiKeyStoreConfig.js";
import { assertCommunicationProductionTargetAllowed } from "../communication/productionTargetGate.js";

export function getRefereeApiSupabaseUrl() {
  const viteUrl = String(globalThis.process?.env?.VITE_SUPABASE_URL || "").trim();
  return viteUrl || getSupabaseServerUrl();
}

function createServiceClient(url, serviceKey) {
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let cachedServiceClient = null;
let cachedServiceClientKey = null;

function getSharedServiceClient(url, serviceKey) {
  const key = `${url}::${serviceKey.slice(0, 8)}`;
  if (cachedServiceClient && cachedServiceClientKey === key) {
    return cachedServiceClient;
  }
  cachedServiceClient = createServiceClient(url, serviceKey);
  cachedServiceClientKey = key;
  return cachedServiceClient;
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
export async function authorizeRefereeActor(req) {
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

  const url = getRefereeApiSupabaseUrl();
  const serviceKey = getSupabaseServiceRoleKey();
  if (!url || !serviceKey) {
    return {
      ok: false,
      code: "NO_SUPABASE",
      error:
        "Supabase server chưa cấu hình (URL hoặc SUPABASE_SERVICE_ROLE_KEY).",
    };
  }

  const productionGate = assertCommunicationProductionTargetAllowed(url);
  if (!productionGate.ok) {
    return productionGate;
  }

  const serviceClient = getSharedServiceClient(url, serviceKey);
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
