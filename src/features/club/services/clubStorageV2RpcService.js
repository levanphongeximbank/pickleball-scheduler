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
  return { ok: true, data };
}

function newRequestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function callRpc(fnName, args) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }

  const { data, error } = await client.rpc(fnName, args);
  if (error) {
    if (isMissingRpcError(error)) {
      return { ok: false, code: "RPC_NOT_DEPLOYED", error: error.message };
    }
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }
  return parseRpcJson(data);
}

/** Map Phase 42 canonical club JSON → UI club shape (compat with existing pages). */
export function mapV2ClubToUiClub(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    code: row.code || null,
    description: row.description || "",
    status: row.status || "active",
    venueId: row.tenant_id,
    tenantId: row.tenant_id,
    version: row.version,
    governance: {
      ownerUserId: row.owner_user_id || null,
      presidentUserId: row.president_user_id || null,
      registeredClusterId: row.registered_cluster_id || null,
    },
    ownerLabel: row.owner_label || null,
    presidentLabel: row.president_label || null,
    activeMemberCount: row.active_member_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDefault: false,
  };
}

export async function rpcV2ClubCreate({
  tenantId,
  name,
  code = null,
  description = "",
  registeredClusterId = null,
  requestId = newRequestId(),
} = {}) {
  const result = await callRpc("club_create", {
    p_request_id: requestId,
    p_tenant_id: tenantId,
    p_name: name,
    p_code: code,
    p_description: description || "",
    p_registered_cluster_id: registeredClusterId,
  });
  if (!result.ok) {
    return result;
  }
  return {
    ok: true,
    club: mapV2ClubToUiClub(result.data),
    version: result.version,
    requestId,
  };
}

export async function rpcV2ClubGet(clubId) {
  const result = await callRpc("club_get", { p_club_id: clubId });
  if (!result.ok) {
    return result;
  }
  return { ok: true, club: mapV2ClubToUiClub(result.data), version: result.version };
}

export async function rpcV2ClubListRegistry({ tenantId = null, includeInactive = false } = {}) {
  const result = await callRpc("club_list_registry", {
    p_tenant_id: tenantId,
    p_include_inactive: includeInactive,
  });
  if (!result.ok) {
    return result;
  }
  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    ok: true,
    clubs: rows.map(mapV2ClubToUiClub).filter(Boolean),
  };
}

export async function rpcV2ClubListDiscoverable({ search = "", limit = 100 } = {}) {
  const result = await callRpc("club_list_discoverable", {
    p_search: search || "",
    p_limit: limit,
  });
  if (!result.ok) {
    return result;
  }
  const rows = Array.isArray(result.data) ? result.data : [];
  return {
    ok: true,
    clubs: rows.map(mapV2ClubToUiClub).filter(Boolean),
  };
}

export async function rpcV2ClubListMembers(clubId) {
  const result = await callRpc("club_list_members", { p_club_id: clubId });
  if (!result.ok) {
    return result;
  }
  return {
    ok: true,
    members: Array.isArray(result.data) ? result.data : [],
    version: result.version,
  };
}

export async function rpcV2ClubSubmitMembershipRequest({
  clubId,
  message = "",
  requestId = newRequestId(),
} = {}) {
  return callRpc("club_submit_membership_request", {
    p_request_id: requestId,
    p_club_id: clubId,
    p_message: message || "",
  });
}

export async function rpcV2ClubListMyRequests() {
  const result = await callRpc("club_list_my_requests", {});
  if (!result.ok) {
    return result;
  }
  return { ok: true, requests: Array.isArray(result.data) ? result.data : [] };
}

export async function rpcV2ClubListPendingRequests(clubId) {
  const result = await callRpc("club_list_pending_requests", { p_club_id: clubId });
  if (!result.ok) {
    return result;
  }
  return { ok: true, requests: Array.isArray(result.data) ? result.data : [] };
}

export async function rpcV2ClubCancelMembershipRequest({
  membershipRequestId,
  expectedVersion,
  requestId = newRequestId(),
} = {}) {
  return callRpc("club_cancel_membership_request", {
    p_request_id: requestId,
    p_membership_request_id: membershipRequestId,
    p_expected_version: expectedVersion,
  });
}

export async function rpcV2ClubReviewMembershipRequest({
  membershipRequestId,
  decision,
  reviewNote = null,
  expectedVersion = null,
  requestId = newRequestId(),
} = {}) {
  return callRpc("club_review_membership_request", {
    p_request_id: requestId,
    p_membership_request_id: membershipRequestId,
    p_decision: decision,
    p_review_note: reviewNote,
    p_expected_version: expectedVersion,
  });
}

export async function rpcV2ClubAssignOwner({
  clubId,
  memberUserId,
  expectedClubVersion,
  requestId = newRequestId(),
} = {}) {
  const result = await callRpc("club_assign_owner", {
    p_request_id: requestId,
    p_club_id: clubId,
    p_member_user_id: memberUserId,
    p_expected_club_version: expectedClubVersion,
  });
  if (!result.ok) {
    return result;
  }
  return { ok: true, club: mapV2ClubToUiClub(result.data), version: result.version };
}

export async function rpcV2ClubClearOwner({
  clubId,
  expectedClubVersion,
  requestId = newRequestId(),
} = {}) {
  const result = await callRpc("club_clear_owner", {
    p_request_id: requestId,
    p_club_id: clubId,
    p_expected_club_version: expectedClubVersion,
  });
  if (!result.ok) {
    return result;
  }
  return { ok: true, club: mapV2ClubToUiClub(result.data), version: result.version };
}

export async function rpcV2ClubTransferPresident({
  clubId,
  nextUserId,
  expectedClubVersion,
  requestId = newRequestId(),
} = {}) {
  const result = await callRpc("club_transfer_president", {
    p_request_id: requestId,
    p_club_id: clubId,
    p_next_user_id: nextUserId,
    p_expected_club_version: expectedClubVersion,
  });
  if (!result.ok) {
    return result;
  }
  return { ok: true, club: mapV2ClubToUiClub(result.data), version: result.version };
}

export async function rpcV2ClubLeaveMembership({
  clubId,
  requestId = newRequestId(),
} = {}) {
  return callRpc("club_leave_membership", {
    p_request_id: requestId,
    p_club_id: clubId,
  });
}

export { newRequestId };
