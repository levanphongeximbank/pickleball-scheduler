/**
 * Isolated Live29 failure-matrix repros. Local only. No Staging mutation.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ASSIGNMENT_COMMAND_ERROR_CODE,
  ASSIGNMENT_LIFECYCLE_STATE,
  createCompetitionRefereeAssignmentCommandService,
  createInMemoryCanonicalAssignmentPersistence,
} from "../src/features/competition-engine/operations/referee/assignment/index.js";
import { handleCompetitionRefereeAssignmentAction } from "../src/features/competition-engine/operations/referee/assignment/server/edgeHttpHandler.js";
import { COMPETITION_ASSIGNMENT_IDEMPOTENCY_RPC, COMPETITION_ASSIGNMENT_MUTATION_RPC } from "../src/features/competition-engine/operations/referee/assignment/persistence/createRpcCanonicalAssignmentPersistence.js";
import {
  createRefereeCandidate,
  createMatchScheduleRow,
  createPopulatedSnapshotResult,
} from "../src/features/competition-core/referee-assignment/index.js";

const REF_UUID = "aaaa1111-bbbb-4ccc-8ddd-eeeeffffffff";
const ACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function createService() {
  return createCompetitionRefereeAssignmentCommandService({
    persistence: createInMemoryCanonicalAssignmentPersistence({
      clockIso: "2026-08-19T08:00:00.000Z",
    }),
    production: false,
    authorizeEmergency: (cmd) => cmd.emergencyReplacement === true,
  });
}

function baseCommand(overrides = {}) {
  return {
    tenantId: "tenant-a",
    tournamentId: "tourn-a",
    matchId: "match-1",
    refereeId: "ref-001",
    actorId: "actor-1",
    expectedVersion: 0,
    idempotencyKey: `idem-${Math.random().toString(16).slice(2)}`,
    lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH,
    authorizedTenantId: "tenant-a",
    authorizedTournamentId: "tourn-a",
    ...overrides,
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

test("E isolated: same tenant + wrong tournament is CORE13_CROSS_TOURNAMENT_DENIED", async () => {
  let assignCalled = false;
  const result = await handleCompetitionRefereeAssignmentAction({
    action: "assignReferee",
    body: {
      command: {
        tenantId: "tenant-a",
        tournamentId: "tourn-b",
        matchId: "match-1",
        refereeId: REF_UUID,
        expectedVersion: 0,
        idempotencyKey: "cross-tournament-e",
      },
    },
    userClient: createUserClient(),
    serviceClient: {
      rpc: async (name) => {
        if (name === COMPETITION_ASSIGNMENT_MUTATION_RPC.ASSIGN) assignCalled = true;
        return { data: { ok: true, assignmentId: "should-not-write" }, error: null };
      },
      from(table) {
        if (table === "canonical_tournaments") {
          return createFilterApi([
            {
              id: "tourn-a",
              tenant_id: "tenant-a",
              club_id: "club-a",
              status: "active",
              payload: { matches: [{ id: "match-1", status: "SCHEDULED", entryAId: "a", entryBId: "b" }] },
            },
            {
              id: "tourn-b",
              tenant_id: "tenant-a",
              club_id: "club-a",
              status: "active",
              payload: { matches: [{ id: "match-other", status: "SCHEDULED", entryAId: "c", entryBId: "d" }] },
            },
          ]);
        }
        if (table === "match_live_states") {
          return createFilterApi([
            {
              match_id: "match-1",
              tenant_id: "tenant-a",
              tournament_id: "tourn-a",
              status: "PRE_MATCH",
            },
          ]);
        }
        if (table === "team_tournaments") return createFilterApi([]);
        if (table === "referee_assignments") return createFilterApi([]);
        return createFilterApi([]);
      },
    },
    identityAccessAdapter: {
      async resolveSubjectIdentity() {
        return {
          status: "OK",
          data: {
            subjectId: REF_UUID,
            canonicalSubjectId: REF_UUID,
            role: "REFEREE",
            status: "active",
            active: true,
            tenantId: "tenant-a",
          },
        };
      },
    },
  });
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED);
  assert.equal(assignCalled, false);
});

test("E isolated: correct tournament proceeds; client cannot bypass with another valid tournamentId", async () => {
  const allowed = await handleCompetitionRefereeAssignmentAction({
    action: "assignReferee",
    body: {
      command: {
        tenantId: "tenant-a",
        tournamentId: "tourn-a",
        matchId: "match-1",
        refereeId: REF_UUID,
        expectedVersion: 0,
        idempotencyKey: "correct-tournament",
      },
    },
    userClient: createUserClient(),
    serviceClient: {
      rpc: async (name, args) => {
        if (name === COMPETITION_ASSIGNMENT_IDEMPOTENCY_RPC.PAYLOAD_HASH) {
          return { data: "peek-hash", error: null };
        }
        if (name === COMPETITION_ASSIGNMENT_IDEMPOTENCY_RPC.CHECK) {
          return { data: { replay: false }, error: null };
        }
        if (name === COMPETITION_ASSIGNMENT_MUTATION_RPC.ASSIGN) {
          assert.equal(args.p_tournament_id, "tourn-a");
          return {
            data: {
              ok: true,
              assignmentId: "asg-ok",
              version: 1,
              refereeUserId: REF_UUID,
              matchId: args.p_match_id,
              status: "active",
            },
            error: null,
          };
        }
        return { data: null, error: { message: "unexpected " + name } };
      },
      from(table) {
        if (table === "canonical_tournaments") {
          return createFilterApi([
            {
              id: "tourn-a",
              tenant_id: "tenant-a",
              club_id: "club-a",
              status: "active",
              payload: { matches: [{ id: "match-1", status: "SCHEDULED", entryAId: "a", entryBId: "b" }] },
            },
            {
              id: "tourn-b",
              tenant_id: "tenant-a",
              club_id: "club-a",
              status: "active",
              payload: {},
            },
          ]);
        }
        if (table === "match_live_states") {
          return createFilterApi([
            { match_id: "match-1", tenant_id: "tenant-a", tournament_id: "tourn-a", status: "PRE_MATCH" },
          ]);
        }
        if (table === "team_tournaments") return createFilterApi([]);
        if (table === "referee_assignments") return createFilterApi([]);
        return createFilterApi([]);
      },
    },
    identityAccessAdapter: {
      async resolveSubjectIdentity() {
        return {
          status: "OK",
          data: {
            subjectId: REF_UUID,
            canonicalSubjectId: REF_UUID,
            role: "REFEREE",
            status: "active",
            active: true,
            tenantId: "tenant-a",
          },
        };
      },
    },
  });
  assert.equal(allowed.body.ok, true);
});

test("G isolated: correct expectedVersion replace passes; stale assign denies STALE_WRITE", async () => {
  const service = createService();
  const assigned = await service.assignReferee(baseCommand({ idempotencyKey: "g-assign" }));
  assert.equal(assigned.ok, true);
  const replaced = await service.replaceReferee(
    baseCommand({
      newRefereeId: "ref-002",
      expectedVersion: 1,
      idempotencyKey: "g-cas-pass",
      candidates: [
        { refereeId: "ref-001", active: true },
        { refereeId: "ref-002", active: true },
      ],
    })
  );
  assert.equal(replaced.ok, true);
  assert.equal(replaced.version, 2);
  await assert.rejects(
    () =>
      service.assignReferee(
        baseCommand({ expectedVersion: 0, idempotencyKey: "g-stale", refereeId: "ref-001" })
      ),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.STALE_WRITE
  );
  await assert.rejects(
    () => service.assignReferee(baseCommand({ idempotencyKey: "g-missing-version", expectedVersion: undefined })),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.EXPECTED_VERSION_REQUIRED
  );
});

test("H isolated: same key + changed payload is IDEMPOTENCY_CONFLICT", async () => {
  const service = createService();
  const key = "h-conflict";
  await service.assignReferee(baseCommand({ idempotencyKey: key, refereeId: "ref-001" }));
  await assert.rejects(
    () =>
      service.assignReferee(
        baseCommand({
          idempotencyKey: key,
          refereeId: "ref-OTHER",
          expectedVersion: 0,
        })
      ),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.IDEMPOTENCY_CONFLICT
  );
});

test("I/J isolated: atomic replace keeps one active; IN_PROGRESS and scoring emergency pass", async () => {
  const service = createService();
  await service.assignReferee(baseCommand({ matchId: "m-pre", idempotencyKey: "i-assign" }));
  const replaced = await service.replaceReferee(
    baseCommand({
      matchId: "m-pre",
      newRefereeId: "ref-002",
      expectedVersion: 1,
      idempotencyKey: "i-replace",
      candidates: [
        { refereeId: "ref-001", active: true },
        { refereeId: "ref-002", active: true },
      ],
    })
  );
  assert.equal(replaced.ok, true);
  const listed = await service.listActiveAssignments({
    tenantId: "tenant-a",
    tournamentId: "tourn-a",
  });
  const activePre = listed.filter((row) => row.matchId === "m-pre" && row.status === "active");
  assert.equal(activePre.length, 1);
  assert.equal(activePre[0].refereeId, "ref-002");

  await service.assignReferee(
    baseCommand({
      matchId: "m-live",
      idempotencyKey: "j-seed",
      lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH,
    })
  );
  const inProgress = await service.replaceReferee(
    baseCommand({
      matchId: "m-live",
      newRefereeId: "ref-002",
      expectedVersion: 1,
      idempotencyKey: "j-in-progress",
      lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.IN_PROGRESS,
      candidates: [
        { refereeId: "ref-001", active: true },
        { refereeId: "ref-002", active: true },
      ],
    })
  );
  assert.equal(inProgress.ok, true);

  await service.assignReferee(
    baseCommand({
      matchId: "m-score",
      idempotencyKey: "j-score-seed",
      refereeId: "ref-001",
    })
  );
  const emergency = await service.replaceReferee(
    baseCommand({
      matchId: "m-score",
      newRefereeId: "ref-002",
      expectedVersion: 1,
      idempotencyKey: "j-emergency",
      lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.SCORING_ACTIVE,
      emergencyReplacement: true,
      candidates: [
        { refereeId: "ref-001", active: true },
        { refereeId: "ref-002", active: true },
      ],
    })
  );
  assert.equal(emergency.ok, true);
});

test("L isolated: inactive referee maps to CANONICAL_REFEREE_EVIDENCE_REQUIRED", async () => {
  const service = createService();
  await assert.rejects(
    () =>
      service.assignReferee(
        baseCommand({
          directorySnapshot: createPopulatedSnapshotResult([
            createRefereeCandidate({ refereeId: "ref-001", active: false }),
          ]),
        })
      ),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED
  );
});

test("L isolated: overlapping windows deny; unscheduled does not invent overlap authority", async () => {
  const service = createService();
  const first = await service.assignReferee(
    baseCommand({
      matchId: "m-overlap-a",
      startAt: "2026-08-19T10:00:00.000Z",
      endAt: "2026-08-19T11:00:00.000Z",
      scheduleSnapshot: createPopulatedSnapshotResult([
        createMatchScheduleRow({
          matchId: "m-overlap-a",
          startAt: "2026-08-19T10:00:00.000Z",
          endAt: "2026-08-19T11:00:00.000Z",
        }),
        createMatchScheduleRow({
          matchId: "m-overlap-b",
          startAt: "2026-08-19T10:30:00.000Z",
          endAt: "2026-08-19T11:30:00.000Z",
        }),
      ]),
    })
  );
  assert.equal(first.ok, true);
  await assert.rejects(
    () =>
      service.assignReferee(
        baseCommand({
          matchId: "m-overlap-b",
          startAt: "2026-08-19T10:30:00.000Z",
          endAt: "2026-08-19T11:30:00.000Z",
          scheduleSnapshot: createPopulatedSnapshotResult([
            createMatchScheduleRow({
              matchId: "m-overlap-a",
              startAt: "2026-08-19T10:00:00.000Z",
              endAt: "2026-08-19T11:00:00.000Z",
            }),
            createMatchScheduleRow({
              matchId: "m-overlap-b",
              startAt: "2026-08-19T10:30:00.000Z",
              endAt: "2026-08-19T11:30:00.000Z",
            }),
          ]),
        })
      ),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED
  );

  const unscheduled = await service.assignReferee(
    baseCommand({
      matchId: "m-unscheduled-b",
      requireScheduleWindowForMandatoryRoles: false,
      scheduled: false,
    })
  );
  assert.equal(unscheduled.ok, true);
});
