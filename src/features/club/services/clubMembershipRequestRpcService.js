import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { API_ERROR_CODES } from "../../api/constants/apiErrors.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";

/**
 * Phase 31 legacy Membership Request RPC transport (V2-OFF / offline debt only).
 *
 * Phase 45A.4B — Under VITE_CLUB_STORAGE_V2=true, Production commands MUST go through
 * clubMembershipRequestService → clubStorageV2RpcService. This module is not part of
 * the V2 canonical command path (wrong live PostgREST signatures).
 *
 * Phase 2C G-FLAG — hard-dead on V2 ON: every export returns FEATURE_DISABLED
 * (no network call). Callers must not use this module when Club Storage V2 is authoritative.
 */

function assertPhase31Allowed(operation) {
  if (!isClubStorageV2Enabled()) {
    return { ok: true };
  }
  return {
    ok: false,
    code: API_ERROR_CODES.FEATURE_DISABLED,
    error: `Phase 31 RPC (${operation}) bị tắt khi Club Storage V2 bật. Dùng clubStorageV2RpcService.`,
    serverCode: "FEATURE_DISABLED",
  };
}

function isMissingRpcError(error) {
  const message = String(error?.message || error?.code || "").toLowerCase();
  return (
    message.includes("could not find the function") ||
    (message.includes("function") && message.includes("does not exist")) ||
    error?.code === "PGRST202"
  );
}

function parseRpcJson(data) {
  if (!data) {
    return { ok: false, code: "EMPTY_RESPONSE", error: "RPC trả về rỗng." };
  }
  if (typeof data === "object" && "ok" in data) {
    return data;
  }
  return { ok: true, ...data };
}

/**
 * Phase 31 — gán club_id + player_id sau khi duyệt (staging/production).
 * Fallback local khi RPC chưa deploy.
 */
export async function rpcReviewClubMembershipRequest({
  userId,
  clubId,
  playerId,
  action,
  reviewNote = "",
}) {
  const gate = assertPhase31Allowed("club_review_membership_request");
  if (!gate.ok) {
    return gate;
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("club_review_membership_request", {
    p_user_id: userId,
    p_club_id: clubId,
    p_player_id: playerId,
    p_action: action,
    p_review_note: reviewNote || "",
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { ok: false, code: "RPC_NOT_DEPLOYED", error: error.message };
    }
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }

  return parseRpcJson(data);
}

export async function rpcSubmitClubMembershipRequest({
  clubId,
  message = "",
  pickVnRating = null,
}) {
  const gate = assertPhase31Allowed("club_submit_membership_request");
  if (!gate.ok) {
    return gate;
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("club_submit_membership_request", {
    p_club_id: clubId,
    p_message: message || "",
    p_pick_vn_rating: pickVnRating,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { ok: false, code: "RPC_NOT_DEPLOYED", error: error.message };
    }
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }

  return parseRpcJson(data);
}

/**
 * Tự rời CLB — xóa club_id/player_id trên profile (staging/production).
 * Fallback local khi RPC chưa deploy.
 */
export async function rpcLeaveMyClub() {
  const gate = assertPhase31Allowed("club_leave_my_membership");
  if (!gate.ok) {
    return gate;
  }

  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("club_leave_my_membership");

  if (error) {
    if (isMissingRpcError(error)) {
      return { ok: false, code: "RPC_NOT_DEPLOYED", error: error.message };
    }
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }

  return parseRpcJson(data);
}
