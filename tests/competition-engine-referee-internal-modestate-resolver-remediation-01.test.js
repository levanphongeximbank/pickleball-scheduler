/**
 * Internal modeState resolver remediation — payload.events[].matches → modeState.matches
 * before Adapter B requireModeMatch. Fixture shape mirrors Staging CORE-13 Internal
 * acceptance evidence (no secrets).
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createScoringFormat } from "../src/features/competition-core/scoring/index.js";
import {
  COMPETITION_REFEREE_MODE,
  REFEREE_ADAPTER_ERROR_CODE,
  createDailyPlayRefereeAdapter,
  createInternalTournamentRefereeAdapter,
  createOfficialTournamentRefereeAdapter,
  createTeamTournamentRefereeAdapter,
  isRefereeAdapterContractError,
  runCompetitionRefereeAdapterConformance,
} from "../src/features/competition-engine/index.js";
import { buildRefereeAssignmentCard } from "../src/features/referee-production-ui/projection/buildRefereeAssignmentCard.js";
import {
  normalizeCanonicalTournamentMatchesFromPayload,
  resolveCanonicalRefereeModeState,
} from "../src/features/referee-production-ui/application/resolveCanonicalRefereeModeState.js";

const SCORING = createScoringFormat({
  scoringSystem: "SIDE_OUT",
  pointsToWin: 11,
  winBy: 2,
  bestOfGames: 1,
});

/** Staging-evidenced Internal competition / match UUIDs (public fixture ids). */
const FAILING_COMPETITION_ID = "196a1420-f561-47bc-8de9-ac4b962f6472";
const FAILING_MATCH_ID = "4d8f7fd3-e36a-4995-b628-7f1de34b0690";
const EVENT_ID = "fd0911ce-7f04-4abf-b7f7-f8e813a37abc";
const COURT_ID = "952a6c15-a3c1-4cd4-9dee-6720bcf5e073";
const ENTRY_A = "da59b2ee-27b7-46cc-8d75-fb121314dc1f";
const ENTRY_B = "60c30a61-94a3-4eb0-9968-421c68249956";
const PLAYER_A = "7be5f51a-50a0-4d61-88a4-e0a213acd298";
const PLAYER_B = "f7349ada-91c6-4683-a645-2b86f412b017";
const TENANT = "venue-staging-a";

function stagingInternalPayload(overrides = {}) {
  return {
    tenantId: TENANT,
    events: [
      {
        id: EVENT_ID,
        name: "Singles",
        entries: [
          { id: ENTRY_A, playerIds: [PLAYER_A] },
          { id: ENTRY_B, playerIds: [PLAYER_B] },
        ],
        matches: [
          {
            id: FAILING_MATCH_ID,
            matchId: FAILING_MATCH_ID,
            status: "waiting",
            courtId: COURT_ID,
            physicalCourtId: COURT_ID,
            stage: "group",
            round: 1,
            eventId: EVENT_ID,
            entryAId: ENTRY_A,
            entryBId: ENTRY_B,
            participantIdsA: [PLAYER_A],
            participantIdsB: [PLAYER_B],
            scheduledAt: "2099-06-16T01:00:00.000Z",
            scheduledStart: "2099-06-16T01:00:00.000Z",
            scoringRules: SCORING,
            tournamentId: FAILING_COMPETITION_ID,
            lineupsLocked: true,
          },
        ],
      },
    ],
    ...overrides,
  };
}

function mockCanonicalClient(row, { athletes = {}, profiles = {}, courts = {} } = {}) {
  return {
    from(table) {
      if (table === "team_tournaments") {
        const empty = {
          select() {
            return empty;
          },
          eq() {
            return empty;
          },
          maybeSingle: async () => ({ data: null, error: null }),
        };
        return empty;
      }
      if (table === "athletes") {
        const api = {
          _ids: null,
          select() {
            return api;
          },
          in(_col, ids) {
            api._ids = ids;
            return api;
          },
          then(resolve) {
            const data = (api._ids || [])
              .map((id) =>
                athletes[id]
                  ? { id, display_name: athletes[id] }
                  : null
              )
              .filter(Boolean);
            return Promise.resolve(resolve({ data, error: null }));
          },
        };
        return api;
      }
      if (table === "profiles") {
        const api = {
          _ids: null,
          select() {
            return api;
          },
          in(_col, ids) {
            api._ids = ids;
            return api;
          },
          then(resolve) {
            const data = (api._ids || [])
              .map((id) =>
                profiles[id]
                  ? { id, display_name: profiles[id], player_id: null }
                  : null
              )
              .filter(Boolean);
            return Promise.resolve(resolve({ data, error: null }));
          },
        };
        return api;
      }
      if (table === "court_resource_physical_courts") {
        const api = {
          _ids: null,
          select() {
            return api;
          },
          in(_col, ids) {
            api._ids = ids;
            return api;
          },
          eq() {
            return api;
          },
          then(resolve) {
            const data = (api._ids || [])
              .map((id) =>
                courts[id]
                  ? {
                      physical_court_id: id,
                      display_name: courts[id],
                      display_code: null,
                      display_number: null,
                    }
                  : null
              )
              .filter(Boolean);
            return Promise.resolve(resolve({ data, error: null }));
          },
        };
        return api;
      }
      assert.equal(table, "canonical_tournaments");
      const api = {
        select() {
          return api;
        },
        or() {
          return api;
        },
        eq() {
          return api;
        },
        maybeSingle: async () => ({ data: row, error: null }),
      };
      return api;
    },
  };
}

function expectAdapterCode(fn, code) {
  try {
    fn();
    assert.fail(`expected ${code}`);
  } catch (err) {
    assert.equal(isRefereeAdapterContractError(err), true);
    assert.equal(err.code, code);
    assert.equal(err.failClosed, true);
  }
}

test("1. Internal payload.events[].matches resolves into modeState.matches", () => {
  const matches = normalizeCanonicalTournamentMatchesFromPayload(
    stagingInternalPayload(),
    { competitionMode: COMPETITION_REFEREE_MODE.INTERNAL, competitionId: FAILING_COMPETITION_ID }
  );
  assert.equal(Boolean(matches[FAILING_MATCH_ID]), true);
  assert.equal(matches[FAILING_MATCH_ID].matchId, FAILING_MATCH_ID);
});

test("2. exact failing match UUID resolves via resolveCanonicalRefereeModeState", async () => {
  const modeState = await resolveCanonicalRefereeModeState(
    mockCanonicalClient({
      id: FAILING_COMPETITION_ID,
      tenant_id: TENANT,
      club_id: "club-1",
      external_key: FAILING_COMPETITION_ID,
      name: "Internal staging fixture",
      mode: "internal_tournament",
      status: "active",
      payload: stagingInternalPayload(),
    }),
    {
      tenantId: TENANT,
      competitionId: FAILING_COMPETITION_ID,
      matchId: FAILING_MATCH_ID,
    }
  );
  assert.ok(modeState);
  assert.equal(modeState.competitionMode, COMPETITION_REFEREE_MODE.INTERNAL);
  assert.equal(Boolean(modeState.matches[FAILING_MATCH_ID]), true);
  assert.equal(modeState.matches[FAILING_MATCH_ID].matchId, FAILING_MATCH_ID);
});

test("3. participant sides normalize correctly through Adapter B", async () => {
  const modeState = await resolveCanonicalRefereeModeState(
    mockCanonicalClient({
      id: FAILING_COMPETITION_ID,
      tenant_id: TENANT,
      club_id: "club-1",
      name: "Internal",
      mode: "internal_tournament",
      payload: stagingInternalPayload(),
    }),
    {
      tenantId: TENANT,
      competitionId: FAILING_COMPETITION_ID,
      matchId: FAILING_MATCH_ID,
    }
  );
  const adapter = createInternalTournamentRefereeAdapter({ modeState });
  const participants = adapter.getParticipants({
    tenantId: TENANT,
    competitionId: FAILING_COMPETITION_ID,
    matchId: FAILING_MATCH_ID,
  });
  assert.equal(participants.sides.length, 2);
  assert.equal(participants.sides[0].entryId, ENTRY_A);
  assert.equal(participants.sides[1].entryId, ENTRY_B);
  assert.deepEqual(participants.sides[0].participantIds, [PLAYER_A]);
  assert.deepEqual(participants.sides[1].participantIds, [PLAYER_B]);
});

test("4. courtId preserved", () => {
  const matches = normalizeCanonicalTournamentMatchesFromPayload(
    stagingInternalPayload(),
    { competitionMode: COMPETITION_REFEREE_MODE.INTERNAL }
  );
  assert.equal(matches[FAILING_MATCH_ID].courtId, COURT_ID);
  assert.equal(matches[FAILING_MATCH_ID].physicalCourtId, COURT_ID);
});

test("5. lifecycle/status preserved", () => {
  const matches = normalizeCanonicalTournamentMatchesFromPayload(
    stagingInternalPayload(),
    { competitionMode: COMPETITION_REFEREE_MODE.INTERNAL }
  );
  assert.equal(matches[FAILING_MATCH_ID].status, "waiting");
  assert.equal(matches[FAILING_MATCH_ID].stage, "group");
  assert.equal(matches[FAILING_MATCH_ID].round, 1);
  assert.equal(matches[FAILING_MATCH_ID].scheduledAt, "2099-06-16T01:00:00.000Z");
});

test("6. payload.matches existing behavior preserved (Daily / direct map)", () => {
  const dailyMatches = normalizeCanonicalTournamentMatchesFromPayload(
    {
      matches: {
        "daily-m1": {
          id: "daily-m1",
          status: "ready",
          courtId: "court-1",
          teamAPlayerIds: ["p1", "p2"],
          teamBPlayerIds: ["p3", "p4"],
          scoringRules: SCORING,
        },
      },
    },
    { competitionMode: COMPETITION_REFEREE_MODE.DAILY_PLAY }
  );
  assert.equal(Boolean(dailyMatches["daily-m1"]), true);
  assert.equal(dailyMatches["daily-m1"].courtId, "court-1");

  const officialDirect = normalizeCanonicalTournamentMatchesFromPayload(
    {
      matches: {
        "off-m1": {
          matchId: "off-m1",
          status: "READY_TO_START",
          entryAId: "a",
          entryBId: "b",
          courtId: "c1",
          scoringRules: SCORING,
        },
      },
    },
    { competitionMode: COMPETITION_REFEREE_MODE.OFFICIAL }
  );
  assert.equal(Boolean(officialDirect["off-m1"]), true);
  assert.equal(officialDirect["off-m1"].entryAId, "a");
});

test("7. duplicate/conflicting match IDs fail closed", () => {
  assert.throws(
    () =>
      normalizeCanonicalTournamentMatchesFromPayload(
        {
          events: [
            {
              id: "e1",
              entries: [],
              matches: [
                {
                  id: "dup-1",
                  entryAId: "a1",
                  entryBId: "b1",
                  courtId: "court-a",
                  status: "waiting",
                },
                {
                  id: "dup-1",
                  entryAId: "a2",
                  entryBId: "b2",
                  courtId: "court-b",
                  status: "waiting",
                },
              ],
            },
          ],
        },
        { competitionMode: COMPETITION_REFEREE_MODE.INTERNAL }
      ),
    (err) => err?.code === "MATCH_IDENTITY_CONFLICT" && err.failClosed === true
  );

  assert.throws(
    () =>
      normalizeCanonicalTournamentMatchesFromPayload(
        {
          events: [
            {
              id: "e1",
              matches: [
                {
                  id: "dup-2",
                  entryAId: "a1",
                  entryBId: "b1",
                  courtId: "court-a",
                  status: "waiting",
                },
              ],
            },
          ],
          matches: {
            "dup-2": {
              id: "dup-2",
              entryAId: "a9",
              entryBId: "b9",
              courtId: "court-z",
              status: "READY_TO_START",
            },
          },
        },
        { competitionMode: COMPETITION_REFEREE_MODE.INTERNAL }
      ),
    (err) => err?.code === "MATCH_IDENTITY_CONFLICT" && err.failClosed === true
  );
});

test("8. missing match still throws Unknown match via Adapter B", async () => {
  const modeState = await resolveCanonicalRefereeModeState(
    mockCanonicalClient({
      id: FAILING_COMPETITION_ID,
      tenant_id: TENANT,
      club_id: "club-1",
      name: "Internal",
      mode: "internal_tournament",
      payload: stagingInternalPayload(),
    }),
    {
      tenantId: TENANT,
      competitionId: FAILING_COMPETITION_ID,
      matchId: FAILING_MATCH_ID,
    }
  );
  const adapter = createInternalTournamentRefereeAdapter({ modeState });
  expectAdapterCode(
    () =>
      adapter.getMatchContext({
        tenantId: TENANT,
        competitionId: FAILING_COMPETITION_ID,
        matchId: "00000000-0000-4000-8000-000000000099",
      }),
    REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH
  );
});

test("9. Home card link unchanged", () => {
  const card = buildRefereeAssignmentCard({
    assignment: {
      matchId: FAILING_MATCH_ID,
      competitionId: FAILING_COMPETITION_ID,
      status: "ASSIGNED",
    },
    competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
    assignedMatch: { lifecycleState: "READY_TO_START" },
    participants: { sides: [] },
  });
  assert.equal(
    card.href,
    `/referee/match/${FAILING_MATCH_ID}?competitionId=${FAILING_COMPETITION_ID}`
  );
});

test("10. cross-tournament wrong competitionId still denied", async () => {
  const modeState = await resolveCanonicalRefereeModeState(
    mockCanonicalClient({
      id: FAILING_COMPETITION_ID,
      tenant_id: TENANT,
      club_id: "club-1",
      name: "Internal",
      mode: "internal_tournament",
      payload: stagingInternalPayload(),
    }),
    {
      tenantId: TENANT,
      competitionId: FAILING_COMPETITION_ID,
      matchId: FAILING_MATCH_ID,
    }
  );
  const adapter = createInternalTournamentRefereeAdapter({ modeState });
  expectAdapterCode(
    () =>
      adapter.getMatchContext({
        tenantId: TENANT,
        competitionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        matchId: FAILING_MATCH_ID,
      }),
    REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT
  );
});

test("11. cross-tenant still denied", async () => {
  const modeState = await resolveCanonicalRefereeModeState(
    mockCanonicalClient({
      id: FAILING_COMPETITION_ID,
      tenant_id: TENANT,
      club_id: "club-1",
      name: "Internal",
      mode: "internal_tournament",
      payload: stagingInternalPayload(),
    }),
    {
      tenantId: TENANT,
      competitionId: FAILING_COMPETITION_ID,
      matchId: FAILING_MATCH_ID,
    }
  );
  const adapter = createInternalTournamentRefereeAdapter({ modeState });
  expectAdapterCode(
    () =>
      adapter.getMatchContext({
        tenantId: "other-tenant",
        competitionId: FAILING_COMPETITION_ID,
        matchId: FAILING_MATCH_ID,
      }),
    REFEREE_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT
  );
});

test("12. Adapter B conformance Internal PASS with events-indexed modeState", async () => {
  const modeState = await resolveCanonicalRefereeModeState(
    mockCanonicalClient({
      id: FAILING_COMPETITION_ID,
      tenant_id: TENANT,
      club_id: "club-1",
      name: "Internal",
      mode: "internal_tournament",
      payload: stagingInternalPayload(),
    }),
    {
      tenantId: TENANT,
      competitionId: FAILING_COMPETITION_ID,
      matchId: FAILING_MATCH_ID,
    }
  );
  const adapter = createInternalTournamentRefereeAdapter({ modeState });
  const report = runCompetitionRefereeAdapterConformance(adapter, {
    validRequest: {
      tenantId: TENANT,
      competitionId: FAILING_COMPETITION_ID,
      matchId: FAILING_MATCH_ID,
    },
    crossTenantRequest: {
      tenantId: "other-tenant",
      competitionId: FAILING_COMPETITION_ID,
      matchId: FAILING_MATCH_ID,
    },
  });
  assert.equal(
    report.ok,
    true,
    JSON.stringify((report.results || []).filter((r) => !r.ok), null, 2)
  );
});

test("13. all four Adapter B modes PASS conformance", () => {
  const daily = createDailyPlayRefereeAdapter({
    modeState: {
      tenantId: TENANT,
      competitionId: "daily-1",
      competitionMode: COMPETITION_REFEREE_MODE.DAILY_PLAY,
      canonicalAssignmentAuthorityAvailable: true,
      session: {
        sessionId: "daily-1",
        matchType: "mixed_double",
        checkedInPlayerIds: ["p1", "p2", "p3", "p4"],
        enabledCourtIds: ["c1"],
      },
      matches: {
        "m-daily": {
          matchId: "m-daily",
          status: "ready",
          courtId: "c1",
          teamAPlayerIds: ["p1", "p2"],
          teamBPlayerIds: ["p3", "p4"],
          scoringRules: SCORING,
          lineupsLocked: true,
        },
      },
    },
  });
  const internalMatches = normalizeCanonicalTournamentMatchesFromPayload(
    stagingInternalPayload(),
    { competitionMode: COMPETITION_REFEREE_MODE.INTERNAL, competitionId: FAILING_COMPETITION_ID }
  );
  const internal = createInternalTournamentRefereeAdapter({
    modeState: {
      tenantId: TENANT,
      competitionId: FAILING_COMPETITION_ID,
      competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
      canonicalAssignmentAuthorityAvailable: true,
      matches: internalMatches,
      scoringRules: SCORING,
    },
  });
  const official = createOfficialTournamentRefereeAdapter({
    modeState: {
      tenantId: TENANT,
      competitionId: "official-1",
      competitionMode: COMPETITION_REFEREE_MODE.OFFICIAL,
      competitionType: "official_tournament",
      canonicalAssignmentAuthorityAvailable: true,
      registrationContext: { openEntry: true },
      eligibilityContext: { requiresRegistration: true },
      matches: normalizeCanonicalTournamentMatchesFromPayload(
        {
          events: [
            {
              id: "oe1",
              entries: [
                { id: "oa", playerIds: ["op1"] },
                { id: "ob", playerIds: ["op2"] },
              ],
              matches: [
                {
                  id: "m-off",
                  status: "READY_TO_START",
                  entryAId: "oa",
                  entryBId: "ob",
                  courtId: "c2",
                  scoringRules: SCORING,
                  lineupsLocked: true,
                },
              ],
            },
          ],
        },
        { competitionMode: COMPETITION_REFEREE_MODE.OFFICIAL }
      ),
    },
  });
  const team = createTeamTournamentRefereeAdapter({
    modeState: {
      tenantId: TENANT,
      competitionId: "team-1",
      competitionMode: COMPETITION_REFEREE_MODE.TEAM,
      canonicalAssignmentAuthorityAvailable: true,
      assignments: [{ matchupId: "mu-1", scope: "parent", status: "active" }],
      matchups: {
        "mu-1": {
          matchupId: "mu-1",
          teamAId: "ta",
          teamBId: "tb",
          status: "READY_TO_START",
          courtId: "c3",
          lineupsLocked: true,
          scoringRules: SCORING,
          subMatches: [
            {
              id: "sub-1",
              status: "READY_TO_START",
              lineupA: ["a1"],
              lineupB: ["b1"],
              scoringRules: SCORING,
              lineupsLocked: true,
            },
          ],
        },
      },
    },
  });

  for (const [label, adapter, validRequest] of [
    ["DAILY", daily, { tenantId: TENANT, competitionId: "daily-1", matchId: "m-daily" }],
    [
      "INTERNAL",
      internal,
      {
        tenantId: TENANT,
        competitionId: FAILING_COMPETITION_ID,
        matchId: FAILING_MATCH_ID,
      },
    ],
    ["OFFICIAL", official, { tenantId: TENANT, competitionId: "official-1", matchId: "m-off" }],
    ["TEAM", team, { tenantId: TENANT, competitionId: "team-1", matchId: "sub-1" }],
  ]) {
    const report = runCompetitionRefereeAdapterConformance(adapter, {
      validRequest,
      crossTenantRequest: { ...validRequest, tenantId: "other-tenant" },
    });
    assert.equal(
      report.ok,
      true,
      `${label}: ${JSON.stringify((report.results || []).filter((r) => !r.ok))}`
    );
  }
});

test("tenant mismatch on canonical row still returns null", async () => {
  const modeState = await resolveCanonicalRefereeModeState(
    mockCanonicalClient({
      id: FAILING_COMPETITION_ID,
      tenant_id: TENANT,
      club_id: "club-1",
      name: "Internal",
      mode: "internal_tournament",
      payload: stagingInternalPayload(),
    }),
    {
      tenantId: "other-tenant",
      competitionId: FAILING_COMPETITION_ID,
      matchId: FAILING_MATCH_ID,
    }
  );
  assert.equal(modeState, null);
});

test("equivalent duplicate match ids across events+payload.matches merge safely", () => {
  const match = {
    id: "same-1",
    entryAId: "a1",
    entryBId: "b1",
    courtId: "court-a",
    status: "waiting",
    scoringRules: SCORING,
  };
  const matches = normalizeCanonicalTournamentMatchesFromPayload(
    {
      events: [{ id: "e1", matches: [match] }],
      matches: { "same-1": { ...match } },
    },
    { competitionMode: COMPETITION_REFEREE_MODE.INTERNAL }
  );
  assert.equal(Boolean(matches["same-1"]), true);
  assert.equal(matches["same-1"].entryAId, "a1");
});

test("14. Internal event match participantIds preserved through normalizer", () => {
  const matches = normalizeCanonicalTournamentMatchesFromPayload(
    stagingInternalPayload(),
    { competitionMode: COMPETITION_REFEREE_MODE.INTERNAL, competitionId: FAILING_COMPETITION_ID }
  );
  assert.deepEqual(matches[FAILING_MATCH_ID].participantIdsA, [PLAYER_A]);
  assert.deepEqual(matches[FAILING_MATCH_ID].participantIdsB, [PLAYER_B]);
  assert.equal(matches[FAILING_MATCH_ID].entryAId, ENTRY_A);
  assert.equal(matches[FAILING_MATCH_ID].entryBId, ENTRY_B);
});

test("15. Internal participant names resolved from athletes directory", async () => {
  const modeState = await resolveCanonicalRefereeModeState(
    mockCanonicalClient(
      {
        id: FAILING_COMPETITION_ID,
        tenant_id: TENANT,
        club_id: "club-1",
        name: "Internal",
        mode: "internal_tournament",
        payload: stagingInternalPayload(),
      },
      {
        athletes: { [PLAYER_A]: "Nguyễn A", [PLAYER_B]: "Trần B" },
        courts: { [COURT_ID]: "Sân 3" },
      }
    ),
    {
      tenantId: TENANT,
      competitionId: FAILING_COMPETITION_ID,
      matchId: FAILING_MATCH_ID,
    }
  );
  assert.equal(modeState.participantNames[PLAYER_A], "Nguyễn A");
  assert.equal(modeState.participantNames[PLAYER_B], "Trần B");
});

test("16. Side A/B display correct via Adapter B + match view projection", async () => {
  const { buildRefereeMatchView } = await import(
    "../src/features/referee-production-ui/projection/buildRefereeMatchView.js"
  );
  const modeState = await resolveCanonicalRefereeModeState(
    mockCanonicalClient(
      {
        id: FAILING_COMPETITION_ID,
        tenant_id: TENANT,
        club_id: "club-1",
        name: "Internal staging fixture",
        mode: "internal_tournament",
        payload: stagingInternalPayload(),
      },
      {
        athletes: { [PLAYER_A]: "Nguyễn A", [PLAYER_B]: "Trần B" },
        courts: { [COURT_ID]: "Sân 3" },
      }
    ),
    {
      tenantId: TENANT,
      competitionId: FAILING_COMPETITION_ID,
      matchId: FAILING_MATCH_ID,
    }
  );
  const adapter = createInternalTournamentRefereeAdapter({ modeState });
  const req = {
    tenantId: TENANT,
    competitionId: FAILING_COMPETITION_ID,
    matchId: FAILING_MATCH_ID,
  };
  const participants = adapter.getParticipants(req);
  const matchContext = adapter.getMatchContext(req);
  const view = buildRefereeMatchView({
    matchId: FAILING_MATCH_ID,
    competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
    adapterSelected: COMPETITION_REFEREE_MODE.INTERNAL,
    competitionContext: adapter.getCompetitionContext(req),
    matchContext,
    participants,
    modeState,
    participantNames: modeState.participantNames,
    assignedMatch: { lifecycleState: "READY_TO_START" },
  });
  assert.equal(view.participantDisplay.sideA.playerNames.includes("Nguyễn A"), true);
  assert.equal(view.participantDisplay.sideB.playerNames.includes("Trần B"), true);
  assert.equal(view.participantDisplay.sideA.playerNames.includes("VĐV"), false);
  assert.equal(view.participantDisplay.sideB.playerNames.includes("VĐV"), false);
  assert.equal(matchContext.courtId, COURT_ID);
  assert.equal(matchContext.courtLabel, "Sân 3");
  assert.equal(view.courtLabel, "Sân 3");
  assert.notEqual(view.courtLabel, "Sân chưa xác định");
});

test("17. courtId preserved and court label resolved from canonical court source", async () => {
  const modeState = await resolveCanonicalRefereeModeState(
    mockCanonicalClient(
      {
        id: FAILING_COMPETITION_ID,
        tenant_id: TENANT,
        club_id: "club-1",
        name: "Internal",
        mode: "internal_tournament",
        payload: stagingInternalPayload(),
      },
      { courts: { [COURT_ID]: "Sân Trung Tâm 1" } }
    ),
    {
      tenantId: TENANT,
      competitionId: FAILING_COMPETITION_ID,
      matchId: FAILING_MATCH_ID,
    }
  );
  assert.equal(modeState.matches[FAILING_MATCH_ID].courtId, COURT_ID);
  assert.equal(modeState.matches[FAILING_MATCH_ID].physicalCourtId, COURT_ID);
  assert.equal(modeState.matches[FAILING_MATCH_ID].courtLabel, "Sân Trung Tâm 1");
  assert.equal(modeState.courtLabels[COURT_ID], "Sân Trung Tâm 1");
});

test("18. valid courtId without label surfaces id (not Sân chưa xác định)", async () => {
  const { formatCourtLabel } = await import(
    "../src/features/referee-production-ui/projection/formatRefereeUiLabels.js"
  );
  const modeState = await resolveCanonicalRefereeModeState(
    mockCanonicalClient({
      id: FAILING_COMPETITION_ID,
      tenant_id: TENANT,
      club_id: "club-1",
      name: "Internal",
      mode: "internal_tournament",
      payload: stagingInternalPayload(),
    }),
    {
      tenantId: TENANT,
      competitionId: FAILING_COMPETITION_ID,
      matchId: FAILING_MATCH_ID,
    }
  );
  const courtId = modeState.matches[FAILING_MATCH_ID].courtId;
  assert.equal(courtId, COURT_ID);
  assert.equal(formatCourtLabel({ courtId }), COURT_ID);
  assert.notEqual(formatCourtLabel({ courtId }), "Sân chưa xác định");
});

test("19. no venueId→physicalCourtId fallback", async () => {
  const modeState = await resolveCanonicalRefereeModeState(
    mockCanonicalClient({
      id: FAILING_COMPETITION_ID,
      tenant_id: TENANT,
      club_id: "club-1",
      name: "Internal",
      mode: "internal_tournament",
      payload: stagingInternalPayload({
        events: [
          {
            id: EVENT_ID,
            name: "Singles",
            entries: [
              { id: ENTRY_A, playerIds: [PLAYER_A], name: "Entry A" },
              { id: ENTRY_B, playerIds: [PLAYER_B], name: "Entry B" },
            ],
            matches: [
              {
                id: FAILING_MATCH_ID,
                status: "waiting",
                // intentionally no courtId — must not invent from venue/tenant
                entryAId: ENTRY_A,
                entryBId: ENTRY_B,
                participantIdsA: [PLAYER_A],
                participantIdsB: [PLAYER_B],
                scoringRules: SCORING,
                tournamentId: FAILING_COMPETITION_ID,
                lineupsLocked: true,
              },
            ],
          },
        ],
      }),
    }),
    {
      tenantId: TENANT,
      competitionId: FAILING_COMPETITION_ID,
      matchId: FAILING_MATCH_ID,
    }
  );
  assert.equal(modeState.venueId, TENANT);
  assert.equal(modeState.matches[FAILING_MATCH_ID].courtId, null);
  assert.equal(modeState.matches[FAILING_MATCH_ID].physicalCourtId, null);
  assert.notEqual(modeState.matches[FAILING_MATCH_ID].physicalCourtId, TENANT);
});

test("20. Daily / Official / Team participant+court paths unchanged", () => {
  const dailyMatches = normalizeCanonicalTournamentMatchesFromPayload(
    {
      matches: {
        "daily-m1": {
          id: "daily-m1",
          status: "ready",
          courtId: "court-1",
          teamAPlayerIds: ["p1", "p2"],
          teamBPlayerIds: ["p3", "p4"],
          scoringRules: SCORING,
        },
      },
    },
    { competitionMode: COMPETITION_REFEREE_MODE.DAILY_PLAY }
  );
  assert.equal(dailyMatches["daily-m1"].courtId, "court-1");
  assert.equal(dailyMatches["daily-m1"].status, "ready");
  assert.deepEqual(dailyMatches["daily-m1"].teamAPlayerIds, ["p1", "p2"]);

  const official = normalizeCanonicalTournamentMatchesFromPayload(
    {
      events: [
        {
          id: "oe1",
          entries: [
            { id: "oa", playerIds: ["op1"] },
            { id: "ob", playerIds: ["op2"] },
          ],
          matches: [
            {
              id: "m-off",
              status: "READY_TO_START",
              entryAId: "oa",
              entryBId: "ob",
              courtId: "c2",
              scoringRules: SCORING,
              lineupsLocked: true,
            },
          ],
        },
      ],
    },
    { competitionMode: COMPETITION_REFEREE_MODE.OFFICIAL }
  );
  assert.equal(official["m-off"].entryAId, "oa");
  assert.equal(official["m-off"].courtId, "c2");

  const team = createTeamTournamentRefereeAdapter({
    modeState: {
      tenantId: TENANT,
      competitionId: "team-1",
      competitionMode: COMPETITION_REFEREE_MODE.TEAM,
      canonicalAssignmentAuthorityAvailable: true,
      assignments: [{ matchupId: "mu-1", scope: "parent", status: "active" }],
      matchups: {
        "mu-1": {
          matchupId: "mu-1",
          teamAId: "ta",
          teamBId: "tb",
          status: "READY_TO_START",
          courtId: "c3",
          courtLabel: "Sân Team",
          lineupsLocked: true,
          scoringRules: SCORING,
          subMatches: [
            {
              id: "sub-1",
              status: "READY_TO_START",
              lineupA: ["a1"],
              lineupB: ["b1"],
              scoringRules: SCORING,
              lineupsLocked: true,
            },
          ],
        },
      },
    },
  });
  const teamCtx = team.getMatchContext({
    tenantId: TENANT,
    competitionId: "team-1",
    matchId: "sub-1",
  });
  assert.equal(teamCtx.courtId, "c3");
  assert.equal(teamCtx.courtLabel, "Sân Team");
});

test("21. failing deep-link getMatchView read-only PASS (fixture-shaped)", async () => {
  const { buildRefereeMatchView } = await import(
    "../src/features/referee-production-ui/projection/buildRefereeMatchView.js"
  );
  const modeState = await resolveCanonicalRefereeModeState(
    mockCanonicalClient(
      {
        id: FAILING_COMPETITION_ID,
        tenant_id: TENANT,
        club_id: "club-1",
        external_key: FAILING_COMPETITION_ID,
        name: "CORE13_STAGING_ACCEPTANCE",
        mode: "internal_tournament",
        status: "active",
        payload: stagingInternalPayload({
          events: [
            {
              id: EVENT_ID,
              name: "Singles",
              entries: [
                { id: ENTRY_A, playerIds: [PLAYER_A], name: "Nguyễn A" },
                { id: ENTRY_B, playerIds: [PLAYER_B], name: "Trần B" },
              ],
              matches: [
                {
                  id: FAILING_MATCH_ID,
                  matchId: FAILING_MATCH_ID,
                  status: "waiting",
                  courtId: COURT_ID,
                  physicalCourtId: COURT_ID,
                  stage: "group",
                  round: 1,
                  eventId: EVENT_ID,
                  entryAId: ENTRY_A,
                  entryBId: ENTRY_B,
                  participantIdsA: [PLAYER_A],
                  participantIdsB: [PLAYER_B],
                  scheduledAt: "2099-06-16T01:00:00.000Z",
                  scoringRules: SCORING,
                  tournamentId: FAILING_COMPETITION_ID,
                  lineupsLocked: true,
                },
              ],
            },
          ],
        }),
      },
      {
        athletes: { [PLAYER_A]: "Nguyễn A", [PLAYER_B]: "Trần B" },
        courts: { [COURT_ID]: "Sân 3" },
      }
    ),
    {
      tenantId: TENANT,
      competitionId: FAILING_COMPETITION_ID,
      matchId: FAILING_MATCH_ID,
    }
  );
  const adapter = createInternalTournamentRefereeAdapter({ modeState });
  const req = {
    tenantId: TENANT,
    competitionId: FAILING_COMPETITION_ID,
    matchId: FAILING_MATCH_ID,
  };
  const view = buildRefereeMatchView({
    matchId: FAILING_MATCH_ID,
    competitionMode: COMPETITION_REFEREE_MODE.INTERNAL,
    adapterSelected: "internal-tournament-referee-adapter-b",
    competitionContext: adapter.getCompetitionContext(req),
    matchContext: adapter.getMatchContext(req),
    participants: adapter.getParticipants(req),
    modeState,
    participantNames: modeState.participantNames,
    assignedMatch: { lifecycleState: "READY_TO_START" },
  });
  assert.equal(view.matchId, FAILING_MATCH_ID);
  assert.equal(view.competitionId, FAILING_COMPETITION_ID);
  assert.equal(view.participantDisplay.sideA.playerNames[0], "Nguyễn A");
  assert.equal(view.participantDisplay.sideB.playerNames[0], "Trần B");
  assert.equal(view.courtId, COURT_ID);
  assert.equal(view.courtLabel, "Sân 3");
  assert.equal(view.courtLabel.includes("chưa xác định"), false);
});
