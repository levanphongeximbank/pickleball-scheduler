import { RULE_SET_ID } from "../../../constants/scoringStrategy.js";
import { applySideOutScoringEvent } from "../../sideOutScoringEngine.js";

/** Side-out doubles — wraps existing production engine (behavior frozen). */
export const sideOutDoublesStrategy = {
  id: RULE_SET_ID.SIDE_OUT_DOUBLES_V1,

  applyRallyResult(state, winningTeamId, config) {
    return applySideOutScoringEvent(state, winningTeamId, config);
  },
};
