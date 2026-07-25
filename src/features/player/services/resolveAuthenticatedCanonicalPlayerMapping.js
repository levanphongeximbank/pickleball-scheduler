/**
 * PM-ID-01 — Authenticated canonical principal→player mapping resolver.
 *
 * resolveAuthenticatedCanonicalPlayerMapping({ tenantId, clubId })
 *
 * Identity comes from the authenticated session only.
 * Callers must NOT supply principalId / authUserId / playerId as identity.
 */

import {
  PLAYER_IDENTITY_MAPPING_SOURCE,
  PLAYER_IDENTITY_MAPPING_STATUS,
  PLAYER_IDENTITY_REASON_CODE,
  PLAYER_IDENTITY_LINK_LIFECYCLE,
} from "../constants/identityMapping.js";
import {
  buildPlayerIdentityMappingResult,
  validatePlayerIdentityMappingResult,
} from "../models/identityMappingResult.js";
import { mapIdentityMappingError } from "./mapIdentityMappingError.js";
import { trimId } from "../utils/playerId.js";

/**
 * Lazy session bridge — avoids hard import of auth/supabase at module load
 * so unit tests can inject getSessionUserId without Identity internals.
 * @returns {Promise<string|null>}
 */
async function readSessionUserId() {
  const { getCurrentUser } = await import("../../../auth/authService.js");
  return trimId(getCurrentUser()?.id) || null;
}

const FORBIDDEN_IDENTITY_KEYS = Object.freeze([
  "principalId",
  "principal_id",
  "authUserId",
  "auth_user_id",
  "userId",
  "user_id",
  "playerId",
  "player_id",
]);

/**
 * Pure evaluate from repository scope snapshot (deterministic; no first-row guess).
 * @param {object} params
 */
export function evaluatePlayerIdentityMappingScope({
  tenantId,
  clubId,
  principalId,
  clubBelongsToTenant,
  membershipActive,
  links,
}) {
  if (!principalId) {
    return buildPlayerIdentityMappingResult({
      status: PLAYER_IDENTITY_MAPPING_STATUS.INVALID,
      tenantId,
      clubId,
      reasonCode: PLAYER_IDENTITY_REASON_CODE.UNAUTHENTICATED,
    });
  }

  if (!tenantId || !clubId) {
    return buildPlayerIdentityMappingResult({
      status: PLAYER_IDENTITY_MAPPING_STATUS.INVALID,
      tenantId,
      clubId,
      reasonCode: PLAYER_IDENTITY_REASON_CODE.SCOPE_REQUIRED,
    });
  }

  if (!clubBelongsToTenant) {
    return buildPlayerIdentityMappingResult({
      status: PLAYER_IDENTITY_MAPPING_STATUS.INVALID,
      tenantId,
      clubId,
      source: PLAYER_IDENTITY_MAPPING_SOURCE.PLAYER_IDENTITY_LINKS,
      reasonCode: PLAYER_IDENTITY_REASON_CODE.TENANT_CLUB_MISMATCH,
    });
  }

  const list = Array.isArray(links) ? links : [];
  const active = list.filter((l) => String(l.status) === PLAYER_IDENTITY_LINK_LIFECYCLE.ACTIVE);
  const revoked = list.filter((l) => String(l.status) === PLAYER_IDENTITY_LINK_LIFECYCLE.REVOKED);

  if (active.length > 1) {
    return buildPlayerIdentityMappingResult({
      status: PLAYER_IDENTITY_MAPPING_STATUS.AMBIGUOUS,
      tenantId,
      clubId,
      source: PLAYER_IDENTITY_MAPPING_SOURCE.PLAYER_IDENTITY_LINKS,
      reasonCode: PLAYER_IDENTITY_REASON_CODE.MULTIPLE_ACTIVE_LINKS,
    });
  }

  if (active.length === 1) {
    const playerId = trimId(active[0].playerId);
    if (!playerId) {
      return buildPlayerIdentityMappingResult({
        status: PLAYER_IDENTITY_MAPPING_STATUS.INVALID,
        tenantId,
        clubId,
        source: PLAYER_IDENTITY_MAPPING_SOURCE.PLAYER_IDENTITY_LINKS,
        reasonCode: PLAYER_IDENTITY_REASON_CODE.MALFORMED_PLAYER_ID,
      });
    }
    if (!membershipActive) {
      return buildPlayerIdentityMappingResult({
        status: PLAYER_IDENTITY_MAPPING_STATUS.INACTIVE,
        tenantId,
        clubId,
        source: PLAYER_IDENTITY_MAPPING_SOURCE.PLAYER_IDENTITY_LINKS,
        reasonCode: PLAYER_IDENTITY_REASON_CODE.MEMBERSHIP_INACTIVE,
      });
    }
    return buildPlayerIdentityMappingResult({
      status: PLAYER_IDENTITY_MAPPING_STATUS.MAPPED,
      playerId,
      tenantId,
      clubId,
      source: PLAYER_IDENTITY_MAPPING_SOURCE.PLAYER_IDENTITY_LINKS,
      reasonCode: PLAYER_IDENTITY_REASON_CODE.OK,
    });
  }

  if (revoked.length > 0) {
    return buildPlayerIdentityMappingResult({
      status: PLAYER_IDENTITY_MAPPING_STATUS.INACTIVE,
      tenantId,
      clubId,
      source: PLAYER_IDENTITY_MAPPING_SOURCE.PLAYER_IDENTITY_LINKS,
      reasonCode: PLAYER_IDENTITY_REASON_CODE.LINK_REVOKED,
    });
  }

  return buildPlayerIdentityMappingResult({
    status: PLAYER_IDENTITY_MAPPING_STATUS.UNMAPPED,
    tenantId,
    clubId,
    source: PLAYER_IDENTITY_MAPPING_SOURCE.PLAYER_IDENTITY_LINKS,
    reasonCode: PLAYER_IDENTITY_REASON_CODE.NO_LINK,
  });
}

/**
 * @param {object} [input]
 * @param {string} [input.tenantId]
 * @param {string} [input.clubId]
 * @param {import("../repositories/playerIdentityLinkRepository.js").PlayerIdentityLinkRepository} [input.repository]
 * @param {{ rpcResolve?: Function }} [input.adapter]
 * @param {() => string|null} [input.getSessionUserId]
 */
export async function resolveAuthenticatedCanonicalPlayerMapping(input = {}) {
  for (const key of FORBIDDEN_IDENTITY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(input, key) && input[key] != null && input[key] !== "") {
      return buildPlayerIdentityMappingResult({
        status: PLAYER_IDENTITY_MAPPING_STATUS.INVALID,
        tenantId: trimId(input.tenantId) || null,
        clubId: trimId(input.clubId) || null,
        reasonCode: PLAYER_IDENTITY_REASON_CODE.CALLER_PRINCIPAL_FORBIDDEN,
      });
    }
  }

  const tenantId = trimId(input.tenantId) || null;
  const clubId = trimId(input.clubId) || null;

  const principalId =
    typeof input.getSessionUserId === "function"
      ? trimId(input.getSessionUserId()) || null
      : trimId(await readSessionUserId()) || null;

  if (!principalId) {
    return buildPlayerIdentityMappingResult({
      status: PLAYER_IDENTITY_MAPPING_STATUS.INVALID,
      tenantId,
      clubId,
      reasonCode: PLAYER_IDENTITY_REASON_CODE.UNAUTHENTICATED,
    });
  }

  if (!tenantId || !clubId) {
    return buildPlayerIdentityMappingResult({
      status: PLAYER_IDENTITY_MAPPING_STATUS.INVALID,
      tenantId,
      clubId,
      reasonCode: PLAYER_IDENTITY_REASON_CODE.SCOPE_REQUIRED,
    });
  }

  try {
    if (input.adapter && typeof input.adapter.rpcResolve === "function") {
      const rpcResult = await input.adapter.rpcResolve({ tenantId, clubId });
      const validated = validatePlayerIdentityMappingResult(rpcResult);
      if (!validated.ok) {
        return buildPlayerIdentityMappingResult({
          status: PLAYER_IDENTITY_MAPPING_STATUS.INVALID,
          tenantId,
          clubId,
          reasonCode: PLAYER_IDENTITY_REASON_CODE.INVALID_RESULT,
        });
      }
      return validated.value;
    }

    if (!input.repository || typeof input.repository.resolveScope !== "function") {
      return buildPlayerIdentityMappingResult({
        status: PLAYER_IDENTITY_MAPPING_STATUS.INVALID,
        tenantId,
        clubId,
        reasonCode: PLAYER_IDENTITY_REASON_CODE.REPOSITORY_ERROR,
      });
    }

    const scope = await input.repository.resolveScope({
      tenantId,
      clubId,
      principalId,
    });

    const result = evaluatePlayerIdentityMappingScope({
      tenantId,
      clubId,
      principalId,
      clubBelongsToTenant: Boolean(scope.clubBelongsToTenant),
      membershipActive: Boolean(scope.membershipActive),
      links: scope.links,
    });

    const validated = validatePlayerIdentityMappingResult(result);
    if (!validated.ok) {
      return buildPlayerIdentityMappingResult({
        status: PLAYER_IDENTITY_MAPPING_STATUS.INVALID,
        tenantId,
        clubId,
        reasonCode: PLAYER_IDENTITY_REASON_CODE.INVALID_RESULT,
      });
    }
    return validated.value;
  } catch (error) {
    return mapIdentityMappingError(error, { tenantId, clubId });
  }
}
