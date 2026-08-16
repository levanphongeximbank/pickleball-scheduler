/**
 * Team Tournament Canonical Adapter ĐẦU B public surface.
 */

export {
  TEAM_ADAPTER_B_CATALOG,
  TEAM_ADAPTER_B_CLASSIFICATION,
  TEAM_ADAPTER_B_NAMES,
  TEAM_ADAPTER_B_ORDINAL,
  TEAM_COMPETITION_TYPE,
  TEAM_TOURNAMENT_ADAPTER_B_MODE,
} from "./constants.js";

export {
  isNonEmptyCanonicalId,
  readDistinctTeamScope,
  requireCanonicalActorId,
  toCanonicalAdapterContext,
} from "./context.js";

export {
  isTeamFederationActivated,
  isTeamFinanceActivated,
  isTeamRankingActivated,
  isTeamRatingActivated,
  isTeamRefereeActivated,
} from "./activation.js";

export { createTeamTournamentIdentityAccessAdapter } from "./TeamTournamentIdentityAccessAdapter.js";
export { createTeamTournamentTenantOrganizationAdapter } from "./TeamTournamentTenantOrganizationAdapter.js";
export { createTeamTournamentParticipantAdapter } from "./TeamTournamentParticipantAdapter.js";
export { createTeamTournamentClubTeamMembershipAdapter } from "./TeamTournamentClubTeamMembershipAdapter.js";
export {
  createTeamTournamentRatingAdapter,
  hydrateCanonicalRatingEvidence,
  readTeamRatingValue,
  readTeamRatingValueOrZero,
} from "./TeamTournamentRatingAdapter.js";
export {
  assertRankingDoesNotControlTeamLifecycle,
  createTeamTournamentRankingAdapter,
  isTeamTournamentRecord,
  teamRankingMayAward,
} from "./TeamTournamentRankingAdapter.js";
export {
  TEAM_COURT_DISCOVERY_OUTCOME,
  classifyTeamCourtDiscovery,
  createTeamTournamentCourtAdapter,
  deriveCanonicalClusterChoices,
  TeamTournamentCourtAdapter,
  toFormatVenueCourt,
  toTeamCourtContractContext,
} from "./TeamTournamentCourtAdapter.js";
export {
  createTeamTournamentRefereeAdapter,
  TeamTournamentRefereeAdapter,
} from "./TeamTournamentRefereeAdapter.js";
export {
  createTeamTournamentAnalyticsReportingAdapter,
  createTeamTournamentCrmSponsorAdapter,
  createTeamTournamentFederationExternalAuthorityAdapter,
  createTeamTournamentFileMediaAdapter,
  createTeamTournamentFinancePaymentAdapter,
  createTeamTournamentNotificationCommunicationAdapter,
  createTeamTournamentStreamingScoreboardAdapter,
} from "./optionalBoundaries.js";
export {
  createTeamTournamentAuditAdapter,
  createTeamTournamentAuditSink,
} from "./TeamTournamentAuditAdapter.js";
export { createTeamTournamentAdapterBRegistry } from "./registry.js";
export { buildTeamAdapterBMatrix } from "./matrix.js";
