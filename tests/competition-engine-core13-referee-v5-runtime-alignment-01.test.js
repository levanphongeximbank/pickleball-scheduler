/**
 * PR #444 — Referee V5 staging runtime alignment + CORE-13 assignment
 * tenant/result-shape/idempotency contracts. Local only.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import os from "node:os";

import {
  ASSIGNMENT_COMMAND_ERROR_CODE,
  createCompetitionRefereeAssignmentCommandService,
  createInMemoryCanonicalAssignmentPersistence,
  extractCanonicalAssignmentId,
  normalizeCompetitionAssignmentResult,
} from "../src/features/competition-engine/operations/referee/assignment/index.js";
import { handleCompetitionRefereeAssignmentAction } from "../src/features/competition-engine/operations/referee/assignment/server/edgeHttpHandler.js";
import { COMPETITION_ASSIGNMENT_MUTATION_RPC } from "../src/features/competition-engine/operations/referee/assignment/persistence/createRpcCanonicalAssignmentPersistence.js";
import { resolveAuthoritativeAssignmentTenant } from "../src/features/competition-engine/operations/referee/assignment/server/resolveAuthoritativeAssignmentTenant.js";
import { CASE_CATALOG } from "../scripts/core13/core13-staging-acceptance-proofs.mjs";
import {
  createBootstrapRefereeAssignmentWriter,
  evaluateForbiddenCallerAuthority,
} from "../scripts/core13/core13-staging-fixture-writers.mjs";
import {
  createPartialFixtureReceipt,
  evaluateFixtureReceipt,
  evaluatePartialFixtureReceipt,
} from "../scripts/core13/core13-staging-fixture-receipt.mjs";
import {
  persistPartialReceiptArtifact,
} from "../scripts/core13/core13-staging-fixture-provisioner.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SQL_PKG = path.join(
  ROOT,
  "docs/competition-core-core13/referee-v5-staging-runtime-alignment"
);

const PACKAGE_LF_SHA256 = Object.freeze({
  "01_PRECHECK.sql":
    "0ef73f6d5adcd7079c8cb8cbaa9a3814c44cf57026848ec211294367f8ee56c6",
  "02_APPLY.sql":
    "ca1e01e401347248d72e1065364ab5a794db8addc6afc07eba4eb9cfeea8730d",
  "03_VERIFY.sql":
    "6073531b791e9ec9d11214452029d74ed7edf3f6482916422788e34660451f39",
  "04_ROLLBACK.sql":
    "cad5dcc1306826101e254653496eed76bccd0ac1449014e412baae80ae2cc925",
});

const CANONICAL_TRANSITION_ARGS =
  "p_tenant_id text, p_tournament_id text, p_match_id text, p_actor_id uuid, p_command_type text, p_command_payload jsonb, p_expected_state_version integer, p_expected_event_sequence bigint, p_client_mutation_id text, p_idempotency_key text, p_request_hash text, p_next_state jsonb, p_generated_events jsonb, p_state_before_hash text, p_state_after_hash text, p_state_before jsonb, p_staging_fault text";

function sha256Lf(name) {
  const raw = readFileSync(path.join(SQL_PKG, name), "utf8").replace(/\r\n/g, "\n");
  return createHash("sha256").update(raw, "utf8").digest("hex");
}

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function nextUuid(n) {
  const hex = String(n).padStart(12, "0");
  return `aaaaaaaa-aaaa-4aaa-8aaa-${hex}`;
}

function createService() {
  return createCompetitionRefereeAssignmentCommandService({
    persistence: createInMemoryCanonicalAssignmentPersistence(),
    production: false,
    authorize: () => true,
  });
}

function baseCommand(overrides = {}) {
  return {
    tenantId: "tenant-a",
    tournamentId: "tourn-a",
    matchId: "match-1",
    refereeId: "ref-001",
    actorId: "actor-1",
    actorAuthorized: true,
    expectedVersion: 0,
    idempotencyKey: "k-1",
    lifecycleState: "PRE_MATCH",
    ...overrides,
  };
}

function tableApi(rows) {
  const api = {
    select: () => api,
    eq: () => api,
    order: () => api,
    limit: () => api,
    maybeSingle: async () => ({ data: rows[0] || null, error: null }),
    then: (resolve) => resolve({ data: rows, error: null }),
  };
  return api;
}

function makeClients(options = {}) {
  const tenantId = options.tenantId || "tenant-a";
  const tournamentId = options.tournamentId || "tourn-a";
  const persisted = { tenantId: null, assignmentId: options.assignmentId || "asg-1" };
  const userClient = {
    auth: {
      getUser: async () => ({
        data: { user: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" } },
        error: null,
      }),
    },
    rpc: async (name) => {
      if (name === "canonical_tournament_assert_tenant") return { data: null, error: null };
      if (name === "canonical_tournament_assert_permission") return { data: null, error: null };
      if (name === "canonical_tournament_get") return { data: { ok: true }, error: null };
      return { data: null, error: { message: "unexpected " + name } };
    },
  };
  const serviceClient = {
    rpc: async (name, args) => {
      if (name === COMPETITION_ASSIGNMENT_MUTATION_RPC.ASSIGN) {
        persisted.tenantId = args.p_tenant_id;
        return {
          data: {
            ok: true,
            replayed: false,
            assignmentId: persisted.assignmentId,
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
    },
    from(table) {
      if (table === "canonical_tournaments") {
        return tableApi([
          {
            id: tournamentId,
            tenant_id: tenantId,
            club_id: "club-a",
            status: "active",
            mode: "internal",
            payload: {
              matches: [
                {
                  id: "match-1",
                  status: "SCHEDULED",
                  entryAId: "a",
                  entryBId: "b",
                },
              ],
            },
            external_key: tournamentId,
          },
        ]);
      }
      if (table === "team_tournaments") return tableApi([]);
      if (table === "match_live_states") return tableApi([]);
      if (table === "profiles") {
        return tableApi([
          {
            id: "aaaa1111-bbbb-4ccc-8ddd-eeeeffffffff",
            display_name: "Ref",
            role: "REFEREE",
            venue_id: "venue-home",
            status: "active",
          },
        ]);
      }
      if (table === "referee_assignments") return tableApi([]);
      return tableApi([]);
    },
  };
  return { userClient, serviceClient, persisted };
}

const identityAccessAdapter = {
  async resolveSubjectIdentity() {
    return {
      status: "OK",
      data: {
        subjectId: "aaaa1111-bbbb-4ccc-8ddd-eeeeffffffff",
        canonicalSubjectId: "aaaa1111-bbbb-4ccc-8ddd-eeeeffffffff",
        role: "REFEREE",
        status: "active",
        active: true,
        tenantId: "tenant-a",
        venueId: "venue-home",
      },
    };
  },
};

test("catalog remains exactly 29 cases", () => {
  assert.equal(CASE_CATALOG.length, 29);
});

test("SQL package lock + canonical V5D32 signature, not V5D1", () => {
  for (const [name, expected] of Object.entries(PACKAGE_LF_SHA256)) {
    assert.equal(sha256Lf(name), expected, name);
  }
  const readme = readFileSync(path.join(SQL_PKG, "00_README.md"), "utf8");
  for (const [name, expected] of Object.entries(PACKAGE_LF_SHA256)) {
    assert.match(readme, new RegExp(expected));
    assert.match(readme, new RegExp(name.replace(".", "\\.")));
  }
  const apply = readFileSync(path.join(SQL_PKG, "02_APPLY.sql"), "utf8");
  const precheck = readFileSync(path.join(SQL_PKG, "01_PRECHECK.sql"), "utf8");
  const verify = readFileSync(path.join(SQL_PKG, "03_VERIFY.sql"), "utf8");
  const rollback = readFileSync(path.join(SQL_PKG, "04_ROLLBACK.sql"), "utf8");
  assert.match(apply, /p_state_before jsonb default null/);
  assert.match(apply, /p_staging_fault text default null/);
  assert.match(apply, /notify pgrst, 'reload schema'/i);
  assert.doesNotMatch(apply, /create table/i);
  assert.doesNotMatch(apply, /enable row level security/i);
  assert.match(apply, /revoke all on function public\.referee_v5_commit_match_transition[\s\S]+from public, anon, authenticated/);
  assert.match(apply, /grant execute on function public\.referee_v5_commit_match_transition[\s\S]+to service_role/);
  assert.doesNotMatch(apply, /grant execute[\s\S]+to authenticated/);
  assert.doesNotMatch(apply, /grant execute[\s\S]+to anon/);
  assert.match(precheck, new RegExp(CANONICAL_TRANSITION_ARGS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(verify, /overload\.transition/);
  assert.match(rollback, /ROLLBACK_REFUSED/);
  const v5d1 = read("docs/v5/referee-v5/PHASE_V5D1_REFEREE_HARDENING.sql");
  assert.match(v5d1, /p_state_after_hash text\s*\) returns jsonb/);
  assert.doesNotMatch(
    apply.split("create or replace function public.referee_v5_commit_match_transition")[1].split("$$")[0],
    /p_state_after_hash text\s*\) returns jsonb/
  );
});

test("Edge/runtime RPC contract matches authored SQL package", () => {
  const rpc = read("src/features/referee-v5/persistence/RefereeV5RpcAtomicCommitService.js");
  const edge = read("src/features/referee-v5/server/edgeHttpHandler.js");
  const apply = readFileSync(path.join(SQL_PKG, "02_APPLY.sql"), "utf8");
  assert.match(rpc, /COMMIT_TRANSITION/);
  assert.match(rpc, /p_command_type:/);
  assert.match(rpc, /p_next_state:/);
  assert.match(rpc, /p_generated_events:/);
  assert.match(rpc, /p_state_before:/);
  assert.match(edge, /referee_v5_commit_match_transition/);
  assert.match(edge, /action === "apply-command"/);
  assert.match(apply, /referee_v5_commit_match_transition/);
  assert.match(apply, /p_state_before jsonb default null/);
  const init = read("src/features/referee-v5/services/refereeV5EdgeClient.js");
  assert.match(init, /INITIALIZE_EXECUTION: "initialize-execution"/);
  assert.doesNotMatch(rpc, /p_expected_version:/);
});

test("tenant omit passes; foreign tenant denied; venue is not tenant authority", async () => {
  const { userClient, serviceClient, persisted } = makeClients();
  const omitted = await handleCompetitionRefereeAssignmentAction({
    action: "assignReferee",
    body: {
      command: {
        tournamentId: "tourn-a",
        matchId: "match-1",
        refereeId: "aaaa1111-bbbb-4ccc-8ddd-eeeeffffffff",
        expectedVersion: 0,
        idempotencyKey: "idem-omit",
      },
    },
    userClient,
    serviceClient,
    identityAccessAdapter,
  });
  assert.equal(omitted.body?.ok, true, JSON.stringify(omitted.body));
  assert.equal(omitted.body.assignmentId, "asg-1");
  assert.equal(persisted.tenantId, "tenant-a");

  const matching = await handleCompetitionRefereeAssignmentAction({
    action: "assignReferee",
    body: {
      command: {
        tenantId: "tenant-a",
        tournamentId: "tourn-a",
        matchId: "match-1",
        refereeId: "aaaa1111-bbbb-4ccc-8ddd-eeeeffffffff",
        expectedVersion: 0,
        idempotencyKey: "idem-match",
      },
    },
    userClient,
    serviceClient,
    identityAccessAdapter,
  });
  assert.equal(matching.body?.ok, true);

  const foreign = await handleCompetitionRefereeAssignmentAction({
    action: "assignReferee",
    body: {
      command: {
        tenantId: "tenant-b",
        tournamentId: "tourn-a",
        matchId: "match-1",
        refereeId: "aaaa1111-bbbb-4ccc-8ddd-eeeeffffffff",
        expectedVersion: 0,
        idempotencyKey: "idem-foreign",
      },
    },
    userClient,
    serviceClient,
    identityAccessAdapter,
  });
  assert.equal(foreign.body?.ok, false);
  assert.equal(foreign.body?.code, ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED);

  await assert.rejects(
    () =>
      resolveAuthoritativeAssignmentTenant({
        serviceClient,
        tournamentId: "tourn-a",
        claimedTenantId: "venue-home",
      }),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CROSS_TENANT_DENIED
  );
});

test("assignmentId is canonical; malformed success fails closed", async () => {
  assert.equal(
    extractCanonicalAssignmentId({
      ok: true,
      assignment: { assignmentId: "asg-nested" },
    }),
    "asg-nested"
  );
  const malformed = normalizeCompetitionAssignmentResult("assignReferee", {
    ok: true,
    command: "assignReferee",
  });
  assert.equal(malformed.ok, false);
  assert.equal(
    malformed.code,
    ASSIGNMENT_COMMAND_ERROR_CODE.MALFORMED_ASSIGNMENT_RESULT
  );

  const writer = createBootstrapRefereeAssignmentWriter({
    organizerAccessToken: "tok",
    edgeBaseUrl: "https://example.test",
    createClient: () => ({
      getMatchAssignmentVersion: async () => ({ ok: true, version: 0 }),
      assignReferee: async () => ({
        ok: true,
        assignment: { assignmentId: "asg-from-edge" },
      }),
    }),
  });
  const ok = await writer({
    tournamentId: nextUuid(1),
    matchId: nextUuid(2),
    refereeId: nextUuid(3),
    lifecycleState: "PRE_MATCH",
    runId: "run-id",
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.assignmentId, "asg-from-edge");

  const closed = createBootstrapRefereeAssignmentWriter({
    organizerAccessToken: "tok",
    edgeBaseUrl: "https://example.test",
    createClient: () => ({
      getMatchAssignmentVersion: async () => ({ ok: true, version: 0 }),
      assignReferee: async () => ({ ok: true, assignment: {} }),
    }),
  });
  const denied = await closed({
    tournamentId: nextUuid(1),
    matchId: nextUuid(2),
    refereeId: nextUuid(3),
    lifecycleState: "PRE_MATCH",
  });
  assert.equal(denied.ok, false);
  assert.match(denied.detail, /assignmentId/);
  assert.equal(evaluateForbiddenCallerAuthority({ tenantId: "t" }).ok, false);
});

test("idempotent replay returns same assignmentId; duplicate active denied", async () => {
  const service = createService();
  const first = await service.assignReferee(
    baseCommand({ idempotencyKey: "idem-same", refereeId: "ref-001" })
  );
  const replay = await service.assignReferee(
    baseCommand({
      idempotencyKey: "idem-same",
      refereeId: "ref-001",
      expectedVersion: 0,
    })
  );
  assert.equal(replay.replayed, true);
  assert.equal(replay.assignment.assignmentId, first.assignment.assignmentId);

  const uniqueness = await service.assignReferee(
    baseCommand({
      idempotencyKey: "idem-other-key",
      refereeId: "ref-001",
      expectedVersion: 1,
    })
  );
  assert.equal(uniqueness.ok, true);
  assert.equal(uniqueness.assignment.assignmentId, first.assignment.assignmentId);
  assert.equal(uniqueness.uniquenessReconciled, true);

  await assert.rejects(
    () =>
      service.assignReferee(
        baseCommand({
          idempotencyKey: "idem-stale-same-ref",
          refereeId: "ref-001",
          expectedVersion: 0,
        })
      ),
    (err) => err.code === ASSIGNMENT_COMMAND_ERROR_CODE.STALE_WRITE
  );

  await assert.rejects(
    () =>
      service.assignReferee(
        baseCommand({
          idempotencyKey: "idem-other-ref",
          refereeId: "ref-OTHER",
          expectedVersion: 1,
          candidates: [
            { refereeId: "ref-001", active: true },
            { refereeId: "ref-OTHER", active: true },
          ],
        })
      ),
    (err) =>
      err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED
  );
});

test("partial receipt is PARTIAL, secret-free, and not valid SSOT", () => {
  const partial = createPartialFixtureReceipt({
    runId: "run-partial",
    abortReason: "START_MATCH schema cache",
    ownedIds: {
      tournaments: ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1"],
      matches: ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1"],
      assignments: ["cccccccc-cccc-4ccc-8ccc-ccccccccccc1"],
    },
  });
  assert.equal(partial.status, "PARTIAL");
  assert.equal(partial.validLive29CaseSsot, false);
  assert.equal(evaluatePartialFixtureReceipt(partial).ok, true);
  assert.equal(evaluateFixtureReceipt(partial).ok, false);
  const dir = mkdtempSync(path.join(os.tmpdir(), "core13-partial-"));
  const persisted = persistPartialReceiptArtifact(partial, dir);
  assert.equal(persisted.ok, true);
  assert.match(persisted.filePath, /\.partial\.json$/);
});

test("fixture writers still refuse Team/Daily as Internal authority", () => {
  const writers = read("scripts/core13/core13-staging-fixture-writers.mjs");
  const provisioner = read("scripts/core13/core13-staging-fixture-provisioner.mjs");
  assert.match(writers, /TEAM_RPC_AS_INTERNAL_FIXTURE_AUTHORITY=DENY/);
  assert.match(writers, /DAILY_WRITER_AS_INTERNAL_FIXTURE_AUTHORITY=DENY/);
  assert.match(provisioner, /initializeMatchExecution/);
  assert.match(provisioner, /startMatchLive/);
  assert.doesNotMatch(provisioner, /from\("match_live_states"\)\.insert/);
  assert.doesNotMatch(provisioner, /from\("referee_assignments"\)\.insert/);
  assert.equal(existsSync(path.join(SQL_PKG, "02_APPLY.sql")), true);
});
