/**
 * Durable RPC idempotency replay parity — H.idempotency-replay-same-command.
 * Local only. Uses existing SQL RPCs (hash + check). No second ledger.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  ASSIGNMENT_COMMAND_ERROR_CODE,
  ASSIGNMENT_LIFECYCLE_STATE,
  createCompetitionRefereeAssignmentCommandService,
} from "../src/features/competition-engine/operations/referee/assignment/index.js";
import { handleCompetitionRefereeAssignmentAction } from "../src/features/competition-engine/operations/referee/assignment/server/edgeHttpHandler.js";
import {
  COMPETITION_ASSIGNMENT_IDEMPOTENCY_RPC,
  COMPETITION_ASSIGNMENT_MUTATION_RPC,
  buildDurableAssignmentIdempotencyPayload,
  createRpcCanonicalAssignmentPersistence,
  toDurableCanonicalRole,
} from "../src/features/competition-engine/operations/referee/assignment/persistence/createRpcCanonicalAssignmentPersistence.js";

const TENANT = "tenant-a";
const TOURNAMENT = "tourn-a";
const MATCH = "11111111-1111-4111-8111-111111111111";
const MATCH_B = "22222222-2222-4222-8222-222222222222";
const REF_A = "aaaa1111-bbbb-4ccc-8ddd-eeeeffffffff";
const REF_B = "bbbb2222-cccc-4ddd-8eee-ffffaaaaaaaa";
const ACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function hashPayload(payload) {
  return createHash("md5").update(JSON.stringify(payload)).digest("hex");
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

function ledgerKey(tenantId, tournamentId, key) {
  return `${tenantId}::${tournamentId}::${key}`;
}

function createDurableBackend() {
  const assignments = [];
  const ledger = new Map();
  const audit = [];
  const rpcCounts = {
    assign: 0,
    replace: 0,
    unassign: 0,
    payloadHash: 0,
    check: 0,
  };

  function remember(args, operation, assignmentId, resultVersion, role) {
    const payload = buildDurableAssignmentIdempotencyPayload({
      operation,
      tenantId: args.p_tenant_id,
      tournamentId: args.p_tournament_id,
      matchId: args.p_match_id,
      refereeId: args.p_referee_user_id,
      newRefereeId: args.p_new_referee_user_id,
      role: args.p_role,
      expectedVersion: args.p_expected_version,
      actorId: args.p_actor_id,
      lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH,
      emergencyReplacement: args.p_emergency_replacement === true,
    });
    ledger.set(ledgerKey(args.p_tenant_id, args.p_tournament_id, args.p_idempotency_key), {
      hash: hashPayload(payload),
      assignmentId,
      resultVersion,
      operation,
      role,
    });
  }

  function serviceClient() {
    return {
      async rpc(name, args = {}) {
        if (name === COMPETITION_ASSIGNMENT_IDEMPOTENCY_RPC.PAYLOAD_HASH) {
          rpcCounts.payloadHash += 1;
          return { data: hashPayload(args.p_payload), error: null };
        }
        if (name === COMPETITION_ASSIGNMENT_IDEMPOTENCY_RPC.CHECK) {
          rpcCounts.check += 1;
          const row = ledger.get(
            ledgerKey(args.p_tenant_id, args.p_tournament_id, args.p_idempotency_key)
          );
          if (!row) return { data: { replay: false }, error: null };
          if (row.hash !== args.p_payload_hash) {
            return {
              data: null,
              error: { message: "IDEMPOTENCY_CONFLICT", details: "hash mismatch" },
            };
          }
          return {
            data: {
              replay: true,
              assignmentId: row.assignmentId,
              version: row.resultVersion,
              operation: row.operation,
              role: row.role,
            },
            error: null,
          };
        }
        if (name === COMPETITION_ASSIGNMENT_MUTATION_RPC.ASSIGN) {
          rpcCounts.assign += 1;
          const assignmentId = crypto.randomUUID();
          const role = toDurableCanonicalRole(args.p_role);
          assignments.push({
            id: assignmentId,
            tenant_id: args.p_tenant_id,
            tournament_id: args.p_tournament_id,
            match_id: args.p_match_id,
            referee_user_id: args.p_referee_user_id,
            role,
            status: "active",
            version: 1,
          });
          remember(args, "ASSIGN", assignmentId, 1, role);
          audit.push({ assignmentId, operation: "ASSIGN" });
          return {
            data: {
              ok: true,
              assignmentId,
              version: 1,
              matchId: args.p_match_id,
              role,
              refereeUserId: args.p_referee_user_id,
            },
            error: null,
          };
        }
        if (name === COMPETITION_ASSIGNMENT_MUTATION_RPC.REPLACE) {
          rpcCounts.replace += 1;
          const prior = assignments.find(
            (row) =>
              row.match_id === args.p_match_id &&
              row.status === "active" &&
              row.tenant_id === args.p_tenant_id
          );
          if (prior) prior.status = "revoked";
          const assignmentId = crypto.randomUUID();
          const role = toDurableCanonicalRole(args.p_role);
          const version = Number(prior?.version || 0) + 1;
          assignments.push({
            id: assignmentId,
            tenant_id: args.p_tenant_id,
            tournament_id: args.p_tournament_id,
            match_id: args.p_match_id,
            referee_user_id: args.p_new_referee_user_id,
            role,
            status: "active",
            version,
          });
          remember(args, "REPLACE", assignmentId, version, role);
          audit.push({ assignmentId, operation: "REPLACE" });
          return {
            data: {
              ok: true,
              assignmentId,
              version,
              matchId: args.p_match_id,
              role,
              newRefereeUserId: args.p_new_referee_user_id,
              previousAssignmentId: prior?.id || null,
            },
            error: null,
          };
        }
        if (name === COMPETITION_ASSIGNMENT_MUTATION_RPC.UNASSIGN) {
          rpcCounts.unassign += 1;
          const prior = assignments.find(
            (row) =>
              row.match_id === args.p_match_id &&
              row.status === "active" &&
              row.tenant_id === args.p_tenant_id
          );
          const version = Number(prior?.version || 0) + 1;
          if (prior) {
            prior.status = "revoked";
            prior.version = version;
          }
          remember(args, "UNASSIGN", prior?.id, version, toDurableCanonicalRole(args.p_role));
          audit.push({ assignmentId: prior?.id, operation: "UNASSIGN" });
          return {
            data: {
              ok: true,
              assignmentId: prior?.id,
              version,
              matchId: args.p_match_id,
              status: "revoked",
              role: toDurableCanonicalRole(args.p_role),
            },
            error: null,
          };
        }
        return { data: null, error: { message: `unexpected rpc ${name}` } };
      },
      from(table) {
        if (table === "referee_assignments") return createFilterApi(assignments);
        return createFilterApi([]);
      },
    };
  }

  return {
    assignments,
    ledger,
    audit,
    rpcCounts,
    serviceClient: serviceClient(),
    mutateCurrentAssignment(assignmentId, patch) {
      const row = assignments.find((item) => item.id === assignmentId);
      if (row) Object.assign(row, patch);
    },
  };
}

function createService(backend) {
  return createCompetitionRefereeAssignmentCommandService({
    persistence: createRpcCanonicalAssignmentPersistence({
      serviceClient: backend.serviceClient,
    }),
    production: true,
  });
}

function baseCommand(overrides = {}) {
  return {
    tenantId: TENANT,
    tournamentId: TOURNAMENT,
    matchId: MATCH,
    refereeId: REF_A,
    actorId: ACTOR,
    expectedVersion: 0,
    idempotencyKey: "durable-h-key",
    lifecycleState: ASSIGNMENT_LIFECYCLE_STATE.PRE_MATCH,
    authorizedTenantId: TENANT,
    authorizedTournamentId: TOURNAMENT,
    ...overrides,
  };
}

test("H8 PRIMARY and REFEREE produce the same durable payload role", () => {
  const primary = buildDurableAssignmentIdempotencyPayload(
    baseCommand({ role: "PRIMARY" })
  );
  const referee = buildDurableAssignmentIdempotencyPayload(
    baseCommand({ role: "REFEREE" })
  );
  assert.equal(primary.role, "REFEREE");
  assert.deepEqual(primary, referee);
});

test("H1/H2 durable ASSIGN replay returns original result without second mutation", async () => {
  const backend = createDurableBackend();
  const service = createService(backend);
  const first = await service.assignReferee(baseCommand());
  assert.equal(first.ok, true);
  assert.equal(first.replayed, false);
  assert.equal(first.version, 1);
  assert.equal(backend.rpcCounts.assign, 1);
  const assignmentId = first.assignment.assignmentId;
  const second = await service.assignReferee(baseCommand({ expectedVersion: 0 }));
  assert.equal(second.ok, true);
  assert.equal(second.replayed, true);
  assert.equal(second.assignment.assignmentId, assignmentId);
  assert.equal(second.version, 1);
  assert.equal(backend.rpcCounts.assign, 1);
  assert.equal(backend.audit.length, 1);
  assert.equal(backend.ledger.size, 1);
});

test("H3 same key changed referee is IDEMPOTENCY_CONFLICT", async () => {
  const backend = createDurableBackend();
  const service = createService(backend);
  await service.assignReferee(baseCommand());
  await assert.rejects(
    () => service.assignReferee(baseCommand({ refereeId: REF_B })),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.IDEMPOTENCY_CONFLICT
  );
  assert.equal(backend.rpcCounts.assign, 1);
});

test("H4 same key changed match is IDEMPOTENCY_CONFLICT", async () => {
  const backend = createDurableBackend();
  const service = createService(backend);
  await service.assignReferee(baseCommand());
  await assert.rejects(
    () => service.assignReferee(baseCommand({ matchId: MATCH_B })),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.IDEMPOTENCY_CONFLICT
  );
});

test("H5 same key changed operation is IDEMPOTENCY_CONFLICT", async () => {
  const backend = createDurableBackend();
  const service = createService(backend);
  await service.assignReferee(baseCommand());
  await assert.rejects(
    () =>
      service.replaceReferee(
        baseCommand({
          operation: "REPLACE",
          newRefereeId: REF_B,
          expectedVersion: 0,
        })
      ),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.IDEMPOTENCY_CONFLICT
  );
  assert.equal(backend.rpcCounts.replace, 0);
});

test("H6 new key stale expectedVersion is STALE_WRITE", async () => {
  const backend = createDurableBackend();
  const service = createService(backend);
  await service.assignReferee(baseCommand());
  await assert.rejects(
    () =>
      service.assignReferee(
        baseCommand({
          idempotencyKey: "durable-h-stale",
          expectedVersion: 0,
        })
      ),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.STALE_WRITE
  );
  assert.equal(backend.rpcCounts.assign, 1);
});

test("H8 replay with PRIMARY vs REFEREE does not false-conflict", async () => {
  const backend = createDurableBackend();
  const service = createService(backend);
  const first = await service.assignReferee(baseCommand({ role: "PRIMARY" }));
  const second = await service.assignReferee(
    baseCommand({ role: "REFEREE", expectedVersion: 0 })
  );
  assert.equal(second.replayed, true);
  assert.equal(second.assignment.assignmentId, first.assignment.assignmentId);
  assert.equal(backend.rpcCounts.assign, 1);
});

test("H9 REPLACE exact replay does not invoke a second replacement", async () => {
  const backend = createDurableBackend();
  const service = createService(backend);
  await service.assignReferee(baseCommand({ idempotencyKey: "assign-before-replace" }));
  const replaced = await service.replaceReferee(
    baseCommand({
      idempotencyKey: "replace-key",
      newRefereeId: REF_B,
      expectedVersion: 1,
    })
  );
  const replayed = await service.replaceReferee(
    baseCommand({
      idempotencyKey: "replace-key",
      newRefereeId: REF_B,
      expectedVersion: 1,
    })
  );
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.assignment.assignmentId, replaced.assignment.assignmentId);
  assert.equal(backend.rpcCounts.replace, 1);
});

test("H10 UNASSIGN exact replay does not invoke a second revoke", async () => {
  const backend = createDurableBackend();
  const service = createService(backend);
  await service.assignReferee(baseCommand({ idempotencyKey: "assign-before-unassign" }));
  const first = await service.unassignReferee(
    baseCommand({
      idempotencyKey: "unassign-key",
      expectedVersion: 1,
    })
  );
  const second = await service.unassignReferee(
    baseCommand({
      idempotencyKey: "unassign-key",
      expectedVersion: 1,
    })
  );
  assert.equal(first.ok, true);
  assert.equal(second.replayed, true);
  assert.equal(second.assignment.assignmentId, first.assignment.assignmentId);
  assert.equal(backend.rpcCounts.unassign, 1);
});

test("H11 same key changed emergencyReplacement is IDEMPOTENCY_CONFLICT", async () => {
  const backend = createDurableBackend();
  const service = createService(backend);
  await service.assignReferee(baseCommand({ idempotencyKey: "assign-before-emerg" }));
  await service.replaceReferee(
    baseCommand({
      idempotencyKey: "emerg-key",
      newRefereeId: REF_B,
      expectedVersion: 1,
      emergencyReplacement: false,
    })
  );
  await assert.rejects(
    () =>
      service.replaceReferee(
        baseCommand({
          idempotencyKey: "emerg-key",
          newRefereeId: REF_B,
          expectedVersion: 1,
          emergencyReplacement: true,
        })
      ),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.IDEMPOTENCY_CONFLICT
  );
  assert.equal(backend.rpcCounts.replace, 1);
});

test("H12 replay result does not use later-mutated current assignment state", async () => {
  const backend = createDurableBackend();
  const service = createService(backend);
  const first = await service.assignReferee(baseCommand());
  backend.mutateCurrentAssignment(first.assignment.assignmentId, {
    version: 99,
    status: "revoked",
    referee_user_id: REF_B,
  });
  const replayed = await service.assignReferee(baseCommand({ expectedVersion: 0 }));
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.assignment.assignmentId, first.assignment.assignmentId);
  assert.equal(replayed.version, 1);
  assert.equal(replayed.assignment.version, 1);
  assert.equal(replayed.assignment.refereeId, REF_A);
  assert.equal(backend.rpcCounts.assign, 1);
});

test("H7 wrong tournament is denied before durable replay lookup", async () => {
  let checkCalled = false;
  const result = await handleCompetitionRefereeAssignmentAction({
    action: "assignReferee",
    body: {
      command: {
        tenantId: TENANT,
        tournamentId: "tourn-b",
        matchId: MATCH,
        refereeId: REF_A,
        expectedVersion: 0,
        idempotencyKey: "durable-h-key",
      },
    },
    userClient: {
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
    },
    serviceClient: {
      async rpc(name) {
        if (name === COMPETITION_ASSIGNMENT_IDEMPOTENCY_RPC.CHECK) checkCalled = true;
        if (name === COMPETITION_ASSIGNMENT_IDEMPOTENCY_RPC.PAYLOAD_HASH) checkCalled = true;
        return { data: null, error: { message: "should-not-peek" } };
      },
      from(table) {
        if (table === "canonical_tournaments") {
          return createFilterApi([
            {
              id: TOURNAMENT,
              tenant_id: TENANT,
              club_id: "club-a",
              status: "active",
              payload: {
                matches: [{ id: MATCH, status: "SCHEDULED", entryAId: "a", entryBId: "b" }],
              },
            },
            {
              id: "tourn-b",
              tenant_id: TENANT,
              club_id: "club-a",
              status: "active",
              payload: {
                matches: [{ id: MATCH_B, status: "SCHEDULED", entryAId: "c", entryBId: "d" }],
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
            subjectId: REF_A,
            canonicalSubjectId: REF_A,
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
