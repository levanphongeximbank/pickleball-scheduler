/**
 * Staging QA fixtures — REFEREE_V5_TEST_* and REFEREE_V5_RALLY_TEST_* namespaces.
 */
export const REFEREE_V5_STAGING = Object.freeze({
  TENANT_A: "REFEREE_V5_TEST_TENANT_A",
  TENANT_B: "REFEREE_V5_TEST_TENANT_B",
  TOURNAMENT_A: "REFEREE_V5_TEST_TOURNAMENT_A",
  TOURNAMENT_B: "REFEREE_V5_TEST_TOURNAMENT_B",
  MATCH_DOUBLES: "REFEREE_V5_TEST_MATCH_DOUBLES",
  MATCH_SINGLES: "REFEREE_V5_TEST_MATCH_SINGLES",
  MATCH_EXPIRED: "REFEREE_V5_TEST_MATCH_EXPIRED",
  MATCH_TENANT_B: "REFEREE_V5_TEST_MATCH_TENANT_B",
  RALLY_TENANT: "REFEREE_V5_RALLY_TEST_TENANT",
  RALLY_TOURNAMENT: "REFEREE_V5_RALLY_TEST_TOURNAMENT",
  RALLY_MATCH_DOUBLES: "REFEREE_V5_RALLY_TEST_MATCH_DOUBLES",
  USERS: Object.freeze({
    refereeA: "owner@staging.local",
    player: "player@staging.local",
    refereeB: "owner-b@staging.local",
  }),
});

export const REFEREE_V5_STAGING_FIXTURES = [
  {
    id: "staging-doubles",
    label: "Staging — Doubles side-out QA",
    tenantId: REFEREE_V5_STAGING.TENANT_A,
    tournamentId: REFEREE_V5_STAGING.TOURNAMENT_A,
    matchId: REFEREE_V5_STAGING.MATCH_DOUBLES,
    matchType: "doubles",
  },
  {
    id: "staging-singles",
    label: "Staging — Singles QA",
    tenantId: REFEREE_V5_STAGING.TENANT_A,
    tournamentId: REFEREE_V5_STAGING.TOURNAMENT_A,
    matchId: REFEREE_V5_STAGING.MATCH_SINGLES,
    matchType: "singles",
  },
  {
    id: "staging-rally-doubles",
    label: "Staging — USAP Rally Doubles QA",
    tenantId: REFEREE_V5_STAGING.RALLY_TENANT,
    tournamentId: REFEREE_V5_STAGING.RALLY_TOURNAMENT,
    matchId: REFEREE_V5_STAGING.RALLY_MATCH_DOUBLES,
    matchType: "doubles",
  },
];
