export {
  HARD_CUTOVER_FLAG,
  COMPETITION_REMOTE_SSOT_FLAG,
  RUNTIME_AUTHORITY_MATRIX,
  isPlatformHardCutoverEnabled,
  isCompetitionRemoteSsotEnabled,
  listRuntimeAuthorityDomains,
  getRuntimeAuthorityEntry,
  readEnvFlag,
} from "./runtimeAuthorityMatrix.js";

export {
  LEGACY_AUTHORITY_ERROR,
  createLegacyAuthorityError,
  mustBlockLegacyWriters,
  assertNoClubAiDataAccess,
  assertLocalCloudDbAllowed,
  assertMatchLiveDirectWriteAllowed,
  assertInMemoryCompetitionProdAllowed,
  assertMockPersistenceAllowed,
  rejectSilentFallback,
  assertPrivatePairingLegacyPickerAllowed,
  assertPrivatePairingSilentRatingDefaultAllowed,
} from "./legacyAuthorityPolicy.js";

export {
  RATING_CUTOVER_FLAG,
  isPublicPlayerRatingActivationEnabled,
  assertCompetitionEloSeparatedFromPublicRating,
  assertRatingIdempotencyKey,
  assertClubBlobRatingWriteForbidden,
  demoteLocalAssessmentToDraft,
} from "./ratingCutoverPolicy.js";
