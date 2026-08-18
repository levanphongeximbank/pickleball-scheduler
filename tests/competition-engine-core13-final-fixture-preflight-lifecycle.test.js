/**
 * CORE-13 final fixture preflight, Daily CAS chain, and lifecycle evidence.
 * Local only. No Staging mutation.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  CASE_CATALOG,
} from "../scripts/core13/core13-staging-acceptance-proofs.mjs";
import {
  createReadyDailyPreflightSnapshot,
  evaluateDailyDoublesPayload,
  evaluateDailyFixturePreflight,
  evaluateSemantic29CasePreflight,
  MIN_EXISTING_ELIGIBLE_DAILY_PLAYERS_REQUIRED,
} from "../scripts/core13/core13-staging-fixture-preflight.mjs";
import {
  buildDailyCheckInIdempotencyKey,
  buildDailyCreateMatchesIdempotencyKey,
  buildDailyDoublesMatchPayload,
  createDailyPlayCanonicalMatchWriter,
  REQUIRED_WRITER_PORTS,
} from "../scripts/core13/core13-staging-fixture-writers.mjs";
import {
  COMPLETED_FINALIZED_EVIDENCE_MODEL,
  EVENT_SEQUENCE_ALONE_AS_SCORING_ACTIVE,
  evaluateFixtureReceipt,
  evaluateReceiptRemoteReconciliation,
  hydrateHarnessFixtures,
  mapAuthoritativeLifecycle,
  REQUIRED_MATCH_KEYS,
  REQUIRED_TOURNAMENT_KEYS,
} from "../scripts/core13/core13-staging-fixture-receipt.mjs";
import { materializeReceiptFromWriters } from "../scripts/core13/core13-staging-fixture-provisioner.mjs";
import { DAILY_PLAY_CODE } from "../src/features/daily-play/canonical/dailyPlayCodes.js";

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

function playerIds(count) {
  return Array.from({ length: count }, (_, i) => `dddddddd-dddd-4ddd-8ddd-${String(i + 1).padStart(12, "0")}`);
}

function createMemoryDailyService({ failStale = false } = {}) {
  let revision = 10;
  const checkedInPlayerIds = [];
  const matches = [];
  return {
    async getState() {
      return {
        ok: true,
        revision,
        dailyPlay: { revision, checkedInPlayerIds: [...checkedInPlayerIds], matches: [...matches] },
      };
    },
    async checkIn(_scope, { playerId, expectedVersion, idempotencyKey }) {
      if (!idempotencyKey) return { ok: false, code: DAILY_PLAY_CODE.IDEMPOTENCY_KEY_REQUIRED };
      if (expectedVersion !== revision) {
        return {
          ok: false,
          code: DAILY_PLAY_CODE.VERSION_CONFLICT,
          expectedVersion,
          actualVersion: revision,
        };
      }
      if (failStale) {
        return { ok: true, revision };
      }
      checkedInPlayerIds.push(playerId);
      revision += 1;
      return { ok: true, revision };
    },
    async createMatches(_scope, { matches: proposed, expectedVersion, idempotencyKey }) {
      if (!idempotencyKey) return { ok: false, code: DAILY_PLAY_CODE.IDEMPOTENCY_KEY_REQUIRED };
      if (expectedVersion !== revision) {
        return {
          ok: false,
          code: DAILY_PLAY_CODE.VERSION_CONFLICT,
          expectedVersion,
          actualVersion: revision,
        };
      }
      matches.push(...(proposed || []));
      revision += 1;
      return { ok: true, revision, matches: [...matches] };
    },
  };
}

function buildRealisticRemoteEvidence(receipt) {
  const live = {
    preMatch: null,
    overlapA: null,
    overlapB: null,
    nonOverlap: null,
    inProgress: {
      status: "in_progress",
      last_event_sequence: 1,
      state_payload: { status: "in_progress", teams: { teamA: { score: 0 }, teamB: { score: 0 } } },
    },
    scoringActive: {
      status: "in_progress",
      last_event_sequence: 2,
      state_payload: { status: "in_progress", teams: { teamA: { score: 1 }, teamB: { score: 0 } } },
    },
    locked: {
      status: "paused",
      last_event_sequence: 2,
      state_payload: { status: "paused", teams: { teamA: { score: 0 }, teamB: { score: 0 } } },
    },
    completed: {
      status: "locked",
      last_event_sequence: 2,
      locked_at: "2026-01-01T00:00:00.000Z",
      state_payload: { status: "completed", teams: { teamA: { score: 0 }, teamB: { score: 0 } } },
    },
    dailyEnabled: null,
    dailyDisabled: null,
  };
  const events = {
    inProgress: [{ command_type: "START_MATCH" }],
    scoringActive: [{ command_type: "START_MATCH" }, { command_type: "TEAM_A_WON_RALLY" }],
    locked: [{ command_type: "START_MATCH" }, { command_type: "PAUSE_MATCH" }],
    completed: [{ command_type: "START_MATCH" }, { command_type: "DECLARE_FORFEIT" }],
  };
  const revisions = {
    completed: { status: "confirmed", revision: 1, final_score: { teamA: 0, teamB: 0 } },
  };
  const matches = {};
  for (const key of REQUIRED_MATCH_KEYS) {
    const proofsArgs = {
      liveRow: live[key] || null,
      events: events[key] || [],
      resultRevision: revisions[key] || null,
      payloadMatchPresent: true,
    };
    matches[key] = {
      exists: true,
      tournamentId: String(receipt.matches[key].tournamentId),
      lifecycle: mapAuthoritativeLifecycle(proofsArgs),
      scoringEvidence: key === "scoringActive",
      engineCompleted: key === "completed",
      confirmedResultRevision: key === "completed",
      finalizedLock: key === "completed",
    };
  }
  return {
    reconcile: true,
    projectRef: receipt.projectRef,
    environment: "staging",
    primaryTournamentTenantId: receipt.tenantA.id,
    crossTournamentTenantId: receipt.tenantA.id,
    completedLifecycleTournamentTenantId: receipt.tenantA.id,
    primaryTournamentStatus: "active",
    matches,
    identities: {
      refereeA: {
        exists: true,
        role: "REFEREE",
        status: "ACTIVE",
        tenantId: receipt.tenantA.id,
        contract01Evidence: {
          subjectId: receipt.users.refereeA.id,
          role: "REFEREE",
          status: "active",
          active: true,
          tenantId: receipt.tenantA.id,
          venueId: null,
          source: "identity",
        },
      },
      replacementReferee: {
        exists: true,
        role: "REFEREE",
        status: "ACTIVE",
        tenantId: receipt.tenantA.id,
        contract01Evidence: {
          subjectId: receipt.users.replacementReferee.id,
          role: "REFEREE",
          status: "active",
          active: true,
          tenantId: receipt.tenantA.id,
          venueId: null,
          source: "identity",
        },
      },
      inactiveReferee: {
        exists: true,
        role: "REFEREE",
        status: "suspended",
        tenantId: receipt.tenantA.id,
        contract01Evidence: {
          subjectId: receipt.users.inactiveReferee.id,
          role: "REFEREE",
          status: "suspended",
          active: false,
          tenantId: receipt.tenantA.id,
          venueId: null,
          source: "identity",
        },
      },
      nonCanonicalSubject: { exists: false, role: "ABSENT", status: "ABSENT" },
    },
    schedule: { required: true, overlapConflict: true, nonOverlapConflict: false },
  };
}

test("A. Daily preflight denies 0/2/3 eligible players and accepts 4", () => {
  assert.equal(MIN_EXISTING_ELIGIBLE_DAILY_PLAYERS_REQUIRED, 4);
  assert.equal(evaluateDailyFixturePreflight(createReadyDailyPreflightSnapshot({ eligiblePlayerIds: [] })).ok, false);
  assert.equal(evaluateDailyFixturePreflight(createReadyDailyPreflightSnapshot({ eligiblePlayerIds: playerIds(2) })).ok, false);
  assert.equal(evaluateDailyFixturePreflight(createReadyDailyPreflightSnapshot({ eligiblePlayerIds: playerIds(3) })).ok, false);
  const ready = evaluateDailyFixturePreflight(createReadyDailyPreflightSnapshot({ eligiblePlayerIds: playerIds(4) }));
  assert.equal(ready.ok, true);
  assert.equal(ready.verdict, "READY");
});

test("A. Daily preflight denies wrong tenant, wrong club, and missing court", () => {
  const wrongTenant = evaluateDailyFixturePreflight(
    createReadyDailyPreflightSnapshot({
      tenantId: "tenant-b",
      expectedTenantId: "tenant-a",
      clubTenantId: "tenant-b",
    })
  );
  assert.equal(wrongTenant.ok, false);
  assert.equal(wrongTenant.verdict, "DENY");
  const wrongClub = evaluateDailyFixturePreflight(
    createReadyDailyPreflightSnapshot({
      tenantId: "tenant-a",
      expectedTenantId: "tenant-a",
      clubTenantId: "tenant-b",
    })
  );
  assert.equal(wrongClub.ok, false);
  assert.match(wrongClub.detail, /club/i);
  const noCourt = evaluateDailyFixturePreflight(
    createReadyDailyPreflightSnapshot({ hasCourtCapability: false, usableCourtCount: 0 })
  );
  assert.equal(noCourt.ok, false);
  assert.match(noCourt.detail, /court/i);
});

test("B. Daily canonical CAS chain advances N through N+5 and fails closed on stale version", async () => {
  const service = createMemoryDailyService();
  const writer = createDailyPlayCanonicalMatchWriter({ service, organizerAccessToken: "org-tok" });
  const ids = playerIds(4);
  const result = await writer({
    tenantId: "tenant-a",
    clubId: "club-a",
    tournamentId: nextUuid(1),
    runId: "run-cas",
    playerIds: ids,
    enabled: true,
  });
  assert.equal(result.ok, true);
  assert.equal(result.casTrace[0].op, "getState");
  assert.equal(result.casTrace[0].expectedVersion, 10);
  assert.deepEqual(
    result.casTrace.filter((row) => row.op === "checkIn").map((row) => `${row.from}->${row.to}`),
    ["10->11", "11->12", "12->13", "13->14"]
  );
  const create = result.casTrace.find((row) => row.op === "createMatches");
  assert.equal(create.from, 14);
  assert.equal(create.to, 15);
  assert.ok(result.id);

  const stale = createDailyPlayCanonicalMatchWriter({
    service: createMemoryDailyService({ failStale: true }),
    organizerAccessToken: "org-tok",
  });
  const denied = await stale({
    tenantId: "tenant-a",
    clubId: "club-a",
    tournamentId: nextUuid(2),
    runId: "run-stale",
    playerIds: ids,
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.code, DAILY_PLAY_CODE.VERSION_CONFLICT);
});

test("C. Daily doubles payload requires four distinct existing players", () => {
  const ids = playerIds(4);
  const ok = evaluateDailyDoublesPayload({ playerIds: ids, eligiblePlayerIds: ids });
  assert.equal(ok.ok, true);
  assert.equal(buildDailyDoublesMatchPayload({ playerIds: ids }).ok, true);
  assert.equal(buildDailyDoublesMatchPayload({ playerIds: [...ids.slice(0, 3), ids[0]] }).ok, false);
  assert.equal(
    evaluateDailyDoublesPayload({
      playerIds: ids,
      eligiblePlayerIds: ids.slice(0, 3),
    }).ok,
    false
  );
  assert.equal(evaluateDailyDoublesPayload({ playerIds: ids, fabricated: true }).ok, false);
  assert.match(buildDailyCheckInIdempotencyKey({ runId: "r", tournamentId: "t", playerId: ids[0], index: 1 }), /DAILY_CHECKIN/);
  assert.match(buildDailyCreateMatchesIdempotencyKey({ runId: "r", tournamentId: "t" }), /DAILY_CREATE_MATCHES/);
});

test("D/E. lifecycle mapper covers START-only, rally, pause, completed, and finalized lock", () => {
  assert.equal(EVENT_SEQUENCE_ALONE_AS_SCORING_ACTIVE, "DENY");
  assert.equal(COMPLETED_FINALIZED_EVIDENCE_MODEL, "ENGINE_COMPLETED_PLUS_CONFIRMED_RESULT_REVISION_PLUS_FINALIZED_LOCK");
  assert.equal(mapAuthoritativeLifecycle({ payloadMatchPresent: true }), "PRE_MATCH");
  assert.equal(mapAuthoritativeLifecycle({ liveRow: { status: "not_started", last_event_sequence: 0 } }), "PRE_MATCH");
  assert.equal(
    mapAuthoritativeLifecycle({
      liveRow: {
        status: "in_progress",
        last_event_sequence: 1,
        state_payload: { status: "in_progress", teams: { teamA: { score: 0 }, teamB: { score: 0 } } },
      },
      events: [{ command_type: "START_MATCH" }],
    }),
    "IN_PROGRESS"
  );
  assert.equal(
    mapAuthoritativeLifecycle({
      liveRow: {
        status: "in_progress",
        last_event_sequence: 2,
        state_payload: { status: "in_progress", teams: { teamA: { score: 1 }, teamB: { score: 0 } } },
      },
      events: [{ command_type: "START_MATCH" }, { command_type: "TEAM_A_WON_RALLY" }],
    }),
    "SCORING_ACTIVE"
  );
  assert.equal(
    mapAuthoritativeLifecycle({
      liveRow: {
        status: "paused",
        last_event_sequence: 2,
        state_payload: { status: "paused", teams: { teamA: { score: 0 }, teamB: { score: 0 } } },
      },
    }),
    "LOCKED"
  );
  assert.equal(
    mapAuthoritativeLifecycle({
      liveRow: {
        status: "completed",
        last_event_sequence: 2,
        state_payload: { status: "completed", teams: { teamA: { score: 0 }, teamB: { score: 0 } } },
      },
    }),
    "COMPLETED"
  );
  assert.equal(
    mapAuthoritativeLifecycle({
      liveRow: {
        status: "locked",
        locked_at: "2026-01-01T00:00:00.000Z",
        last_event_sequence: 2,
        state_payload: { status: "completed", teams: { teamA: { score: 0 }, teamB: { score: 0 } } },
      },
      resultRevision: { status: "confirmed", revision: 1 },
    }),
    "COMPLETED"
  );
  assert.equal(
    mapAuthoritativeLifecycle({
      liveRow: { status: "locked", last_event_sequence: 2, state_payload: { status: "in_progress" } },
    }),
    "UNPROVEN"
  );
  assert.notEqual(
    mapAuthoritativeLifecycle({
      liveRow: { status: "in_progress", last_event_sequence: 1 },
    }),
    "SCORING_ACTIVE"
  );
});

test("D. completed fixture uses DECLARE_FORFEIT + FINALIZE without forceComplete", async () => {
  const result = await materializeReceiptFromWriters({
    writers: createStubWriters(),
    allowExecute: true,
    runId: "run-completed-finalized",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.materializationPaths.completed, [
    "createInternalMatch",
    "initializeMatchExecution",
    "bootstrapRefereeAssignment",
    "startMatchLive",
    "declareForfeit",
    "finalizeMatchLive",
  ]);
  assert.equal(result.FORCE_COMPLETE_USED_IN_SOURCE_PLAN, "NO");
  assert.equal(result.FAKE_COMPLETED_STATUS, "DENY");
});

test("F. receipt reconciliation requires completed evidence and rejects pause/start-only as completed/scoring", async () => {
  const result = await materializeReceiptFromWriters({
    writers: createStubWriters(),
    allowExecute: true,
    runId: "run-reconcile-realistic",
  });
  assert.equal(result.ok, true);
  const remote = buildRealisticRemoteEvidence(result.receipt);
  assert.equal(evaluateReceiptRemoteReconciliation(result.receipt, remote).ok, true);
  const pausedAsCompleted = structuredClone(remote);
  pausedAsCompleted.matches.completed.lifecycle = "LOCKED";
  pausedAsCompleted.matches.completed.engineCompleted = false;
  pausedAsCompleted.matches.completed.confirmedResultRevision = false;
  pausedAsCompleted.matches.completed.finalizedLock = false;
  assert.equal(evaluateReceiptRemoteReconciliation(result.receipt, pausedAsCompleted).ok, false);
  const startOnlyAsScoring = structuredClone(remote);
  startOnlyAsScoring.matches.scoringActive.lifecycle = "IN_PROGRESS";
  startOnlyAsScoring.matches.scoringActive.scoringEvidence = false;
  assert.equal(evaluateReceiptRemoteReconciliation(result.receipt, startOnlyAsScoring).ok, false);
  const claimOverride = { ...remote, receiptClaimOverridesRemote: true };
  assert.equal(evaluateReceiptRemoteReconciliation(result.receipt, claimOverride).ok, false);
});

test("G. semantic preflight failure causes zero createCanonicalTournament calls", async () => {
  const writers = createStubWriters();
  let creates = 0;
  writers.resolveDailyPlayPreflight = async () =>
    createReadyDailyPreflightSnapshot({ eligiblePlayerIds: playerIds(2) });
  writers.createCanonicalTournament = async () => {
    creates += 1;
    return { id: nextUuid(1), ok: true };
  };
  const result = await materializeReceiptFromWriters({
    writers,
    allowExecute: true,
    runId: "run-preflight-block",
  });
  assert.equal(result.ok, false);
  assert.equal(result.verdict, "NOT_READY");
  assert.equal(creates, 0);
  assert.equal(result.createCanonicalTournamentCalls, 0);
});

test("H. full valid fixture mock hydrates all required objects and keeps catalog at 29", async () => {
  assert.equal(CASE_CATALOG.length, 29);
  assert.equal(REQUIRED_TOURNAMENT_KEYS.length, 5);
  assert.equal(REQUIRED_MATCH_KEYS.length, 10);
  const result = await materializeReceiptFromWriters({
    writers: createStubWriters(),
    allowExecute: true,
    runId: "run-full-valid",
  });
  assert.equal(result.ok, true);
  assert.equal(evaluateFixtureReceipt(result.receipt).ok, true);
  for (const key of REQUIRED_TOURNAMENT_KEYS) {
    assert.ok(result.receipt.tournaments[key]?.id);
  }
  for (const key of REQUIRED_MATCH_KEYS) {
    assert.ok(result.receipt.matches[key]?.id);
  }
  assert.equal(result.receipt.matches.dailyEnabled.lifecycle, "PRE_MATCH");
  assert.equal(result.receipt.matches.dailyDisabled.lifecycle, "PRE_MATCH");
  assert.equal(result.receipt.assignments.length, 4);
  const hydrated = hydrateHarnessFixtures(result.receipt);
  assert.ok(hydrated.tournamentA);
  assert.ok(hydrated.completedLifecycleTournament);
  assert.ok(hydrated.dailyEnabledMatch);
  assert.ok(hydrated.matchCompleted);
  assert.equal(evaluateReceiptRemoteReconciliation(result.receipt, buildRealisticRemoteEvidence(result.receipt)).ok, true);
  const semantic = evaluateSemantic29CasePreflight({
    writers: createStubWriters(),
    identities: (await createStubWriters().resolveQaIdentitySet()),
    tenantA: { id: "core13-qa-tenant-a" },
    tenantB: { id: "core13-qa-tenant-b" },
    daily: evaluateDailyFixturePreflight(createReadyDailyPreflightSnapshot()),
  });
  assert.equal(semantic.ok, true);
  assert.equal(semantic.CATALOG_CASE_COUNT, 29);
});
