import { DOMAIN_EVENT_TYPE } from "../constants/eventTypes.js";
import { cloneMatchState } from "../domain/matchState.js";
import { swapTeamCourtEnds } from "./courtPositionEngine.js";

/**
 * ENDS_SWITCHED — swap court ends only; preserve serve/receiver identities and scores.
 */
export function applySwitchEnds(state) {
  const beforeServer = state.servingPlayerId;
  const beforeReceiver = state.receivingPlayerId;
  const beforeServerNumber = state.serverNumber;
  const beforeScoreA = state.teams.teamA.score;
  const beforeScoreB = state.teams.teamB.score;
  const beforeSides = {
    teamA: state.teams.teamA.players.map((player) => ({ ...player })),
    teamB: state.teams.teamB.players.map((player) => ({ ...player })),
  };

  let next = swapTeamCourtEnds(cloneMatchState(state));

  if (
    String(next.servingPlayerId) !== String(beforeServer) ||
    String(next.receivingPlayerId) !== String(beforeReceiver)
  ) {
    return { ok: false, error: "ENDS_SWITCHED_CHANGED_SERVE_IDENTITIES" };
  }

  if (next.serverNumber !== beforeServerNumber) {
    return { ok: false, error: "ENDS_SWITCHED_CHANGED_SERVER_NUMBER" };
  }

  if (
    next.teams.teamA.score !== beforeScoreA ||
    next.teams.teamB.score !== beforeScoreB
  ) {
    return { ok: false, error: "ENDS_SWITCHED_CHANGED_SCORE" };
  }

  for (const side of ["teamA", "teamB"]) {
    for (let index = 0; index < next.teams[side].players.length; index += 1) {
      if (
        next.teams[side].players[index].logicalServiceSide !==
        beforeSides[side][index].logicalServiceSide
      ) {
        return { ok: false, error: "ENDS_SWITCHED_CHANGED_LOGICAL_SIDES" };
      }
    }
  }

  return {
    ok: true,
    state: next,
    generatedEvents: [DOMAIN_EVENT_TYPE.ENDS_SWITCHED],
  };
}
