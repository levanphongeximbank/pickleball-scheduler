/**
 * Authenticated JWT authorize for canonical Referee trusted backend.
 * Mirrors api/communication/authorizeCommunicationActor.js.
 * Never trusts browser-claimed userId / tenantId / role.
 *
 * Warm-lambda profile cache: JWT is verified every request via auth.getUser;
 * active profile (role/tenant/status) may be reused briefly so AUTH_NETWORK_COUNT
 * collapses to 1 on the hot scoring path without trusting the browser actorId.
 */

import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseServerUrl,
  getSupabaseServiceRoleKey,
} from "../../src/features/api/config/apiKeyStoreConfig.js";
import {
  getActiveSupabaseCounters,
  instrumentSharedSupabaseClient,
  noteSupabaseLedgerEntry,
} from "../../src/features/referee-production-ui/application/instrumentSupabaseRequestCounters.js";
import { assertCommunicationProductionTargetAllowed } from "../communication/productionTargetGate.js";

/** @type {Map<string, { profile: object, cachedAt: number }>} */
const profileCacheByActorId = new Map();
const PROFILE_CACHE_TTL_MS = 60_000;

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
  cachedServiceClient = instrumentSharedSupabaseClient(
    createServiceClient(url, serviceKey)
  );
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

function readCachedProfile(actorId) {
  const hit = profileCacheByActorId.get(actorId);
  if (!hit) return null;
  if (Date.now() - hit.cachedAt > PROFILE_CACHE_TTL_MS) {
    profileCacheByActorId.delete(actorId);
    return null;
  }
  return hit.profile;
}

function writeCachedProfile(actorId, profile) {
  profileCacheByActorId.set(actorId, {
    profile: Object.freeze({
      id: profile.id,
      role: profile.role || null,
      status: profile.status || null,
      venue_id: profile.venue_id || null,
      club_id: profile.club_id || null,
    }),
    cachedAt: Date.now(),
  });
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
  const counters = getActiveSupabaseCounters();
  let profile = readCachedProfile(actorId);
  if (profile) {
    noteSupabaseLedgerEntry(counters, {
      operation: "AUTH_PROFILE_CACHE_HIT",
      tableOrRpc: "profiles",
      kind: "auth",
      elapsedMs: 0,
      required: true,
      reused: true,
      duplicateOf: "AUTH_PROFILE_READ",
      canReuseRequestLocal: true,
    });
  } else {
    const tProfile0 = Date.now();
    const { data, error: profileError } = await serviceClient
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
    profile = data;
    if (profile && String(profile.status || "").toLowerCase() === "active") {
      writeCachedProfile(actorId, profile);
    }
    // Auto-instrument already ledgered the from("profiles") call; enrich last row.
    const ledger = counters?.LEDGER;
    if (ledger?.length) {
      const last = ledger[ledger.length - 1];
      if (last?.operation === "AUTH_PROFILE_READ" || last?.tableOrRpc === "profiles") {
        ledger[ledger.length - 1] = Object.freeze({
          ...last,
          operation: "AUTH_PROFILE_READ",
          elapsedMs: Date.now() - tProfile0,
          required: true,
          canReuseRequestLocal: true,
          canCombineWith: "AUTH_GET_USER (same request-local actor context)",
        });
      }
    }
  }

  if (!profile || String(profile.status || "").toLowerCase() !== "active") {
    profileCacheByActorId.delete(actorId);
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
