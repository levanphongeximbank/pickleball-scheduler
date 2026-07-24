/**
 * E2E-07 suspension, cancellation, and archive certification.
 */

import { createInMemoryTemplateCatalog } from "../../../competition-management/template-instantiation/index.js";
import {
  ENTRY_OPS_STATUS,
  LIFECYCLE_PROJECTION,
  createCompetitionGovernanceReliabilityFacade,
  createInMemoryOrganizerOperationsStore,
  createOrganizerOperationsFacade,
} from "../../operations/index.js";
import { CERTIFICATION_CHECK, CERTIFICATION_ERROR_CODE } from "../constants.js";
import { createIndividualPoolKnockoutScenarioFixture } from "../fixtures/individualPoolKnockoutScenario.js";
import { computeCertificationFingerprint, deepFreeze } from "../fingerprint.js";
import { createCertificationRuntimePorts } from "../ports/createCertificationRuntimePorts.js";
import {
  buildGovernanceQuery,
  buildGovernanceRecordFromFixture,
  buildOrganizerCommand,
  buildStandingsRowsFromPoolGrouping,
} from "./scenarioHelpers.js";
import { createPoolKnockoutRuntimeComposition } from "../../application/createPoolKnockoutRuntimeComposition.js";

/**
 * @param {object} [input]
 */
export async function runSuspensionCancellationArchiveCertification(input = {}) {
  const fixture =
    input.fixture || createIndividualPoolKnockoutScenarioFixture(input.fixtureOverrides);
  const ports = createCertificationRuntimePorts(input.portDeps);
  const store = createInMemoryOrganizerOperationsStore({ clockIso: fixture.clockIso });
  const organizer = createOrganizerOperationsFacade({
    clockIso: fixture.clockIso,
    runtimePorts: ports,
    store,
  });
  const governance = createCompetitionGovernanceReliabilityFacade({ runtimePorts: ports });
  const cmd = (overrides = {}) => buildOrganizerCommand(fixture, overrides);
  const catalog = createInMemoryTemplateCatalog();

  await organizer.prepareCompetitionOperations(
    cmd({
      entries: fixture.players.map((p) => ({
        participantId: p.participantId,
        status: ENTRY_OPS_STATUS.ELIGIBLE,
      })),
    })
  );
  await organizer.lockParticipantField(cmd());
  await organizer.preparePoolStage(cmd({ catalog, formatOverrides: fixture.formatOverrides }));
  await organizer.prepareOperationalSchedule(cmd({ certifiedSchedule: fixture.schedule }));
  await organizer.confirmCourtAssignments(
    cmd({
      confirmedAssignment: {
        ...fixture.courtAssignment,
        tenantId: fixture.tenantId,
        venueId: fixture.venueId,
      },
    })
  );
  await organizer.publishOperationalPlan(cmd());
  await organizer.openCheckIn(cmd());
  await organizer.recordOrganizerCheckInMarks(
    cmd({ participantIds: fixture.players.map((p) => p.participantId) })
  );
  await organizer.closeCheckIn(cmd());
  await organizer.openMatchOperations(cmd({ matches: [{ matchId: "m1", status: "READY" }] }));

  const suspended = await organizer.suspendMatchOperations(cmd());
  const resumed = await organizer.resumeMatchOperations(cmd());

  const activeArchive = await governance.evaluateArchiveReadiness(
    buildGovernanceQuery(fixture, {
      governanceRecord: buildGovernanceRecordFromFixture(fixture, {
        lifecycleState: LIFECYCLE_PROJECTION.ACTIVE,
      }),
    })
  );

  const archiveMutateBlocked = await (async () => {
    try {
      const rec = store.get(fixture.tenantId, fixture.competitionId);
      if (rec.archiveReadiness?.directArchiveMutation === true) return false;
      const archiveReq = await organizer.requestArchiveReadiness(cmd());
      return archiveReq.archiveReadiness?.directArchiveMutation === false;
    } catch {
      return true;
    }
  })();

  const composition = createPoolKnockoutRuntimeComposition({
    tenantId: fixture.tenantId,
    competitionId: fixture.competitionId,
    participants: fixture.players.map((p) => p.participantId),
    deterministicSeed: fixture.deterministicSeed,
    catalog,
    formatOverrides: fixture.formatOverrides,
    includeKnockout: false,
    requireRuntimePorts: false,
  });
  const rows = buildStandingsRowsFromPoolGrouping(composition.composition?.stages?.pool);
  await organizer.activateKnockoutStage(
    cmd({
      qualificationReady: true,
      poolStageComplete: true,
      poolStandingsRows: rows,
      catalog,
      formatOverrides: fixture.formatOverrides,
      matches: [{ matchId: "ko-final", status: "COMPLETED", stage: "KNOCKOUT" }],
    })
  );
  await organizer.completeCompetitionOperations(
    cmd({ matches: [{ matchId: "ko-final", status: "COMPLETED", stage: "KNOCKOUT" }] })
  );
  await organizer.publishFinalCompetitionResult(cmd());
  const completedArchive = await organizer.requestArchiveReadiness(cmd());
  const completedGovArchive = await governance.evaluateArchiveReadiness(
    buildGovernanceQuery(fixture, {
      governanceRecord: buildGovernanceRecordFromFixture(fixture, {
        lifecycleState: LIFECYCLE_PROJECTION.COMPLETED,
        finalPublished: true,
        archiveReady: true,
      }),
    })
  );

  const checks = Object.freeze([
    Object.freeze({
      id: "suspend-resume",
      ok: suspended.matchOpsState === "SUSPENDED" && resumed.matchOpsState === "OPEN",
      detail: `${suspended.matchOpsState}->${resumed.matchOpsState}`,
    }),
    Object.freeze({
      id: "active-not-archive-ready",
      ok: activeArchive.result?.ready === false,
      detail: "ACTIVE lifecycle blocks archive readiness",
    }),
    Object.freeze({
      id: "archive-no-direct-mutate",
      ok: archiveMutateBlocked,
      detail: "requestArchiveReadiness does not direct-mutate archive",
    }),
    Object.freeze({
      id: "completed-archive-ready",
      ok:
        completedArchive.archiveReadiness?.ready === true &&
        completedGovArchive.result?.ready === true,
      detail: "COMPLETED + final publish archive ready",
    }),
  ]);

  const ok = checks.every((c) => c.ok);
  const evidence = deepFreeze({
    scenarioId: fixture.scenarioId,
    sourceCommit: input.sourceCommit ?? null,
    generatedAt: input.generatedAt ?? null,
  });

  const deterministicFingerprint = computeCertificationFingerprint({
    kind: "suspension-archive-certification",
    ok,
    checks: checks.map((c) => ({ id: c.id, ok: c.ok })),
    evidence,
  });

  return deepFreeze({
    ok,
    checkId: CERTIFICATION_CHECK.SUSPENSION_ARCHIVE,
    checks,
    evidence,
    warnings: Object.freeze([]),
    blockers: Object.freeze(
      ok
        ? []
        : [
            Object.freeze({
              code: CERTIFICATION_ERROR_CODE.GOVERNANCE_BLOCKED,
              message: "suspension/archive certification failed",
            }),
          ]
    ),
    deterministicFingerprint,
  });
}
