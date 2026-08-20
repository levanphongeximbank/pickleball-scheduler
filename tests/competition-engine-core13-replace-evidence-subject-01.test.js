/**
 * CORE-13 operation-aware referee evidence subject — G replace remediation.
 * Local only. Proves ASSIGN/REPLACE/UNASSIGN/READ evidence targeting.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  ASSIGNMENT_COMMAND_ERROR_CODE,
  ASSIGNMENT_LIFECYCLE_STATE,
  createCompetitionRefereeAssignmentCommandService,
} from "../src/features/competition-engine/operations/referee/assignment/index.js";
import {
  handleCompetitionRefereeAssignmentAction,
  stripBrowserAuthority,
} from "../src/features/competition-engine/operations/referee/assignment/server/edgeHttpHandler.js";
import {
  isReadOnlyAssignmentAction,
  resolveRefereeEvidenceSubjectId,
} from "../src/features/competition-engine/operations/referee/assignment/server/resolveRefereeEvidenceSubjectId.js";
import {
  COMPETITION_ASSIGNMENT_IDEMPOTENCY_RPC,
  COMPETITION_ASSIGNMENT_MUTATION_RPC,
} from "../src/features/competition-engine/operations/referee/assignment/persistence/createRpcCanonicalAssignmentPersistence.js";
import { createPopulatedSnapshotResult } from "../src/features/competition-core/referee-assignment/index.js";
import { createRefereeCandidate } from "../src/features/competition-core/referee-assignment/index.js";
import { createInMemoryCanonicalAssignmentPersistence } from "../src/features/competition-engine/operations/referee/assignment/persistence/createInMemoryCanonicalAssignmentPersistence.js";

const TENANT = "venue-staging-a";
const TOURNAMENT = "b8df6c79-afb2-4329-bf58-f4b160b7bfd8";
const MATCH = "9b049c67-ac66-4158-acfb-397e3304e1c5";
const REF_A = "ca78575b-c5bf-4d32-bd7c-cc3027fea2a5";
const REF_B = "8bb178b3-c0d8-4965-848d-2de9d73fa9d6";
const ACTOR = "13e0968b-53c5-4ba6-8ae0-dce12b1faf9c";

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

function createEdgeHarness(options = {}) {
  const lookedUp = [];
  const subjects = options.subjects || {};
  const assignmentRows = [...(options.assignments || [])];
  let assignVersion = options.assignVersion ?? 0;
  let replaceCount = 0;
  let assignmentSeq = 1;

  function subjectEvidence(subjectId) {
    const spec = subjects[subjectId];
    if (!spec) {
      return {
        status: "NOT_FOUND",
        data: { subjectId },
        reasonCodes: ["SUBJECT_NOT_FOUND"],
      };
    }
    if (spec.notFound) {
      return { status: "NOT_FOUND", data: { subjectId }, reasonCodes: ["SUBJECT_NOT_FOUND"] };
    }
    return {
      status: "OK",
      data: {
        subjectId,
        canonicalSubjectId: subjectId,
        role: spec.role || "REFEREE",
        status: spec.status || "active",
        active: spec.active !== false && String(spec.status || "active").toLowerCase() === "active",
        tenantId: spec.tenantId || TENANT,
        venueId: spec.venueId ?? spec.tenantId ?? TENANT,
      },
      reasonCodes: [],
    };
  }

  const serviceClient = {
    async rpc(name, args) {
      if (name === COMPETITION_ASSIGNMENT_IDEMPOTENCY_RPC.PAYLOAD_HASH) {
        return { data: "peek-hash", error: null };
      }
      if (name === COMPETITION_ASSIGNMENT_IDEMPOTENCY_RPC.CHECK) {
        return { data: { replay: false }, error: null };
      }
      if (name === COMPETITION_ASSIGNMENT_MUTATION_RPC.ASSIGN) {
        assignVersion += 1;
        assignmentRows.push({
          id: `asg-${assignmentSeq++}`,
          tenant_id: args.p_tenant_id,
          tournament_id: args.p_tournament_id,
          match_id: args.p_match_id,
          referee_user_id: args.p_referee_user_id,
          role: args.p_role || "REFEREE",
          status: "active",
          version: assignVersion,
        });
        return {
          data: {
            ok: true,
            replayed: false,
            assignmentId: assignmentRows.at(-1).id,
            version: assignVersion,
            matchId: args.p_match_id,
            refereeUserId: args.p_referee_user_id,
            status: "active",
          },
          error: null,
        };
      }
      if (name === COMPETITION_ASSIGNMENT_MUTATION_RPC.REPLACE) {
        replaceCount += 1;
        assignVersion += 1;
        const prior = assignmentRows.find(
          (row) =>
            row.match_id === args.p_match_id &&
            row.tenant_id === args.p_tenant_id &&
            row.tournament_id === args.p_tournament_id &&
            row.status === "active"
        );
        if (prior) {
          prior.referee_user_id = args.p_new_referee_user_id;
          prior.version = assignVersion;
        }
        return {
          data: {
            ok: true,
            replayed: false,
            assignmentId: prior?.id || `asg-${assignmentSeq++}`,
            version: assignVersion,
            matchId: args.p_match_id,
            newRefereeUserId: args.p_new_referee_user_id,
            status: "active",
          },
          error: null,
        };
      }
      if (name === COMPETITION_ASSIGNMENT_MUTATION_RPC.UNASSIGN) {
        assignVersion += 1;
        return {
          data: {
            ok: true,
            replayed: false,
            assignmentId: "asg-revoked",
            version: assignVersion,
            matchId: args.p_match_id,
            status: "revoked",
          },
          error: null,
        };
      }
      return { data: null, error: { message: "unexpected rpc " + name } };
    },
    from(table) {
      if (table === "canonical_tournaments") {
        return createFilterApi([
          {
            id: TOURNAMENT,
            tenant_id: TENANT,
            club_id: "club-a",
            status: "active",
            mode: "internal",
            payload: {
              matches: [
                {
                  id: MATCH,
                  scheduledStart: "2099-06-15T12:00:00.000Z",
                  scheduledEnd: "2099-06-15T13:00:00.000Z",
                  courtId: "court-1",
                  entryAId: "a",
                  entryBId: "b",
                  status: "SCHEDULED",
                },
              ],
            },
          },
        ]);
      }
      if (table === "match_live_states") {
        return createFilterApi([
          {
            match_id: MATCH,
            tenant_id: TENANT,
            tournament_id: TOURNAMENT,
            status: "PRE_MATCH",
          },
        ]);
      }
      if (table === "referee_assignments") return createFilterApi(assignmentRows);
      if (table === "team_tournaments") return createFilterApi([]);
      return createFilterApi([]);
    },
  };

  const userClient = {
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

  const identityAccessAdapter = {
    async resolveSubjectIdentity(context = {}) {
      const subjectId = String(context.subjectId || "").trim();
      lookedUp.push(subjectId);
      return subjectEvidence(subjectId);
    },
  };

  async function invoke(action, command) {
    return handleCompetitionRefereeAssignmentAction({
      action,
      body: { command },
      userClient,
      serviceClient,
      identityAccessAdapter,
    });
  }

  return { invoke, lookedUp, get replaceCount() { return replaceCount; } };
}

test("G1 ASSIGN resolves evidence subject to refereeId", () => {
  assert.equal(
    resolveRefereeEvidenceSubjectId("assignReferee", { refereeId: REF_A }),
    REF_A
  );
});

test("G2 REPLACE resolves evidence subject to newRefereeId not outgoing refereeId", () => {
  assert.equal(
    resolveRefereeEvidenceSubjectId("replaceReferee", {
      refereeId: REF_A,
      newRefereeId: REF_B,
    }),
    REF_B
  );
});

test("G3 REPLACE compatibility uses refereeId when newRefereeId absent", () => {
  assert.equal(
    resolveRefereeEvidenceSubjectId("replaceReferee", { refereeId: REF_B }),
    REF_B
  );
});

test("G4 REPLACE NOT_FOUND subject denies CANONICAL_REFEREE_EVIDENCE_REQUIRED", async () => {
  const harness = createEdgeHarness({
    subjects: {
      [REF_A]: { role: "REFEREE", status: "active", tenantId: TENANT },
      [REF_B]: { notFound: true },
    },
  });
  await harness.invoke("assignReferee", {
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    refereeId: REF_A,
    expectedVersion: 0,
    idempotencyKey: "assign-g4",
    competitionMode: "INTERNAL",
  });
  const result = await harness.invoke("replaceReferee", {
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    refereeId: REF_A,
    newRefereeId: REF_B,
    expectedVersion: 1,
    idempotencyKey: "replace-g4",
    competitionMode: "INTERNAL",
  });
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED);
  assert.deepEqual(harness.lookedUp.slice(-1), [REF_B]);
});

test("G5 REPLACE wrong tenant denies FOREIGN_REFEREE_DENIED", async () => {
  const harness = createEdgeHarness({
    subjects: {
      [REF_A]: { role: "REFEREE", status: "active", tenantId: TENANT },
      [REF_B]: { role: "REFEREE", status: "active", tenantId: "venue-staging-b" },
    },
  });
  await harness.invoke("assignReferee", {
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    refereeId: REF_A,
    expectedVersion: 0,
    idempotencyKey: "assign-g5",
    competitionMode: "INTERNAL",
  });
  const result = await harness.invoke("replaceReferee", {
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    refereeId: REF_A,
    newRefereeId: REF_B,
    expectedVersion: 1,
    idempotencyKey: "replace-g5",
    competitionMode: "INTERNAL",
  });
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, ASSIGNMENT_COMMAND_ERROR_CODE.FOREIGN_REFEREE_DENIED);
  assert.deepEqual(harness.lookedUp.slice(-1), [REF_B]);
});

test("G6 REPLACE inactive incoming denies canonical evidence", async () => {
  const harness = createEdgeHarness({
    subjects: {
      [REF_A]: { role: "REFEREE", status: "active", tenantId: TENANT },
      [REF_B]: { role: "REFEREE", status: "suspended", active: false, tenantId: TENANT },
    },
  });
  await harness.invoke("assignReferee", {
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    refereeId: REF_A,
    expectedVersion: 0,
    idempotencyKey: "assign-g6",
    competitionMode: "INTERNAL",
  });
  const result = await harness.invoke("replaceReferee", {
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    refereeId: REF_A,
    newRefereeId: REF_B,
    expectedVersion: 1,
    idempotencyKey: "replace-g6",
    competitionMode: "INTERNAL",
  });
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED);
});

test("G7 browser directorySnapshot spoof is stripped", () => {
  const stripped = stripBrowserAuthority({
    directorySnapshot: createPopulatedSnapshotResult([
      createRefereeCandidate({ refereeId: REF_A, active: true }),
    ]),
    candidates: [{ refereeId: REF_A }],
  });
  assert.equal(stripped.directorySnapshot, undefined);
  assert.equal(stripped.candidates, undefined);
});

test("G8 valid outgoing A with invalid incoming B denies on B lookup", async () => {
  const harness = createEdgeHarness({
    subjects: {
      [REF_A]: { role: "REFEREE", status: "active", tenantId: TENANT },
      [REF_B]: { notFound: true },
    },
  });
  await harness.invoke("assignReferee", {
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    refereeId: REF_A,
    expectedVersion: 0,
    idempotencyKey: "assign-g8",
    competitionMode: "INTERNAL",
  });
  const result = await harness.invoke("replaceReferee", {
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    refereeId: REF_A,
    newRefereeId: REF_B,
    expectedVersion: 1,
    idempotencyKey: "replace-g8",
    competitionMode: "INTERNAL",
  });
  assert.equal(result.body.ok, false);
  assert.deepEqual(harness.lookedUp.filter((id) => id === REF_A).length, 1);
  assert.deepEqual(harness.lookedUp.slice(-1), [REF_B]);
});

test("G9 REPLACE stale expectedVersion denies STALE_WRITE", async () => {
  const service = createCompetitionRefereeAssignmentCommandService({
    persistence: createInMemoryCanonicalAssignmentPersistence(),
    production: false,
  });
  await service.assignReferee({
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    refereeId: REF_A,
    actorId: ACTOR,
    expectedVersion: 0,
    idempotencyKey: "assign-g9",
    lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH,
    authorizedTenantId: TENANT,
    authorizedTournamentId: TOURNAMENT,
    directorySnapshot: createPopulatedSnapshotResult([
      createRefereeCandidate({ refereeId: REF_A, active: true }),
    ]),
  });
  await assert.rejects(
    () =>
      service.replaceReferee({
        tenantId: TENANT,
        tournamentId: TOURNAMENT,
        matchId: MATCH,
        newRefereeId: REF_B,
        actorId: ACTOR,
        expectedVersion: 0,
        idempotencyKey: "replace-g9",
        lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH,
        authorizedTenantId: TENANT,
        authorizedTournamentId: TOURNAMENT,
        directorySnapshot: createPopulatedSnapshotResult([
          createRefereeCandidate({ refereeId: REF_B, active: true }),
        ]),
      }),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.STALE_WRITE
  );
});

test("G10 REPLACE correct B + expectedVersion PASS", async () => {
  const harness = createEdgeHarness({
    subjects: {
      [REF_A]: { role: "REFEREE", status: "active", tenantId: TENANT },
      [REF_B]: { role: "REFEREE", status: "active", tenantId: TENANT },
    },
  });
  await harness.invoke("assignReferee", {
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    refereeId: REF_A,
    expectedVersion: 0,
    idempotencyKey: "assign-g10",
    competitionMode: "INTERNAL",
  });
  const result = await harness.invoke("replaceReferee", {
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    refereeId: REF_A,
    newRefereeId: REF_B,
    expectedVersion: 1,
    idempotencyKey: "replace-g10",
    competitionMode: "INTERNAL",
  });
  assert.equal(result.body.ok, true);
  assert.equal(result.body.version, 2);
  assert.deepEqual(harness.lookedUp.slice(-1), [REF_B]);
  assert.equal(harness.replaceCount, 1);
});

test("G11-G12 idempotency replay and conflict semantics preserved at command layer", async () => {
  const persistence = createInMemoryCanonicalAssignmentPersistence();
  const service = createCompetitionRefereeAssignmentCommandService({
    persistence,
    production: false,
  });
  const base = {
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    actorId: ACTOR,
    lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH,
    authorizedTenantId: TENANT,
    authorizedTournamentId: TOURNAMENT,
    directorySnapshot: createPopulatedSnapshotResult([
      createRefereeCandidate({ refereeId: REF_A, active: true }),
    ]),
  };
  await service.assignReferee({
    ...base,
    refereeId: REF_A,
    expectedVersion: 0,
    idempotencyKey: "idem-g11",
  });
  const replay = await service.assignReferee({
    ...base,
    refereeId: REF_A,
    expectedVersion: 0,
    idempotencyKey: "idem-g11",
  });
  assert.equal(replay.replayed, true);
  await assert.rejects(
    () =>
      service.assignReferee({
        ...base,
        refereeId: REF_B,
        expectedVersion: 0,
        idempotencyKey: "idem-g11",
      }),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.IDEMPOTENCY_CONFLICT
  );
});

test("G13 cross-tournament denied before durable replay", async () => {
  let checkCalled = false;
  const result = await handleCompetitionRefereeAssignmentAction({
    action: "replaceReferee",
    body: {
      command: {
        tenantId: TENANT,
        tournamentId: "other-tournament",
        matchId: MATCH,
        refereeId: REF_A,
        newRefereeId: REF_B,
        expectedVersion: 1,
        idempotencyKey: "cross-tourn",
      },
    },
    userClient: {
      auth: { getUser: async () => ({ data: { user: { id: ACTOR } }, error: null }) },
      rpc: async (name) => {
        if (name.startsWith("canonical_tournament") || name === "team_tournament_get_setup") {
          return { data: { ok: true }, error: null };
        }
        return { data: null, error: { message: "unexpected" } };
      },
    },
    serviceClient: {
      async rpc(name) {
        if (
          name === COMPETITION_ASSIGNMENT_IDEMPOTENCY_RPC.CHECK ||
          name === COMPETITION_ASSIGNMENT_IDEMPOTENCY_RPC.PAYLOAD_HASH
        ) {
          checkCalled = true;
        }
        return { data: null, error: { message: "should-not-run" } };
      },
      from(table) {
        if (table === "canonical_tournaments") {
          return createFilterApi([
            {
              id: TOURNAMENT,
              tenant_id: TENANT,
              club_id: "club-a",
              status: "active",
              payload: { matches: [{ id: MATCH, entryAId: "a", entryBId: "b" }] },
            },
          ]);
        }
        if (table === "match_live_states") {
          return createFilterApi([
            { match_id: MATCH, tenant_id: TENANT, tournament_id: TOURNAMENT, status: "PRE_MATCH" },
          ]);
        }
        return createFilterApi([]);
      },
    },
    identityAccessAdapter: {
      async resolveSubjectIdentity({ subjectId }) {
        return {
          status: "OK",
          data: {
            subjectId,
            canonicalSubjectId: subjectId,
            role: "REFEREE",
            status: "active",
            active: true,
            tenantId: TENANT,
          },
        };
      },
    },
  });
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TOURNAMENT_DENIED);
  assert.equal(checkCalled, false);
});

test("G14 cross-tenant denied", async () => {
  const harness = createEdgeHarness({
    subjects: {
      [REF_B]: { role: "REFEREE", status: "active", tenantId: "venue-staging-b" },
    },
  });
  const result = await harness.invoke("assignReferee", {
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    refereeId: REF_B,
    expectedVersion: 0,
    idempotencyKey: "cross-tenant-g14",
    competitionMode: "INTERNAL",
  });
  assert.equal(result.body.ok, false);
  assert.equal(result.body.code, ASSIGNMENT_COMMAND_ERROR_CODE.FOREIGN_REFEREE_DENIED);
});

test("G15 read actions do not require referee identity lookup", async () => {
  const lookedUp = [];
  const result = await handleCompetitionRefereeAssignmentAction({
    action: "getMatchAssignmentVersion",
    body: {
      command: {
        tenantId: TENANT,
        tournamentId: TOURNAMENT,
        matchId: MATCH,
        competitionMode: "INTERNAL",
      },
    },
    userClient: {
      auth: { getUser: async () => ({ data: { user: { id: ACTOR } }, error: null }) },
      rpc: async (name) => {
        if (name.startsWith("canonical_tournament") || name === "team_tournament_get_setup") {
          return { data: { ok: true }, error: null };
        }
        return { data: null, error: { message: "unexpected" } };
      },
    },
    serviceClient: {
      rpc: async () => ({ data: { replay: false }, error: null }),
      from(table) {
        if (table === "canonical_tournaments") {
          return createFilterApi([
            {
              id: TOURNAMENT,
              tenant_id: TENANT,
              club_id: "club-a",
              status: "active",
              payload: { matches: [{ id: MATCH, entryAId: "a", entryBId: "b" }] },
            },
          ]);
        }
        if (table === "match_live_states") {
          return createFilterApi([
            { match_id: MATCH, tenant_id: TENANT, tournament_id: TOURNAMENT, status: "PRE_MATCH" },
          ]);
        }
        if (table === "referee_assignments") return createFilterApi([]);
        return createFilterApi([]);
      },
    },
    identityAccessAdapter: {
      async resolveSubjectIdentity({ subjectId }) {
        lookedUp.push(subjectId);
        return { status: "OK", data: { subjectId, role: "REFEREE", status: "active", active: true, tenantId: TENANT } };
      },
    },
  });
  assert.equal(result.body.ok, true);
  assert.equal(lookedUp.length, 0);
  assert.equal(isReadOnlyAssignmentAction("getMatchAssignmentVersion"), true);
});

test("G16 UNASSIGN does not require incoming referee identity evidence", () => {
  assert.equal(resolveRefereeEvidenceSubjectId("unassignReferee", { refereeId: REF_A }), null);
  assert.equal(resolveRefereeEvidenceSubjectId("replaceReferee", { refereeId: REF_A, newRefereeId: REF_B }), REF_B);
});
