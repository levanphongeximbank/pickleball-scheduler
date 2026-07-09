import { TOURNAMENT_STATUS } from "../../models/tournament/constants.js";

export const INTERVENTION_PHASE = Object.freeze({
  TOURNAMENT: "tournament",
  COURT: "court",
});

export const INTERVENTION_TYPE = Object.freeze({
  ENTRY_SWAP: "entry_swap",
  ENTRY_MOVE: "entry_move",
  ENTRY_DISSOLVE: "entry_dissolve",
  GROUP_MOVE: "group_move",
  GROUP_SWAP: "group_swap",
  COURT_SWAP_TEAMS: "court_swap_teams",
  COURT_MOVE_PLAYER: "court_move_player",
});

export const INTERVENTION_GUARD_CODE = Object.freeze({
  FORBIDDEN: "FORBIDDEN",
  TOURNAMENT_STARTED: "TOURNAMENT_STARTED",
  NOT_PREVIEW: "NOT_PREVIEW",
  INVALID_INPUT: "INVALID_INPUT",
});

const SETUP_STATUSES = new Set([
  TOURNAMENT_STATUS.DRAFT,
  TOURNAMENT_STATUS.REGISTRATION,
  TOURNAMENT_STATUS.READY,
]);

export function isTournamentSetupStatus(status) {
  return SETUP_STATUSES.has(status);
}
