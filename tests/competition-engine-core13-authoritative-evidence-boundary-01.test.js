/**
 * CORE-13 authoritative evidence boundary — Adapter B reuse, real schedule,
 * no fake qualification/availability, overlap, architecture guards.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ASSIGNMENT_COMMAND_ERROR_CODE,
  ASSIGNMENT_COMPETITION_MODE,
  ASSIGNMENT_LIFECYCLE_STATE,
  CORE13_CANONICAL_ASSIGNMENT_RUNTIME,
  createCompetitionRefereeAssignmentCommandService,
  createInMemoryCanonicalAssignmentPersistence,
  isCompetitionRefereeAssignmentCommandError,
} from "../src/features/competition-engine/operations/referee/assignment/index.js";
import { handleCompetitionRefereeAssignmentAction } from "../src/features/competition-engine/operations/referee/assignment/server/edgeHttpHandler.js";
import { loadAuthoritativeAssignmentEvidence } from "../src/features/competition-engine/operations/referee/assignment/server/loadAuthoritativeAssignmentEvidence.js";
import { projectMatchScheduleFromAdapterB } from "../src/features/competition-engine/operations/referee/assignment/server/projectMatchScheduleFromAdapterB.js";
import { createTrustedServerRefereeAdapterB } from "../src/features/competition-engine/operations/referee/assignment/server/createTrustedServerRefereeAdapterB.js";
import {
  createIdentityBackedRefereeDirectoryPort,
  CONTRACT_01_CURRENT_METHODS,
  CONTRACT_01_ID,
  IDENTITY_DIRECTORY_CAPABILITY,
} from "../src/features/competition-engine/operations/referee/assignment/server/createIdentityBackedRefereeDirectoryPort.js";
import { IDENTITY_ACCESS_CONTRACT } from "../src/features/competition-engine/integration/contracts/definitions.js";
import { assertTrustedServerNoFakeSuccess } from "../src/features/competition-engine/operations/referee/assignment/server/assertTrustedServerNoFakeSuccess.js";
import { COMPETITION_ASSIGNMENT_MUTATION_RPC } from "../src/features/competition-engine/operations/referee/assignment/persistence/createRpcCanonicalAssignmentPersistence.js";
import {
  COMPETITION_REFEREE_ADAPTER_CONTRACT_ID,
  COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION,
} from "../src/features/competition-engine/integration/referee/constants.js";
import {
  createRefereeCandidate,
  createRefereeQualification,
  createRefereeAvailabilityWindow,
  createMatchScheduleRow,
  createPopulatedSnapshotResult,
  createEmptySnapshotResult,
} from "../src/features/competition-core/referee-assignment/index.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REF_UUID = "aaaa1111-bbbb-4ccc-8ddd-eeeeffffffff";
const ACTOR = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function read(rel) {
  return readFileSync(path.join(ROOT, rel), "utf8");
}

function createService() {
  return createCompetitionRefereeAssignmentCommandService({
    persistence: createInMemoryCanonicalAssignmentPersistence({
      clockIso: "2026-08-17T12:00:00.000Z",
    }),
    production: false,
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

function createQueryApi(rows, maybeSingleRow = null) {
  const api = {
    select: () => api,
    eq: () => api,
    order: () => api,
    limit: () => api,
    maybeSingle: async () => ({
      data: maybeSingleRow !== undefined ? maybeSingleRow : rows[0] || null,
      error: null,
    }),
    then: (resolve) => resolve({ data: rows, error: null }),
  };
  return api;
}

function createServiceClient({
  canonical = [
    {
      id: "tourn-a",
      tenant_id: "tenant-a",
      club_id: "club-a",
      status: "active",
      mode: "internal",
      external_key: "tourn-a",
      payload: {
        matches: [
          {
            id: "match-1",
            scheduledStart: "2026-08-17T10:00:00.000Z",
            scheduledEnd: "2026-08-17T11:00:00.000Z",
            courtId: "court-physical-1",
            entryAId: "e1",
            entryBId: "e2",
            status: "SCHEDULED",
          },
        ],
      },
    },
  ],
  team = [],
  live = [],
  profile = {
    id: REF_UUID,
    display_name: "Ref",
    role: "REFEREE",
    venue_id: "tenant-a",
    status: "active",
  },
  persist = async (name, args) => {
    if (name === COMPETITION_ASSIGNMENT_MUTATION_RPC.ASSIGN) {
      return {
        data: {
          ok: true,
          replayed: false,
          assignmentId: "asg-1",
          version: 1,
          matchId: args.p_match_id,
          role: "REFEREE",
          refereeUserId: args.p_referee_user_id,
          status: "active",
        },
        error: null,
      };
    }
    return { data: null, error: { message: "unexpected rpc " + name } };
  },
} = {}) {
  return {
    rpc: persist,
    from(table) {
      if (table === "canonical_tournaments") return createQueryApi(canonical);
      if (table === "team_tournaments") return createQueryApi(team);
      if (table === "match_live_states") return createQueryApi(live);
      if (table === "profiles") return createQueryApi(profile ? [profile] : [], profile);
      if (table === "referee_assignments") return createQueryApi([]);
      return createQueryApi([]);
    },
  };
}

function createSubjectIdentityAdapter({
  subjectId = REF_UUID,
  role = "REFEREE",
  status = "active",
  tenantId = "tenant-a",
  displayLabel = "Ref",
} = {}) {
  return {
    async resolveSubjectIdentity(context = {}) {
      return {
        sourceSystem: "identity",
        status: "OK",
        data: {
          subjectId: context.subjectId || subjectId,
          actorId: context.subjectId || subjectId,
          role,
          status,
          tenantId,
          displayLabel,
        },
        reasonCodes: [],
      };
    },
  };
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

test("Contract #08 remains frozen and Adapter B is reused server-side", () => {
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.contract08Changed, false);
  assert.equal(CORE13_CANONICAL_ASSIGNMENT_RUNTIME.adapterBServerReuse, true);
  assert.equal(COMPETITION_REFEREE_ADAPTER_CONTRACT_ID, "competition.referee.adapter.v1");
  assert.equal(COMPETITION_REFEREE_ADAPTER_CONTRACT_VERSION, "1.0.0");
  const runtime = createTrustedServerRefereeAdapterB({
    tenantId: "tenant-a",
    tournamentId: "tourn-a",
    competitionMode: "INTERNAL",
    canonical: {
      id: "tourn-a",
      tenant_id: "tenant-a",
      payload: {
        matches: [
          {
            id: "match-1",
            scheduledAt: "2026-08-17T10:00:00.000Z",
            durationMinutes: 60,
            courtId: "court-physical-1",
            entryAId: "e1",
            entryBId: "e2",
          },
        ],
      },
    },
  });
  assert.equal(runtime.contractId, COMPETITION_REFEREE_ADAPTER_CONTRACT_ID);
  assert.equal(runtime.ownsRefereeIdentity, false);
  const ctx = runtime.adapter.getMatchContext({
    tenantId: "tenant-a",
    competitionId: "tourn-a",
    matchId: "match-1",
  });
  assert.equal(ctx.matchId, "match-1");
  assert.equal(ctx.scheduledAt, "2026-08-17T10:00:00.000Z");
  assert.equal(ctx.courtId, "court-physical-1");
});

test("authoritative schedule is projected from Adapter B; no invented timestamps", () => {
  const projected = projectMatchScheduleFromAdapterB({
    matchId: "match-1",
    matchContext: { scheduledAt: "2026-08-18T09:00:00.000Z", courtId: "court-9" },
    modeMatch: {
      scheduledStart: "2026-08-18T09:00:00.000Z",
      durationMinutes: 45,
      physicalCourtId: "court-9",
    },
  });
  assert.equal(projected.scheduled, true);
  assert.equal(projected.startAt, "2026-08-18T09:00:00.000Z");
  assert.equal(projected.endAt, "2026-08-18T09:45:00.000Z");
  assert.equal(projected.courtId, "court-9");
  assert.equal(projected.source, "ADAPTER_B_GET_MATCH_CONTEXT");

  const unscheduled = projectMatchScheduleFromAdapterB({
    matchId: "match-open",
    matchContext: { scheduledAt: null, courtId: null },
    modeMatch: {},
  });
  assert.equal(unscheduled.scheduled, false);
  assert.equal(unscheduled.startAt, null);
  assert.equal(unscheduled.endAt, null);
  assert.equal(unscheduled.assignmentBeforeSchedule, true);
});

test("trusted-server loader uses Adapter B schedule; Identity directory requires Contract #01 subject lookup", async () => {
  await assert.rejects(
    () =>
      loadAuthoritativeAssignmentEvidence({
        serviceClient: createServiceClient(),
        tenantId: "tenant-a",
        tournamentId: "tourn-a",
        matchId: "match-1",
        refereeId: REF_UUID,
        competitionMode: "INTERNAL",
      }),
    (err) =>
      isCompetitionRefereeAssignmentCommandError(err) &&
      err.code === ASSIGNMENT_COMMAND_ERROR_CODE.NOT_CONFIGURED &&
      err.details?.sharedContractCapabilityGap === true
  );

  const evidence = await loadAuthoritativeAssignmentEvidence({
    serviceClient: createServiceClient(),
    tenantId: "tenant-a",
    tournamentId: "tourn-a",
    matchId: "match-1",
    refereeId: REF_UUID,
    competitionMode: "INTERNAL",
    identityAccessAdapter: createSubjectIdentityAdapter(),
  });
  assert.equal(evidence.adapterBReused, true);
  assert.equal(evidence.authoritativeScheduleSource, "ADAPTER_B_GET_MATCH_CONTEXT");
  assert.equal(evidence.startAt, "2026-08-17T10:00:00.000Z");
  assert.equal(evidence.endAt, "2026-08-17T11:00:00.000Z");
  assert.equal(evidence.courtId, "court-physical-1");
  assert.equal(evidence.refereeQualificationEvidence, "NOT_CONFIGURED");
  assert.equal(evidence.refereeAvailabilityEvidence, "NOT_CONFIGURED");
  assert.equal(evidence.requireQualification, false);
  assert.equal(evidence.requireAvailability, false);
  assert.equal(evidence.qualificationSnapshot.items.length, 0);
  assert.equal(evidence.availabilitySnapshot.items.length, 0);
  assert.equal(evidence.directorySnapshot.items[0].refereeId, REF_UUID);
  assert.equal(evidence.directorySnapshot.items[0].active, true);
  assert.equal(
    evidence.refereeIdentityEvidence,
    IDENTITY_DIRECTORY_CAPABILITY.SUBJECT_IDENTITY
  );
});

test("inactive referee is denied by CORE-13", async () => {
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
    (err) =>
      isCompetitionRefereeAssignmentCommandError(err) &&
      err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED
  );
});

test("required qualification missing fails closed; unconfigured mode is not forced", async () => {
  const service = createService();
  const allowed = await service.assignReferee(baseCommand());
  assert.equal(allowed.ok, true);

  await assert.rejects(
    () =>
      service.assignReferee(
        baseCommand({
          requireQualification: true,
          qualificationSnapshot: createEmptySnapshotResult("missing"),
        })
      ),
    (err) =>
      isCompetitionRefereeAssignmentCommandError(err) &&
      err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED
  );

  const qualified = await service.assignReferee(
    baseCommand({
      matchId: "match-qual",
      requireQualification: true,
      startAt: "2026-08-18T10:00:00.000Z",
      endAt: "2026-08-18T11:00:00.000Z",
      qualificationSnapshot: createPopulatedSnapshotResult([
        createRefereeQualification({
          qualificationId: "qual-1",
          refereeId: "ref-001",
          roleCode: "PRIMARY",
          validFrom: "2026-01-01T00:00:00.000Z",
          validTo: "2027-01-01T00:00:00.000Z",
        }),
      ]),
      availabilitySnapshot: createEmptySnapshotResult(),
    })
  );
  assert.equal(qualified.ok, true);
});

test("unavailable referee denied only where availability is required", async () => {
  const service = createService();
  const notConfigured = await service.assignReferee(
    baseCommand({
      matchId: "match-avail-off",
      startAt: "2026-08-18T10:00:00.000Z",
      endAt: "2026-08-18T11:00:00.000Z",
      requireAvailability: false,
    })
  );
  assert.equal(notConfigured.ok, true);

  await assert.rejects(
    () =>
      service.assignReferee(
        baseCommand({
          matchId: "match-avail-on",
          startAt: "2026-08-18T10:00:00.000Z",
          endAt: "2026-08-18T11:00:00.000Z",
          requireAvailability: true,
          availabilitySnapshot: createPopulatedSnapshotResult([
            createRefereeAvailabilityWindow({
              windowId: "w1",
              refereeId: "ref-001",
              startAt: "2026-08-18T12:00:00.000Z",
              endAt: "2026-08-18T13:00:00.000Z",
            }),
          ]),
        })
      ),
    (err) =>
      isCompetitionRefereeAssignmentCommandError(err) &&
      err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED &&
      String(err.message || "").includes("REFEREE_UNAVAILABLE")
  );
});

test("overlapping real schedule windows conflict; non-overlapping are allowed", async () => {
  const service = createService();
  const first = await service.assignReferee(
    baseCommand({
      matchId: "m-overlap-a",
      startAt: "2026-08-19T10:00:00.000Z",
      endAt: "2026-08-19T11:00:00.000Z",
      courtId: "court-1",
      scheduleSnapshot: createPopulatedSnapshotResult([
        createMatchScheduleRow({
          matchId: "m-overlap-a",
          startAt: "2026-08-19T10:00:00.000Z",
          endAt: "2026-08-19T11:00:00.000Z",
          courtId: "court-1",
        }),
        createMatchScheduleRow({
          matchId: "m-overlap-b",
          startAt: "2026-08-19T10:30:00.000Z",
          endAt: "2026-08-19T11:30:00.000Z",
          courtId: "court-2",
        }),
        createMatchScheduleRow({
          matchId: "m-nonoverlap",
          startAt: "2026-08-19T12:00:00.000Z",
          endAt: "2026-08-19T13:00:00.000Z",
          courtId: "court-1",
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
          courtId: "court-2",
          expectedVersion: 0,
          scheduleSnapshot: createPopulatedSnapshotResult([
            createMatchScheduleRow({
              matchId: "m-overlap-a",
              startAt: "2026-08-19T10:00:00.000Z",
              endAt: "2026-08-19T11:00:00.000Z",
              courtId: "court-1",
            }),
            createMatchScheduleRow({
              matchId: "m-overlap-b",
              startAt: "2026-08-19T10:30:00.000Z",
              endAt: "2026-08-19T11:30:00.000Z",
              courtId: "court-2",
            }),
          ]),
        })
      ),
    (err) =>
      isCompetitionRefereeAssignmentCommandError(err) &&
      err.code === ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED
  );

  const later = await service.assignReferee(
    baseCommand({
      matchId: "m-nonoverlap",
      startAt: "2026-08-19T12:00:00.000Z",
      endAt: "2026-08-19T13:00:00.000Z",
      courtId: "court-1",
      expectedVersion: 0,
      scheduleSnapshot: createPopulatedSnapshotResult([
        createMatchScheduleRow({
          matchId: "m-overlap-a",
          startAt: "2026-08-19T10:00:00.000Z",
          endAt: "2026-08-19T11:00:00.000Z",
          courtId: "court-1",
        }),
        createMatchScheduleRow({
          matchId: "m-nonoverlap",
          startAt: "2026-08-19T12:00:00.000Z",
          endAt: "2026-08-19T13:00:00.000Z",
          courtId: "court-1",
        }),
      ]),
    })
  );
  assert.equal(later.ok, true);
});

test("trusted-server assign uses real Adapter B schedule and ignores browser snapshots", async () => {
  const result = await handleCompetitionRefereeAssignmentAction({
    action: "assignReferee",
    body: {
      command: {
        tenantId: "tenant-a",
        tournamentId: "tourn-a",
        matchId: "match-1",
        refereeId: REF_UUID,
        actorId: "spoofed",
        expectedVersion: 0,
        idempotencyKey: "idem-evidence",
        startAt: "1999-01-01T00:00:00.000Z",
        endAt: "1999-01-01T01:00:00.000Z",
        directorySnapshot: { forged: true },
        qualificationSnapshot: { forged: true },
      },
    },
    userClient: createUserClient(),
    serviceClient: createServiceClient(),
    identityAccessAdapter: createSubjectIdentityAdapter(),
  });
  assert.equal(result.body?.ok, true, JSON.stringify(result.body));
  assert.equal(result.body.originatingActorId, ACTOR);
});

test("non-canonical Identity role is denied", async () => {
  const result = await handleCompetitionRefereeAssignmentAction({
    action: "assignReferee",
    body: {
      command: {
        tenantId: "tenant-a",
        tournamentId: "tourn-a",
        matchId: "match-1",
        refereeId: REF_UUID,
        expectedVersion: 0,
        idempotencyKey: "idem-player",
      },
    },
    userClient: createUserClient(),
    serviceClient: createServiceClient(),
    identityAccessAdapter: createSubjectIdentityAdapter({ role: "PLAYER" }),
  });
  assert.equal(result.body?.ok, false);
  assert.equal(
    result.body.code,
    ASSIGNMENT_COMMAND_ERROR_CODE.CANONICAL_REFEREE_EVIDENCE_REQUIRED
  );
});

test("required qualification on trusted server fails closed when capability missing", async () => {
  const result = await handleCompetitionRefereeAssignmentAction({
    action: "assignReferee",
    body: {
      command: {
        tenantId: "tenant-a",
        tournamentId: "tourn-a",
        matchId: "match-1",
        refereeId: REF_UUID,
        expectedVersion: 0,
        idempotencyKey: "idem-req-qual",
        requireQualification: true,
      },
    },
    userClient: createUserClient(),
    serviceClient: createServiceClient(),
    identityAccessAdapter: createSubjectIdentityAdapter(),
  });
  assert.equal(result.body?.ok, false);
  assert.equal(result.body.code, ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED);
});

test("architecture guard: no fake schedule/qual/avail and no Identity private persistence bypass", () => {
  const result = assertTrustedServerNoFakeSuccess(ROOT);
  assert.equal(result.ok, true, result.failures.join("; "));
  const contract = read(
    "src/features/competition-engine/integration/referee/constants.js"
  );
  assert.match(contract, /competition\.referee\.adapter\.v1/);
  assert.match(contract, /resolveRefereeIdentity/);
  const loader = read(
    "src/features/competition-engine/operations/referee/assignment/server/loadAuthoritativeAssignmentEvidence.js"
  );
  assert.doesNotMatch(loader, /2026-08-17T10:00:00\.000Z/);
  assert.doesNotMatch(loader, /\.from\(\s*["']profiles["']\s*\)/);
  const directory = read(
    "src/features/competition-engine/operations/referee/assignment/server/createIdentityBackedRefereeDirectoryPort.js"
  );
  assert.doesNotMatch(directory, /\.from\(\s*["']profiles["']\s*\)/);
  assert.deepEqual([...IDENTITY_ACCESS_CONTRACT.requiredMethods], [
    "resolveActorIdentity",
    "getAuthorizationEvidence",
    "getCapabilityEvidence",
  ]);
  assert.deepEqual([...CONTRACT_01_CURRENT_METHODS], [
    "resolveActorIdentity",
    "getAuthorizationEvidence",
    "getCapabilityEvidence",
  ]);
  assert.equal(CONTRACT_01_ID, "competition.identity-access.adapter.v1");
});

test("Contract #01 Adapter B does not provide subject directory; inactive/foreign fail closed when evidence exists", async () => {
  const productionPort = createIdentityBackedRefereeDirectoryPort({
    identityAccessAdapter: {
      resolveActorIdentity() {
        return { data: { actorId: REF_UUID, role: "REFEREE" } };
      },
      getAuthorizationEvidence() {
        return { grantedPermissions: [] };
      },
      getCapabilityEvidence() {
        return { grantedPermissions: [] };
      },
    },
  });
  assert.equal(
    productionPort.source,
    IDENTITY_DIRECTORY_CAPABILITY.NOT_CONFIGURED
  );
  await assert.rejects(
    () =>
      productionPort.resolveRefereeDirectory({
        refereeId: REF_UUID,
        tenantId: "tenant-a",
      }),
    (err) =>
      isCompetitionRefereeAssignmentCommandError(err) &&
      err.code === ASSIGNMENT_COMMAND_ERROR_CODE.NOT_CONFIGURED &&
      err.details?.contractId === CONTRACT_01_ID
  );

  const inactivePort = createIdentityBackedRefereeDirectoryPort({
    identityAccessAdapter: createSubjectIdentityAdapter({ status: "inactive" }),
  });
  const inactiveSnap = await inactivePort.resolveRefereeDirectory({
    refereeId: REF_UUID,
    tenantId: "tenant-a",
  });
  assert.equal(inactiveSnap.items[0].active, false);

  const inactive = await handleCompetitionRefereeAssignmentAction({
    action: "assignReferee",
    body: {
      command: {
        tenantId: "tenant-a",
        tournamentId: "tourn-a",
        matchId: "match-1",
        refereeId: REF_UUID,
        expectedVersion: 0,
        idempotencyKey: "idem-inactive",
      },
    },
    userClient: createUserClient(),
    serviceClient: createServiceClient(),
    identityAccessAdapter: createSubjectIdentityAdapter({ status: "inactive" }),
  });
  assert.equal(inactive.body?.ok, false);
  assert.equal(
    inactive.body.code,
    ASSIGNMENT_COMMAND_ERROR_CODE.CORE13_VALIDATION_REJECTED
  );

  const foreign = await handleCompetitionRefereeAssignmentAction({
    action: "assignReferee",
    body: {
      command: {
        tenantId: "tenant-a",
        tournamentId: "tourn-a",
        matchId: "match-1",
        refereeId: REF_UUID,
        expectedVersion: 0,
        idempotencyKey: "idem-foreign",
      },
    },
    userClient: createUserClient(),
    serviceClient: createServiceClient(),
    identityAccessAdapter: createSubjectIdentityAdapter({ tenantId: "other-tenant" }),
  });
  assert.equal(foreign.body?.ok, false);
  assert.equal(foreign.body.code, ASSIGNMENT_COMMAND_ERROR_CODE.FOREIGN_REFEREE_DENIED);
});

test("Daily Play disabled remains NOT_APPLICABLE", async () => {
  const service = createService();
  await assert.rejects(
    () =>
      service.assignReferee(
        baseCommand({
          competitionMode: ASSIGNMENT_COMPETITION_MODE.DAILY_PLAY,
          refereeFeatureEnabled: false,
        })
      ),
    (err) =>
      err.code === ASSIGNMENT_COMMAND_ERROR_CODE.DAILY_PLAY_NOT_APPLICABLE
  );
});
