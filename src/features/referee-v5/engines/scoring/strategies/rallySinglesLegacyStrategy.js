import { RULE_SET_ID } from "../../../constants/scoringStrategy.js";
import { applySinglesRallyEvent } from "../../singlesScoringEngine.js";

/** Legacy rally singles — delegates to existing singles rally path. */
export const rallySinglesLegacyStrategy = {
  id: RULE_SET_ID.RALLY_SINGLES_LEGACY_V1,

  applyRallyResult(state, winningTeamId, config) {
    return applySinglesRallyEvent(state, winningTeamId, config);
  },
};
