/**
 * Phase 3C — build ParticipantReference list without importing Participant Runtime.
 * Prefer injected refs / resolveParticipantRefs callback. Fallback reads only
 * explicit person-kind signals from playerById (no full participant mapping).
 */

import { createParticipantReference } from "../../participants/contracts/identity.js";
import { PARTICIPANT_REFERENCE_KIND } from "../../participants/enums/identityKinds.js";
import { REGISTRATION_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { RegistrationRuntimeError } from "../errors/RegistrationRuntimeError.js";

/**
 * @param {Record<string, unknown>} player
 * @returns {string}
 */
function inferPersonKind(player) {
  if (
    player.playerType === "guest" ||
    player.isGuest === true ||
    player.kind === PARTICIPANT_REFERENCE_KIND.GUEST
  ) {
    return PARTICIPANT_REFERENCE_KIND.GUEST;
  }
  if (
    player.playerType === "external" ||
    player.playerType === "visitor" ||
    player.isExternal === true ||
    player.kind === PARTICIPANT_REFERENCE_KIND.EXTERNAL
  ) {
    return PARTICIPANT_REFERENCE_KIND.EXTERNAL;
  }
  if (player.kind === PARTICIPANT_REFERENCE_KIND.ATHLETE || player.athleteId) {
    return PARTICIPANT_REFERENCE_KIND.ATHLETE;
  }
  if (player.kind === PARTICIPANT_REFERENCE_KIND.CLUB_MEMBER || player.clubMemberId) {
    return PARTICIPANT_REFERENCE_KIND.CLUB_MEMBER;
  }
  if (player.kind === PARTICIPANT_REFERENCE_KIND.PLATFORM_USER || player.platformUserId) {
    return PARTICIPANT_REFERENCE_KIND.PLATFORM_USER;
  }
  return PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE;
}

/**
 * @param {string[]} playerIds
 * @param {Record<string, unknown>} context
 * @returns {import('../../participants/contracts/identity.js').ParticipantReference[]}
 */
export function buildMemberRefsFromContext(playerIds, context = {}) {
  if (Array.isArray(context.memberRefs) && context.memberRefs.length > 0) {
    return context.memberRefs.map((ref) => createParticipantReference(ref || {}));
  }

  if (typeof context.resolveParticipantRefs === "function") {
    const resolved = context.resolveParticipantRefs(playerIds, context);
    if (!Array.isArray(resolved)) {
      throw new RegistrationRuntimeError(
        REGISTRATION_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT_REFERENCE,
        "resolveParticipantRefs must return an array",
        {}
      );
    }
    return resolved.map((ref) => createParticipantReference(ref || {}));
  }

  const playerById =
    context.playerById && typeof context.playerById === "object"
      ? /** @type {Record<string, Record<string, unknown>>} */ (context.playerById)
      : {};

  return playerIds.map((rawId) => {
    const id = String(rawId || "").trim();
    if (!id) {
      throw new RegistrationRuntimeError(
        REGISTRATION_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT_REFERENCE,
        "Participant reference id is required",
        {}
      );
    }
    const player = playerById[id] || { id };
    const kind = inferPersonKind(player);
    if (kind === PARTICIPANT_REFERENCE_KIND.GUEST && !String(player.id || id).trim()) {
      throw new RegistrationRuntimeError(
        REGISTRATION_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT_REFERENCE,
        "Guest participant reference requires a stable id",
        { kind }
      );
    }
    return createParticipantReference({
      kind,
      id: String(player.id || id).trim(),
      displayNameSnapshot: player.name || player.displayName || null,
      snapshotMetadata: {
        playerType: player.playerType || null,
        guest: kind === PARTICIPANT_REFERENCE_KIND.GUEST,
      },
    });
  });
}

/**
 * Optional async DI path — call injected Participant Runtime resolve without
 * importing app registry.
 *
 * @param {string[]} playerIds
 * @param {Record<string, unknown>} context
 * @param {{ resolveParticipant?: Function }} deps
 * @returns {Promise<import('../../participants/contracts/identity.js').ParticipantReference[]>}
 */
export async function resolveMemberRefsWithDependency(playerIds, context, deps = {}) {
  if (Array.isArray(context.memberRefs) && context.memberRefs.length > 0) {
    return context.memberRefs.map((ref) => createParticipantReference(ref || {}));
  }
  if (typeof context.resolveParticipantRefs === "function") {
    const resolved = await context.resolveParticipantRefs(playerIds, context);
    if (!Array.isArray(resolved)) {
      throw new RegistrationRuntimeError(
        REGISTRATION_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT_REFERENCE,
        "resolveParticipantRefs must return an array",
        {}
      );
    }
    return resolved.map((ref) => createParticipantReference(ref || {}));
  }
  if (typeof deps.resolveParticipant === "function") {
    const refs = [];
    for (const id of playerIds) {
      const result = await deps.resolveParticipant(
        { id, ...(context.playerById?.[id] || {}) },
        { competitionId: context.competitionId }
      );
      if (!result || result.ok === false) {
        throw new RegistrationRuntimeError(
          REGISTRATION_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT_REFERENCE,
          "Injected participant resolve failed",
          { playerId: id, error: result?.error || null }
        );
      }
      const person = result.participant?.person || result.person || result;
      refs.push(createParticipantReference(person));
    }
    return refs;
  }
  return buildMemberRefsFromContext(playerIds, context);
}
