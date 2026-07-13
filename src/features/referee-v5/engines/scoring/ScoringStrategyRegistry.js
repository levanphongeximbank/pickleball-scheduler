import { resolveRuleSetId } from "./formatResolution.js";
import { ScoringFormatError } from "./scoringFormatError.js";
import { rallyDoublesLegacyPrototypeStrategy } from "./strategies/rallyDoublesLegacyPrototypeStrategy.js";
import { rallySinglesLegacyStrategy } from "./strategies/rallySinglesLegacyStrategy.js";
import { sideOutDoublesStrategy } from "./strategies/sideOutDoublesStrategy.js";
import { sideOutSinglesStrategy } from "./strategies/sideOutSinglesStrategy.js";
import { usap2026ProvisionalRallyDoublesStrategy } from "./strategies/usap2026ProvisionalRallyDoublesStrategy.js";

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
  return get(ruleSetId);
}

register(sideOutDoublesStrategy);
register(sideOutSinglesStrategy);
register(rallyDoublesLegacyPrototypeStrategy);
register(rallySinglesLegacyStrategy);
register(usap2026ProvisionalRallyDoublesStrategy);

export const ScoringStrategyRegistry = {
  register,
  get,
  resolve,
  resolveRuleSetId,
};
