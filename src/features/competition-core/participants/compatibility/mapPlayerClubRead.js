/**
 * Core-02 read-map adapters for Player Management and Club scope.
 * Must not import write services, repositories, or UI modules.
 */

import { PARTICIPANT_REFERENCE_KIND } from "../enums/identityKinds.js";
import { createParticipantReference } from "../contracts/identity.js";
import { createEntryTenantScope } from "../contracts/tenantScope.js";
import { PARTICIPANT_ERROR_CODE } from "../errors/errorCodes.js";
import {
  validationError,
  validationFail,
  validationOk,
} from "../results/validationResult.js";

/**
 * Map a Player Management–like profile object to ParticipantReference (read-only).
 * @param {unknown} source
 * @returns {{
 *   success: boolean,
 *   reference: ReturnType<typeof createParticipantReference>|null,
 *   validation: import('../results/validationResult.js').ParticipantValidationResult,
 * }}
 */
export function mapPlayerProfileToParticipantReference(source) {
  if (!source || typeof source !== "object") {
    return {
      success: false,
      reference: null,
      validation: validationFail([
        validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "Player profile must be an object"),
      ]),
    };
  }

  const profile = /** @type {Record<string, unknown>} */ (source);
  const id = String(
    profile.player_id || profile.playerId || profile.id || ""
  ).trim();
  if (!id) {
    return {
      success: false,
      reference: null,
      validation: validationFail([
        validationError(PARTICIPANT_ERROR_CODE.REQUIRED, "player_id", "player_id required"),
      ]),
    };
  }

  const reference = createParticipantReference({
    kind: PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
    id,
    displayNameSnapshot: profile.displayName || profile.name || null,
    sourceSystem: "player-management-read",
    aliases: Array.isArray(profile.aliases)
      ? profile.aliases.map((a) => String(a))
      : [],
  });

  return { success: true, reference, validation: validationOk() };
}

/**
 * Map club ownership hints to EntryTenantScope (read-only).
 * Never invents a default tenant when scope is missing.
 * @param {unknown} source
 */
export function mapClubScopeToEntryTenantScope(source) {
  if (!source || typeof source !== "object") {
    return {
      success: false,
      tenantScope: null,
      validation: validationFail([
        validationError(PARTICIPANT_ERROR_CODE.INVALID_TYPE, "", "Club scope must be an object"),
      ]),
    };
  }

  const club = /** @type {Record<string, unknown>} */ (source);
  const tenantScope = createEntryTenantScope({
    tenantId: club.tenantId || null,
    clubId: club.clubId || club.id || null,
    organizationId: club.organizationId || null,
  });

  if (!tenantScope) {
    return {
      success: false,
      tenantScope: null,
      validation: validationFail([
        validationError(
          PARTICIPANT_ERROR_CODE.TENANT_SCOPE_MISSING,
          "tenantScope",
          "Missing club/tenant scope must not fall back to a default tenant"
        ),
      ]),
    };
  }

  return { success: true, tenantScope, validation: validationOk() };
}
