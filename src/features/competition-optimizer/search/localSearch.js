/**
 * Local search facade — mutate loop is owned by runGlobalSearch;
 * this module exposes named strategies for diagnostics / tests.
 */
export { pickBestNeighbor } from "./hillClimbing.js";

export const LOCAL_SEARCH_STRATEGY = Object.freeze({
  HILL_CLIMB: "HILL_CLIMB",
  SIMULATED_ANNEALING: "SIMULATED_ANNEALING",
});
