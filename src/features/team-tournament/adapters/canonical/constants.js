/**
 * Team Tournament Adapter ĐẦU B catalog.
 *
 * Contract identity/version strings live on the canonical catalog (ĐẦU A).
 * This file must not duplicate or invent contract IDs.
 */

export const TEAM_TOURNAMENT_ADAPTER_B_MODE = "TEAM_TOURNAMENT";

export const TEAM_ADAPTER_B_CLASSIFICATION = Object.freeze({
  REQUIRED: "REQUIRED",
  CONDITIONAL: "CONDITIONAL",
  OPTIONAL: "OPTIONAL",
  NOT_REQUIRED: "NOT_REQUIRED",
});

export const TEAM_ADAPTER_B_ORDINAL = Object.freeze({
  IDENTITY_ACCESS: 1,
  TENANT_ORGANIZATION: 2,
  PARTICIPANT: 3,
  CLUB_TEAM_MEMBERSHIP: 4,
  RATING: 5,
  RANKING: 6,
  COURT: 7,
  REFEREE: 8,
  FINANCE_PAYMENT: 9,
  NOTIFICATION_COMMUNICATION: 10,
  FILE_MEDIA: 11,
  STREAMING_SCOREBOARD: 12,
  FEDERATION_EXTERNAL_AUTHORITY: 13,
  CRM_SPONSOR: 14,
  ANALYTICS_REPORTING: 15,
  AUDIT: 16,
});

export const TEAM_ADAPTER_B_NAMES = Object.freeze({
  1: "TeamTournamentIdentityAccessAdapter",
  2: "TeamTournamentTenantOrganizationAdapter",
  3: "TeamTournamentParticipantAdapter",
  4: "TeamTournamentClubTeamMembershipAdapter",
  5: "TeamTournamentRatingAdapter",
  6: "TeamTournamentRankingAdapter",
  7: "TeamTournamentCourtAdapter",
  8: "TeamTournamentRefereeAdapter",
  9: "TeamTournamentFinancePaymentAdapter",
  10: "TeamTournamentNotificationCommunicationAdapter",
  11: "TeamTournamentFileMediaAdapter",
  12: "TeamTournamentStreamingScoreboardAdapter",
  13: "TeamTournamentFederationExternalAuthorityAdapter",
  14: "TeamTournamentCrmSponsorAdapter",
  15: "TeamTournamentAnalyticsReportingAdapter",
  16: "TeamTournamentAuditAdapter",
});

export const TEAM_ADAPTER_B_CATALOG = Object.freeze(
  [
    [1, TEAM_ADAPTER_B_CLASSIFICATION.REQUIRED],
    [2, TEAM_ADAPTER_B_CLASSIFICATION.REQUIRED],
    [3, TEAM_ADAPTER_B_CLASSIFICATION.REQUIRED],
    [4, TEAM_ADAPTER_B_CLASSIFICATION.REQUIRED],
    [5, TEAM_ADAPTER_B_CLASSIFICATION.CONDITIONAL],
    [6, TEAM_ADAPTER_B_CLASSIFICATION.CONDITIONAL],
    [7, TEAM_ADAPTER_B_CLASSIFICATION.REQUIRED],
    [8, TEAM_ADAPTER_B_CLASSIFICATION.CONDITIONAL],
    [9, TEAM_ADAPTER_B_CLASSIFICATION.NOT_REQUIRED],
    [10, TEAM_ADAPTER_B_CLASSIFICATION.OPTIONAL],
    [11, TEAM_ADAPTER_B_CLASSIFICATION.OPTIONAL],
    [12, TEAM_ADAPTER_B_CLASSIFICATION.OPTIONAL],
    [13, TEAM_ADAPTER_B_CLASSIFICATION.NOT_REQUIRED],
    [14, TEAM_ADAPTER_B_CLASSIFICATION.OPTIONAL],
    [15, TEAM_ADAPTER_B_CLASSIFICATION.OPTIONAL],
    [16, TEAM_ADAPTER_B_CLASSIFICATION.REQUIRED],
  ].map(([ordinal, classification]) =>
    Object.freeze({
      ordinal,
      adapterBName: TEAM_ADAPTER_B_NAMES[ordinal],
      classification,
    })
  )
);

export const TEAM_COMPETITION_TYPE = "team";
