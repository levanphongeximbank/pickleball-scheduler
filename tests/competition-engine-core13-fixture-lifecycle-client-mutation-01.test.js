/**
 * CORE-13 fixture Referee V5 lifecycle — clientMutationId, CAS chain, error envelope.
 * Acceptance tooling only. No remote fixture mutation.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  buildFixtureLifecycleClientMutationId,
  buildFixtureLifecycleIdempotencyKey,
  createRefereeV5LifecycleWriters,
  FIXTURE_LIFECYCLE_WRITER_COMMAND_TYPES,
  MATCH_EVENT_TYPE,
  REQUIRED_WRITER_PORTS,
} from "../scripts/core13/core13-staging-fixture-writers.mjs";
import { createReadyDailyPreflightSnapshot } from "../scripts/core13/core13-staging-fixture-preflight.mjs";
import {
  buildFixtureAbortReason,
  evaluateFixtureReceipt,
  evaluatePartialFixtureReceipt,
  FIXTURE_ERROR_STAGE,
  normalizeFixtureLifecycleError,
  receiptContainsSecrets,
  STAGING_PROJECT_REF,
  stripReceiptSecrets,
} from "../scripts/core13/core13-staging-fixture-receipt.mjs";
import {
  materializeReceiptFromWriters,
  persistPartialReceiptArtifact,
  RUNTIME_ARTIFACT_DIR,
  runFixtureProvisionerCli,
} from "../scripts/core13/core13-staging-fixture-provisioner.mjs";

function nextUuid(seq) {
  return `aaaaaaaa-bbbb-4ccc-8ddd-${String(seq).padStart(12, "0")}`;
}

function createStubWriters() {
  let seq = 20;
  const writers = {};
  for (const name of REQUIRED_WRITER_PORTS) {
    writers[name] = async () => ({ id: nextUuid(seq++), ok: true, assignmentId: nextUuid(seq++) });
  }
  writers.resolveExistingTenantFixture = async ({ scope } = {}) => ({
    id: scope === "TENANT_B" ? "core13-qa-tenant-b" : "core13-qa-tenant-a",
    tenantId: scope === "TENANT_B" ? "core13-qa-tenant-b" : "core13-qa-tenant-a",
    ok: true,
  });
  writers.resolveQaIdentitySet = async () => ({
    ok: true,
    organizerA: {
      userId: "11111111-1111-4111-8111-111111111111",
      tenantId: "core13-qa-tenant-a",
      role: "VENUE_OWNER",
      credentialPresent: true,
    },
    organizerB: {
      userId: "22222222-2222-4222-8222-222222222222",
      tenantId: "core13-qa-tenant-b",
      role: "VENUE_OWNER",
      credentialPresent: true,
    },
    refereeA: {
      userId: "33333333-3333-4333-8333-333333333333",
      tenantId: "core13-qa-tenant-a",
      role: "REFEREE",
      status: "ACTIVE",
      credentialPresent: true,
    },
    replacementReferee: {
      userId: "44444444-4444-4444-8444-444444444444",
      tenantId: "core13-qa-tenant-a",
      role: "REFEREE",
      status: "ACTIVE",
    },
    inactiveReferee: {
      userId: "55555555-5555-4555-8555-555555555555",
      tenantId: "core13-qa-tenant-a",
      role: "REFEREE",
      status: "suspended",
      contract01Evidence: {
        subjectId: "55555555-5555-4555-8555-555555555555",
        canonicalSubjectId: "55555555-5555-4555-8555-555555555555",
        role: "REFEREE",
        status: "suspended",
        active: false,
        tenantId: "core13-qa-tenant-a",
        venueId: null,
        source: "identity",
      },
    },
    nonCanonicalSubject: {
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      classification: "NON_CANONICAL_EXPECTED_ABSENT",
    },
  });
  writers.resolveDailyPlayPreflight = async ({ tenantId } = {}) =>
    createReadyDailyPreflightSnapshot({
      tenantId: tenantId || "core13-qa-tenant-a",
      clubTenantId: tenantId || "core13-qa-tenant-a",
    });
  return writers;
}

const ORGANIZER_CONTEXT = Object.freeze({
  userId: "11111111-1111-4111-8111-111111111111",
  tenantId: "core13-qa-tenant-a",
  role: "VENUE_OWNER",
  accessToken: "org-tok",
});

const REFEREE_CONTEXT = Object.freeze({
  userId: "33333333-3333-4333-8333-333333333333",
  tenantId: "core13-qa-tenant-a",
  role: "REFEREE",
  accessToken: "ref-tok",
});

const AUTHORIZED_ENV = Object.freeze({
  CORE13_FIXTURE_PROVISION_GO: "YES",
  STAGING_MUTATION_GO: "YES",
  PICK_VN_ENV: "staging",
  TARGET_PROJECT_REF: STAGING_PROJECT_REF,
  STAGING_ORGANIZER_ACCESS_TOKEN: "org-tok",
  STAGING_SUPABASE_URL: `https://${STAGING_PROJECT_REF}.supabase.co`,
});

const BOOTSTRAP = Object.freeze({ assignmentId: nextUuid(9), active: true });
const LIFECYCLE_PORTS = Object.freeze([
  "startMatchLive",
  "recordScoreEvent",
  "pauseMatchLive",
  "declareForfeit",
  "finalizeMatchLive",
]);

function assertNoSecrets(value) {
  const blob = JSON.stringify(value);
  assert.equal(blob.includes("SECRET_ACCESS_TOKEN"), false);
  assert.equal(blob.includes("SECRET_JWT"), false);
  assert.equal(blob.includes("SECRET_PASSWORD"), false);
  assert.equal(blob.includes("SECRET_SERVICE_ROLE"), false);
  assert.equal(blob.includes("Bearer SECRET"), false);
  assert.equal(receiptContainsSecrets(value), false);
}

test("helpers are deterministic and distinct by run/match/command", () => {
  const base = { runId: "run-a", matchId: nextUuid(1), commandType: MATCH_EVENT_TYPE.START_MATCH };
  const mutationA = buildFixtureLifecycleClientMutationId(base);
  const idemA = buildFixtureLifecycleIdempotencyKey(base);
  assert.ok(mutationA);
  assert.ok(idemA);
  assert.notEqual(mutationA, idemA);
  assert.equal(buildFixtureLifecycleClientMutationId(base), mutationA);
  assert.equal(buildFixtureLifecycleIdempotencyKey(base), idemA);
  assert.match(mutationA, /CLIENT_MUTATION$/);
  assert.match(idemA, /IDEMPOTENCY$/);

  const score = buildFixtureLifecycleClientMutationId({
    ...base,
    commandType: MATCH_EVENT_TYPE.TEAM_A_WON_RALLY,
  });
  const otherMatch = buildFixtureLifecycleClientMutationId({
    ...base,
    matchId: nextUuid(2),
  });
  const otherRun = buildFixtureLifecycleClientMutationId({
    ...base,
    runId: "run-b",
  });
  assert.notEqual(score, mutationA);
  assert.notEqual(otherMatch, mutationA);
  assert.notEqual(otherRun, mutationA);
  assert.equal(buildFixtureLifecycleClientMutationId({ commandType: "START_MATCH" }), "");
});

test("every lifecycle writer sends non-empty clientMutationId and idempotencyKey", async () => {
  const seen = [];
  const lifecycle = createRefereeV5LifecycleWriters({
    refereeAccessToken: REFEREE_CONTEXT.accessToken,
    edgeBaseUrl: "https://example.test",
    applyCommand: async (request) => {
      seen.push({ port: "apply", ...request });
      return { ok: true, stateVersion: 1, lastEventSequence: 1 };
    },
    finalize: async (request) => {
      seen.push({ port: "finalize", ...request });
      return { ok: true, stateVersion: 3, lastEventSequence: 3 };
    },
  });

  for (const port of LIFECYCLE_PORTS) {
    const result = await lifecycle[port]({
      tournamentId: nextUuid(1),
      matchId: nextUuid(2),
      runId: "run-mutation",
      bootstrapAssignmentProof: BOOTSTRAP,
    });
    assert.equal(result.ok, true, port);
    assert.ok(result.clientMutationId, port);
    assert.ok(result.idempotencyKey, port);
    assert.notEqual(result.clientMutationId, result.idempotencyKey, port);
    const commandType = FIXTURE_LIFECYCLE_WRITER_COMMAND_TYPES[port];
    assert.equal(
      result.clientMutationId,
      buildFixtureLifecycleClientMutationId({
        runId: "run-mutation",
        matchId: nextUuid(2),
        commandType,
      }),
      port
    );
    assert.equal(
      result.idempotencyKey,
      buildFixtureLifecycleIdempotencyKey({
        runId: "run-mutation",
        matchId: nextUuid(2),
        commandType,
      }),
      port
    );
  }

  const applyCalls = seen.filter((row) => row.port === "apply");
  assert.equal(applyCalls.length, 4);
  for (const call of applyCalls) {
    assert.ok(call.clientMutationId);
    assert.ok(call.idempotencyKey);
    assert.equal(Object.prototype.hasOwnProperty.call(call, "tenantId"), false);
    assert.equal(Object.prototype.hasOwnProperty.call(call, "actor"), false);
  }
  const finalizeCall = seen.find((row) => row.port === "finalize");
  assert.ok(finalizeCall.idempotencyKey);
  assert.equal(finalizeCall.forceComplete, false);
  assert.equal(Object.prototype.hasOwnProperty.call(finalizeCall, "clientMutationId"), false);
});

test("applyLiveLifecycle chains canonical stateVersion/lastEventSequence", async () => {
  const writers = createStubWriters();
  const captured = [];
  writers.initializeMatchExecution = async () => ({
    ok: true,
    stateVersion: 0,
    lastEventSequence: 0,
  });
  writers.startMatchLive = async (input) => {
    captured.push({ port: "startMatchLive", ...input });
    return { ok: true, stateVersion: 1, lastEventSequence: 1 };
  };
  writers.recordScoreEvent = async (input) => {
    captured.push({ port: "recordScoreEvent", ...input });
    return { ok: true, stateVersion: 2, lastEventSequence: 2 };
  };
  writers.pauseMatchLive = async (input) => {
    captured.push({ port: "pauseMatchLive", ...input });
    return { ok: true, stateVersion: 2, lastEventSequence: 2 };
  };
  writers.declareForfeit = async (input) => {
    captured.push({ port: "declareForfeit", ...input });
    return { ok: true, stateVersion: 2, lastEventSequence: 2 };
  };
  writers.finalizeMatchLive = async (input) => {
    captured.push({ port: "finalizeMatchLive", ...input });
    return { ok: true, stateVersion: 3, lastEventSequence: 3 };
  };

  const result = await materializeReceiptFromWriters({
    writers,
    allowExecute: true,
    runId: "run-cas-chain",
  });
  assert.equal(result.ok, true);

  const score = captured.find((row) => row.port === "recordScoreEvent");
  assert.ok(score);
  assert.equal(score.expectedVersion, 1);
  assert.equal(score.expectedSequence, 1);
  const startForScore = captured.find(
    (row) => row.port === "startMatchLive" && row.matchId === score.matchId
  );
  assert.equal(startForScore.expectedVersion, 0);
  assert.equal(startForScore.expectedSequence, 0);

  const pause = captured.find((row) => row.port === "pauseMatchLive");
  assert.equal(pause.expectedVersion, 1);
  assert.equal(pause.expectedSequence, 1);

  const forfeit = captured.find((row) => row.port === "declareForfeit");
  assert.equal(forfeit.expectedVersion, 1);
  assert.equal(forfeit.expectedSequence, 1);
  const finalize = captured.find((row) => row.port === "finalizeMatchLive");
  assert.equal(finalize.expectedVersion, 2);
  assert.equal(finalize.matchId, forfeit.matchId);
});

async function materializeWithStartFailure(edgeResult, runId = "run-start-fail") {
  const later = [];
  const writers = createStubWriters();
  writers.startMatchLive = async () => edgeResult;
  writers.recordScoreEvent = async () => {
    later.push("recordScoreEvent");
    return { ok: true };
  };
  writers.pauseMatchLive = async () => {
    later.push("pauseMatchLive");
    return { ok: true };
  };
  writers.declareForfeit = async () => {
    later.push("declareForfeit");
    return { ok: true };
  };
  writers.finalizeMatchLive = async () => {
    later.push("finalizeMatchLive");
    return { ok: true };
  };
  const result = await materializeReceiptFromWriters({
    writers,
    allowExecute: true,
    runId,
  });
  return { result, later };
}

test("START_MATCH VALIDATION_FAILED preserves envelope and PARTIAL receipt", async () => {
  const { result, later } = await materializeWithStartFailure({
    ok: false,
    httpStatus: 400,
    code: "VALIDATION_FAILED",
    error: "commit_failed",
    currentVersion: 0,
    currentSequence: 0,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
  });
  assert.equal(result.ok, false);
  assert.deepEqual(later, []);
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.validLive29CaseSsot, false);
  assert.equal(result.partialReceipt.status, "PARTIAL");
  assert.equal(result.partialReceipt.validLive29CaseSsot, false);
  assert.equal(evaluatePartialFixtureReceipt(result.partialReceipt).ok, true);
  assert.equal(evaluateFixtureReceipt(result.partialReceipt).ok, false);
  assert.equal(result.failureEnvelope.httpStatus, 400);
  assert.equal(result.failureEnvelope.code, "VALIDATION_FAILED");
  assert.equal(result.failureEnvelope.error, "commit_failed");
  assert.equal(result.failureEnvelope.currentVersion, 0);
  assert.equal(result.failureEnvelope.currentSequence, 0);
  assert.equal(result.failureEnvelope.commandType, "START_MATCH");
  assert.equal(result.failureEnvelope.writerPort, "startMatchLive");
  assert.equal(result.failureEnvelope.stage, FIXTURE_ERROR_STAGE.REFEREE_V5_LIFECYCLE);
  assert.notEqual(result.detail, "provision aborted");
  assert.match(result.detail, /VALIDATION_FAILED/);
  assert.match(result.partialReceipt.abortReason, /VALIDATION_FAILED/);
  assert.equal(result.partialReceipt.failureEnvelope.code, "VALIDATION_FAILED");
});

test("MATCH_STATE_CONFLICT and REFEREE_NOT_ASSIGNED keep distinct envelopes", async () => {
  const conflict = await materializeWithStartFailure(
    {
      ok: false,
      httpStatus: 409,
      code: "MATCH_STATE_CONFLICT",
      error: "version conflict",
      currentVersion: 1,
      currentSequence: 1,
      commandType: MATCH_EVENT_TYPE.START_MATCH,
    },
    "run-conflict"
  );
  assert.equal(conflict.result.failureEnvelope.httpStatus, 409);
  assert.equal(conflict.result.failureEnvelope.code, "MATCH_STATE_CONFLICT");
  assert.match(conflict.result.detail, /MATCH_STATE_CONFLICT/);
  assert.notEqual(conflict.result.detail, "provision aborted");

  const denied = await materializeWithStartFailure(
    {
      ok: false,
      httpStatus: 403,
      code: "REFEREE_NOT_ASSIGNED",
      error: "not assigned",
      commandType: MATCH_EVENT_TYPE.START_MATCH,
    },
    "run-forbidden"
  );
  assert.equal(denied.result.failureEnvelope.httpStatus, 403);
  assert.equal(denied.result.failureEnvelope.code, "REFEREE_NOT_ASSIGNED");
  assert.match(denied.result.detail, /REFEREE_NOT_ASSIGNED/);
  assert.notEqual(denied.result.detail, conflict.result.detail);
});

test("invalid JSON transport failure is classified without collapsing to generic abort", async () => {
  const { result } = await materializeWithStartFailure(
    {
      ok: false,
      httpStatus: 502,
      code: "VALIDATION_FAILED",
      error: "Invalid JSON response",
      commandType: MATCH_EVENT_TYPE.START_MATCH,
    },
    "run-invalid-json"
  );
  assert.equal(result.ok, false);
  assert.equal(result.status, "PARTIAL");
  assert.equal(result.failureEnvelope.transport, "INVALID_JSON");
  assert.match(result.detail, /Invalid JSON|INVALID_JSON/);
  assert.notEqual(result.detail, "provision aborted");
});

test("nested secrets never appear in partial receipt or error envelope", async () => {
  const { result } = await materializeWithStartFailure(
    {
      ok: false,
      httpStatus: 400,
      code: "VALIDATION_FAILED",
      error: "commit_failed",
      currentVersion: 0,
      currentSequence: 0,
      commandType: MATCH_EVENT_TYPE.START_MATCH,
      accessToken: "SECRET_ACCESS_TOKEN",
      Authorization: "Bearer SECRET_JWT",
      password: "SECRET_PASSWORD",
      serviceRoleKey: "SECRET_SERVICE_ROLE",
      nested: {
        headers: { Authorization: "Bearer SECRET_JWT" },
        auth: {
          accessToken: "SECRET_ACCESS_TOKEN",
          refreshToken: "SECRET_ACCESS_TOKEN",
          jwt: "SECRET_JWT",
          token: "SECRET_JWT",
        },
        credentials: {
          password: "SECRET_PASSWORD",
          service_role_key: "SECRET_SERVICE_ROLE",
        },
      },
    },
    "run-secret-safe"
  );
  assert.equal(result.ok, false);
  assert.equal(result.partialReceipt.status, "PARTIAL");
  assert.equal(result.partialReceipt.validLive29CaseSsot, false);
  assertNoSecrets(result.failureEnvelope);
  assertNoSecrets(result.partialReceipt);
  assertNoSecrets({
    detail: result.detail,
    abortReason: result.partialReceipt.abortReason,
    logs: [result.failureEnvelope, result.partialReceipt],
  });
  const dir = mkdtempSync(path.join(os.tmpdir(), "core13-secret-"));
  const persisted = persistPartialReceiptArtifact(result.partialReceipt, dir);
  assert.equal(persisted.ok, true);
  const raw = readFileSync(persisted.filePath, "utf8");
  assert.equal(raw.includes("SECRET_ACCESS_TOKEN"), false);
  assert.equal(raw.includes("SECRET_JWT"), false);
  assert.equal(raw.includes("SECRET_PASSWORD"), false);
  assert.equal(raw.includes("SECRET_SERVICE_ROLE"), false);
});

test("error normalizer copies only supplied safe fields", () => {
  const envelope = normalizeFixtureLifecycleError(
    { ok: false, httpStatus: 400, code: "VALIDATION_FAILED" },
    { stage: FIXTURE_ERROR_STAGE.REFEREE_V5_LIFECYCLE, writerPort: "startMatchLive" }
  );
  assert.deepEqual(Object.keys(envelope).sort(), [
    "code",
    "httpStatus",
    "stage",
    "writerPort",
  ]);
  assert.equal(envelope.error, undefined);
  assert.equal(envelope.detail, undefined);
  const stripped = stripReceiptSecrets({
    extra: {
      accessToken: "SECRET_ACCESS_TOKEN",
      nested: [{ Authorization: "Bearer SECRET_JWT", password: "SECRET_PASSWORD" }],
    },
  });
  assert.equal(stripped.extra.accessToken, undefined);
  assert.equal(stripped.extra.nested[0].Authorization, undefined);
  assert.equal(stripped.extra.nested[0].password, undefined);
  assert.equal(
    buildFixtureAbortReason({ code: "VALIDATION_FAILED", error: "commit_failed" }),
    "VALIDATION_FAILED commit_failed"
  );
});

test("CLI persists PARTIAL receipt with envelope and does not claim live-29 SSOT", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "core13-partial-cli-"));
  const writers = createStubWriters();
  writers.startMatchLive = async () => ({
    ok: false,
    httpStatus: 400,
    code: "VALIDATION_FAILED",
    error: "commit_failed",
    currentVersion: 0,
    currentSequence: 0,
    commandType: MATCH_EVENT_TYPE.START_MATCH,
  });
  const executed = await runFixtureProvisionerCli(["--provision"], AUTHORIZED_ENV, {
    allowExecute: true,
    writers,
    organizerContext: ORGANIZER_CONTEXT,
    refereeContext: REFEREE_CONTEXT,
    rootDir: dir,
    runId: "run-cli-partial-obs",
  });
  assert.equal(executed.ok, false);
  assert.equal(executed.status, "PARTIAL");
  assert.equal(executed.validLive29CaseSsot, false);
  assert.equal(executed.failureEnvelope.code, "VALIDATION_FAILED");
  assert.equal(executed.partialReceipt.status, "PARTIAL");
  assert.equal(executed.partialReceipt.validLive29CaseSsot, false);
  const filePath = path.join(dir, RUNTIME_ARTIFACT_DIR, "run-cli-partial-obs.partial.json");
  assert.equal(existsSync(filePath), true);
  const saved = JSON.parse(readFileSync(filePath, "utf8"));
  assert.equal(saved.status, "PARTIAL");
  assert.equal(saved.validLive29CaseSsot, false);
  assert.equal(saved.failureEnvelope.error, "commit_failed");
  assert.equal(evaluatePartialFixtureReceipt(saved).ok, true);
  assert.equal(evaluateFixtureReceipt(saved).ok, false);
});
