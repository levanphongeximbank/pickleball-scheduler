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

/** Normalize VP user id list from phase42_club_canonical payload. */
function mapVicePresidentUserIds(row = {}) {
  const fromArray = Array.isArray(row.vice_president_user_ids)
    ? row.vice_president_user_ids
    : [];
  const ids = fromArray
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  if (ids.length) {
    return [...new Set(ids)].slice(0, 2);
  }
  const single = String(row.vice_president_user_id || "").trim();
  return single ? [single] : [];
}

function mapVicePresidentLabels(row = {}, vicePresidentUserIds = []) {
  const fromArray = Array.isArray(row.vice_president_labels)
    ? row.vice_president_labels.map((label) => String(label || "").trim())
    : [];
  if (fromArray.length) {
    return fromArray.slice(0, Math.max(vicePresidentUserIds.length, 2));
  }
  const single = String(row.vice_president_label || "").trim();
  return single ? [single] : [];
}

/** Map Phase 42 canonical club JSON → UI club shape (compat with existing pages). */
export function mapV2ClubToUiClub(row) {
  if (!row) {
    return null;
  }
  const vicePresidentUserIds = mapVicePresidentUserIds(row);
  const vicePresidentLabels = mapVicePresidentLabels(row, vicePresidentUserIds);
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
      vicePresidentUserId: vicePresidentUserIds[0] || null,
      vicePresidentUserIds,
      registeredClusterId: row.registered_cluster_id || null,
    },
    ownerLabel: row.owner_label || null,
    presidentLabel: row.president_label || null,
    vicePresidentLabel: vicePresidentLabels[0] || null,
    vicePresidentLabels,
    activeMemberCount: row.active_member_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDefault: false,
    source: "v2-rpc",
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

/**
 * Phase 45A.3D — canonical Club UPDATE transport.
 *
 * NULL-vs-empty semantics (must match public.club_update):
 * - omitted / undefined argument → field NOT sent → SQL DEFAULT null → leave unchanged
 * - explicit null → leave unchanged
 * - empty string for code / registeredClusterId → clear to NULL
 * - empty string for name → rejected by server (NAME_REQUIRED)
 *
 * Never writes blob / legacy club_governance.
 */
export async function rpcV2ClubUpdate({
  clubId,
  expectedClubVersion,
  name,
  code,
  description,
  status,
  registeredClusterId,
  requestId = newRequestId(),
} = {}) {
  const id = String(clubId || "").trim();
  if (!id) {
    return { ok: false, code: "CLUB_REQUIRED", error: "Thiếu id CLB." };
  }
  if (expectedClubVersion == null || !Number.isFinite(Number(expectedClubVersion))) {
    return {
      ok: false,
      code: "VERSION_CONFLICT",
      error: "Thiếu phiên bản CLB (expectedClubVersion).",
    };
  }

  const args = {
    p_request_id: requestId,
    p_club_id: id,
    p_expected_club_version: Number(expectedClubVersion),
  };

  // Only include changed fields so omitted = unchanged (PostgREST DEFAULT null).
  if (name !== undefined) args.p_name = name;
  if (code !== undefined) args.p_code = code;
  if (description !== undefined) args.p_description = description;
  if (status !== undefined) args.p_status = status;
  if (registeredClusterId !== undefined) args.p_registered_cluster_id = registeredClusterId;

  const result = await callRpc("club_update", args);
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

/**
 * Phase 1B — assign one vice president (max 2 active on server).
 * Signature: club_assign_vice_president(uuid, text, uuid, integer)
 */
export async function rpcV2ClubAssignVicePresident({
  clubId,
  memberUserId,
  expectedClubVersion,
  requestId = newRequestId(),
} = {}) {
  const result = await callRpc("club_assign_vice_president", {
    p_request_id: requestId,
    p_club_id: clubId,
    p_member_user_id: memberUserId,
    p_expected_club_version: expectedClubVersion,
  });
  if (!result.ok) {
    return result;
  }
  return {
    ok: true,
    club: mapV2ClubToUiClub(result.data),
    version: result.version,
    skipped: Boolean(result.skipped),
  };
}

/**
 * Phase 1B — clear one VP (memberUserId set) or all VPs (memberUserId null).
 * Signature: club_clear_vice_president(uuid, text, integer, uuid)
 */
export async function rpcV2ClubClearVicePresident({
  clubId,
  expectedClubVersion,
  memberUserId = null,
  requestId = newRequestId(),
} = {}) {
  const result = await callRpc("club_clear_vice_president", {
    p_request_id: requestId,
    p_club_id: clubId,
    p_expected_club_version: expectedClubVersion,
    p_member_user_id: memberUserId,
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

/**
 * Phase 45A.4C.4 — canonical admin add / reactivate-left member.
 * Signature: club_add_member(uuid, text, uuid, text, integer)
 */
export async function rpcV2ClubAddMember({
  clubId,
  targetUserId,
  membershipType = "regular",
  expectedVersion = null,
  requestId = newRequestId(),
} = {}) {
  const result = await callRpc("club_add_member", {
    p_request_id: requestId,
    p_club_id: clubId,
    p_target_user_id: targetUserId,
    p_membership_type: membershipType ?? "regular",
    p_expected_version: expectedVersion ?? null,
  });
  if (!result.ok) {
    return result;
  }
  return {
    ok: true,
    member: result.data || null,
    version: result.version ?? null,
  };
}

/**
 * Phase 45A.4C.4 — canonical admin soft-remove member (status='removed').
 * Signature: club_remove_member(uuid, text, uuid, integer)
 */
export async function rpcV2ClubRemoveMember({
  clubId,
  targetUserId,
  expectedVersion = null,
  requestId = newRequestId(),
} = {}) {
  const result = await callRpc("club_remove_member", {
    p_request_id: requestId,
    p_club_id: clubId,
    p_target_user_id: targetUserId,
    p_expected_version: expectedVersion ?? null,
  });
  if (!result.ok) {
    return result;
  }
  return {
    ok: true,
    member: result.data || null,
    version: result.version ?? null,
  };
}

/**
 * Phase 1B / 45A.4D — restore admin-removed member (status removed → active).
 * Signature: club_restore_member(uuid, text, uuid, integer)
 */
export async function rpcV2ClubRestoreMember({
  clubId,
  targetUserId,
  expectedVersion = null,
  requestId = newRequestId(),
} = {}) {
  const result = await callRpc("club_restore_member", {
    p_request_id: requestId,
    p_club_id: clubId,
    p_target_user_id: targetUserId,
    p_expected_version: expectedVersion ?? null,
  });
  if (!result.ok) {
    return result;
  }
  return {
    ok: true,
    member: result.data || null,
    version: result.version ?? null,
  };
}

export async function rpcV2GetMyActiveMembership() {
  const result = await callRpc("club_get_my_active_membership", {});
  if (!result.ok) {
    return result;
  }
  const data = result.data || {};
  return {
    ok: true,
    clubId: data.club_id || null,
    memberId: data.member_id || null,
    hasActiveMembership: Boolean(data.has_active_membership && data.club_id),
    club: data.club ? mapV2ClubToUiClub(data.club) : null,
  };
}

/**
 * Phase 44C.1A — canonical governance-role predicate for the CURRENT auth user.
 *
 * Reuses the production RPC `public.phase42_has_gov_role(p_club_id, p_roles[])`
 * (canonical SSOT `club_governance_assignments`, auth.uid()-scoped, SECURITY
 * DEFINER, EXECUTE granted to authenticated). Returns a bare SQL boolean, so it
 * must NOT go through parseRpcJson (which treats `false` as an empty response).
 */
export async function rpcV2HasClubGovernanceRole(clubId, roles = ["president", "vice_president"]) {
  const client = getSupabaseAuthClient();
  if (!client) {
    return { ok: false, code: "NO_SUPABASE", error: "Supabase chưa sẵn sàng." };
  }
  const id = String(clubId || "").trim();
  if (!id) {
    return { ok: true, allowed: false };
  }
  const { data, error } = await client.rpc("phase42_has_gov_role", {
    p_club_id: id,
    p_roles: roles,
  });
  if (error) {
    if (isMissingRpcError(error)) {
      return { ok: false, code: "RPC_NOT_DEPLOYED", error: error.message };
    }
    return { ok: false, code: "RPC_FAILED", error: error.message };
  }
  return { ok: true, allowed: Boolean(data) };
}

/** Phase 42N — resolve profiles + athletes + active club_members by auth user. */
export async function rpcPlatformResolveAthleteProfile(authUserId) {
  const result = await callRpc("platform_resolve_athlete_profile", {
    p_auth_user_id: authUserId,
  });
  if (!result.ok) {
    return result;
  }
  return {
    ok: true,
    data: result.data || null,
  };
}

/**
 * Phase 42N.1 — resolve by athlete id (server maps athlete → user_id, then
 * applies the same authorization as platform_resolve_athlete_profile).
 * Returns explicit codes: NOT_FOUND, ATHLETE_NOT_LINKED, FORBIDDEN, ...
 */
export async function rpcPlatformResolveAthleteById(athleteId) {
  const result = await callRpc("platform_resolve_athlete_by_id", {
    p_athlete_id: athleteId,
  });
  if (!result.ok) {
    return result;
  }
  return {
    ok: true,
    data: result.data || null,
  };
}

export { newRequestId };
