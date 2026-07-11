import { DRAW_SEED_SOURCE } from "./drawConstants.js";
import { createDrawSeed } from "./drawContracts.js";

/**
 * Seed model helpers — CC-04A contracts only. Does not replace seed runtime.
 */

/**
 * @param {Partial<import('./drawTypes.js').DrawSeed>} [partial]
 */
export function createManualDrawSeed(partial = {}) {
  return createDrawSeed({
    ...partial,
    source: DRAW_SEED_SOURCE.MANUAL,
  });
}

/**
 * @param {Partial<import('./drawTypes.js').DrawSeed>} [partial]
 */
export function createAverageLevelDrawSeed(partial = {}) {
  return createDrawSeed({
    ...partial,
    source: DRAW_SEED_SOURCE.AVERAGE_LEVEL,
  });
}

/**
 * @param {Partial<import('./drawTypes.js').DrawSeed>} [partial]
 */
export function createCompetitionEloDrawSeed(partial = {}) {
  return createDrawSeed({
    ...partial,
    source: DRAW_SEED_SOURCE.COMPETITION_ELO,
  });
}

/**
 * @param {Partial<import('./drawTypes.js').DrawSeed>} [partial]
 */
export function createWinRateDrawSeed(partial = {}) {
  return createDrawSeed({
    ...partial,
    source: DRAW_SEED_SOURCE.WIN_RATE,
  });
}

/**
 * @param {Partial<import('./drawTypes.js').DrawSeed>} [partial]
 */
export function createPerformanceDrawSeed(partial = {}) {
  return createDrawSeed({
    ...partial,
    source: DRAW_SEED_SOURCE.PERFORMANCE,
  });
}

/**
 * @param {Partial<import('./drawTypes.js').DrawSeed>} [partial]
 */
export function createProvisionalDrawSeed(partial = {}) {
  return createDrawSeed({
    ...partial,
    source: DRAW_SEED_SOURCE.PROVISIONAL,
    provisional: true,
  });
}

/**
 * @param {Partial<import('./drawTypes.js').DrawSeed>} [partial]
 */
export function createNewPlayerDrawSeed(partial = {}) {
  return createDrawSeed({
    ...partial,
    source: DRAW_SEED_SOURCE.NEW_PLAYER,
    newPlayer: true,
  });
}

/**
 * @param {Partial<import('./drawTypes.js').DrawSeed>} [partial]
 */
export function createManualAdjustmentDrawSeed(partial = {}) {
  return createDrawSeed({
    ...partial,
    source: DRAW_SEED_SOURCE.MANUAL_ADJUSTMENT,
  });
}

/**
 * Normalize a heterogeneous seed list into DrawSeed contracts.
 *
 * @param {Array<Partial<import('./drawTypes.js').DrawSeed>>} [seeds]
 * @returns {import('./drawTypes.js').DrawSeed[]}
 */
export function normalizeDrawSeeds(seeds = []) {
  return (seeds || []).map((seed) => createDrawSeed(seed));
}
