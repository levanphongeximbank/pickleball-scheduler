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
