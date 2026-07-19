/**
 * Core-02 Daily Play invariant — players may map to CompetitionParticipant,
 * but no CompetitionEntry is created by default.
 */

import { PARTICIPANT_REFERENCE_KIND } from "../enums/identityKinds.js";
import { COMPETITION_PARTICIPANT_STATUS } from "../enums/statuses.js";
import { PARTICIPANT_ERROR_CODE } from "../errors/errorCodes.js";
import {
  createCompetitionParticipant,
  createParticipantReference,
  createFormatExtension,
} from "../contracts/index.js";
import { validateCompetitionParticipant } from "../validators/index.js";
import {
  validationError,
  validationFail,
  validationOk,
} from "../results/validationResult.js";

/**
 * @param {unknown} source
 * @param {Record<string, unknown>} [context]
 * @returns {{
 *   success: boolean,
 *   participant: ReturnType<typeof createCompetitionParticipant>|null,
 *   entry: null,
 *   createdCompetitionEntry: false,
 *   validation: import('../results/validationResult.js').ParticipantValidationResult,
 * }}
 */
export function mapDailyPlayPlayerWithoutEntry(source, context = {}) {
  if (!source || typeof source !== "object" || !source.id) {
    return {
      success: false,
      participant: null,
      entry: null,
      createdCompetitionEntry: false,
      validation: validationFail([
        validationError(
          PARTICIPANT_ERROR_CODE.REQUIRED,
          "id",
          "Daily player id required"
        ),
      ]),
    };
  }

  const player = /** @type {Record<string, unknown>} */ (source);
  const competitionId = String(
    context.competitionId ||
      context.tournamentId ||
      context.sessionId ||
      player.competitionId ||
      player.tournamentId ||
      player.sessionId ||
      ""
  ).trim();

  const isGuest =
    player.isGuest === true ||
    player.isWalkIn === true ||
    String(player.playerType || "").toLowerCase() === "guest";

  const person = createParticipantReference({
    kind: isGuest ? PARTICIPANT_REFERENCE_KIND.GUEST : PARTICIPANT_REFERENCE_KIND.PLAYER_PROFILE,
    id: String(player.id),
    displayNameSnapshot: player.name || player.displayName || null,
    sourceSystem: "daily-play",
  });

  const participant = createCompetitionParticipant({
    id: `cp:daily:${competitionId}:${player.id}`,
    competitionId,
    person,
    status: COMPETITION_PARTICIPANT_STATUS.ACTIVE,
    displayName: player.name || player.displayName || null,
    extensions: createFormatExtension({
      formatKey: "daily-play",
      payload: {
        notCompetitionEntry: true,
        sessionScoped: true,
      },
    }),
  });

  const validation = validateCompetitionParticipant(participant);
  return {
    success: validation.valid && isNonEmptyCompetitionId(competitionId),
    participant: validation.valid ? participant : null,
    entry: null,
    createdCompetitionEntry: false,
    validation: validation.valid
      ? isNonEmptyCompetitionId(competitionId)
        ? validationOk()
        : validationFail([
            validationError(
              PARTICIPANT_ERROR_CODE.MISSING_COMPETITION_ID,
              "competitionId",
              "Daily participant requires session/competition scope"
            ),
          ])
      : validation,
  };
}

/**
 * Prove the Daily adapter contract never yields an Entry by default.
 * @param {unknown[]} players
 * @param {Record<string, unknown>} [context]
 */
export function assertDailyPlayMapsWithoutEntries(players = [], context = {}) {
  const mapped = (Array.isArray(players) ? players : []).map((p) =>
    mapDailyPlayPlayerWithoutEntry(p, context)
  );
  const anyEntry = mapped.some((m) => m.entry != null || m.createdCompetitionEntry === true);
  if (anyEntry) {
    return validationFail([
      validationError(
        PARTICIPANT_ERROR_CODE.INVALID_TYPE,
        "entry",
        "Daily Play must not create CompetitionEntry by default"
      ),
    ]);
  }
  return validationOk();
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isNonEmptyCompetitionId(value) {
  return typeof value === "string" && value.trim().length > 0;
}
