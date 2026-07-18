/**
 * Phase 3D — participant reference helpers for team/roster mapping.
 * Participant Runtime is DI-only — never imported here.
 */

import { createParticipantReference } from "../../participants/contracts/identity.js";
import { PARTICIPANT_REFERENCE_KIND } from "../../participants/enums/identityKinds.js";
import { TEAM_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { TeamRuntimeError } from "../errors/TeamRuntimeError.js";

/**
 * @param {unknown} player
 * @param {string} playerId
 * @returns {import('../../participants/contracts/identity.js').ParticipantReference}
 */
export function resolvePersonReferenceFromPlayer(player, playerId) {
  const id = String(playerId || player?.id || "").trim();
  if (!id) {
    throw new TeamRuntimeError(
      TEAM_RUNTIME_ERROR_CODE.MISSING_PARTICIPANT_REF,
      "Player id required for participant reference",
      {}
    );
  }
  const isGuest =
    player?.isGuest === true ||
    player?.playerType === "guest" ||
    String(player?.kind || "").toUpperCase() === "GUEST";

  return createParticipantReference({
    kind: isGuest
      ? PARTICIPANT_REFERENCE_KIND.GUEST
      : PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
    id,
    displayNameSnapshot:
      typeof player?.name === "string"
        ? player.name
        : typeof player?.displayName === "string"
          ? player.displayName
          : null,
  });
}

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {import('../../participants/contracts/identity.js').ParticipantReference[]}
 */
export function buildMemberRefsFromContext(source, context = {}) {
  if (Array.isArray(context.memberRefs) && context.memberRefs.length > 0) {
    return context.memberRefs.map((r) => createParticipantReference(r || {}));
  }

  const raw = source && typeof source === "object" ? source : {};
  const playerIds = Array.isArray(raw.playerIds) ? raw.playerIds : [];
  const playerById =
    context.playerById && typeof context.playerById === "object"
      ? context.playerById
      : {};

  return playerIds
    .map((id) => String(id || "").trim())
    .filter(Boolean)
    .map((id) => resolvePersonReferenceFromPlayer(playerById[id] || { id }, id));
}

/**
 * Optional DI: resolve each playerId via injected resolveParticipant.
 * @param {unknown} source
 * @param {Record<string, unknown>} context
 * @param {Function} resolveParticipant
 * @returns {Promise<import('../../participants/contracts/identity.js').ParticipantReference[]>}
 */
export async function resolveMemberRefsWithDependency(
  source,
  context,
  resolveParticipant
) {
  const raw = source && typeof source === "object" ? source : {};
  const playerIds = Array.isArray(raw.playerIds) ? raw.playerIds : [];
  const playerById =
    context.playerById && typeof context.playerById === "object"
      ? context.playerById
      : {};
  const refs = [];

  for (const id of playerIds) {
    const playerId = String(id || "").trim();
    if (!playerId) continue;
    const player = playerById[playerId] || { id: playerId };
    const result = await resolveParticipant(player, {
      competitionId: context.competitionId,
    });
    if (!result || result.ok === false) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT_REFERENCE,
        "Injected participant resolve failed",
        { playerId, error: result?.error || null }
      );
    }
    const person = result.participant?.person || result.person;
    if (!person?.id || !person?.kind) {
      throw new TeamRuntimeError(
        TEAM_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT_REFERENCE,
        "Injected participant missing person reference",
        { playerId }
      );
    }
    refs.push(createParticipantReference(person));
  }

  return refs;
}
