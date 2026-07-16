/**
 * PHASE 45B.3 — Pairing candidates gateway public surface.
 *
 * Portable core: reason codes, contract, identity mapper (athletes.id primary),
 * eligibility evaluator. App adapters: canonicalAthleteRepository + service.
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
  extractAthleteId,
  collectLegacyAliases,
  classifyIdentityCoverage,
  buildPairingIdentityIndex,
  resolvePairingIdentityId,
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
  fetchPickVnRatingsForPairingCandidates,
} from "./selectPlayersCandidateAdapter.js";

export {
  CANONICAL_RATING_SOURCE,
  buildPickVnRatingIndex,
  resolveCanonicalAthleteRating,
  attachCanonicalRatingToScopeRow,
  projectCanonicalRatingFields,
} from "./canonicalAthleteRating.js";

export {
  toLegacyScreenPickerPlayer,
  buildCandidateDiagnosticCounts,
  loadClubPairingCandidatePool,
  loadTenantPairingCandidatePool,
  listClubsForPairingTenant,
  loadDailyPlayCandidatePool,
  loadTeamBuilderClubCandidatePool,
  loadTeamBuilderTenantCandidatePool,
  loadTournamentPickerClubCandidatePool,
  loadTournamentPickerTenantCandidatePool,
} from "./screenCandidateAdapters.js";

export {
  resolvePairingScopeTenantId,
  isPlaceholderTenantId,
} from "./pairingScopeResolver.js";

export {
  isActiveMembershipStatus,
  normalizeMembershipStatus,
  readMembershipStatus,
} from "./pairingMembershipStatus.js";

export {
  useClubPairingCandidatePool,
  useTenantPairingCandidatePool,
} from "./usePairingCandidatePools.js";
