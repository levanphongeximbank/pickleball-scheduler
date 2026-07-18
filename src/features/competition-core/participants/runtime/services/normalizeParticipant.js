/**
 * Phase 3B — normalize + validate CompetitionParticipant for resolve path.
 */

import { validateCompetitionParticipant } from "../../validators/index.js";
import { identityFromCompetitionParticipant } from "../../contracts/identity.js";
import { PARTICIPANT_REFERENCE_KIND } from "../../enums/identityKinds.js";
import { PARTICIPANT_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { ParticipantRuntimeError } from "../errors/ParticipantRuntimeError.js";

/**
 * Guest must never be dropped silently — missing guest id is a hard error.
 * @param {import('../../contracts/competitionParticipant.js').CompetitionParticipant} participant
 */
export function assertGuestPreserved(participant) {
  if (participant?.person?.kind !== PARTICIPANT_REFERENCE_KIND.GUEST) return;
  if (!participant.person.id || !String(participant.person.id).trim()) {
    throw new ParticipantRuntimeError(
      PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT,
      "Guest participant missing identity id — refuse silent loss",
      { participantId: participant.id }
    );
  }
}

/**
 * @param {unknown} participant
 * @returns {import('../../contracts/competitionParticipant.js').CompetitionParticipant}
 */
export function normalizeAndValidateParticipant(participant) {
  if (!participant || typeof participant !== "object") {
    throw new ParticipantRuntimeError(
      PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT,
      "Participant must be an object",
      {}
    );
  }

  const validation = validateCompetitionParticipant(participant);
  if (!validation.valid) {
    throw new ParticipantRuntimeError(
      PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT,
      "Participant failed validation",
      {
        errors: validation.errors.map((e) => ({
          code: e.code,
          path: e.path,
          message: e.message,
        })),
      }
    );
  }

  assertGuestPreserved(
    /** @type {import('../../contracts/competitionParticipant.js').CompetitionParticipant} */ (
      participant
    )
  );

  const identity = identityFromCompetitionParticipant(participant);
  if (!identity) {
    throw new ParticipantRuntimeError(
      PARTICIPANT_RUNTIME_ERROR_CODE.INVALID_PARTICIPANT,
      "Participant identity incomplete",
      { participantId: /** @type {{ id?: string }} */ (participant).id }
    );
  }

  return /** @type {import('../../contracts/competitionParticipant.js').CompetitionParticipant} */ (
    participant
  );
}
