/**
 * Internal referee scoring runtime ensure (IT-E2E-BROWSER-016).
 * Canonical assignment token → security-definer RPC → tournament_match_live.
 * Does not synthesize a second token. Does not write tournament_match_live from the client.
 */
import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";

export const CANONICAL_ENSURE_INTERNAL_REFEREE_MATCH_LIVE =
  "canonical_ensure_internal_referee_match_live";

export function isInternalRefereeEnsureToken(token) {
  return String(token || "").trim().length >= 16;
}

function defaultEnsureRpc(name, args) {
  const supabase = getSupabaseAuthClient();
  if (!supabase?.rpc) return null;
  return supabase.rpc(name, args);
}

export async function ensureInternalRefereeMatchLive(token, { rpc } = {}) {
  const trimmed = String(token || "").trim();
  if (!isInternalRefereeEnsureToken(trimmed)) {
    return { ok: false, code: "INVALID_TOKEN" };
  }

  const callRpc = typeof rpc === "function" ? rpc : defaultEnsureRpc;
  let result;
  try {
    result = await callRpc(CANONICAL_ENSURE_INTERNAL_REFEREE_MATCH_LIVE, {
      p_token: trimmed,
    });
  } catch (error) {
    return {
      ok: false,
      code: classifyEnsureError(error),
      error: String(error?.message || error || ""),
    };
  }

  if (result == null) {
    return { ok: false, code: "NO_CLIENT" };
  }

  const data = result?.data !== undefined ? result.data : result;
  const error = result?.error;
  if (error) {
    return {
      ok: false,
      code: classifyEnsureError(error),
      error: String(error.message || error),
    };
  }
  if (!data) {
    return { ok: false, code: "NOT_FOUND" };
  }

  return {
    ok: true,
    matchId: data.match_id || data.matchId || null,
    refereeToken: data.referee_token || data.refereeToken || trimmed,
    row: data,
  };
}

function classifyEnsureError(error) {
  const message = String(error?.message || error || "");
  if (/REFEREE_TOKEN_INVALID/i.test(message)) return "INVALID_TOKEN";
  if (/REFEREE_TOKEN_NOT_FOUND/i.test(message)) return "NOT_FOUND";
  if (/TOURNAMENT_FORBIDDEN/i.test(message) || error?.code === "42501") {
    return "FORBIDDEN";
  }
  if (/NOT_AUTHENTICATED/i.test(message)) return "NOT_AUTHENTICATED";
  return "ENSURE_FAILED";
}
