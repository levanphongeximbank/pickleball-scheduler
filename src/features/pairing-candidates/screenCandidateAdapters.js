/**
 * PHASE 45B.5B — Daily Play / Team / Tournament candidate discovery adapters.
 *
 * All discovery goes through pairingCandidateService.listCandidates.
 * No blob/localStorage roster authority. Repository failures → ok:false (never
 * silently rendered as an empty success list).
 *
 * athletes.id = pairing identity. Legacy profile/blob ids remain aliases only.
 */

import { rpcV2ClubListRegistry } from "../club/services/clubStorageV2RpcService.js";
import { createPairingCandidateService } from "./pairingCandidateService.js";
import { PAIRING_CANDIDATE_STATUS } from "./pairingCandidateContract.js";
import { PAIRING_CANDIDATE_REASON_CODES } from "./pairingCandidateReasonCodes.js";
import {
  listSelectPlayersScopeRows,
  toLegacySelectPlayersPlayer,
} from "./selectPlayersCandidateAdapter.js";

function normalizeId(value) {
  return String(value || "").trim();
}

/**
 * Project gateway candidate → legacy tournament/team/daily picker shape.
 * id = athletes.id (pairingIdentityId).
 *
 * @param {object} candidate
 * @param {{ clubName?: string|null }} [extras]
 */
export function toLegacyScreenPickerPlayer(candidate, extras = {}) {
  const base = toLegacySelectPlayersPlayer(candidate);
  if (!base) return null;

  const coverage = candidate.metadata?.identity?.coverageBucket || null;
  let mappingStatus = "UNMAPPED";
  if (coverage === "mapped" || candidate.metadata?.profilePlayerId) {
    mappingStatus = "MAPPED";
  } else if (coverage === "derived" || candidate.metadata?.legacyPlayerId) {
    mappingStatus = "DERIVED";
  }

  const clubId = base.clubId || candidate.clubId || null;
  return {
    ...base,
    status: base.active ? "active" : "inactive",
    sourceClubId: clubId,
    clubName: extras.clubName || candidate.metadata?.clubName || "",
    tenantId: candidate.tenantId || null,
    profileId: null,
    mappingStatus,
    membershipStatus: candidate.membershipStatus || "active",
    selectable: true,
    _canonicalPlayerId: base.id,
    source: "pairing-candidate-gateway",
  };
}

const EXCLUSION_REASON_LABELS = Object.freeze({
  [PAIRING_CANDIDATE_REASON_CODES.MISSING_IDENTITY_LINK]:
    "thiếu liên kết Athlete (athletes.id)",
  [PAIRING_CANDIDATE_REASON_CODES.MISSING_MEMBERSHIP]: "thiếu membership",
  [PAIRING_CANDIDATE_REASON_CODES.MEMBERSHIP_INACTIVE]: "membership không active",
  [PAIRING_CANDIDATE_REASON_CODES.ATHLETE_INACTIVE]: "athlete không active",
  [PAIRING_CANDIDATE_REASON_CODES.WRONG_SCOPE]: "sai phạm vi CLB/tenant",
  [PAIRING_CANDIDATE_REASON_CODES.MISSING_GENDER]: "thiếu giới tính",
  [PAIRING_CANDIDATE_REASON_CODES.MISSING_RATING]: "thiếu trình độ",
  [PAIRING_CANDIDATE_REASON_CODES.NOT_REGISTERED]: "chưa đăng ký giải",
  [PAIRING_CANDIDATE_REASON_CODES.WITHDRAWN]: "đã rút lui",
  [PAIRING_CANDIDATE_REASON_CODES.BUSY]: "đang bận",
  [PAIRING_CANDIDATE_REASON_CODES.ALREADY_ASSIGNED]: "đã được gán đội",
});

function formatExclusionSummary(gatewayResult, label = "VĐV") {
  const sourceCount = Number(gatewayResult?.summary?.sourceCount || 0);
  const byReason = gatewayResult?.summary?.byReason || {};
  const parts = Object.entries(byReason).map(([code, count]) => {
    const human = EXCLUSION_REASON_LABELS[code] || code;
    return `${human}:${count}`;
  });

  if (sourceCount === 0 && parts.length === 0) {
    return (
      `Không có nguồn ${label} canonical cho CLB này (sourceCount=0). ` +
      `Không kết luận “chưa có thành viên” — kiểm tra membership RPC / môi trường Supabase.`
    );
  }

  if (parts.length === 0) {
    return `Không có ${label} đủ điều kiện.`;
  }

  return `Không có ${label} đủ điều kiện (loại trừ: ${parts.join(", ")}).`;
}

/**
 * Club-scoped candidate pool via pairingCandidateService.
 *
 * @param {string} clubId
 * @param {object} [deps]
 * @param {string|null} [deps.clubName]
 */
export async function loadClubPairingCandidatePool(clubId, deps = {}) {
  const id = normalizeId(clubId);
  if (!id) {
    return {
      ok: false,
      code: PAIRING_CANDIDATE_REASON_CODES.WRONG_SCOPE,
      message: "Chưa chọn CLB để tải danh sách VĐV.",
      players: [],
      legacyPlayers: [],
      gatewayResult: null,
    };
  }

  const service =
    deps.service ||
    createPairingCandidateService({
      listScopeRows: (scope) =>
        listSelectPlayersScopeRows(scope.clubId || id, deps),
    });

  const gatewayResult = await service.listCandidates(
    {
      clubId: id,
      tenantId: deps.tenantId || null,
      eventType: deps.eventType || null,
      genderMode: deps.genderMode || null,
      ratingBand: deps.ratingBand || null,
    },
    deps
  );

  if (
    gatewayResult.status === PAIRING_CANDIDATE_STATUS.ERROR ||
    gatewayResult.status === PAIRING_CANDIDATE_STATUS.BLOCKED
  ) {
    return {
      ok: false,
      code: gatewayResult.diagnostics?.error?.code || "REPOSITORY_ERROR",
      message:
        gatewayResult.diagnostics?.error?.message ||
        "Không tải được danh sách VĐV canonical. Không dùng roster blob.",
      players: [],
      legacyPlayers: [],
      gatewayResult,
    };
  }

  const players = (gatewayResult.candidates || [])
    .map((c) =>
      toLegacyScreenPickerPlayer(c, {
        clubName: deps.clubName || null,
      })
    )
    .filter(Boolean);

  if (players.length === 0) {
    return {
      ok: true,
      empty: true,
      code: "NO_ELIGIBLE_CANDIDATES",
      message: formatExclusionSummary(gatewayResult),
      players: [],
      legacyPlayers: [],
      gatewayResult,
    };
  }

  return {
    ok: true,
    empty: false,
    players,
    legacyPlayers: players,
    gatewayResult,
  };
}

/**
 * List clubs for tenant (injectable). Uses club_list_registry — no blob.
 * @param {string} tenantId
 * @param {object} [deps]
 */
export async function listClubsForPairingTenant(tenantId, deps = {}) {
  const tid = normalizeId(tenantId);
  if (!tid) {
    return { ok: false, code: "WRONG_SCOPE", message: "tenantId is required.", clubs: [] };
  }
  if (typeof deps.listClubs === "function") {
    return deps.listClubs(tid);
  }
  const result = await rpcV2ClubListRegistry({
    tenantId: tid,
    includeInactive: false,
  });
  if (!result?.ok) {
    return {
      ok: false,
      code: result?.code || "CLUB_REGISTRY_FAILED",
      message: result?.error || "Không tải được registry CLB cho tenant.",
      clubs: [],
    };
  }
  return {
    ok: true,
    clubs: Array.isArray(result.clubs) ? result.clubs : [],
  };
}

/**
 * Tenant-scoped candidate pool — listCandidates per club, merge by athletes.id.
 * Any club repository failure → ok:false (never silent empty success).
 *
 * @param {string} tenantId
 * @param {object} [deps]
 */
export async function loadTenantPairingCandidatePool(tenantId, deps = {}) {
  const tid = normalizeId(tenantId);
  if (!tid) {
    return {
      ok: false,
      code: PAIRING_CANDIDATE_REASON_CODES.WRONG_SCOPE,
      message: "Chưa chọn tenant để tải danh sách VĐV.",
      players: [],
      legacyPlayers: [],
      gatewayResults: [],
    };
  }

  const clubsResult = await listClubsForPairingTenant(tid, deps);
  if (!clubsResult.ok) {
    return {
      ok: false,
      code: clubsResult.code || "CLUB_REGISTRY_FAILED",
      message:
        clubsResult.message ||
        "Không tải được danh sách CLB. Không dùng roster blob.",
      players: [],
      legacyPlayers: [],
      gatewayResults: [],
    };
  }

  const clubs = (clubsResult.clubs || []).filter(
    (c) => normalizeId(c.id) && normalizeId(c.id) !== "default"
  );

  if (clubs.length === 0) {
    return {
      ok: true,
      empty: true,
      code: "NO_CLUBS",
      message: "Tenant chưa có CLB để tải VĐV.",
      players: [],
      legacyPlayers: [],
      gatewayResults: [],
    };
  }

  const byAthleteId = new Map();
  const gatewayResults = [];

  for (const club of clubs) {
    const clubId = normalizeId(club.id);
    const clubPool = await loadClubPairingCandidatePool(clubId, {
      ...deps,
      tenantId: tid,
      clubName: club.name || clubId,
    });
    gatewayResults.push({ clubId, result: clubPool });

    if (!clubPool.ok) {
      return {
        ok: false,
        code: clubPool.code || "REPOSITORY_ERROR",
        message:
          clubPool.message ||
          `Không tải được VĐV cho CLB ${club.name || clubId}. Không dùng roster blob.`,
        players: [],
        legacyPlayers: [],
        gatewayResults,
      };
    }

    for (const player of clubPool.players || []) {
      const id = normalizeId(player.id);
      if (!id) continue;
      if (!byAthleteId.has(id)) {
        byAthleteId.set(id, player);
      }
    }
  }

  const players = [...byAthleteId.values()].sort((a, b) => {
    const nameA = String(a.name || "").toLocaleLowerCase();
    const nameB = String(b.name || "").toLocaleLowerCase();
    if (nameA < nameB) return -1;
    if (nameA > nameB) return 1;
    return String(a.id).localeCompare(String(b.id));
  });

  if (players.length === 0) {
    return {
      ok: true,
      empty: true,
      code: "NO_ELIGIBLE_CANDIDATES",
      message: "Không có VĐV đủ điều kiện trên tenant.",
      players: [],
      legacyPlayers: [],
      gatewayResults,
    };
  }

  return {
    ok: true,
    empty: false,
    players,
    legacyPlayers: players,
    gatewayResults,
  };
}

/** Daily Play discovery entry. */
export async function loadDailyPlayCandidatePool(clubId, deps = {}) {
  return loadClubPairingCandidatePool(clubId, deps);
}

/** Team builder club-scoped discovery. */
export async function loadTeamBuilderClubCandidatePool(clubId, deps = {}) {
  return loadClubPairingCandidatePool(clubId, deps);
}

/** Team builder tenant-scoped discovery. */
export async function loadTeamBuilderTenantCandidatePool(tenantId, deps = {}) {
  return loadTenantPairingCandidatePool(tenantId, deps);
}

/** Tournament registration picker club-scoped discovery. */
export async function loadTournamentPickerClubCandidatePool(clubId, deps = {}) {
  return loadClubPairingCandidatePool(clubId, deps);
}

/** Tournament registration picker tenant-scoped discovery. */
export async function loadTournamentPickerTenantCandidatePool(tenantId, deps = {}) {
  return loadTenantPairingCandidatePool(tenantId, deps);
}
