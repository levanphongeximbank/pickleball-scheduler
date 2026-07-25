/**
 * PM-ID-01 — Mapping result builder + validator.
 * playerId is present only when status === MAPPED.
 */

import {
  PLAYER_IDENTITY_MAPPING_SOURCE,
  PLAYER_IDENTITY_MAPPING_STATUS,
  isPlayerIdentityMappingStatus,
} from "../constants/identityMapping.js";

/**
 * @typedef {object} PlayerIdentityMappingResult
 * @property {string} status
 * @property {string|null} playerId
 * @property {string|null} tenantId
 * @property {string|null} clubId
 * @property {string|null} source
 * @property {string|null} reasonCode
 */

/**
 * @param {object} partial
 * @returns {PlayerIdentityMappingResult}
 */
export function buildPlayerIdentityMappingResult(partial = {}) {
  const status = String(partial.status || PLAYER_IDENTITY_MAPPING_STATUS.INVALID);
  const mapped = status === PLAYER_IDENTITY_MAPPING_STATUS.MAPPED;
  const playerIdRaw = partial.playerId ?? partial.player_id ?? null;
  const playerId =
    mapped && playerIdRaw != null && String(playerIdRaw).trim()
      ? String(playerIdRaw).trim()
      : null;

  return Object.freeze({
    status,
    playerId,
    tenantId:
      partial.tenantId != null || partial.tenant_id != null
        ? String(partial.tenantId ?? partial.tenant_id).trim() || null
        : null,
    clubId:
      partial.clubId != null || partial.club_id != null
        ? String(partial.clubId ?? partial.club_id).trim() || null
        : null,
    source:
      partial.source != null
        ? String(partial.source)
        : mapped
          ? PLAYER_IDENTITY_MAPPING_SOURCE.PLAYER_IDENTITY_LINKS
          : null,
    reasonCode:
      partial.reasonCode != null || partial.reason_code != null
        ? String(partial.reasonCode ?? partial.reason_code)
        : null,
  });
}

/**
 * @param {unknown} value
 * @returns {{ ok: true, value: PlayerIdentityMappingResult } | { ok: false, errors: string[] }}
 */
export function validatePlayerIdentityMappingResult(value) {
  /** @type {string[]} */
  const errors = [];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, errors: ["RESULT_NOT_OBJECT"] };
  }

  if (!isPlayerIdentityMappingStatus(value.status)) {
    errors.push("STATUS_INVALID");
  }

  const status = String(value.status || "");
  const playerId = value.playerId;

  if (status === PLAYER_IDENTITY_MAPPING_STATUS.MAPPED) {
    if (playerId == null || !String(playerId).trim()) {
      errors.push("MAPPED_REQUIRES_PLAYER_ID");
    }
  } else if (playerId != null && String(playerId).trim() !== "") {
    errors.push("NON_MAPPED_MUST_NOT_INCLUDE_PLAYER_ID");
  }

  if ("principalId" in value || "authUserId" in value || "auth_user_id" in value) {
    errors.push("RESULT_MUST_NOT_EXPOSE_CALLER_PRINCIPAL_FIELDS");
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: buildPlayerIdentityMappingResult(value) };
}
