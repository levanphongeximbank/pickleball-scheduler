/**
 * Simulated annealing acceptance is implemented inside runGlobalSearch.
 * This file documents the strategy id and default temperature schedule.
 */
export const SIMULATED_ANNEALING = Object.freeze({
  id: "SIMULATED_ANNEALING",
  defaultStartTemp: 1,
  coolFactor: 0.02,
});
