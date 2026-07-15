import { RULE_SET_ID } from "../../../constants/scoringStrategy.js";
import { applyRallyScoringEvent } from "../../rallyScoringEngine.js";

/**
 * Legacy rally doubles prototype — delegates to existing engine.
 * USAP 2026 canonical strategy is R2-2; this preserves pre-R2 rally behavior only.
 */
export const rallyDoublesLegacyPrototypeStrategy = {
  id: RULE_SET_ID.RALLY_DOUBLES_LEGACY_PROTOTYPE_V1,

  applyRallyResult(state, winningTeamId, config) {
    return applyRallyScoringEvent(state, winningTeamId, config);
  },
};
