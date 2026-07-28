export {
  HARD_CUTOVER_FLAG,
  COMPETITION_REMOTE_SSOT_FLAG,
  RUNTIME_AUTHORITY_MATRIX,
  RUNTIME_AUTHORITY_DOMAIN_COUNT,
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
  assertCoachingLegacyAuthorityAllowed,
  assertMessagingDemoAuthorityAllowed,
  assertDashboardAnalyticsMockAllowed,
  assertDashboardAnalyticsLocalStorageAllowed,
  assertFinanceLocalStorageAuthorityAllowed,
  assertFinanceDemoClubFallbackAllowed,
  assertCrmLocalStorageAuthorityAllowed,
  assertCrmDemoClubFallbackAllowed,
} from "./legacyAuthorityPolicy.js";

export {
  RATING_CUTOVER_FLAG,
  isPublicPlayerRatingActivationEnabled,
  assertCompetitionEloSeparatedFromPublicRating,
  assertRatingIdempotencyKey,
  assertClubBlobRatingWriteForbidden,
  demoteLocalAssessmentToDraft,
} from "./ratingCutoverPolicy.js";
