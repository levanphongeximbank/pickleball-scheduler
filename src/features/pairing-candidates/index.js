/**
 * PHASE 45B.2 — Pairing candidates gateway public surface.
 *
 * Portable core: reason codes, contract, identity mapper, eligibility evaluator.
 * App adapters: canonicalAthleteRepository injectables + pairingCandidateService.
 */

export {
  PAIRING_CANDIDATE_REASON_CODES,
  isPairingCandidateReasonCode,
} from "./pairingCandidateReasonCodes.js";

export {
  PAIRING_CANDIDATE_GATEWAY_VERSION,
  PAIRING_CANDIDATE_STATUS,
  buildPairingCandidateResponse,
  emptyIdentityCoverage,
  emptySourceBreakdown,
  isPairingCandidateResponse,
} from "./pairingCandidateContract.js";

export {
  mapPairingIdentity,
  mapPairingIdentities,
} from "./pairingIdentityMapper.js";

export {
  evaluatePairingEligibility,
  evaluateAllPairingEligibility,
  applyOptionalPrivatePairingSeam,
} from "./pairingEligibilityEvaluator.js";

export {
  createCanonicalAthleteRepository,
  canonicalAthleteRepository,
  normalizeAthleteMembershipScopeRow,
  joinAthletesAndMemberships,
} from "./canonicalAthleteRepository.js";

export {
  createPairingCandidateService,
  pairingCandidateService,
} from "./pairingCandidateService.js";

export {
  loadSelectPlayersCandidatePool,
  listSelectPlayersScopeRows,
  toLegacySelectPlayersPlayer,
  fetchProfilesForPairingCandidates,
  fetchAthletesForPairingCandidates,
} from "./selectPlayersCandidateAdapter.js";
