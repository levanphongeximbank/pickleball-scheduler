import { DRAW_STRATEGY_KIND } from "./drawConstants.js";
import { createDrawStrategy } from "./drawContracts.js";

/**
 * Strategy contracts — CC-04A. Names only; no runtime algorithms.
 */

export function createSeedStrategy(partial = {}) {
  return createDrawStrategy({
    kind: DRAW_STRATEGY_KIND.SEED,
    id: partial.id || "seed-strategy",
    name: partial.name || "SeedStrategy",
    version: partial.version || "1",
    params: partial.params,
    implemented: false,
  });
}

export function createDistributionStrategy(partial = {}) {
  return createDrawStrategy({
    kind: DRAW_STRATEGY_KIND.DISTRIBUTION,
    id: partial.id || "distribution-strategy",
    name: partial.name || "DistributionStrategy",
    version: partial.version || "1",
    params: partial.params,
    implemented: false,
  });
}

export function createConstraintStrategy(partial = {}) {
  return createDrawStrategy({
    kind: DRAW_STRATEGY_KIND.CONSTRAINT,
    id: partial.id || "constraint-strategy",
    name: partial.name || "ConstraintStrategy",
    version: partial.version || "1",
    params: partial.params,
    implemented: false,
  });
}

export function createBalancingStrategy(partial = {}) {
  return createDrawStrategy({
    kind: DRAW_STRATEGY_KIND.BALANCING,
    id: partial.id || "balancing-strategy",
    name: partial.name || "BalancingStrategy",
    version: partial.version || "1",
    params: partial.params,
    implemented: false,
  });
}

export function createRandomStrategy(partial = {}) {
  return createDrawStrategy({
    kind: DRAW_STRATEGY_KIND.RANDOM,
    id: partial.id || "random-strategy",
    name: partial.name || "RandomStrategy",
    version: partial.version || "1",
    params: partial.params,
    implemented: false,
  });
}

export function createAuditStrategy(partial = {}) {
  return createDrawStrategy({
    kind: DRAW_STRATEGY_KIND.AUDIT,
    id: partial.id || "audit-strategy",
    name: partial.name || "AuditStrategy",
    version: partial.version || "1",
    params: partial.params,
    implemented: false,
  });
}

export function createExplainStrategy(partial = {}) {
  return createDrawStrategy({
    kind: DRAW_STRATEGY_KIND.EXPLAIN,
    id: partial.id || "explain-strategy",
    name: partial.name || "ExplainStrategy",
    version: partial.version || "1",
    params: partial.params,
    implemented: false,
  });
}

/**
 * Default strategy bundle for a foundation DrawRequest — all unimplemented.
 *
 * @returns {import('./drawTypes.js').DrawStrategy[]}
 */
export function createDefaultDrawStrategyBundle() {
  return [
    createSeedStrategy(),
    createDistributionStrategy(),
    createConstraintStrategy(),
    createBalancingStrategy(),
    createRandomStrategy(),
    createAuditStrategy(),
    createExplainStrategy(),
  ];
}
