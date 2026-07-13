import { RULE_SET_ID } from "../../../constants/scoringStrategy.js";
import { applySinglesSideOutEvent } from "../../singlesScoringEngine.js";

/** Side-out singles — wraps existing production engine. */
export const sideOutSinglesStrategy = {
  id: RULE_SET_ID.SIDE_OUT_SINGLES_V1,

  applyRallyResult(state, winningTeamId, config) {
    return applySinglesSideOutEvent(state, winningTeamId, config);
  },
};
