import { RULE_SET_ID } from "../../constants/scoringStrategy.js";
import { resolveRuleSetId } from "./formatResolution.js";
import { ScoringFormatError } from "./scoringFormatError.js";
import { rallyDoublesLegacyPrototypeStrategy } from "./strategies/rallyDoublesLegacyPrototypeStrategy.js";
import { rallySinglesLegacyStrategy } from "./strategies/rallySinglesLegacyStrategy.js";
import { sideOutDoublesStrategy } from "./strategies/sideOutDoublesStrategy.js";
import { sideOutSinglesStrategy } from "./strategies/sideOutSinglesStrategy.js";

const registry = new Map();

function register(strategy) {
  if (!strategy?.id) {
    throw new Error("ScoringStrategy must have an id.");
  }
  registry.set(strategy.id, strategy);
}

function get(ruleSetId) {
  const strategy = registry.get(ruleSetId);
  if (!strategy) {
    throw new ScoringFormatError(
      "UNKNOWN_RULE_SET",
      `No scoring strategy registered for ruleSetId: ${ruleSetId}`
    );
  }
  return strategy;
}

function resolve(state) {
  const ruleSetId = resolveRuleSetId(state);

  if (ruleSetId === RULE_SET_ID.RALLY_USAP_2026_PROVISIONAL_DOUBLES_V1) {
    throw new ScoringFormatError(
      "RALLY_STRATEGY_NOT_IMPLEMENTED",
      "USAP 2026 provisional rally strategy is not implemented (R2-2)."
    );
  }

  return get(ruleSetId);
}

register(sideOutDoublesStrategy);
register(sideOutSinglesStrategy);
register(rallyDoublesLegacyPrototypeStrategy);
register(rallySinglesLegacyStrategy);

export const ScoringStrategyRegistry = {
  register,
  get,
  resolve,
  resolveRuleSetId,
};
