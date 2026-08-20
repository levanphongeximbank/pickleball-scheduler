/**
 * CORE-13 canonical match index + Daily ownership / policy-order matrix.
 * Local only. Does not mutate Staging. Does not change resolver policy.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ASSIGNMENT_COMMAND_ERROR_CODE,
  ASSIGNMENT_COMPETITION_MODE,
} from "../src/features/competition-engine/operations/referee/assignment/constants.js";
import {
  extractCanonicalMatchIndex,
  buildAdapterBModeState,
} from "../src/features/competition-engine/operations/referee/assignment/server/loadCanonicalCompetitionModeState.js";
import { resolveAuthoritativeAssignmentTenant } from "../src/features/competition-engine/operations/referee/assignment/server/resolveAuthoritativeAssignmentTenant.js";
import { handleCompetitionRefereeAssignmentAction } from "../src/features/competition-engine/operations/referee/assignment/server/edgeHttpHandler.js";
import {
  COMPETITION_ASSIGNMENT_IDEMPOTENCY_RPC,
  COMPETITION_ASSIGNMENT_MUTATION_RPC,
} from "../src/features/competition-engine/operations/referee/assignment/persistence/createRpcCanonicalAssignmentPersistence.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF_UUID = "aaaa1111-bbbb-4ccc-8ddd-eeeeffffffff";
const ACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TENANT_A = "11111111-1111-4111-8111-111111111111";
const TENANT_B = "22222222-2222-4222-8222-222222222222";
const VENUE_ID = "33333333-3333-4333-8333-333333333333";
const TOURN_DISABLED = "44444444-4444-4444-8444-444444444444";
const TOURN_ENABLED = "55555555-5555-4555-8555-555555555555";
const TOURN_OTHER = "66666666-6666-4666-8666-666666666666";
const MATCH_DISABLED = "77777777-7777-4777-8777-777777777777";
const MATCH_ENABLED = "88888888-8888-4888-8888-888888888888";
const MATCH_INTERNAL = "99999999-9999-4999-8999-999999999999";
const MATCH_OFFICIAL = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const MATCH_TEAM = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const MATCHUP_TEAM = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const COURT_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PLAYER_A = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
const PLAYER_B = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2";
const SYNTHETIC_RECEIPT_MATCH = "ffffffff-ffff-4fff-8fff-ffffffffffff";

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function dailyCanonical({
  id,
  tenantId = TENANT_A,
  matchId,
  refereeFeatureEnabled,
  extraDaily = {},
} = {}) {
  return {
    id,
    tenant_id: tenantId,
    club_id: "club-a",
    status: "active",
    mode: "daily_play",
    external_key: id,
    payload: {
      mode: "daily_play",
      settings: {
        dailyPlay: {
          refereeFeatureEnabled,
          revision: 1,
          checkedInPlayerIds: [PLAYER_A, PLAYER_B],
          enabledCourtIds: [COURT_ID],
          matches: [
            {
              id: matchId,
              status: "waiting",
              courtId: null,
              teamAPlayerIds: [PLAYER_A],
              teamBPlayerIds: [PLAYER_B],
              matchType: "open_double",
            },
          ],
          ...extraDaily,
        },
      },
    },
  };
}

function createFilterApi(rows) {
  let filtered = [...rows];
  const api = {
    select: () => api,
    eq(col, val) {
      filtered = filtered.filter((row) => String(row[col]) === String(val));
      return api;
    },
    order: () => api,
    limit: () => api,
    maybeSingle: async () => ({ data: filtered[0] || null, error: null }),
    then: (resolve) => resolve({ data: filtered, error: null }),
  };
  return api;
}

function createUserClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: ACTOR } }, error: null }),
    },
    rpc: async (name) => {
      if (
        name === "canonical_tournament_assert_tenant" ||
        name === "canonical_tournament_assert_permission" ||
        name === "canonical_tournament_get" ||
        name === "team_tournament_get_setup"
      ) {
        return { data: { ok: true }, error: null };
      }
      return { data: null, error: { message: "unexpected " + name } };
    },
  };
}

function identityAdapter(tenantId = TENANT_A) {
  return {
    async resolveSubjectIdentity() {
      return {
        status: "OK",
        data: {
          subjectId: REF_UUID,
          canonicalSubjectId: REF_UUID,
          role: "REFEREE",
          status: "active",
          active: true,
          tenantId,
        },
      };
    },
  };
}

function createServiceClient({
  canonical = [],
  team = [],
  live = [],
  persist,
} = {}) {
  return {
    rpc:
      persist ||
      (async (name, args) => {
        if (name === COMPETITION_ASSIGNMENT_IDEMPOTENCY_RPC.PAYLOAD_HASH) {
          return { data: "peek-hash", error: null };
        }
        if (name === COMPETITION_ASSIGNMENT_IDEMPOTENCY_RPC.CHECK) {
          return { data: { replay: false }, error: null };
        }
        if (name === COMPETITION_ASSIGNMENT_MUTATION_RPC.ASSIGN) {
          return {
            data: {
              ok: true,
              replayed: false,
              assignmentId: "asg-1",
              version: 1,
              matchId: args.p_match_id,
              role: "PRIMARY",
              refereeUserId: args.p_referee_user_id,
              status: "active",
            },
            error: null,
          };
        }
        return { data: null, error: { message: "unexpected rpc " + name } };
      }),
    from(table) {
      if (table === "canonical_tournaments") return createFilterApi(canonical);
      if (table === "team_tournaments") return createFilterApi(team);
      if (table === "match_live_states") return createFilterApi(live);
      if (table === "referee_assignments") return createFilterApi([]);
      return createFilterApi([]);
    },
  };
}

test("IDX1 INTERNAL canonical match still indexed", () => {
  const index = extractCanonicalMatchIndex({
    id: "tourn-internal",
    status: "active",
    payload: {
      events: [
        {
          id: "event-1",
          status: "open",
          matches: [
            {
              id: MATCH_INTERNAL,
              status: "SCHEDULED",
              entryAId: "a",
              entryBId: "b",
              scheduledAt: "2026-08-20T10:00:00.000Z",
              physicalCourtId: COURT_ID,
              durationMinutes: 45,
            },
          ],
        },
      ],
    },
  });
  assert.equal(Boolean(index.matches[MATCH_INTERNAL]), true);
  assert.equal(index.matches[MATCH_INTERNAL].scheduledAt, "2026-08-20T10:00:00.000Z");
  assert.equal(index.matches[MATCH_INTERNAL].physicalCourtId, COURT_ID);
  assert.equal(Boolean(index.matches["tourn-internal"]), false);
  assert.equal(Boolean(index.matches["event-1"]), false);
});

test("IDX2 TEAM match/matchup still indexed", () => {
  const index = extractCanonicalMatchIndex({
    id: "tourn-team",
    status: "active",
    payload: {
      matchups: [
        {
          matchupId: MATCHUP_TEAM,
          id: MATCHUP_TEAM,
          teamAId: "team-a",
          teamBId: "team-b",
          status: "READY",
        },
      ],
      matches: [{ id: MATCH_TEAM, status: "READY", sides: { a: 1, b: 2 } }],
    },
  });
  assert.equal(Boolean(index.matchups[MATCHUP_TEAM]), true);
  assert.equal(Boolean(index.matches[MATCHUP_TEAM]), true);
  assert.equal(Boolean(index.matches[MATCH_TEAM]), true);
});

test("IDX3 OFFICIAL existing canonical match shape still indexed", () => {
  const index = extractCanonicalMatchIndex({
    id: "tourn-official",
    status: "active",
    mode: "official",
    payload: {
      matches: [
        {
          matchId: MATCH_OFFICIAL,
          status: "READY_TO_START",
          entryAId: "oa",
          entryBId: "ob",
          scheduledStart: "2026-08-20T11:00:00.000Z",
          courtId: COURT_ID,
        },
      ],
    },
  });
  assert.equal(Boolean(index.matches[MATCH_OFFICIAL]), true);
  assert.equal(index.matches[MATCH_OFFICIAL].scheduledStart, "2026-08-20T11:00:00.000Z");
});

test("IDX4-IDX6 DAILY_PLAY payload.settings.dailyPlay.matches indexed for disabled and enabled", () => {
  const disabled = extractCanonicalMatchIndex(
    dailyCanonical({
      id: TOURN_DISABLED,
      matchId: MATCH_DISABLED,
      refereeFeatureEnabled: false,
    })
  );
  const enabled = extractCanonicalMatchIndex(
    dailyCanonical({
      id: TOURN_ENABLED,
      matchId: MATCH_ENABLED,
      refereeFeatureEnabled: true,
    })
  );
  assert.equal(Boolean(disabled.matches[MATCH_DISABLED]), true);
  assert.equal(Boolean(enabled.matches[MATCH_ENABLED]), true);
  assert.equal(disabled.matches[MATCH_DISABLED].matchId, MATCH_DISABLED);
  assert.equal(enabled.matches[MATCH_ENABLED].matchId, MATCH_ENABLED);
});

test("IDX7 canonical tournament root id is not indexed as a match", () => {
  const row = dailyCanonical({
    id: TOURN_DISABLED,
    matchId: MATCH_DISABLED,
    refereeFeatureEnabled: false,
  });
  const index = extractCanonicalMatchIndex(row);
  assert.equal(Boolean(index.matches[TOURN_DISABLED]), false);
  assert.equal(Boolean(index.matches[MATCH_DISABLED]), true);
});

test("IDX8 dailyPlay settings object id is not indexed as a match", () => {
  const row = dailyCanonical({
    id: TOURN_DISABLED,
    matchId: MATCH_DISABLED,
    refereeFeatureEnabled: false,
    extraDaily: { id: "daily-settings-id", status: "open" },
  });
  const index = extractCanonicalMatchIndex(row);
  assert.equal(Boolean(index.matches["daily-settings-id"]), false);
  assert.equal(Boolean(index.matches[MATCH_DISABLED]), true);
});

test("IDX9 courtId is not indexed as a match", () => {
  const index = extractCanonicalMatchIndex({
    id: TOURN_DISABLED,
    status: "active",
    payload: {
      settings: {
        courts: [{ id: COURT_ID, status: "active" }],
        dailyPlay: {
          matches: [
            {
              id: MATCH_DISABLED,
              status: "waiting",
              courtId: COURT_ID,
              court: { id: COURT_ID, status: "active" },
            },
          ],
        },
      },
    },
  });
  assert.equal(Boolean(index.matches[COURT_ID]), false);
  assert.equal(Boolean(index.matches[MATCH_DISABLED]), true);
});

test("IDX10 participant/player/team IDs are not indexed as a match", () => {
  const index = extractCanonicalMatchIndex({
    id: TOURN_DISABLED,
    status: "active",
    payload: {
      settings: {
        dailyPlay: {
          matches: [
            {
              id: MATCH_DISABLED,
              status: "waiting",
              teamAPlayerIds: [PLAYER_A],
              teamBPlayerIds: [PLAYER_B],
              players: [
                { id: PLAYER_A, status: "checked_in" },
                { id: PLAYER_B, status: "checked_in" },
              ],
            },
          ],
        },
      },
    },
  });
  assert.equal(Boolean(index.matches[PLAYER_A]), false);
  assert.equal(Boolean(index.matches[PLAYER_B]), false);
  assert.equal(Boolean(index.matches[MATCH_DISABLED]), true);
});

test("IDX11 unrecognized nested object with id/status is not automatically indexed", () => {
  const index = extractCanonicalMatchIndex({
    id: "tourn-x",
    status: "active",
    payload: {
      ledger: { id: "ledger-1", status: "open" },
      metadata: { id: "meta-1", status: "published" },
      unknownBucket: { id: "spoof-match", status: "SCHEDULED" },
    },
  });
  assert.equal(Boolean(index.matches["tourn-x"]), false);
  assert.equal(Boolean(index.matches["ledger-1"]), false);
  assert.equal(Boolean(index.matches["meta-1"]), false);
  assert.equal(Boolean(index.matches["spoof-match"]), false);
});

test("IDX12 duplicate same match ID is normalized once", () => {
  const index = extractCanonicalMatchIndex({
    id: "tourn-dup",
    status: "active",
    payload: {
      matches: [
        { id: MATCH_INTERNAL, status: "SCHEDULED", scheduledAt: "2026-08-20T08:00:00.000Z" },
        { id: MATCH_INTERNAL, status: "READY", scheduledAt: "2026-08-20T09:00:00.000Z" },
      ],
    },
  });
  assert.equal(Object.keys(index.matches).length, 1);
  assert.equal(index.matches[MATCH_INTERNAL].scheduledAt, "2026-08-20T08:00:00.000Z");
});

test("IDX13-IDX15 matchup, schedule, and physicalCourtId projection preserved", () => {
  const index = extractCanonicalMatchIndex({
    id: "tourn-proj",
    status: "active",
    payload: {
      matchups: [{ matchupId: MATCHUP_TEAM, teamAId: "ta", teamBId: "tb", status: "READY" }],
      schedule: [
        {
          id: MATCH_INTERNAL,
          status: "SCHEDULED",
          scheduledAt: "2026-08-20T12:00:00.000Z",
          scheduledEnd: "2026-08-20T13:00:00.000Z",
          physicalCourtId: COURT_ID,
          durationMinutes: 60,
        },
      ],
    },
  });
  assert.equal(Boolean(index.matchups[MATCHUP_TEAM]), true);
  assert.equal(index.matches[MATCH_INTERNAL].scheduledAt, "2026-08-20T12:00:00.000Z");
  assert.equal(index.matches[MATCH_INTERNAL].scheduledEnd, "2026-08-20T13:00:00.000Z");
  assert.equal(index.matches[MATCH_INTERNAL].physicalCourtId, COURT_ID);
  assert.equal(index.matches[MATCH_INTERNAL].durationMinutes, 60);
});

test("Adapter B Daily projection source remains payload.settings.dailyPlay.matches", () => {
  const adapterB = read(
    "src/features/referee-v5/server/mapCanonicalIdentityToAdapterBModeState.js"
  );
  assert.match(adapterB, /payload\.settings\?\.dailyPlay/);
  assert.match(adapterB, /function mapDailyMatches/);
  const indexer = read(
    "src/features/competition-engine/operations/referee/assignment/server/loadCanonicalCompetitionModeState.js"
  );
  assert.match(indexer, /dailyPlay/);
  assert.doesNotMatch(indexer, /Object\.keys\(node\)/);
  assert.doesNotMatch(
    indexer,
    /resolveAuthoritativeAssignmentTenant/
  );
});

test("OWN1 Daily Disabled exact tenant+tournament+match ownership PASS", async () => {
  const row = dailyCanonical({
    id: TOURN_DISABLED,
    matchId: MATCH_DISABLED,
    refereeFeatureEnabled: false,
  });
  const resolved = await resolveAuthoritativeAssignmentTenant({
    serviceClient: createServiceClient({ canonical: [row] }),
    tournamentId: TOURN_DISABLED,
    matchId: MATCH_DISABLED,
    claimedTenantId: TENANT_A,
  });
  assert.equal(resolved.tenantId, TENANT_A);
  assert.equal(resolved.tournamentId, TOURN_DISABLED);
  assert.equal(resolved.resolvedMatchTournamentId, TOURN_DISABLED);
  assert.equal(resolved.canonicalBound, true);
});

test("OWN2 Daily Enabled exact tenant+tournament+match ownership PASS", async () => {
  const row = dailyCanonical({
    id: TOURN_ENABLED,
    matchId: MATCH_ENABLED,
    refereeFeatureEnabled: true,
  });
  const resolved = await resolveAuthoritativeAssignmentTenant({
    serviceClient: createServiceClient({ canonical: [row] }),
    tournamentId: TOURN_ENABLED,
    matchId: MATCH_ENABLED,
    claimedTenantId: TENANT_A,
  });
  assert.equal(resolved.tenantId, TENANT_A);
  assert.equal(resolved.resolvedMatchTournamentId, TOURN_ENABLED);
});

test("OWN3 Daily match + wrong tournament → CROSS_TOURNAMENT_DENIED", async () => {
  await assert.rejects(
    () =>
      resolveAuthoritativeAssignmentTenant({
        serviceClient: createServiceClient({
          canonical: [
            dailyCanonical({
              id: TOURN_DISABLED,
              matchId: MATCH_DISABLED,
              refereeFeatureEnabled: false,
            }),
            dailyCanonical({
              id: TOURN_OTHER,
              matchId: MATCH_ENABLED,
              refereeFeatureEnabled: false,
            }),
          ],
        }),
        tournamentId: TOURN_OTHER,
        matchId: MATCH_DISABLED,
        claimedTenantId: TENANT_A,
      }),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED
  );
});

test("OWN4 Daily match + wrong tenant → CROSS_TENANT_DENIED", async () => {
  await assert.rejects(
    () =>
      resolveAuthoritativeAssignmentTenant({
        serviceClient: createServiceClient({
          canonical: [
            dailyCanonical({
              id: TOURN_DISABLED,
              matchId: MATCH_DISABLED,
              refereeFeatureEnabled: false,
            }),
          ],
        }),
        tournamentId: TOURN_DISABLED,
        matchId: MATCH_DISABLED,
        claimedTenantId: TENANT_B,
      }),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED
  );
});

test("OWN5 unknown Daily match → CROSS_TOURNAMENT_DENIED", async () => {
  await assert.rejects(
    () =>
      resolveAuthoritativeAssignmentTenant({
        serviceClient: createServiceClient({
          canonical: [
            dailyCanonical({
              id: TOURN_DISABLED,
              matchId: MATCH_DISABLED,
              refereeFeatureEnabled: false,
            }),
          ],
        }),
        tournamentId: TOURN_DISABLED,
        matchId: SYNTHETIC_RECEIPT_MATCH,
        claimedTenantId: TENANT_A,
      }),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED
  );
});

test("OWN6 receipt-only synthetic match not in canonical state → CROSS_TOURNAMENT_DENIED", async () => {
  await assert.rejects(
    () =>
      resolveAuthoritativeAssignmentTenant({
        serviceClient: createServiceClient({
          canonical: [
            dailyCanonical({
              id: TOURN_DISABLED,
              matchId: MATCH_DISABLED,
              refereeFeatureEnabled: false,
            }),
          ],
        }),
        tournamentId: TOURN_DISABLED,
        matchId: "receipt-only-match",
        claimedTenantId: TENANT_A,
      }),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED
  );
});

test("OWN7 caller tournament cannot override canonical owner", async () => {
  await assert.rejects(
    () =>
      resolveAuthoritativeAssignmentTenant({
        serviceClient: createServiceClient({
          canonical: [
            dailyCanonical({
              id: TOURN_DISABLED,
              matchId: MATCH_DISABLED,
              refereeFeatureEnabled: false,
            }),
            {
              id: TOURN_OTHER,
              tenant_id: TENANT_A,
              status: "active",
              payload: { matches: [{ id: MATCH_INTERNAL, status: "SCHEDULED" }] },
            },
          ],
        }),
        tournamentId: TOURN_OTHER,
        matchId: MATCH_DISABLED,
        claimedTenantId: TENANT_A,
      }),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED
  );
});

test("OWN8 Venue cannot satisfy tenant ownership", async () => {
  await assert.rejects(
    () =>
      resolveAuthoritativeAssignmentTenant({
        serviceClient: createServiceClient({
          canonical: [
            dailyCanonical({
              id: TOURN_DISABLED,
              matchId: MATCH_DISABLED,
              refereeFeatureEnabled: false,
            }),
          ],
        }),
        tournamentId: TOURN_DISABLED,
        matchId: MATCH_DISABLED,
        claimedTenantId: VENUE_ID,
      }),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED
  );
});

test("OWN9 absence of live row is acceptable when canonical index proves match", async () => {
  const resolved = await resolveAuthoritativeAssignmentTenant({
    serviceClient: createServiceClient({
      canonical: [
        dailyCanonical({
          id: TOURN_DISABLED,
          matchId: MATCH_DISABLED,
          refereeFeatureEnabled: false,
        }),
      ],
      live: [],
    }),
    tournamentId: TOURN_DISABLED,
    matchId: MATCH_DISABLED,
    claimedTenantId: TENANT_A,
  });
  assert.equal(resolved.resolvedMatchTournamentId, TOURN_DISABLED);
});

test("OWN10 conflicting live row tournament vs canonical request → CROSS_TOURNAMENT_DENIED", async () => {
  await assert.rejects(
    () =>
      resolveAuthoritativeAssignmentTenant({
        serviceClient: createServiceClient({
          canonical: [
            dailyCanonical({
              id: TOURN_DISABLED,
              matchId: MATCH_DISABLED,
              refereeFeatureEnabled: false,
            }),
          ],
          live: [
            {
              match_id: MATCH_DISABLED,
              tenant_id: TENANT_A,
              tournament_id: TOURN_OTHER,
              status: "PRE_MATCH",
            },
          ],
        }),
        tournamentId: TOURN_DISABLED,
        matchId: MATCH_DISABLED,
        claimedTenantId: TENANT_A,
      }),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED
  );
});

test("feature flag fixture command matches canonical Daily state", () => {
  const disabled = dailyCanonical({
    id: TOURN_DISABLED,
    matchId: MATCH_DISABLED,
    refereeFeatureEnabled: false,
  });
  const enabled = dailyCanonical({
    id: TOURN_ENABLED,
    matchId: MATCH_ENABLED,
    refereeFeatureEnabled: true,
  });
  const disabledCommand = {
    competitionMode: ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY,
    refereeFeatureEnabled: false,
  };
  const enabledCommand = {
    competitionMode: ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY,
    refereeFeatureEnabled: true,
  };
  assert.equal(disabled.payload.settings.dailyPlay.refereeFeatureEnabled, false);
  assert.equal(disabledCommand.refereeFeatureEnabled, false);
  assert.equal(
    disabled.payload.settings.dailyPlay.refereeFeatureEnabled,
    disabledCommand.refereeFeatureEnabled
  );
  assert.equal(enabled.payload.settings.dailyPlay.refereeFeatureEnabled, true);
  assert.equal(enabledCommand.refereeFeatureEnabled, true);
});

test("POL1 Daily Disabled valid canonical ownership → DAILY_PLAY_NOT_APPLICABLE", async () => {
  const result = await handleCompetitionRefereeAssignmentAction({
    action: "assignReferee",
    body: {
      command: {
        tenantId: TENANT_A,
        tournamentId: TOURN_DISABLED,
        matchId: MATCH_DISABLED,
        refereeId: REF_UUID,
        expectedVersion: 0,
        idempotencyKey: "pol1-daily-off",
        competitionMode: ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY,
        refereeFeatureEnabled: false,
      },
    },
    userClient: createUserClient(),
    serviceClient: createServiceClient({
      canonical: [
        dailyCanonical({
          id: TOURN_DISABLED,
          matchId: MATCH_DISABLED,
          refereeFeatureEnabled: false,
        }),
      ],
    }),
    identityAccessAdapter: identityAdapter(),
  });
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, ASSIGNMENT_COMMAND_ERROR_CODE.DAILY_PLAY_NOT_APPLICABLE);
});

test("POL2 Daily Disabled wrong tournament → CROSS_TOURNAMENT_DENIED not NOT_APPLICABLE", async () => {
  const result = await handleCompetitionRefereeAssignmentAction({
    action: "assignReferee",
    body: {
      command: {
        tenantId: TENANT_A,
        tournamentId: TOURN_OTHER,
        matchId: MATCH_DISABLED,
        refereeId: REF_UUID,
        expectedVersion: 0,
        idempotencyKey: "pol2-wrong-tourn",
        competitionMode: ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY,
        refereeFeatureEnabled: false,
      },
    },
    userClient: createUserClient(),
    serviceClient: createServiceClient({
      canonical: [
        dailyCanonical({
          id: TOURN_DISABLED,
          matchId: MATCH_DISABLED,
          refereeFeatureEnabled: false,
        }),
        dailyCanonical({
          id: TOURN_OTHER,
          matchId: MATCH_ENABLED,
          refereeFeatureEnabled: false,
        }),
      ],
    }),
    identityAccessAdapter: identityAdapter(),
  });
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED);
  assert.notEqual(result.body.code, ASSIGNMENT_COMMAND_ERROR_CODE.DAILY_PLAY_NOT_APPLICABLE);
});

test("POL3 Daily Disabled wrong tenant → CROSS_TENANT_DENIED", async () => {
  const result = await handleCompetitionRefereeAssignmentAction({
    action: "assignReferee",
    body: {
      command: {
        tenantId: TENANT_B,
        tournamentId: TOURN_DISABLED,
        matchId: MATCH_DISABLED,
        refereeId: REF_UUID,
        expectedVersion: 0,
        idempotencyKey: "pol3-wrong-tenant",
        competitionMode: ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY,
        refereeFeatureEnabled: false,
      },
    },
    userClient: createUserClient(),
    serviceClient: createServiceClient({
      canonical: [
        dailyCanonical({
          id: TOURN_DISABLED,
          matchId: MATCH_DISABLED,
          refereeFeatureEnabled: false,
        }),
      ],
    }),
    identityAccessAdapter: identityAdapter(),
  });
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED);
});

test("POL4 Daily Enabled valid ownership continues CORE-13 assignment", async () => {
  const result = await handleCompetitionRefereeAssignmentAction({
    action: "assignReferee",
    body: {
      command: {
        tenantId: TENANT_A,
        tournamentId: TOURN_ENABLED,
        matchId: MATCH_ENABLED,
        refereeId: REF_UUID,
        expectedVersion: 0,
        idempotencyKey: "pol4-daily-on",
        competitionMode: ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY,
        refereeFeatureEnabled: true,
      },
    },
    userClient: createUserClient(),
    serviceClient: createServiceClient({
      canonical: [
        dailyCanonical({
          id: TOURN_ENABLED,
          matchId: MATCH_ENABLED,
          refereeFeatureEnabled: true,
        }),
      ],
    }),
    identityAccessAdapter: identityAdapter(),
  });
  assert.equal(result.body?.ok, true, JSON.stringify(result.body));
  assert.equal(result.body.assignmentId, "asg-1");
});

test("buildAdapterBModeState exposes indexed Daily matches without Daily-specific ownership bypass", () => {
  const modeState = buildAdapterBModeState({
    tenantId: TENANT_A,
    tournamentId: TOURN_DISABLED,
    competitionMode: "DAILY_PLAY",
    canonical: dailyCanonical({
      id: TOURN_DISABLED,
      matchId: MATCH_DISABLED,
      refereeFeatureEnabled: false,
    }),
  });
  assert.equal(Boolean(modeState.matches[MATCH_DISABLED]), true);
  assert.equal(modeState.competitionMode, "DAILY_PLAY");
  assert.equal(Boolean(modeState.matches[TOURN_DISABLED]), false);
});
