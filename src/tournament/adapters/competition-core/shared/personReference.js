/**
 * Shared person-reference helpers for format → Core adapters.
 * Imports only Competition Core public API.
 */

import {
  PARTICIPANT_REFERENCE_KIND,
  createParticipantReference,
  createParticipantSnapshot,
} from "../../../../features/competition-core/index.js";

/**
 * @param {Record<string, unknown>|null|undefined} player
 * @param {string|null|undefined} fallbackId
 * @returns {import('../../../../features/competition-core/index.js').ParticipantReference|ReturnType<typeof createParticipantReference>}
 */
export function resolvePersonReference(player, fallbackId = null) {
  const id = String(
    (player && (player.id || player.playerId || player.athleteId)) || fallbackId || ""
  ).trim();

  if (!id) {
    return createParticipantReference({
      kind: PARTICIPANT_REFERENCE_KIND.GUEST,
      id: "",
    });
  }

  const playerType = String(player?.playerType || player?.type || "").toLowerCase();
  const isGuest = player?.isGuest === true || playerType === "guest";
  const isExternal =
    playerType === "external" || playerType === "visitor" || player?.isExternal === true;
  const athleteId = player?.athleteId ? String(player.athleteId) : null;

  let kind = PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE;
  if (isGuest) kind = PARTICIPANT_REFERENCE_KIND.GUEST;
  else if (isExternal) kind = PARTICIPANT_REFERENCE_KIND.EXTERNAL;
  else if (athleteId && String(player?.id) === athleteId) kind = PARTICIPANT_REFERENCE_KIND.ATHLETE;
  else if (playerType === "member" || player?.clubMemberId) kind = PARTICIPANT_REFERENCE_KIND.CLUB_MEMBER;

  return createParticipantReference({
    kind,
    id,
    displayNameSnapshot: player?.name || player?.displayName || null,
    sourceSystem: "pickleball-scheduler",
    externalSystem: player?.externalSystem || null,
    externalKey: player?.externalKey || null,
    snapshotMetadata: {
      playerType: playerType || null,
      gender: player?.gender ?? null,
      skill: player?.skill ?? player?.rating ?? null,
    },
  });
}

/**
 * @param {Record<string, unknown>|null|undefined} player
 * @param {Object} [opts]
 */
export function buildPlayerSnapshot(player, opts = {}) {
  if (!player || typeof player !== "object") {
    return null;
  }
  const rating =
    typeof player.rating === "number"
      ? player.rating
      : typeof player.skill === "number"
        ? player.skill
        : null;
  return createParticipantSnapshot({
    displayName: player.name || player.displayName || null,
    rating,
    eligibilityAttributes: {
      gender: player.gender ?? null,
      playerType: player.playerType ?? null,
      categoryHints: player.categoryHints ?? null,
    },
    affiliation: {
      clubId: player.clubId || opts.clubId || null,
      clubName: player.clubName || null,
      unitName: player.unitName || null,
    },
    identityReference: resolvePersonReference(player),
    snapshotAt: opts.snapshotAt || player.snapshotAt || null,
    seedLockedRating: opts.seedLocked === true ? rating : null,
    seedLocked: opts.seedLocked === true,
  });
}
