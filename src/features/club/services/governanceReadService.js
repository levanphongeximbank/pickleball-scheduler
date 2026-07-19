/**
 * Phase 2E — Governance read service (canonical reader + safe profile hydration).
 *
 * Prefer order:
 * 1. Reuse freeze port governanceGet → club_get / phase42_club_canonical
 * 2. Normalize via governanceCanonicalReadModel
 * 3. Optionally hydrate display_name / avatar_url (display-only)
 *
 * Does not expose mutation RPCs. Does not use profiles.club_id for eligibility.
 * Does not use legacy blob roles under V2.
 */

import { fetchProfileByUserId } from "../../../auth/profileService.js";
import { API_ERROR_CODES } from "../../api/constants/apiErrors.js";
import { isClubStorageV2Enabled } from "../config/clubRegistryFlags.js";
import { governanceGet } from "../api/governanceApi.js";
import {
  GOVERNANCE_READ_STATE,
  toGovernanceReadModel,
  toGovernanceReadSnapshot,
  resolveGovernanceRefreshAction,
  shouldRefetchGovernanceOnConflict,
} from "../context/governanceCanonicalReadModel.js";
import { getVicePresidentUserIds } from "../models/clubGovernance.js";
import { rpcV2ClubGet } from "./clubStorageV2RpcService.js";

/**
 * Safe display-only profile bag. Never promotes club_id to membership/governance.
 *
 * @param {string[]} userIds
 * @param {{ expectedTenantId?: string|null }} [options]
 * @returns {Promise<{ profileByUserId: object, deniedCrossTenantIds: string[] }>}
 */
export async function hydrateGovernanceDisplayProfiles(
  userIds = [],
  options = {}
) {
  const expectedTenantId = options.expectedTenantId
    ? String(options.expectedTenantId).trim()
    : null;
  const uniqueIds = [
    ...new Set(
      (Array.isArray(userIds) ? userIds : [])
        .map((id) => String(id || "").trim())
        .filter(Boolean)
    ),
  ];

  const profileByUserId = {};
  const deniedCrossTenantIds = [];

  await Promise.all(
    uniqueIds.map(async (userId) => {
      try {
        const result = await fetchProfileByUserId(userId);
        if (!result.ok || !result.user) {
          return;
        }
        const user = result.user;
        const profileTenant = String(
          user.tenantId || user.venueId || ""
        ).trim();

        // Cross-tenant hydration denial: do not attach foreign profile display data
        // when the club tenant is known and the profile belongs elsewhere.
        if (
          expectedTenantId &&
          profileTenant &&
          profileTenant !== expectedTenantId
        ) {
          deniedCrossTenantIds.push(userId);
          return;
        }

        profileByUserId[userId] = {
          displayName: String(user.displayName || "").trim() || null,
          avatarUrl: String(user.avatarUrl || "").trim() || null,
          // Intentionally retained so the read model can prove it is ignored.
          clubId: user.clubId || null,
        };
      } catch {
        // RLS may block — leave missing; UI uses neutral fallback.
      }
    })
  );

  return { profileByUserId, deniedCrossTenantIds };
}

function collectGovernanceUserIds(club) {
  const gov = club?.governance || {};
  return [
    gov.ownerUserId,
    gov.presidentUserId,
    ...getVicePresidentUserIds(gov),
  ]
    .map((id) => String(id || "").trim())
    .filter(Boolean);
}

/**
 * Build read model from an already-mapped club (membership seed / club_get).
 * Optional hydration fills display gaps without changing authority refs.
 *
 * @param {object|null} club
 * @param {{
 *   hydrateProfiles?: boolean,
 *   membershipByUserId?: object|null,
 *   profileByUserId?: object|null,
 *   v2Enabled?: boolean,
 * }} [options]
 */
export async function buildGovernanceReadModelFromClub(club, options = {}) {
  if (!club?.id) {
    return {
      ok: false,
      code: API_ERROR_CODES.VALIDATION_ERROR,
      error: "Thiếu club id.",
      readModel: null,
    };
  }

  const v2Enabled =
    options.v2Enabled != null ? Boolean(options.v2Enabled) : isClubStorageV2Enabled();

  let profileByUserId = options.profileByUserId || null;
  let deniedCrossTenantIds = [];

  if (options.hydrateProfiles !== false && !profileByUserId) {
    const hydrated = await hydrateGovernanceDisplayProfiles(
      collectGovernanceUserIds(club),
      { expectedTenantId: club.tenantId || club.venueId || null }
    );
    profileByUserId = hydrated.profileByUserId;
    deniedCrossTenantIds = hydrated.deniedCrossTenantIds;
  }

  const readModel = toGovernanceReadModel({
    club,
    profileByUserId,
    membershipByUserId: options.membershipByUserId || null,
    v2Enabled,
    // Explicitly ignored under V2 — callers may pass for regression tests.
    legacyBlobRoles: options.legacyBlobRoles || null,
  });

  return {
    ok: true,
    clubId: club.id,
    version: readModel.club_version,
    readModel,
    provider: readModel.source?.provider || null,
    deniedCrossTenantIds,
  };
}

/**
 * Canonical governance reader — freeze name governance.get + normalized read model.
 *
 * @param {string} clubId
 * @param {{
 *   club?: object|null,
 *   hydrateProfiles?: boolean,
 *   membershipByUserId?: object|null,
 * }} [options]
 */
export async function readClubGovernance(clubId, options = {}) {
  const id = String(clubId || "").trim();
  if (!id) {
    return {
      ok: false,
      code: API_ERROR_CODES.VALIDATION_ERROR,
      error: "Thiếu club id.",
      readModel: null,
    };
  }

  const v2Enabled = isClubStorageV2Enabled();
  let club = options.club || null;

  if (!club) {
    if (v2Enabled) {
      const rpc = await rpcV2ClubGet(id);
      if (!rpc.ok) {
        return {
          ok: false,
          code: rpc.code || API_ERROR_CODES.INTERNAL_ERROR,
          error: rpc.error || "Không tải được quản trị CLB.",
          readModel: null,
        };
      }
      club = rpc.club;
    } else {
      const port = await governanceGet(id, options);
      if (!port.ok) {
        return { ...port, readModel: null };
      }
      // Legacy OFF path: fabricate a minimal club shell from port refs.
      club = {
        id,
        version: port.version,
        governance: port.governance,
        source: "legacy-registry",
        tenantId: options.club?.tenantId || null,
      };
    }
  }

  return buildGovernanceReadModelFromClub(club, {
    hydrateProfiles: options.hydrateProfiles,
    membershipByUserId: options.membershipByUserId,
    profileByUserId: options.profileByUserId,
    v2Enabled,
    legacyBlobRoles: options.legacyBlobRoles,
  });
}

/**
 * Invalidate / refresh after mutation or VERSION_CONFLICT.
 * Always refetch — never keep pre-mutation officers on conflict/success.
 *
 * @param {string} clubId
 * @param {{ previousVersion?: number|null, mutationResult?: object|null }} [options]
 */
export async function refreshClubGovernanceReadModel(clubId, options = {}) {
  const mutation = options.mutationResult || null;
  const action = resolveGovernanceRefreshAction({
    ok: mutation?.ok,
    code: mutation?.code || mutation?.serverCode,
    version: mutation?.version,
    previousVersion: options.previousVersion,
  });

  if (mutation && !action.refresh && mutation.ok === false) {
    return {
      ok: false,
      code: mutation.code || API_ERROR_CODES.INTERNAL_ERROR,
      error: mutation.error || "Không làm mới được quản trị CLB.",
      readModel: null,
      refreshed: false,
      refreshReason: null,
    };
  }

  const next = await readClubGovernance(clubId, {
    hydrateProfiles: options.hydrateProfiles !== false,
    membershipByUserId: options.membershipByUserId,
  });

  return {
    ...next,
    refreshed: true,
    refreshReason: action.reason || "EXPLICIT_REFRESH",
  };
}

export {
  GOVERNANCE_READ_STATE,
  toGovernanceReadSnapshot,
  shouldRefetchGovernanceOnConflict,
  resolveGovernanceRefreshAction,
};
