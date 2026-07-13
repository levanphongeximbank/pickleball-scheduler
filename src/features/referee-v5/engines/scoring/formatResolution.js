import { MATCH_TYPE } from "../../constants/matchTypes.js";
import { SCORING_FORMAT } from "../../constants/scoringFormats.js";
import {
  RULE_SET_ID,
  SCORING_SYSTEM,
  SCORING_VARIANT,
} from "../../constants/scoringStrategy.js";
import { ScoringFormatError } from "./scoringFormatError.js";

function isRallyScoringFormat(scoringFormat) {
  return scoringFormat === SCORING_FORMAT.RALLY || scoringFormat === "rally";
}

/**
 * Derive registry rule-set id from match state.
 * Legacy matches without scoringSystem use explicit legacy profiles (R1-C §7).
 */
export function resolveRuleSetId(state) {
  if (state.ruleSetId) {
    return String(state.ruleSetId);
  }

  if (state.scoringSystem) {
    return resolveCanonicalRuleSetId(state);
  }

  return resolveLegacyRuleSetId(state);
}

function resolveCanonicalRuleSetId(state) {
  const system = String(state.scoringSystem);
  const variant = state.scoringVariant ? String(state.scoringVariant) : null;
  const matchType = state.matchType || MATCH_TYPE.DOUBLES;

  if (system === SCORING_SYSTEM.SIDE_OUT) {
    if (matchType === MATCH_TYPE.SINGLES) {
      return RULE_SET_ID.SIDE_OUT_SINGLES_V1;
    }
    if (
      !variant ||
      variant === SCORING_VARIANT.SIDE_OUT_DOUBLES_V1
    ) {
      return RULE_SET_ID.SIDE_OUT_DOUBLES_V1;
    }
    throw new ScoringFormatError(
      "UNKNOWN_SCORING_VARIANT",
      `Unsupported side-out variant: ${variant}`
    );
  }

  if (system === SCORING_SYSTEM.RALLY) {
    if (!variant) {
      throw new ScoringFormatError(
        "SCORING_VARIANT_REQUIRED",
        "Rally matches require scoringVariant."
      );
    }
    if (variant === SCORING_VARIANT.USAP_2026_PROVISIONAL_RALLY) {
      if (matchType !== MATCH_TYPE.DOUBLES) {
        throw new ScoringFormatError(
          "UNSUPPORTED_MATCH_TYPE",
          "USAP 2026 provisional rally is doubles-only in R2."
        );
      }
      return RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1;
    }
    throw new ScoringFormatError(
      "UNKNOWN_SCORING_VARIANT",
      `Unsupported rally variant: ${variant}`
    );
  }

  throw new ScoringFormatError(
    "UNKNOWN_SCORING_SYSTEM",
    `Unsupported scoringSystem: ${system}`
  );
}

function resolveLegacyRuleSetId(state) {
  const matchType = state.matchType || MATCH_TYPE.DOUBLES;
  const rally = isRallyScoringFormat(state.scoringFormat);

  if (matchType === MATCH_TYPE.SINGLES) {
    return rally ? RULE_SET_ID.RALLY_SINGLES_LEGACY_V1 : RULE_SET_ID.SIDE_OUT_SINGLES_V1;
  }

  if (rally) {
    return RULE_SET_ID.RALLY_DOUBLES_LEGACY_PROTOTYPE_V1;
  }

  return RULE_SET_ID.SIDE_OUT_DOUBLES_V1;
}
