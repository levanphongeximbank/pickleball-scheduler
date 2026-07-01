import { getSupabaseAuthClient } from "../../../auth/supabaseClient.js";
import { mapProfileRowToUser } from "../../../auth/profileService.js";
import { denormalizeRoleForDb, normalizeRole } from "../constants/roles.js";

function parseRpcJson(data) {
  if (!data) {
    return { ok: false, code: "EMPTY_RESPONSE", error: "RPC trả về rỗng." };
  }
  if (typeof data === "object" && "ok" in data) {
    return data;
  }
  return { ok: true, ...data };
}

function isMissingRpcError(error) {
  const message = String(error?.message || error?.code || "").toLowerCase();
  return (
    message.includes("could not find the function") ||
    message.includes("function") && message.includes("does not exist") ||
    error?.code === "PGRST202"
  );
}

export async function rpcListUsers({ search = "", role = "", status = "", limit = 100 } = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("identity_list_users", {
    p_search: search || "",
    p_role: role ? denormalizeRoleForDb(normalizeRole(role)) : "",
    p_status: status || "",
    p_limit: limit,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { ok: false, code: "RPC_NOT_DEPLOYED", error: error.message };
    }
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }

  const payload = parseRpcJson(data);
  if (!payload.ok) {
    return {
      ok: false,
      code: payload.code || "FORBIDDEN",
      error: payload.error || "Không có quyền.",
    };
  }

  const users = (payload.users || []).map((row) => mapProfileRowToUser(row));
  return { ok: true, users, provider: "rpc" };
}

export async function rpcAdminUpdateUser(userId, patch = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const rpcPatch = {};
  if (patch.displayName !== undefined) {
    rpcPatch.display_name = patch.displayName;
  }
  if (patch.phone !== undefined) {
    rpcPatch.phone = patch.phone;
  }
  if (patch.avatarUrl !== undefined) {
    rpcPatch.avatar_url = patch.avatarUrl;
  }
  if (patch.role !== undefined) {
    rpcPatch.role = denormalizeRoleForDb(normalizeRole(patch.role));
  }
  if (patch.status !== undefined) {
    rpcPatch.status = patch.status;
  }
  if (patch.clubId !== undefined) {
    rpcPatch.club_id = patch.clubId;
  }

  const { data, error } = await client.rpc("identity_admin_update_user", {
    p_user_id: userId,
    p_patch: rpcPatch,
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { ok: false, code: "RPC_NOT_DEPLOYED", error: error.message };
    }
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }

  const payload = parseRpcJson(data);
  if (!payload.ok) {
    return {
      ok: false,
      code: payload.code || "UPDATE_FAILED",
      error: payload.error || "Cập nhật thất bại.",
    };
  }

  return {
    ok: true,
    user: mapProfileRowToUser(payload.user),
    provider: "rpc",
  };
}

export async function rpcListAuditLogs({ limit = 50, action = "", venueId = null } = {}) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc("identity_list_audit_logs", {
    p_limit: limit,
    p_action: action || "",
    p_venue_id: venueId || "",
  });

  if (error) {
    if (isMissingRpcError(error)) {
      return { ok: false, code: "RPC_NOT_DEPLOYED", error: error.message };
    }
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }

  const payload = parseRpcJson(data);
  if (!payload.ok) {
    return {
      ok: false,
      code: payload.code || "FORBIDDEN",
      error: payload.error || "Không có quyền.",
    };
  }

  return { ok: true, logs: payload.logs || [], provider: "rpc" };
}
