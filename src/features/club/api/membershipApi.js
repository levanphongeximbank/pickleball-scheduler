/**
 * Phase 2C — Freeze-named membership.* public/internal ports.
 *
 * Thin façade over certified services. Peers may call list / listActiveRoster only.
 * Mutating commands are internal (Club UI / Club services).
 */

import { getCurrentUser } from "../../../auth/authService.js";
import { getClubById as getRegistryClubById } from "../../../domain/clubService.js";
import { API_ERROR_CODES } from "../../api/constants/apiErrors.js";
import { isClubMemberStatusActive } from "../constants/clubMemberRoles.js";
import { MEMBERSHIP_AUDIT_EVENTS } from "../constants/membershipAuditEvents.js";
import { toActiveRosterMemberDto } from "../membership/membershipLifecycle.js";
import {
  createCanonicalMembershipRepository,
} from "../repositories/canonicalMembershipRepository.js";
import {
  addMemberToClub,
  getClubMembers,
  mapV2MemberRowToUi,
  removeMemberFromClub,
  restoreMemberToClub,
} from "../services/clubMemberService.js";
import { leaveMyClub } from "../services/clubMembershipRequestService.js";
import { canViewFullClubMembers } from "../services/clubGovernanceService.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import { rpcV2ClubListMembers } from "../services/clubStorageV2RpcService.js";

const membershipRepo = createCanonicalMembershipRepository();

/**
 * membership.list — full list for Owner/President/VP (governance); empty if unauthorized.
 */
export async function membershipList(clubId, tenantId, options = {}) {
  const id = String(clubId || "").trim();
  if (!id) {
    return {
      ok: false,
      code: API_ERROR_CODES.VALIDATION_ERROR,
      error: "Thiếu club id.",
    };
  }

  const user = options.user || getCurrentUser();
  const club = options.club || getRegistryClubById(id);

  if (club && user && !canViewFullClubMembers(user, club)) {
    return { ok: true, members: [], visibility: "denied" };
  }

  if (isClubStorageV2Enabled()) {
    const rpc = await rpcV2ClubListMembers(id);
    if (!rpc.ok) {
      return {
        ok: false,
        code: rpc.code || API_ERROR_CODES.INTERNAL_ERROR,
        error: rpc.error || "Không tải được danh sách thành viên.",
      };
    }
    const members = (rpc.members || []).map((row) => mapV2MemberRowToUi(row));
    return {
      ok: true,
      members,
      visibility: "full",
      provider: "v2-rpc",
      audit: null,
    };
  }

  const members = getClubMembers(id, tenantId, { user, skipGovernanceGuard: true });
  return {
    ok: true,
    members,
    visibility: "full",
    provider: "legacy-blob",
  };
}

/**
 * membership.listActiveRoster — active only, minimal PII (public peer read).
 */
export async function membershipListActiveRoster(clubId, options = {}) {
  const id = String(clubId || "").trim();
  if (!id) {
    return {
      ok: false,
      code: API_ERROR_CODES.VALIDATION_ERROR,
      error: "Thiếu club id.",
    };
  }

  const result = await membershipRepo.listActiveClubMembers(id, {
    includeInactive: false,
  });
  if (!result.ok) {
    return {
      ok: false,
      code: result.code || API_ERROR_CODES.INTERNAL_ERROR,
      error: result.message || result.error || "Không tải được roster active.",
    };
  }

  const roster = (result.data || [])
    .filter((m) => isClubMemberStatusActive(m.status || m.membershipStatus))
    .map((m) => toActiveRosterMemberDto(m));

  return {
    ok: true,
    members: roster,
    source: result.source,
    provider: result.execution?.mode === "v2" ? "v2-rpc" : "legacy-blob",
    ...(options.includeMeta
      ? { mappingSummary: result.mappingSummary, warnings: result.warnings }
      : {}),
  };
}

/** membership.add */
export async function membershipAdd(clubId, playerId, tenantId, options = {}) {
  const result = await addMemberToClub(clubId, playerId, tenantId, {
    ...options,
    idempotencyKey: options.idempotencyKey || options.requestId,
  });
  if (result?.ok) {
    return { ...result, auditEvent: MEMBERSHIP_AUDIT_EVENTS.ADDED };
  }
  return result;
}

/** membership.remove */
export async function membershipRemove(clubId, playerId, tenantId, options = {}) {
  const result = await removeMemberFromClub(clubId, playerId, tenantId, {
    ...options,
    idempotencyKey: options.idempotencyKey || options.requestId,
  });
  if (result?.ok) {
    return { ...result, auditEvent: MEMBERSHIP_AUDIT_EVENTS.REMOVED };
  }
  return result;
}

/** membership.restore */
export async function membershipRestore(clubId, playerId, tenantId, options = {}) {
  const result = await restoreMemberToClub(clubId, playerId, tenantId, {
    ...options,
    idempotencyKey: options.idempotencyKey || options.requestId,
  });
  if (result?.ok) {
    return { ...result, auditEvent: MEMBERSHIP_AUDIT_EVENTS.RESTORED };
  }
  return result;
}

/** membership.leave */
export async function membershipLeave(clubId, options = {}) {
  const result = await leaveMyClub({
    user: options.user,
    tenantId: options.tenantId ?? null,
    clubId: clubId || options.clubId || null,
    idempotencyKey: options.idempotencyKey || options.requestId,
  });
  if (result?.ok) {
    return { ...result, auditEvent: MEMBERSHIP_AUDIT_EVENTS.LEFT };
  }
  return result;
}
