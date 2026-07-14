export {
  SIMULATION_DEFAULTS,
  SIMULATION_CODE,
  EXPLANATION_CODE,
  SIMULATION_VERSION,
} from "./simulationCodes.js";

export {
  stableHash,
  normalizeSimulationPlayer,
  filterEligibleSimulationPlayers,
  canonicalizeCandidateKey,
} from "./candidateCanonicalizer.js";

export { generateSimulationCandidates } from "./candidateGenerator.js";

export {
  computeDiversityScore,
  computeSimulationFairnessScore,
  collectMissingRatingWarnings,
  scoreSimulationCandidate,
  compareScoredCandidates,
} from "./candidateScorer.js";

export { explainSimulationCandidate } from "./candidateExplainer.js";

export { simulatePrivatePairing } from "./simulatePrivatePairing.js";

export {
  SIMULATE_PRIVATE_PAIRING_ACTION,
  buildSimulatePrivatePairingAudit,
  maybeWriteSimulationAudit,
} from "./privatePairingSimulationAudit.js";
