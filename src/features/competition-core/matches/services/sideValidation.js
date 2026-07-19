/**
 * Phase 3F — side structural validation helpers.
 */

import { MATCH_SIDE_KEY } from "../enums/matchSideKeys.js";
import { MATCH_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { MatchRuntimeError } from "../errors/MatchRuntimeError.js";

/**
 * @param {import('../contracts/competitionMatch.js').MatchSide[]} sides
 * @param {{ allowSingleSide?: boolean }} [options]
 */
export function assertMatchSidesValid(sides, options = {}) {
  const list = Array.isArray(sides) ? sides : [];
  if (list.length === 0) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_SIDE_REQUIRED,
      "At least one match side is required",
      {}
    );
  }
  if (options.allowSingleSide !== true && list.length < 2) {
    throw new MatchRuntimeError(
      MATCH_RUNTIME_ERROR_CODE.MATCH_SIDE_REQUIRED,
      "Match requires two sides",
      { sideCount: list.length }
    );
  }

  const seenKeys = new Set();
  const seenTeams = new Set();
  const seenParticipants = new Set();

  for (const side of list) {
    const sideKey = String(side?.sideKey || "").trim().toUpperCase();
    if (!sideKey || (sideKey !== MATCH_SIDE_KEY.A && sideKey !== MATCH_SIDE_KEY.B)) {
      throw new MatchRuntimeError(
        MATCH_RUNTIME_ERROR_CODE.MATCH_INVALID_INPUT,
        "Match sideKey must be A or B",
        { sideKey }
      );
    }
    if (seenKeys.has(sideKey)) {
      throw new MatchRuntimeError(
        MATCH_RUNTIME_ERROR_CODE.MATCH_SIDE_DUPLICATE,
        "Duplicate match sideKey",
        { sideKey }
      );
    }
    seenKeys.add(sideKey);

    if (side?.teamReference) {
      const team = String(side.teamReference);
      if (seenTeams.has(team)) {
        throw new MatchRuntimeError(
          MATCH_RUNTIME_ERROR_CODE.MATCH_TEAM_DUPLICATE,
          "Duplicate teamReference across sides",
          { teamReference: team }
        );
      }
      seenTeams.add(team);
    }

    for (const person of side?.participantReferences || []) {
      const token = `${person.kind}:${person.id}`;
      if (seenParticipants.has(token)) {
        throw new MatchRuntimeError(
          MATCH_RUNTIME_ERROR_CODE.MATCH_PARTICIPANT_DUPLICATE,
          "Duplicate participant across sides",
          { participant: token }
        );
      }
      seenParticipants.add(token);
    }
  }
}
