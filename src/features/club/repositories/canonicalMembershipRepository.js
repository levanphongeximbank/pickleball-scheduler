import {
  ACTIVE_MEMBERSHIP_STATUSES,
  CANONICAL_SOURCE,
  CANONICAL_WARNING_CODE,
  NON_PICKER_MEMBERSHIP_STATUSES,
  buildRepoError,
  buildRepoResult,
  emptyMappingSummary,
} from "./canonicalRepositoryTypes.js";
import { rpcV2ClubListMembers, rpcV2GetMyActiveMembership } from "../services/clubStorageV2RpcService.js";
import { isCanonicalClubRepositoryEnabled } from "../config/canonicalRepositoryFlags.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import { hasSupabaseConfig } from "../../../auth/supabaseClient.js";
import { isCanonicalMembershipReadEnabled } from "../context/membershipCanonicalReadModel.js";

const STATUS_RANK = Object.freeze({
  active: 100,
  pending: 40,
  left: 20,
  removed: 10,
  rejected: 5,
});

/**
 * Normalize membership status for picker / dedupe.
 * @param {object|null|undefined} row
 */
export function resolveMembershipStatus(row) {
  const raw = String(row?.status || row?.membershipStatus || "")
    .trim()
    .toLowerCase();
  if (!raw) return "unknown";
  if (ACTIVE_MEMBERSHIP_STATUSES.includes(raw)) return "active";
  if (NON_PICKER_MEMBERSHIP_STATUSES.includes(raw)) return raw;
  return raw;
}

function membershipKey(row) {
  return String(row?.user_id || row?.userId || row?.authUserId || "").trim();
}

function membershipTimestamp(row) {
  const candidates = [
    row?.updated_at,
    row?.updatedAt,
    row?.joined_at,
    row?.joinedAt,
    row?.created_at,
    row?.createdAt,
  ];
  for (const value of candidates) {
    const ms = Date.parse(String(value || ""));
    if (!Number.isNaN(ms)) return ms;
  }
  return 0;
}

/**
 * Deterministic dedupe: one logical membership per user.
 * Prefer active, then higher status rank, then newest timestamp, then stable id.
 *
 * @param {object[]} rows
 * @returns {{ members: object[], duplicatesRemoved: number, warnings: object[] }}
 */
export function dedupeMembershipHistory(rows = []) {
  const warnings = [];
  const byUser = new Map();
  let duplicatesRemoved = 0;

  for (const row of rows || []) {
    const userId = membershipKey(row);
    if (!userId) continue;

    const normalized = {
      ...row,
      userId,
      user_id: userId,
      membershipStatus: resolveMembershipStatus(row),
      status: resolveMembershipStatus(row),
    };

    const existing = byUser.get(userId);
    if (!existing) {
      byUser.set(userId, normalized);
      continue;
    }

    duplicatesRemoved += 1;

    const rankExisting = STATUS_RANK[existing.membershipStatus] || 0;
    const rankNext = STATUS_RANK[normalized.membershipStatus] || 0;
    let keepNext = false;
    if (rankNext > rankExisting) {
      keepNext = true;
    } else if (rankNext === rankExisting) {
      const tsExisting = membershipTimestamp(existing);
      const tsNext = membershipTimestamp(normalized);
      if (tsNext > tsExisting) {
        keepNext = true;
      } else if (tsNext === tsExisting) {
        const idExisting = String(existing.id || existing.memberId || "");
        const idNext = String(normalized.id || normalized.memberId || "");
        keepNext = Boolean(idNext && idNext.localeCompare(idExisting) < 0);
      }
    }

    const kept = keepNext ? normalized : existing;
    const dropped = keepNext ? existing : normalized;
    warnings.push({
      code: CANONICAL_WARNING_CODE.DUPLICATE_MEMBERSHIP_HISTORY,
      message: `Duplicate membership history for user ${userId}`,
      meta: {
        userId,
        keptId: kept.id || kept.memberId || null,
        droppedId: dropped.id || dropped.memberId || null,
      },
    });
    if (keepNext) {
      byUser.set(userId, normalized);
    }
  }

  const members = Array.from(byUser.values()).sort((a, b) =>
    String(a.display_name || a.displayName || a.userId).localeCompare(
      String(b.display_name || b.displayName || b.userId),
      "vi"
    )
  );

  return { members, duplicatesRemoved, warnings };
}

/**
 * @param {object} [deps]
 */
export function createCanonicalMembershipRepository(deps = {}) {
  const {
    envSource = null,
    listMembersRpc = rpcV2ClubListMembers,
    getMyActiveMembershipRpc = rpcV2GetMyActiveMembership,
    isV2Enabled = () => isCanonicalClubRepositoryEnabled(envSource),
    legacyListMembers = null,
  } = deps;

  async function listActiveClubMembers(clubId, options = {}) {
    const id = String(clubId || "").trim();
    if (!id) {
      return buildRepoError({ code: "CLUB_ID_REQUIRED", message: "clubId is required." });
    }

    const includeInactive = Boolean(options.includeInactive);
    const v2 = isV2Enabled();

    if (!v2) {
      const legacyRows = typeof legacyListMembers === "function" ? legacyListMembers(id) || [] : [];
      const deduped = dedupeMembershipHistory(legacyRows);
      const active = includeInactive
        ? deduped.members
        : deduped.members.filter((m) => m.membershipStatus === "active");
      return buildRepoResult({
        data: active,
        source: CANONICAL_SOURCE.LEGACY_BLOB,
        warnings: deduped.warnings,
        mappingSummary: emptyMappingSummary({
          totalMembers: legacyRows.length,
          activeMembers: active.filter((m) => m.membershipStatus === "active").length,
          duplicatesRemoved: deduped.duplicatesRemoved,
        }),
        execution: { mode: "legacy", clubId: id },
      });
    }

    const rpc = await listMembersRpc(id);
    if (!rpc?.ok) {
      return buildRepoError({
        code: rpc?.code || "MEMBERSHIP_RPC_FAILED",
        message: rpc?.error || rpc?.message || "Failed to list club members.",
        source: CANONICAL_SOURCE.MEMBERSHIP_SSOT,
      });
    }

    const raw = Array.isArray(rpc.members) ? rpc.members : [];
    const deduped = dedupeMembershipHistory(raw);
    const active = includeInactive
      ? deduped.members
      : deduped.members.filter((m) => m.membershipStatus === "active");

    return buildRepoResult({
      data: active,
      source: CANONICAL_SOURCE.MEMBERSHIP_SSOT,
      warnings: deduped.warnings,
      mappingSummary: emptyMappingSummary({
        totalMembers: raw.length,
        activeMembers: active.filter((m) => m.membershipStatus === "active").length,
        duplicatesRemoved: deduped.duplicatesRemoved,
      }),
      execution: { mode: "v2", clubId: id },
    });
  }

  async function getActiveMembershipForUser(clubId, userId) {
    const result = await listActiveClubMembers(clubId, { includeInactive: false });
    if (!result.ok) return result;
    const uid = String(userId || "").trim();
    const hit = (result.data || []).find((m) => membershipKey(m) === uid) || null;
    return buildRepoResult({
      data: hit,
      source: result.source,
      warnings: result.warnings,
      mappingSummary: result.mappingSummary,
      execution: { ...result.execution, userId: uid },
    });
  }

  /**
   * Resolve a single logical membership (any status) for a user in a club.
   * @param {string} clubId
   * @param {string} userId
   * @param {{ includeInactive?: boolean }} [options]
   */
  async function getMemberByUserId(clubId, userId, options = {}) {
    const includeInactive = options.includeInactive !== false;
    const result = await listActiveClubMembers(clubId, { includeInactive });
    if (!result.ok) return result;
    const uid = String(userId || "").trim();
    const hit = (result.data || []).find((m) => membershipKey(m) === uid) || null;
    return buildRepoResult({
      data: hit,
      source: result.source,
      warnings: result.warnings,
      mappingSummary: result.mappingSummary,
      execution: { ...result.execution, userId: uid },
    });
  }

  /**
   * Canonical active-member count (active-only club_members semantics).
   * Single shared count contract for My Club / Manage Club surfaces (§6).
   * @param {string} clubId
   * @returns {Promise<object>} repo result with numeric `data`
   */
  async function countActiveMembers(clubId) {
    const result = await listActiveClubMembers(clubId, { includeInactive: false });
    if (!result.ok) return result;
    return buildRepoResult({
      data: (result.data || []).length,
      source: result.source,
      warnings: result.warnings,
      mappingSummary: result.mappingSummary,
      execution: { ...result.execution, counted: "active" },
    });
  }

  async function getMyActiveMembership() {
    if (!isV2Enabled()) {
      return buildRepoResult({
        data: null,
        source: CANONICAL_SOURCE.LEGACY_BLOB,
        execution: { mode: "legacy" },
      });
    }
    const rpc = await getMyActiveMembershipRpc();
    if (!rpc?.ok) {
      return buildRepoError({
        code: rpc?.code || "MEMBERSHIP_RPC_FAILED",
        message: rpc?.error || rpc?.message || "Failed to resolve active membership.",
        source: CANONICAL_SOURCE.MEMBERSHIP_SSOT,
      });
    }
    return buildRepoResult({
      data: {
        clubId: rpc.clubId || null,
        memberId: rpc.memberId || null,
        hasActiveMembership: Boolean(rpc.hasActiveMembership),
        club: rpc.club || null,
      },
      source: CANONICAL_SOURCE.MEMBERSHIP_SSOT,
      execution: { mode: "v2" },
    });
  }

  return {
    listActiveClubMembers,
    // Contract alias (Phase 45A.2 §3): listMembersByClub === listActiveClubMembers.
    listMembersByClub: listActiveClubMembers,
    getActiveMembershipForUser,
    getMemberByUserId,
    countActiveMembers,
    getMyActiveMembership,
    dedupeMembershipHistory,
    resolveMembershipStatus,
  };
}

/**
 * App-facing singleton — the single Membership READ gateway for UI/context/service.
 *
 * Cloud-authoritative (V2 RPC gateway → public.club_members) whenever the canonical
 * repository flag is ON or Club Storage V2 is ON; legacy blob only in explicit
 * offline / no-Supabase mode. Uses the same gate as the read-model consumers so the
 * repository never silently returns an empty/blob roster while the UI believes it is
 * in canonical cloud mode. See membershipCanonicalReadModel.isCanonicalMembershipReadEnabled.
 */
export const canonicalMembershipRepository = createCanonicalMembershipRepository({
  isV2Enabled: () =>
    isCanonicalMembershipReadEnabled({
      canonicalEnabled: isCanonicalClubRepositoryEnabled(),
      v2StorageEnabled: isClubStorageV2Enabled(),
      hasSupabase: hasSupabaseConfig(),
    }),
});
