/**
 * PM-ID-01 — Translate repository / adapter failures to mapping results.
 */

import { PLAYER_IDENTITY_REASON_CODE, PLAYER_IDENTITY_MAPPING_STATUS } from "../constants/identityMapping.js";
import { buildPlayerIdentityMappingResult } from "../models/identityMappingResult.js";

/**
 * @param {unknown} error
 * @param {{ tenantId?: string|null, clubId?: string|null }} [scope]
 */
export function mapIdentityMappingError(error, scope = {}) {
  const code =
    (error && typeof error === "object" && (error.code || error.reasonCode)) ||
    PLAYER_IDENTITY_REASON_CODE.REPOSITORY_ERROR;

  return buildPlayerIdentityMappingResult({
    status: PLAYER_IDENTITY_MAPPING_STATUS.INVALID,
    playerId: null,
    tenantId: scope.tenantId ?? null,
    clubId: scope.clubId ?? null,
    source: null,
    reasonCode: String(code),
  });
}
