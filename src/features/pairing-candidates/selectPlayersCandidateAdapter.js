/**
 * PHASE 45B.5A — SelectPlayers adapter onto pairingCandidateService.
 *
 * Live reads: club_list_members + profiles (+ athletes) via injectables.
 * No blob/localStorage roster authority. No silent empty on cloud error.
 */

import { getSupabaseAuthClient, hasSupabaseConfig } from "../../auth/supabaseClient.js";
import { rpcV2ClubListMembers } from "../club/services/clubStorageV2RpcService.js";
import { createPairingCandidateService } from "./pairingCandidateService.js";
import { PAIRING_CANDIDATE_STATUS } from "./pairingCandidateContract.js";
import { PAIRING_CANDIDATE_REASON_CODES } from "./pairingCandidateReasonCodes.js";

function normalizeId(value) {
  return String(value || "").trim();
}

/**
 * Strict profiles fetch — returns ok:false on failure (no silent []).
 * @param {string[]} userIds
 * @param {object} [deps]
 */
export async function fetchProfilesForPairingCandidates(userIds, deps = {}) {
  const ids = Array.from(
    new Set((userIds || []).map((v) => normalizeId(v)).filter(Boolean))
  );
  if (ids.length === 0) {
    return { ok: true, profiles: [] };
  }
  if (typeof deps.fetchProfiles === "function") {
    return deps.fetchProfiles(ids);
  }
  if (!hasSupabaseConfig()) {
    return {
      ok: false,
      code: "NO_SUPABASE",
      error: "Supabase chưa sẵn sàng để tải hồ sơ pairing.",
    };
  }
  const client = getSupabaseAuthClient();
  if (!client) {
    return {
      ok: false,
      code: "NO_SUPABASE",
      error: "Supabase client chưa sẵn sàng.",
    };
  }
  try {
    const { data, error } = await client
      .from("profiles")
      .select("id, player_id, display_name, gender")
      .in("id", ids);
    if (error) {
      return { ok: false, code: "PROFILES_READ_FAILED", error: error.message };
    }
    return { ok: true, profiles: Array.isArray(data) ? data : [] };
  } catch (err) {
    return {
      ok: false,
      code: "PROFILES_READ_FAILED",
      error: String(err?.message || err || "Profiles read failed"),
    };
  }
}

/**
 * Strict athletes fetch by user_id — returns ok:false on failure.
 * @param {string[]} userIds
 * @param {object} [deps]
 */
export async function fetchAthletesForPairingCandidates(userIds, deps = {}) {
  const ids = Array.from(
    new Set((userIds || []).map((v) => normalizeId(v)).filter(Boolean))
  );
  if (ids.length === 0) {
    return { ok: true, athletes: [] };
  }
  if (typeof deps.fetchAthletes === "function") {
    return deps.fetchAthletes(ids);
  }
  if (!hasSupabaseConfig()) {
    return {
      ok: false,
      code: "NO_SUPABASE",
      error: "Supabase chưa sẵn sàng để tải athletes.",
    };
  }
  const client = getSupabaseAuthClient();
  if (!client) {
    return {
      ok: false,
      code: "NO_SUPABASE",
      error: "Supabase client chưa sẵn sàng.",
    };
  }
  try {
    const { data, error } = await client
      .from("athletes")
      .select("id, user_id, display_name, status, tenant_id")
      .in("user_id", ids);
    if (error) {
      return { ok: false, code: "ATHLETES_READ_FAILED", error: error.message };
    }
    return { ok: true, athletes: Array.isArray(data) ? data : [] };
  } catch (err) {
    return {
      ok: false,
      code: "ATHLETES_READ_FAILED",
      error: String(err?.message || err || "Athletes read failed"),
    };
  }
}

/**
 * Build gateway scope rows from cloud membership + athlete + profile reads.
 * @param {string} clubId
 * @param {object} [deps]
 */
export async function listSelectPlayersScopeRows(clubId, deps = {}) {
  const id = normalizeId(clubId);
  if (!id) {
    return {
      ok: false,
      error: {
        code: PAIRING_CANDIDATE_REASON_CODES.WRONG_SCOPE,
        message: "clubId is required.",
      },
      rows: [],
      sourceBreakdown: { athleteRows: 0, membershipRows: 0, activeMembershipRows: 0 },
    };
  }

  const listMembers = deps.listMembers || rpcV2ClubListMembers;
  const membersResult = await listMembers(id);
  if (!membersResult?.ok) {
    return {
      ok: false,
      error: {
        code: membersResult?.code || "MEMBERSHIP_RPC_FAILED",
        message: membersResult?.error || "Không tải được danh sách thành viên CLB.",
      },
      rows: [],
      sourceBreakdown: { athleteRows: 0, membershipRows: 0, activeMembershipRows: 0 },
    };
  }

  const members = Array.isArray(membersResult.members) ? membersResult.members : [];
  const userIds = members.map((m) => normalizeId(m.user_id || m.userId)).filter(Boolean);

  const profilesResult = await fetchProfilesForPairingCandidates(userIds, deps);
  if (!profilesResult.ok) {
    return {
      ok: false,
      error: {
        code: profilesResult.code || "PROFILES_READ_FAILED",
        message: profilesResult.error || "Không tải được profiles.",
      },
      rows: [],
      sourceBreakdown: {
        athleteRows: 0,
        membershipRows: members.length,
        activeMembershipRows: members.filter(
          (m) => String(m.status || "").toLowerCase() === "active"
        ).length,
      },
    };
  }

  const athletesResult = await fetchAthletesForPairingCandidates(userIds, deps);
  if (!athletesResult.ok) {
    return {
      ok: false,
      error: {
        code: athletesResult.code || "ATHLETES_READ_FAILED",
        message: athletesResult.error || "Không tải được athletes.",
      },
      rows: [],
      sourceBreakdown: {
        athleteRows: 0,
        membershipRows: members.length,
        activeMembershipRows: members.filter(
          (m) => String(m.status || "").toLowerCase() === "active"
        ).length,
      },
    };
  }

  const profilesByUser = new Map(
    (profilesResult.profiles || []).map((p) => [normalizeId(p.id), p])
  );
  const athletesByUser = new Map(
    (athletesResult.athletes || []).map((a) => [normalizeId(a.user_id || a.userId), a])
  );

  const rows = members.map((member) => {
    const userId = normalizeId(member.user_id || member.userId);
    const profile = profilesByUser.get(userId) || null;
    const athlete = athletesByUser.get(userId) || null;
    const athleteId =
      normalizeId(athlete?.id || member.athlete_id || member.athleteId) || null;

    return {
      athleteId,
      userId: userId || null,
      displayName:
        athlete?.display_name ||
        member.display_name ||
        profile?.display_name ||
        userId ||
        athleteId ||
        "",
      gender: profile?.gender ?? member.gender ?? null,
      rating: member.rating ?? athlete?.rating ?? null,
      athleteStatus: athlete?.status || (athleteId ? "active" : "active"),
      membershipId: member.id || member.membershipId || null,
      membershipStatus: member.status || member.membershipStatus || null,
      clubId: id,
      tenantId: member.tenant_id || member.tenantId || athlete?.tenant_id || null,
      profilePlayerId: profile?.player_id || null,
      legacyPlayerId: null,
      registrationStatus: null,
    };
  });

  return {
    ok: true,
    rows,
    sourceBreakdown: {
      athleteRows: athletesResult.athletes?.length ?? 0,
      membershipRows: members.length,
      activeMembershipRows: members.filter(
        (m) => String(m.status || "").toLowerCase() === "active"
      ).length,
    },
  };
}

/**
 * Project gateway candidate → legacy SelectPlayers player shape.
 * `id` is pairingIdentityId (= athletes.id). Legacy ids are aliases only.
 *
 * @param {object} candidate
 */
export function toLegacySelectPlayersPlayer(candidate) {
  if (!candidate) return null;
  const pairingIdentityId = normalizeId(candidate.pairingIdentityId || candidate.athleteId);
  if (!pairingIdentityId) return null;

  return {
    id: pairingIdentityId,
    name: candidate.displayName || pairingIdentityId,
    gender: candidate.gender ?? "",
    level: candidate.rating ?? null,
    rating: candidate.rating ?? null,
    active: String(candidate.athleteStatus || "active").toLowerCase() === "active",
    clubId: candidate.clubId || null,
    athleteId: candidate.athleteId || pairingIdentityId,
    authUserId: candidate.userId || null,
    profilePlayerId: candidate.metadata?.profilePlayerId || null,
    legacyPlayerId: candidate.metadata?.legacyPlayerId || null,
    source: "pairing-candidate-gateway",
  };
}

function formatExclusionSummary(gatewayResult) {
  const byReason = gatewayResult?.summary?.byReason || {};
  const parts = Object.entries(byReason).map(([code, count]) => `${code}:${count}`);
  if (parts.length === 0) {
    return "Không có vận động viên đủ điều kiện để xếp sân.";
  }
  return `Không có VĐV đủ điều kiện (loại trừ: ${parts.join(", ")}).`;
}

/**
 * Public SelectPlayers load entry — never returns bare player array alone as success
 * without diagnostics; never reads blob.
 *
 * @param {string} clubId
 * @param {object} [deps]
 * @returns {Promise<object>}
 */
export async function loadSelectPlayersCandidatePool(clubId, deps = {}) {
  const id = normalizeId(clubId);
  if (!id) {
    return {
      ok: false,
      code: PAIRING_CANDIDATE_REASON_CODES.WRONG_SCOPE,
      message: "Chưa chọn CLB để tải danh sách xếp sân.",
      players: [],
      gatewayResult: null,
    };
  }

  const service =
    deps.service ||
    createPairingCandidateService({
      listScopeRows: (scope) => listSelectPlayersScopeRows(scope.clubId || id, deps),
    });

  const gatewayResult = await service.listCandidates({ clubId: id }, deps);

  if (gatewayResult.status === PAIRING_CANDIDATE_STATUS.ERROR) {
    return {
      ok: false,
      code: gatewayResult.diagnostics?.error?.code || "REPOSITORY_ERROR",
      message:
        gatewayResult.diagnostics?.error?.message ||
        "Không tải được danh sách VĐV canonical. Danh sách không bị thay bằng roster blob.",
      players: [],
      gatewayResult,
    };
  }

  if (gatewayResult.status === PAIRING_CANDIDATE_STATUS.BLOCKED) {
    return {
      ok: false,
      code: gatewayResult.diagnostics?.error?.code || "BLOCKED",
      message:
        gatewayResult.diagnostics?.error?.message ||
        "Danh sách pairing bị chặn bởi chính sách/rules.",
      players: [],
      gatewayResult,
    };
  }

  const players = (gatewayResult.candidates || [])
    .map(toLegacySelectPlayersPlayer)
    .filter(Boolean);

  if (players.length === 0) {
    return {
      ok: true,
      empty: true,
      code: "NO_ELIGIBLE_CANDIDATES",
      message: formatExclusionSummary(gatewayResult),
      players: [],
      gatewayResult,
    };
  }

  return {
    ok: true,
    empty: false,
    players,
    gatewayResult,
  };
}
