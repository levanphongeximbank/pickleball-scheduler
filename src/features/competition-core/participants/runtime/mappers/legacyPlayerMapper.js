/**
 * Phase 3B — Legacy player → CompetitionParticipant mapper.
 * Pure map only. Does not mutate source. Not Production SSOT.
 */

import { createCompetitionParticipant } from "../../contracts/competitionParticipant.js";
import {
  createParticipantReference,
  createParticipantIdentity,
  buildParticipantIdentityKey,
} from "../../contracts/identity.js";
import { PARTICIPANT_REFERENCE_KIND } from "../../enums/identityKinds.js";
import { COMPETITION_PARTICIPANT_STATUS } from "../../enums/statuses.js";
import { cloneJsonSafe } from "../../contracts/shared.js";
import { PARTICIPANT_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { ParticipantRuntimeError } from "../errors/ParticipantRuntimeError.js";

export const LEGACY_PLAYER_SOURCE_TYPE = "LEGACY_PLAYER";

/**
 * @param {unknown} source
 * @returns {boolean}
 */
export function isLegacyPlayerSource(source) {
  if (!source || typeof source !== "object") return false;
  const s = /** @type {Record<string, unknown>} */ (source);
  if (s.__sourceType === LEGACY_PLAYER_SOURCE_TYPE) return true;
  if (s.id == null && s.playerId == null) return false;
  // Accept common legacy player-like shapes; reject obvious non-players.
  if (s.entryRole != null && s.participantIds != null) return false;
  return true;
}

/**
 * Infer reference kind without mutating source.
 * @param {Record<string, unknown>} source
 * @returns {string}
 */
export function inferLegacyPersonKind(source) {
  if (
    source.playerType === "guest" ||
    source.isGuest === true ||
    source.kind === PARTICIPANT_REFERENCE_KIND.GUEST
  ) {
    return PARTICIPANT_REFERENCE_KIND.GUEST;
  }
  if (source.kind === PARTICIPANT_REFERENCE_KIND.ATHLETE || source.athleteId) {
    return PARTICIPANT_REFERENCE_KIND.ATHLETE;
  }
  if (
    source.kind === PARTICIPANT_REFERENCE_KIND.PLATFORM_USER ||
    source.platformUserId
  ) {
    return PARTICIPANT_REFERENCE_KIND.PLATFORM_USER;
  }
  if (
    source.kind === PARTICIPANT_REFERENCE_KIND.CLUB_MEMBER ||
    source.clubMemberId
  ) {
    return PARTICIPANT_REFERENCE_KIND.CLUB_MEMBER;
  }
  if (source.kind === PARTICIPANT_REFERENCE_KIND.EXTERNAL || source.externalKey) {
    return PARTICIPANT_REFERENCE_KIND.EXTERNAL;
  }
  return PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE;
}

/**
 * @param {unknown} source
 * @param {{ competitionId?: string }} [context]
 * @returns {import('../../contracts/competitionParticipant.js').CompetitionParticipant}
 */
export function mapLegacyPlayerToCompetitionParticipant(source, context = {}) {
  if (!source || typeof source !== "object") {
    throw new ParticipantRuntimeError(
      PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_MAPPING,
      "Legacy player source must be an object",
      { sourceType: LEGACY_PLAYER_SOURCE_TYPE }
    );
  }

  // Never mutate caller object — work from a JSON-safe clone of primitives we need.
  const raw = /** @type {Record<string, unknown>} */ (source);
  let snapshot;
  try {
    snapshot = /** @type {Record<string, unknown>} */ (
      cloneJsonSafe({
        id: raw.id,
        playerId: raw.playerId,
        athleteId: raw.athleteId,
        platformUserId: raw.platformUserId,
        clubMemberId: raw.clubMemberId,
        name: raw.name,
        displayName: raw.displayName,
        playerType: raw.playerType,
        isGuest: raw.isGuest,
        kind: raw.kind,
        competitionId: raw.competitionId,
        tournamentId: raw.tournamentId,
        status: raw.status,
        externalKey: raw.externalKey,
      })
    );
  } catch {
    throw new ParticipantRuntimeError(
      PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_MAPPING,
      "Legacy player source is not JSON-safe",
      { sourceType: LEGACY_PLAYER_SOURCE_TYPE }
    );
  }

  const personId = String(
    snapshot.id ||
      snapshot.playerId ||
      snapshot.athleteId ||
      snapshot.platformUserId ||
      snapshot.clubMemberId ||
      ""
  ).trim();

  if (!personId) {
    throw new ParticipantRuntimeError(
      PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_MAPPING,
      "Legacy player source missing id",
      { sourceType: LEGACY_PLAYER_SOURCE_TYPE }
    );
  }

  const competitionId = String(
    context.competitionId || snapshot.competitionId || snapshot.tournamentId || ""
  ).trim();

  if (!competitionId) {
    throw new ParticipantRuntimeError(
      PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_MAPPING,
      "competitionId required for legacy player mapping",
      { sourceType: LEGACY_PLAYER_SOURCE_TYPE, personId }
    );
  }

  const kind = inferLegacyPersonKind(snapshot);
  const displayName =
    (typeof snapshot.displayName === "string" && snapshot.displayName) ||
    (typeof snapshot.name === "string" && snapshot.name) ||
    null;

  const identity = createParticipantIdentity({
    competitionId,
    kind,
    id: personId,
  });

  const participantId = `cp:${identity.key}`;

  return createCompetitionParticipant({
    id: participantId,
    competitionId,
    displayName,
    person: createParticipantReference({
      kind,
      id: personId,
      displayNameSnapshot: displayName,
      sourceSystem: "legacy",
    }),
    status:
      typeof snapshot.status === "string" && snapshot.status
        ? snapshot.status
        : COMPETITION_PARTICIPANT_STATUS.ACTIVE,
    extensions: {
      formatKey: "legacy",
      payload: {
        identityKey: identity.key,
        mappedFrom: LEGACY_PLAYER_SOURCE_TYPE,
        sourceFingerprint: buildParticipantIdentityKey({
          competitionId,
          kind,
          id: personId,
        }),
      },
    },
  });
}
