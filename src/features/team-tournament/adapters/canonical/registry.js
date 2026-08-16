/**
 * Team Tournament Adapter ĐẦU B registry — all 16 boundaries.
 */

import { TEAM_ADAPTER_B_CATALOG, TEAM_TOURNAMENT_ADAPTER_B_MODE } from "./constants.js";
import { createTeamTournamentIdentityAccessAdapter } from "./TeamTournamentIdentityAccessAdapter.js";
import { createTeamTournamentTenantOrganizationAdapter } from "./TeamTournamentTenantOrganizationAdapter.js";
import { createTeamTournamentParticipantAdapter } from "./TeamTournamentParticipantAdapter.js";
import { createTeamTournamentClubTeamMembershipAdapter } from "./TeamTournamentClubTeamMembershipAdapter.js";
import { createTeamTournamentRatingAdapter } from "./TeamTournamentRatingAdapter.js";
import { createTeamTournamentRankingAdapter } from "./TeamTournamentRankingAdapter.js";
import { createTeamTournamentCourtAdapter } from "./TeamTournamentCourtAdapter.js";
import { createTeamTournamentRefereeAdapter } from "./TeamTournamentRefereeAdapter.js";
import {
  createTeamTournamentAnalyticsReportingAdapter,
  createTeamTournamentCrmSponsorAdapter,
  createTeamTournamentFederationExternalAuthorityAdapter,
  createTeamTournamentFileMediaAdapter,
  createTeamTournamentFinancePaymentAdapter,
  createTeamTournamentNotificationCommunicationAdapter,
  createTeamTournamentStreamingScoreboardAdapter,
} from "./optionalBoundaries.js";
import { createTeamTournamentAuditAdapter } from "./TeamTournamentAuditAdapter.js";

export function createTeamTournamentAdapterBRegistry(deps = {}) {
  const adapters = Object.freeze({
    1: deps.identity || createTeamTournamentIdentityAccessAdapter(deps.identityDeps || deps),
    2: deps.tenant || createTeamTournamentTenantOrganizationAdapter(deps.tenantDeps || deps),
    3: deps.participant || createTeamTournamentParticipantAdapter(deps.participantDeps || deps),
    4: deps.club || createTeamTournamentClubTeamMembershipAdapter(deps.clubDeps || deps),
    5: deps.rating || createTeamTournamentRatingAdapter(deps.ratingDeps || deps),
    6: deps.ranking || createTeamTournamentRankingAdapter(deps.rankingDeps || deps),
    7: deps.court || createTeamTournamentCourtAdapter(deps.courtDeps || deps),
    8: deps.referee || createTeamTournamentRefereeAdapter(deps.refereeDeps || deps),
    9: deps.finance || createTeamTournamentFinancePaymentAdapter(deps.financeDeps || deps),
    10:
      deps.notification ||
      createTeamTournamentNotificationCommunicationAdapter(deps.notificationDeps || deps),
    11: deps.fileMedia || createTeamTournamentFileMediaAdapter(deps.fileMediaDeps || deps),
    12:
      deps.streaming ||
      createTeamTournamentStreamingScoreboardAdapter(deps.streamingDeps || deps),
    13:
      deps.federation ||
      createTeamTournamentFederationExternalAuthorityAdapter(deps.federationDeps || deps),
    14: deps.crm || createTeamTournamentCrmSponsorAdapter(deps.crmDeps || deps),
    15:
      deps.analytics ||
      createTeamTournamentAnalyticsReportingAdapter(deps.analyticsDeps || deps),
    16: deps.audit || createTeamTournamentAuditAdapter(deps.auditDeps || deps),
  });

  return Object.freeze({
    kind: "team-tournament-adapter-b-registry",
    competitionMode: TEAM_TOURNAMENT_ADAPTER_B_MODE,
    size: TEAM_ADAPTER_B_CATALOG.length,
    adapters,
    get(ordinal) {
      return adapters[ordinal] || null;
    },
    list() {
      return TEAM_ADAPTER_B_CATALOG.map((entry) => adapters[entry.ordinal]);
    },
  });
}
