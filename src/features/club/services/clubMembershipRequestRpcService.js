import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";

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
