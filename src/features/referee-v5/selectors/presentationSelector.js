import { MATCH_TYPE } from "../constants/matchTypes.js";
import { SCORING_FORMAT } from "../constants/scoringFormats.js";
import {
  RULE_SET_ID,
  SCORING_SYSTEM,
  SCORING_VARIANT,
} from "../constants/scoringStrategy.js";
import { formatSideOutScoreLine } from "./scoreboardSelector.js";

/**
 * Presentation-only profile detection from persisted match state.
 * Does not calculate rally rules — reads format fields only.
 */
export function isUsap2026ProvisionalRallyDoubles(state) {
  if (!state || state.matchType !== MATCH_TYPE.DOUBLES) {
    return false;
  }
  if (state.ruleSetId === RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1) {
    return true;
  }
  return (
    state.scoringSystem === SCORING_SYSTEM.RALLY &&
    state.scoringVariant === SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY
  );
}

/**
 * View-model hints for Referee V5 UI — derived from official match state only.
 */
export function buildPresentationModel(state) {
  const teamA = state.teams.teamA.score;
  const teamB = state.teams.teamB.score;

  if (isUsap2026ProvisionalRallyDoubles(state)) {
    return {
      scoringSystem: SCORING_SYSTEM.RALLY,
      scoringVariant: SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY,
      scoringLabel: "Doubles / USAP Rally Scoring",
      showServerNumber: false,
      scoreLine: `${teamA} – ${teamB}`,
      scoreLineMode: "usap_rally_doubles",
    };
  }

  if (state.matchType === MATCH_TYPE.SINGLES) {
    return {
      scoringSystem: state.scoringSystem || SCORING_SYSTEM.SIDE_OUT,
      scoringVariant: state.scoringVariant || SCORING_VARIANT.SIDE_OUT_SINGLES_V1,
      scoringLabel: "Singles / Side-out",
      showServerNumber: false,
      scoreLine: `${teamA} – ${teamB}`,
      scoreLineMode: "side_out_singles",
    };
  }

  if (state.scoringFormat === SCORING_FORMAT.RALLY) {
    return {
      scoringSystem: state.scoringSystem || SCORING_SYSTEM.RALLY,
      scoringVariant: state.scoringVariant || null,
      scoringLabel: "Doubles / Basic rally",
      showServerNumber: true,
      scoreLine: formatSideOutScoreLine(state),
      scoreLineMode: "legacy_rally_doubles",
    };
  }

  return {
    scoringSystem: state.scoringSystem || SCORING_SYSTEM.SIDE_OUT,
    scoringVariant: state.scoringVariant || SCORING_VARIANT.SIDE_OUT_DOUBLES_V1,
    scoringLabel: "Doubles / Side-out",
    showServerNumber: true,
    scoreLine: formatSideOutScoreLine(state),
    scoreLineMode: "side_out_doubles",
  };
}
