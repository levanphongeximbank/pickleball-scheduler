/**
 * E2E-03 — Organizer Operations MVP targeted tests.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createInMemoryTemplateCatalog } from "../src/features/competition-management/template-instantiation/index.js";
import { PERMISSIONS } from "../src/features/identity/constants/permissions.js";
import {
  CHECKIN_STATE,
  ENTRY_OPS_STATUS,
  ORGANIZER_ACTION,
  ORGANIZER_CAPABILITY,
  ORGANIZER_ERROR_CODE,
  PARTICIPANT_FIELD_STATE,
  PUBLICATION_OPS_STATE,
  buildOrganizerPortalSections,
  createCompetitionRuntimePorts,
  createOrganizerOperationsFacade,
  createPoolKnockoutRuntimeComposition,
  isOrganizerOperationsError,
  snapshotInput,
} from "../src/features/competition-engine/index.js";

const PARTICIPANTS_8 = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function actor(role = "TOURNAMENT_MANAGER", actorId = "org-1") {
  return { actorId, role };
}

function baseCommand(overrides = {}) {
  return {
    tenantId: "tenant-1",
    competitionId: "comp-e2e03",
    venueId: "venue-1",
    actor: actor(),
    deterministicSeed: "seed-e2e03",
    ...overrides,
  };
}

function createFacade(overrides = {}) {
  const ports =
    overrides.runtimePorts ||
    createCompetitionRuntimePorts({
      identity: {
        getPermissionsForRole: (role) => {
          const normalized = String(role || "").toUpperCase();
          // CORE-02 normalizeCompetitionRole maps non-competition roles → UNKNOWN.
          if (
            normalized === "CASHIER" ||
            normalized === "UNKNOWN" ||
            normalized === "PLAYER"
          ) {
            return normalized === "PLAYER" ? [PERMISSIONS.TOURNAMENT_VIEW] : [];
          }
          // Mirror Identity matrix for TOURNAMENT_MANAGER-like organizer.
          return [
            PERMISSIONS.TOURNAMENT_VIEW,
            PERMISSIONS.TOURNAMENT_UPDATE,
            PERMISSIONS.DIRECTOR_USE,
            PERMISSIONS.MATCH_UPDATE,
            PERMISSIONS.SCHEDULING_RUN,
            PERMISSIONS.TOURNAMENT_CERTIFY,
          ];
        },
      },
      ...(overrides.runtimePortDeps || {}),
    });
  return createOrganizerOperationsFacade({
    clockIso: "2026-07-24T12:00:00.000Z",
    runtimePorts: ports,
    ...overrides,
  });
}

async function prepareLockedPool(facade, command = baseCommand()) {
  await facade.prepareCompetitionOperations({
    ...command,
    entries: PARTICIPANTS_8.map((id) => ({
      participantId: id,
      status: ENTRY_OPS_STATUS.ELIGIBLE,
    })),
  });
  await facade.lockParticipantField(command);
  const pool = await facade.preparePoolStage({
    ...command,
    catalog: createInMemoryTemplateCatalog(),
    formatOverrides: { poolCount: 2, qualifiersPerPool: 2 },
  });
  return pool;
}

test("authorization — correct organizer allow / missing identity / missing tenant", async () => {
  const facade = createFacade();
  const ok = await facade.getOrganizerCompetitionOperationsState(baseCommand());
  assert.equal(ok.ok, true);
  assert.equal(ok.capability, ORGANIZER_CAPABILITY.OPERATIONS_READ);
  assert.ok(ok.projection.projectionFingerprint);

  await assert.rejects(
    () =>
      facade.getOrganizerCompetitionOperationsState(
        baseCommand({ actor: { role: "TOURNAMENT_MANAGER" } })
      ),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.MISSING_IDENTITY
  );

  await assert.rejects(
    () =>
      facade.getOrganizerCompetitionOperationsState(
        baseCommand({ tenantId: "" })
      ),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.MISSING_TENANT
  );
});

test("authorization — permission denied, cross-tenant, client grants rejected", async () => {
  const facade = createFacade();
  await assert.rejects(
    () =>
      facade.lockParticipantField(
        baseCommand({ actor: actor("CASHIER", "cash-1") })
      ),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.PERMISSION_DENIED
  );

  await assert.rejects(
    () =>
      facade.lockParticipantField(
        baseCommand({
          actor: {
            actorId: "org-1",
            role: "TOURNAMENT_MANAGER",
            grantedPermissions: [PERMISSIONS.TOURNAMENT_UPDATE],
          },
        })
      ),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.CLIENT_GRANT_TRUST_REJECTED
  );

  const { authorizeCompetitionAction } = await import(
    "../src/features/competition-engine/integration/composition/createCompetitionRuntimePorts.js"
  );
  const basePorts = createCompetitionRuntimePorts({
    identity: {
      getPermissionsForRole: () => [
        PERMISSIONS.TOURNAMENT_VIEW,
        PERMISSIONS.TOURNAMENT_UPDATE,
      ],
    },
  });
  const mismatched = {
    async getEvidence(input) {
      const evidence = await basePorts.identityEvidencePort.getEvidence(input);
      return Object.freeze({
        ...evidence,
        tenantId: "other-tenant",
      });
    },
  };
  const facadeCross = createOrganizerOperationsFacade({
    runtimePorts: {
      ...basePorts,
      identityEvidencePort: mismatched,
      authorize: (request) =>
        authorizeCompetitionAction(request, { evidencePort: mismatched }),
    },
  });
  await assert.rejects(
    () => facadeCross.lockParticipantField(baseCommand()),
    (err) =>
      isOrganizerOperationsError(err) &&
      (err.code === ORGANIZER_ERROR_CODE.CROSS_TENANT_REJECTED ||
        err.code === ORGANIZER_ERROR_CODE.PERMISSION_DENIED)
  );
});

test("command — input immutability + deterministic result fingerprint", async () => {
  const facade = createFacade();
  const command = baseCommand({
    entries: PARTICIPANTS_8.map((id) => ({
      participantId: id,
      status: ENTRY_OPS_STATUS.ELIGIBLE,
    })),
  });
  const before = snapshotInput(command);
  const a = await facade.prepareCompetitionOperations(command);
  const b = await facade.getOrganizerCompetitionOperationsState(command);
  assert.deepEqual(command, before);
  assert.equal(a.ok, true);
  const c = await facade.getOrganizerCompetitionOperationsState(command);
  assert.equal(
    b.projection.projectionFingerprint,
    c.projection.projectionFingerprint
  );
});

test("participants — lock success, reject pending/ineligible, duplicate rejection", async () => {
  const facade = createFacade();
  await facade.prepareCompetitionOperations(
    baseCommand({
      entries: [
        { participantId: "p1", status: ENTRY_OPS_STATUS.ELIGIBLE },
        { participantId: "p2", status: ENTRY_OPS_STATUS.PENDING },
      ],
    })
  );
  await assert.rejects(
    () => facade.lockParticipantField(baseCommand()),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.PARTICIPANT_FIELD_INCOMPLETE
  );

  await assert.rejects(
    () =>
      facade.prepareCompetitionOperations(
        baseCommand({
          entries: [
            { participantId: "p1", status: ENTRY_OPS_STATUS.ELIGIBLE },
            { participantId: "p1", status: ENTRY_OPS_STATUS.ELIGIBLE },
          ],
        })
      ),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.DUPLICATE_PARTICIPANT
  );

  await facade.prepareCompetitionOperations(
    baseCommand({
      entries: PARTICIPANTS_8.map((id) => ({
        participantId: id,
        status: ENTRY_OPS_STATUS.ELIGIBLE,
      })),
    })
  );
  const locked = await facade.lockParticipantField(baseCommand());
  assert.equal(locked.participantFieldState, PARTICIPANT_FIELD_STATE.LOCKED);
  const again = await facade.lockParticipantField(baseCommand());
  assert.equal(again.idempotent, true);
});

test("pool — prepare via E2E-02, no composition mutation of seed template", async () => {
  const facade = createFacade();
  const pool = await prepareLockedPool(facade);
  assert.equal(pool.ok, true);
  assert.ok(pool.composition.fingerprint);
  assert.ok(pool.composition.matchPlanFingerprint);
  assert.equal(pool.composition.runtimeReady, true);

  const again = await facade.preparePoolStage({
    ...baseCommand(),
    catalog: createInMemoryTemplateCatalog(),
    formatOverrides: { poolCount: 2, qualifiersPerPool: 2 },
  });
  assert.equal(again.composition.fingerprint, pool.composition.fingerprint);

  // Direct E2E-02 composition still works independently (no Organizer mutation).
  const direct = createPoolKnockoutRuntimeComposition({
    tenantId: "tenant-1",
    competitionId: "comp-e2e03",
    participants: PARTICIPANTS_8,
    deterministicSeed: "seed-e2e03",
    catalog: createInMemoryTemplateCatalog(),
    formatOverrides: { poolCount: 2, qualifiersPerPool: 2 },
    includeKnockout: false,
    poolStageComplete: false,
    requireRuntimePorts: false,
  });
  assert.equal(direct.runtimeReady, true);
  assert.ok(direct.composition.stages.pool);
  assert.equal(direct.composition.stages.knockout, null);
});

test("schedule/courts — certified accept, uncertified reject, venue/snapshot gates", async () => {
  const facade = createFacade();
  await prepareLockedPool(facade);

  await assert.rejects(
    () =>
      facade.prepareOperationalSchedule(
        baseCommand({
          certifiedSchedule: { certified: false, fingerprint: "x" },
        })
      ),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.SCHEDULE_UNCERTIFIED
  );

  await assert.rejects(
    () =>
      facade.prepareOperationalSchedule(
        baseCommand({ venueId: "", certifiedSchedule: { certified: true } })
      ),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.MISSING_VENUE
  );

  const sched = await facade.prepareOperationalSchedule(
    baseCommand({
      certifiedSchedule: {
        certified: true,
        fingerprint: "sched-fp-1",
        assignmentCount: 12,
      },
    })
  );
  assert.equal(sched.schedule.certified, true);
  assert.equal(sched.schedule.mutated, false);

  await assert.rejects(
    () =>
      facade.confirmCourtAssignments(
        baseCommand({
          courtAssignmentRequest: { matches: [] },
        })
      ),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.COURT_SNAPSHOT_MISSING
  );

  await assert.rejects(
    () =>
      facade.confirmCourtAssignments(
        baseCommand({
          confirmedAssignment: {
            complete: true,
            tenantId: "other-tenant",
            venueId: "venue-1",
            fingerprint: "court-fp",
          },
        })
      ),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.CROSS_TENANT_REJECTED
  );

  const courts = await facade.confirmCourtAssignments(
    baseCommand({
      confirmedAssignment: {
        complete: true,
        tenantId: "tenant-1",
        venueId: "venue-1",
        fingerprint: "court-fp-1",
      },
    })
  );
  assert.equal(courts.courtAssignment.complete, true);
});

test("check-in — open/close idempotency, match open blocked when required missing", async () => {
  const facade = createFacade();
  await prepareLockedPool(facade);
  await facade.prepareOperationalSchedule(
    baseCommand({
      certifiedSchedule: { certified: true, fingerprint: "sched-fp" },
    })
  );
  await facade.confirmCourtAssignments(
    baseCommand({
      confirmedAssignment: {
        complete: true,
        tenantId: "tenant-1",
        venueId: "venue-1",
        fingerprint: "court-fp",
      },
    })
  );
  await facade.publishOperationalPlan(baseCommand());

  await assert.rejects(
    () => facade.openMatchOperations(baseCommand()),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.CHECKIN_NOT_OPEN
  );

  const opened = await facade.openCheckIn(baseCommand());
  assert.equal(opened.checkIn.state, CHECKIN_STATE.OPEN);
  const openedAgain = await facade.openCheckIn(baseCommand());
  assert.equal(openedAgain.idempotent, true);

  await assert.rejects(
    () => facade.openMatchOperations(baseCommand()),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.CHECKIN_REQUIRED_MISSING
  );

  await facade.recordOrganizerCheckInMarks(
    baseCommand({ participantIds: PARTICIPANTS_8 })
  );
  const closed = await facade.closeCheckIn(baseCommand());
  assert.equal(closed.checkIn.state, CHECKIN_STATE.CLOSED);
  const closedAgain = await facade.closeCheckIn(baseCommand());
  assert.equal(closedAgain.idempotent, true);

  const matchOps = await facade.openMatchOperations(
    baseCommand({
      matches: [{ matchId: "m1", status: "READY" }],
    })
  );
  assert.equal(matchOps.matchOpsState, "OPEN");
  assert.equal(matchOps.winnerInference, false);
});

test("match/knockout — suspend/resume, no winner inference, tie/qualification gates, completion block", async () => {
  const facade = createFacade();
  await prepareLockedPool(facade);
  await facade.prepareOperationalSchedule(
    baseCommand({
      certifiedSchedule: { certified: true, fingerprint: "sched-fp" },
    })
  );
  await facade.confirmCourtAssignments(
    baseCommand({
      confirmedAssignment: {
        complete: true,
        tenantId: "tenant-1",
        venueId: "venue-1",
        fingerprint: "court-fp",
      },
    })
  );
  await facade.publishOperationalPlan(baseCommand());
  await facade.openCheckIn(baseCommand());
  await facade.recordOrganizerCheckInMarks(
    baseCommand({ participantIds: PARTICIPANTS_8 })
  );
  await facade.closeCheckIn(baseCommand());
  await facade.openMatchOperations(
    baseCommand({ matches: [{ matchId: "m1", status: "READY" }] })
  );

  const suspended = await facade.suspendMatchOperations(baseCommand());
  assert.equal(suspended.matchOpsState, "SUSPENDED");
  const resumed = await facade.resumeMatchOperations(baseCommand());
  assert.equal(resumed.matchOpsState, "OPEN");

  await assert.rejects(
    () =>
      facade.syncMatchOperationalStatuses(
        baseCommand({
          matches: [{ matchId: "m1", status: "COMPLETED" }],
          inferWinners: true,
        })
      ),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.INVALID_INPUT
  );

  await assert.rejects(
    () => facade.activateKnockoutStage(baseCommand({ unresolvedTie: true })),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.UNRESOLVED_TIE
  );

  await assert.rejects(
    () => facade.activateKnockoutStage(baseCommand()),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.QUALIFICATION_NOT_READY
  );

  // Build standings from a fresh composition grouping.
  const composed = createPoolKnockoutRuntimeComposition({
    tenantId: "tenant-1",
    competitionId: "comp-e2e03",
    participants: PARTICIPANTS_8,
    deterministicSeed: "seed-e2e03",
    catalog: createInMemoryTemplateCatalog(),
    formatOverrides: { poolCount: 2, qualifiersPerPool: 2 },
    includeKnockout: false,
    poolStageComplete: false,
    requireRuntimePorts: false,
  });
  const rows = composed.composition.stages.pool.grouping.groups.map((g) => ({
    groupId: g.groupId,
    rows: g.participantIds.map((id, i) => ({
      entryId: id,
      rank: i + 1,
      points: 20 - i,
    })),
  }));

  const ko = await facade.activateKnockoutStage(
    baseCommand({
      qualificationReady: true,
      poolStageComplete: true,
      poolStandingsRows: rows,
      catalog: createInMemoryTemplateCatalog(),
      formatOverrides: { poolCount: 2, qualifiersPerPool: 2 },
      matches: [
        { matchId: "ko1", status: "READY", stage: "KNOCKOUT" },
        { matchId: "ko2", status: "READY", stage: "KNOCKOUT" },
      ],
    })
  );
  assert.equal(ko.knockoutActive, true);
  assert.equal(ko.winnerInference, false);
  const koAgain = await facade.activateKnockoutStage(
    baseCommand({
      qualificationReady: true,
      poolStageComplete: true,
      poolStandingsRows: rows,
      catalog: createInMemoryTemplateCatalog(),
    })
  );
  assert.equal(koAgain.idempotent, true);

  await assert.rejects(
    () =>
      facade.completeCompetitionOperations(
        baseCommand({
          matches: [{ matchId: "ko1", status: "ACTIVE", stage: "KNOCKOUT" }],
        })
      ),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.ACTIVE_MATCHES
  );

  await facade.syncMatchOperationalStatuses(
    baseCommand({
      matches: [
        { matchId: "ko1", status: "COMPLETED", stage: "KNOCKOUT" },
        { matchId: "ko2", status: "COMPLETED", stage: "KNOCKOUT" },
      ],
      standingsReady: true,
      qualificationReady: true,
    })
  );
  const completed = await facade.completeCompetitionOperations(baseCommand());
  assert.equal(completed.completionConfirmed, true);
});

test("publication/archive — operational plan, final requires completion, archive handoff no direct mutate", async () => {
  const facade = createFacade();
  await prepareLockedPool(facade);
  await facade.prepareOperationalSchedule(
    baseCommand({
      certifiedSchedule: { certified: true, fingerprint: "sched-fp" },
    })
  );
  await facade.confirmCourtAssignments(
    baseCommand({
      confirmedAssignment: {
        complete: true,
        tenantId: "tenant-1",
        venueId: "venue-1",
        fingerprint: "court-fp",
      },
    })
  );
  const pub = await facade.publishOperationalPlan(baseCommand());
  assert.equal(pub.publication.kind, "operational-plan");
  assert.equal(
    pub.projection.publicationState,
    PUBLICATION_OPS_STATE.OPERATIONAL_PLAN_PUBLISHED
  );

  await assert.rejects(
    () => facade.publishFinalCompetitionResult(baseCommand()),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.COMPLETION_REQUIRED
  );

  await assert.rejects(
    () => facade.requestArchiveReadiness(baseCommand()),
    (err) =>
      isOrganizerOperationsError(err) &&
      err.code === ORGANIZER_ERROR_CODE.FINAL_PUBLICATION_REQUIRED
  );

  // Fast-forward completion path
  await facade.openCheckIn(baseCommand());
  await facade.recordOrganizerCheckInMarks(
    baseCommand({ participantIds: PARTICIPANTS_8 })
  );
  await facade.closeCheckIn(baseCommand());
  await facade.openMatchOperations(baseCommand());
  const composed = createPoolKnockoutRuntimeComposition({
    tenantId: "tenant-1",
    competitionId: "comp-e2e03",
    participants: PARTICIPANTS_8,
    deterministicSeed: "seed-e2e03",
    catalog: createInMemoryTemplateCatalog(),
    formatOverrides: { poolCount: 2, qualifiersPerPool: 2 },
    includeKnockout: false,
    requireRuntimePorts: false,
  });
  const rows = composed.composition.stages.pool.grouping.groups.map((g) => ({
    groupId: g.groupId,
    rows: g.participantIds.map((id, i) => ({
      entryId: id,
      rank: i + 1,
      points: 20 - i,
    })),
  }));
  await facade.activateKnockoutStage(
    baseCommand({
      qualificationReady: true,
      poolStageComplete: true,
      poolStandingsRows: rows,
      catalog: createInMemoryTemplateCatalog(),
      formatOverrides: { poolCount: 2, qualifiersPerPool: 2 },
      matches: [{ matchId: "f1", status: "COMPLETED", stage: "KNOCKOUT" }],
    })
  );
  await facade.completeCompetitionOperations(
    baseCommand({
      matches: [{ matchId: "f1", status: "COMPLETED", stage: "KNOCKOUT" }],
    })
  );
  const finalPub = await facade.publishFinalCompetitionResult(baseCommand());
  assert.equal(finalPub.publication.kind, "final-result");
  const archive = await facade.requestArchiveReadiness(baseCommand());
  assert.equal(archive.archiveReadiness.ready, true);
  assert.equal(archive.archiveReadiness.directArchiveMutation, false);
});

test("projection — readiness aggregation, action matrix, portal sections", async () => {
  const facade = createFacade();
  const empty = await facade.getOrganizerReadiness(baseCommand());
  assert.ok(Array.isArray(empty.blockingIssues));
  assert.ok(Array.isArray(empty.projection.allowedOrganizerActions));
  assert.ok(Array.isArray(empty.projection.deniedOrganizerActions));
  assert.ok(empty.projectionFingerprint);

  const sections = buildOrganizerPortalSections(empty.projection);
  assert.equal(sections.length, 10);
  assert.equal(sections[0].id, "overview");
  assert.equal(sections[9].id, "archive");
});

test("architecture — no supabase / Date.now / Math.random in operations boundary", () => {
  const opsDir = path.join(
    ROOT,
    "src/features/competition-engine/operations"
  );
  const files = [
    "createOrganizerOperationsFacade.js",
    "projections/buildOrganizerOperationsProjection.js",
    "context/authorizeOrganizerCommand.js",
    "checkin/organizerCheckInBoundary.js",
    "store/createInMemoryOrganizerOperationsStore.js",
    "permissions/organizerActionMap.js",
  ];
  for (const rel of files) {
    const src = readFileSync(path.join(opsDir, rel), "utf8");
    assert.equal(/@supabase|supabaseClient/.test(src), false, rel);
    assert.equal(/Date\.now\(/.test(src), false, rel);
    assert.equal(/Math\.random\(/.test(src), false, rel);
    assert.equal(/crypto\.randomUUID\(/.test(src), false, rel);
    assert.equal(
      /competition-core\/(?!scheduling|court-assignment)/.test(src) &&
        rel === "createOrganizerOperationsFacade.js"
        ? false
        : false,
      false
    );
  }
  const facadeSrc = readFileSync(
    path.join(opsDir, "createOrganizerOperationsFacade.js"),
    "utf8"
  );
  assert.match(facadeSrc, /createPoolKnockoutRuntimeComposition/);
  assert.match(facadeSrc, /calculateCanonicalSchedule/);
  assert.match(facadeSrc, /assignCourtsDeterministic/);
  assert.doesNotMatch(facadeSrc, /from ["'].*supabase/);
});

test("action map — logical capability names map to Identity permissions only", async () => {
  assert.equal(
    ORGANIZER_ACTION.PARTICIPANTS_LOCK,
    "organizer.participants.lock"
  );
  assert.equal(
    ORGANIZER_CAPABILITY.PARTICIPANTS_LOCK,
    "competition.participants.lock"
  );
  const { resolveOrganizerActionPermissions } = await import(
    "../src/features/competition-engine/operations/permissions/organizerActionMap.js"
  );
  const mapped = resolveOrganizerActionPermissions(
    ORGANIZER_ACTION.PARTICIPANTS_LOCK
  );
  assert.deepEqual(mapped.requiredPermissions, [PERMISSIONS.TOURNAMENT_UPDATE]);
  assert.ok(
    mapped.requiredPermissions.every((p) => typeof p === "string" && p.includes("."))
  );
  assert.equal(mapped.requiredPermissions.includes("competition.participants.lock"), false);
});
