/**
 * HARD-CUTOVER-04 — Membership read authority boundary.
 *
 * Two explicit contracts (no ambiguous includeInactive flag):
 *
 * 1. listCurrentClubMembers — canonical active membership only (operational flows).
 * 2. listClubMembershipHistory — full lifecycle for management / audit tabs.
 *
 * Fail-closed: RPC errors propagate; no blob/profile/athlete fallback when cloud is authoritative.
 */

import { isClubMemberStatusActive } from "../constants/clubMemberRoles.js";
import { canonicalMembershipRepository } from "../repositories/canonicalMembershipRepository.js";
import { mapV2MemberRowToUi } from "./clubMemberService.js";

/**
 * CURRENT MEMBERS CONTRACT — active canonical membership rows only.
 * @param {string} clubId
 * @returns {Promise<import('../repositories/canonicalRepositoryTypes.js').buildRepoResult>}
 */
export async function listCurrentClubMembers(clubId) {
  return canonicalMembershipRepository.listCurrentClubMembers(clubId);
}

/**
 * MEMBERSHIP HISTORY CONTRACT — deduped lifecycle rows (active + left + removed + …).
 * @param {string} clubId
 * @returns {Promise<import('../repositories/canonicalRepositoryTypes.js').buildRepoResult>}
 */
export async function listClubMembershipHistory(clubId) {
  return canonicalMembershipRepository.listClubMembershipHistory(clubId);
}

/**
 * Map current-member repo rows to UI member shape.
 * @param {object} repoResult
 */
export function mapCurrentClubMembersToUi(repoResult) {
  if (!repoResult?.ok) {
    return repoResult;
  }
  return {
    ...repoResult,
    data: (repoResult.data || []).map((row) => mapV2MemberRowToUi(row)),
  };
}

/**
 * Map membership-history repo rows to UI member shape.
 * @param {object} repoResult
 */
export function mapClubMembershipHistoryToUi(repoResult) {
  if (!repoResult?.ok) {
    return repoResult;
  }
  return {
    ...repoResult,
    data: (repoResult.data || []).map((row) => mapV2MemberRowToUi(row)),
  };
}

/**
 * Resolve auth user ids for active members (V2 cloud path).
 * Returns [] on failure — never falls back to blob/profile.
 * @param {string} clubId
 */
export async function listCurrentClubMemberAuthUserIds(clubId) {
  const result = await listCurrentClubMembers(clubId);
  if (!result.ok) {
    return { ok: false, code: result.code, error: result.message, userIds: [] };
  }
  const userIds = (result.data || [])
    .map((row) => String(row.user_id || row.userId || "").trim())
    .filter(Boolean);
  return { ok: true, userIds: [...new Set(userIds)] };
}

/**
 * Filter legacy blob member records to current active only.
 * @param {object[]} members
 */
export function filterLegacyMembersToCurrent(members = []) {
  return (members || []).filter((member) => isClubMemberStatusActive(member?.status));
}
