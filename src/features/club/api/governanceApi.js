/**
 * Phase 2D — Freeze-named governance.* public/internal ports.
 *
 * Thin façade over clubGovernanceService → clubStorageV2RpcService (V2 ON).
 * Mutating commands are internal (Club UI / Club services).
 * Peers may call governanceGet only.
 */

import { getCurrentUser } from "../../../auth/authService.js";
import { getClubById as getRegistryClubById } from "../../../domain/clubService.js";
import { API_ERROR_CODES } from "../../api/constants/apiErrors.js";
import { GOVERNANCE_AUDIT_EVENTS } from "../constants/governanceAuditEvents.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import { toGovernanceReadModel } from "../context/governanceCanonicalReadModel.js";
import {
  assignClubOwner,
  assignClubVicePresident,
  clearClubPresident,
  setClubVicePresidents,
  transferClubOwnership,
  transferClubPresident,
} from "../services/clubGovernanceService.js";
import { rpcV2ClubGet } from "../services/clubStorageV2RpcService.js";

/**
 * governance.get — references + Phase 2E normalized read model (peer-safe read).
 * Additive fields only; existing callers keep governance / version / clubId.
 */
export async function governanceGet(clubId, options = {}) {
  const id = String(clubId || "").trim();
  if (!id) {
    return {
      ok: false,
      code: API_ERROR_CODES.VALIDATION_ERROR,
      error: "Thiếu club id.",
    };
  }

  if (isClubStorageV2Enabled()) {
    const rpc = await rpcV2ClubGet(id);
    if (!rpc.ok) {
      return {
        ok: false,
        code: rpc.code || API_ERROR_CODES.INTERNAL_ERROR,
        error: rpc.error || "Không tải được quản trị CLB.",
      };
    }
    const club = rpc.club || null;
    const readModel = toGovernanceReadModel({
      club,
      profileByUserId: options.profileByUserId || null,
      membershipByUserId: options.membershipByUserId || null,
      v2Enabled: true,
      legacyBlobRoles: null,
    });
    return {
      ok: true,
      governance: club?.governance || null,
      version: rpc.version ?? club?.version ?? null,
      clubId: id,
      provider: "v2-rpc",
      readModel,
      tenantId: club?.tenantId || club?.venueId || null,
    };
  }

  const club = options.club || getRegistryClubById(id);
  if (!club) {
    return {
      ok: false,
      code: API_ERROR_CODES.NOT_FOUND,
      error: "Không tìm thấy CLB.",
    };
  }

  const readModel = toGovernanceReadModel({
    club,
    profileByUserId: options.profileByUserId || null,
    membershipByUserId: options.membershipByUserId || null,
    v2Enabled: false,
    legacyBlobRoles: options.legacyBlobRoles || null,
  });

  return {
    ok: true,
    governance: club.governance || null,
    version: club.version ?? null,
    clubId: id,
    provider: "legacy-registry",
    readModel,
    tenantId: club.tenantId || club.venueId || null,
    /** V2 OFF fallback — not Production authority. */
    fallback: "legacy-registry",
  };
}

/** governance.assignOwner */
export async function governanceAssignOwner(clubId, ownerUserId, options = {}) {
  const tenantId = options.tenantId ?? null;
  const result = await assignClubOwner(clubId, ownerUserId, tenantId, {
    expectedClubVersion: options.expectedVersion ?? options.expectedClubVersion,
    requestId: options.idempotencyKey || options.requestId,
  });
  if (result?.ok) {
    return {
      ...result,
      auditEvent: GOVERNANCE_AUDIT_EVENTS.OWNER_ASSIGNED,
    };
  }
  return result;
}

/** governance.clearOwner */
export async function governanceClearOwner(clubId, options = {}) {
  const tenantId = options.tenantId ?? null;
  const result = await assignClubOwner(clubId, null, tenantId, {
    expectedClubVersion: options.expectedVersion ?? options.expectedClubVersion,
    requestId: options.idempotencyKey || options.requestId,
  });
  if (result?.ok) {
    return {
      ...result,
      auditEvent: GOVERNANCE_AUDIT_EVENTS.OWNER_CLEARED,
    };
  }
  return result;
}

/**
 * governance.assignPresident — transfer path (replacement).
 * Empty clear is not supported on active clubs under V2.
 */
export async function governanceAssignPresident(clubId, nextPresidentUserId, options = {}) {
  const tenantId = options.tenantId ?? null;
  const result = await transferClubPresident(clubId, nextPresidentUserId, tenantId, {
    expectedClubVersion: options.expectedVersion ?? options.expectedClubVersion,
    requestId: options.idempotencyKey || options.requestId,
  });
  if (result?.ok) {
    return {
      ...result,
      auditEvent: GOVERNANCE_AUDIT_EVENTS.PRESIDENT_ASSIGNED,
    };
  }
  return result;
}

/**
 * governance.clearPresident — Phase 2 policy: transfer-only on active clubs.
 */
export async function governanceClearPresident(clubId, options = {}) {
  const tenantId = options.tenantId ?? null;
  return clearClubPresident(clubId, tenantId);
}

/** governance.assignVp */
export async function governanceAssignVp(clubId, memberUserId, options = {}) {
  const tenantId = options.tenantId ?? null;
  const result = await assignClubVicePresident(clubId, memberUserId, tenantId, {
    expectedClubVersion: options.expectedVersion ?? options.expectedClubVersion,
    requestId: options.idempotencyKey || options.requestId,
  });
  if (result?.ok) {
    return {
      ...result,
      auditEvent: GOVERNANCE_AUDIT_EVENTS.VP_ASSIGNED,
    };
  }
  return result;
}

/** governance.clearVp — clear one (memberUserId) or all (omit / null). */
export async function governanceClearVp(clubId, options = {}) {
  const tenantId = options.tenantId ?? null;
  const memberUserId =
    options.memberUserId !== undefined ? options.memberUserId : null;

  if (memberUserId == null || memberUserId === "") {
    const result = await setClubVicePresidents(clubId, [], tenantId, {
      expectedClubVersion: options.expectedVersion ?? options.expectedClubVersion,
      requestId: options.idempotencyKey || options.requestId,
    });
    if (result?.ok) {
      return {
        ...result,
        auditEvent: GOVERNANCE_AUDIT_EVENTS.VP_CLEARED,
      };
    }
    return result;
  }

  // Clear one: set remaining VPs excluding the target (requires current club read).
  const current = await governanceGet(clubId, options);
  if (!current.ok) {
    return current;
  }
  const currentIds = Array.isArray(current.governance?.vicePresidentUserIds)
    ? current.governance.vicePresidentUserIds
    : current.governance?.vicePresidentUserId
      ? [current.governance.vicePresidentUserId]
      : [];
  const nextIds = currentIds.filter(
    (id) => String(id) !== String(memberUserId)
  );
  const result = await setClubVicePresidents(clubId, nextIds, tenantId, {
    expectedClubVersion:
      options.expectedVersion ?? options.expectedClubVersion ?? current.version,
    requestId: options.idempotencyKey || options.requestId,
  });
  if (result?.ok) {
    return {
      ...result,
      auditEvent: GOVERNANCE_AUDIT_EVENTS.VP_CLEARED,
    };
  }
  return result;
}

/** Convenience: ownership transfer (same RPC as assignOwner; actor = current owner UI). */
export async function governanceTransferOwnership(clubId, nextOwnerUserId, options = {}) {
  const user = options.user || getCurrentUser();
  const tenantId = options.tenantId ?? null;
  const result = await transferClubOwnership(
    clubId,
    nextOwnerUserId,
    tenantId,
    {
      expectedClubVersion: options.expectedVersion ?? options.expectedClubVersion,
      requestId: options.idempotencyKey || options.requestId,
      user,
    }
  );
  if (result?.ok) {
    return {
      ...result,
      auditEvent: GOVERNANCE_AUDIT_EVENTS.OWNER_REPLACED,
    };
  }
  return result;
}
