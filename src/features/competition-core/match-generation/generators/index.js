/**
 * CORE-09 Phase 1C — generator barrel (internal).
 */

export {
  generateCircleRoundRobinPairings,
  expectedSingleRoundRobinPlayedMatches,
  expectedSingleRoundRobinRounds,
} from "./roundRobinCircle.js";

export {
  materializeCircleLeg,
  materializeReversedSecondLeg,
} from "./materializeRoundRobinMatches.js";

export { generateRoundRobinForParticipants } from "./generateRoundRobinForParticipants.js";

export { assembleMatchPlan } from "./assembleMatchPlan.js";

export {
  isPowerOfTwo,
  nextPowerOfTwo,
  computeSingleEliminationBracket,
  expectedLogicalMatchCount,
  expectedPlayedMatchCount,
  openingSlotPositions,
  priorChampionshipFeeders,
} from "./singleEliminationBracket.js";

export {
  resolveBracketSlotsFromDraw,
  materializeOpeningRoundMatches,
} from "./materializeSingleEliminationMatches.js";

export { buildEliminationDependencyGraph } from "./buildEliminationDependencyGraph.js";

export {
  generateSingleEliminationForParticipants,
  countDrawParticipants,
} from "./generateSingleEliminationForParticipants.js";
