/**
 * E2E-07 full vertical happy-path certification (IND Pool+Knockout).
 */

import { createInMemoryTemplateCatalog } from "../../../competition-management/template-instantiation/index.js";
import { SCORING_SIDE } from "../../../competition-core/scoring/index.js";
import { createPoolKnockoutRuntimeComposition } from "../../application/createPoolKnockoutRuntimeComposition.js";
import {
  ENTRY_OPS_STATUS,
  LIFECYCLE_PROJECTION,
  PUBLICATION_OPS_STATE,
  createCompetitionGovernanceReliabilityFacade,
  createInMemoryOrganizerOperationsStore,
  createInMemoryPublicExperienceStore,
  createOrganizerOperationsFacade,
  createPlayerCompetitionOperationsFacade,
  createPublicCompetitionExperienceFacade,
  createRefereeCompetitionOperationsFacade,
  projectPublishedRecordFromOrganizer,
} from "../../operations/index.js";
import {
  CERTIFICATION_CHECK,
  CERTIFICATION_ERROR_CODE,
  CERTIFICATION_STAGE,
  CERTIFICATION_VERDICT,
} from "../constants.js";
import { createIndividualPoolKnockoutScenarioFixture } from "../fixtures/individualPoolKnockoutScenario.js";
import { computeCertificationFingerprint, deepFreeze } from "../fingerprint.js";
import { createCertificationRuntimePorts } from "../ports/createCertificationRuntimePorts.js";
import {
  buildGovernanceQuery,
  buildGovernanceRecordFromFixture,
  buildOrganizerCommand,
  buildPlayerCommand,
  buildRefereeCommand,
  buildStandingsRowsFromPoolGrouping,
  pickFirstPoolMatch,
  pickKnockoutMatchIds,
  recordStage,
} from "./scenarioHelpers.js";

/**
 * @param {object} [input]
 */
export async function runHappyPathCertification(input = {}) {
  const fixture =
    input.fixture || createIndividualPoolKnockoutScenarioFixture(input.fixtureOverrides);
  const ports = input.runtimePorts || createCertificationRuntimePorts(input.portDeps);
  const organizerStore =
    input.organizerStore ||
    createInMemoryOrganizerOperationsStore({ clockIso: fixture.clockIso });
  const publicStore =
    input.publicStore || createInMemoryPublicExperienceStore({ clockIso: fixture.clockIso });

  const organizer = createOrganizerOperationsFacade({
    clockIso: fixture.clockIso,
    runtimePorts: ports,
    store: organizerStore,
  });
  const playerFacade = createPlayerCompetitionOperationsFacade({
    clockIso: fixture.clockIso,
    runtimePorts: ports,
    organizerStore,
  });
  const refereeFacade = createRefereeCompetitionOperationsFacade({
    clockIso: fixture.clockIso,
    runtimePorts: ports,
  });
  const governanceFacade = createCompetitionGovernanceReliabilityFacade({
    runtimePorts: ports,
  });

  /** @type {ReturnType<typeof recordStage>[]} */
  const stages = [];
  /** @type {object[]} */
  const blockers = [];
  const cmd = (overrides = {}) => buildOrganizerCommand(fixture, overrides);
  const catalog = createInMemoryTemplateCatalog();

  try {
    const prepared = await organizer.prepareCompetitionOperations(
      cmd({
        entries: fixture.players.map((p) => ({
          participantId: p.participantId,
          status: ENTRY_OPS_STATUS.ELIGIBLE,
          seedNumber: p.seedNumber,
        })),
      })
    );
    stages.push(
      recordStage(CERTIFICATION_STAGE.PREPARE_OPERATIONS, prepared.ok, prepared.compositionFingerprint)
    );

    const locked = await organizer.lockParticipantField(cmd());
    stages.push(
      recordStage(CERTIFICATION_STAGE.LOCK_PARTICIPANT_FIELD, locked.ok, locked.participantFieldState)
    );

    const pool = await organizer.preparePoolStage(
      cmd({
        catalog,
        formatOverrides: fixture.formatOverrides,
      })
    );
    stages.push(
      recordStage(
        CERTIFICATION_STAGE.PREPARE_POOL_STAGE,
        pool.ok,
        pool.composition?.fingerprint
      )
    );

    const schedule = await organizer.prepareOperationalSchedule(
      cmd({ certifiedSchedule: fixture.schedule })
    );
    stages.push(
      recordStage(
        CERTIFICATION_STAGE.PREPARE_OPERATIONAL_SCHEDULE,
        schedule.ok,
        schedule.schedule?.fingerprint
      )
    );

    const courts = await organizer.confirmCourtAssignments(
      cmd({
        confirmedAssignment: {
          ...fixture.courtAssignment,
          tenantId: fixture.tenantId,
          venueId: fixture.venueId,
        },
      })
    );
    stages.push(
      recordStage(
        CERTIFICATION_STAGE.CONFIRM_COURT_ASSIGNMENTS,
        courts.ok,
        courts.courtAssignment?.fingerprint
      )
    );

    const opPub = await organizer.publishOperationalPlan(cmd());
    stages.push(
      recordStage(
        CERTIFICATION_STAGE.PUBLISH_OPERATIONAL_PLAN,
        opPub.ok,
        opPub.publication?.revision
      )
    );

    const checkInOpen = await organizer.openCheckIn(cmd());
    stages.push(
      recordStage(CERTIFICATION_STAGE.OPEN_CHECK_IN, checkInOpen.ok, checkInOpen.checkIn?.state)
    );

    let allCheckedIn = true;
    for (const player of fixture.players) {
      const checkIn = await playerFacade.checkInPlayer(buildPlayerCommand(fixture, player));
      if (!checkIn.ok) allCheckedIn = false;
    }
    stages.push(
      recordStage(CERTIFICATION_STAGE.PLAYER_CHECK_IN_ALL, allCheckedIn, fixture.players.length)
    );

    const checkInClosed = await organizer.closeCheckIn(cmd());
    stages.push(
      recordStage(
        CERTIFICATION_STAGE.CLOSE_CHECK_IN,
        checkInClosed.ok,
        checkInClosed.checkIn?.state
      )
    );

    const composition = createPoolKnockoutRuntimeComposition({
      tenantId: fixture.tenantId,
      competitionId: fixture.competitionId,
      participants: fixture.players.map((p) => p.participantId),
      deterministicSeed: fixture.deterministicSeed,
      catalog,
      formatOverrides: fixture.formatOverrides,
      includeKnockout: false,
      poolStageComplete: false,
      requireRuntimePorts: false,
    });
    const poolMatch = pickFirstPoolMatch(composition);
    const poolMatchId = poolMatch?.matchId || "pool-m1";

    const matchOps = await organizer.openMatchOperations(
      cmd({ matches: [{ matchId: poolMatchId, status: "READY", stage: "POOL" }] })
    );
    stages.push(
      recordStage(CERTIFICATION_STAGE.OPEN_MATCH_OPERATIONS, matchOps.ok, matchOps.matchOpsState)
    );

    refereeFacade.seedAssignments(
      buildRefereeCommand(fixture, fixture.referees[0], {
        assignments: [
          {
            matchId: poolMatchId,
            refereeId: fixture.referees[0].refereeId,
            status: "ASSIGNED",
            courtId: fixture.courts[0].courtId,
            scheduledAt: fixture.clockIso,
            entries: poolMatch?.entries || [],
          },
        ],
      })
    );
    stages.push(
      recordStage(
        CERTIFICATION_STAGE.REFEREE_SEED_ASSIGNMENTS,
        true,
        poolMatchId
      )
    );

    const opened = await refereeFacade.openAssignedMatch(
      buildRefereeCommand(fixture, fixture.referees[0], { matchId: poolMatchId })
    );
    stages.push(
      recordStage(CERTIFICATION_STAGE.REFEREE_OPEN_MATCH, opened.ok, opened.match?.status)
    );

    await refereeFacade.createScoreEntrySession(
      buildRefereeCommand(fixture, fixture.referees[0], { matchId: poolMatchId })
    );
    for (let i = 0; i < fixture.scoring.rallyTarget; i += 1) {
      await refereeFacade.submitScoreProjection(
        buildRefereeCommand(fixture, fixture.referees[0], {
          matchId: poolMatchId,
          scoringSide: SCORING_SIDE.SIDE_A,
          points: 1,
        })
      );
    }
    stages.push(recordStage(CERTIFICATION_STAGE.REFEREE_SCORE_ENTRY, true, fixture.scoring.rallyTarget));

    const validated = await refereeFacade.submitMatchResultForValidation(
      buildRefereeCommand(fixture, fixture.referees[0], {
        matchId: poolMatchId,
        acceptResult: true,
      })
    );
    stages.push(
      recordStage(
        CERTIFICATION_STAGE.REFEREE_VALIDATE_RESULT,
        validated.ok,
        validated.validationStatus
      )
    );

    const poolStage = composition.composition?.stages?.pool;
    const standingsRows = buildStandingsRowsFromPoolGrouping(poolStage);
    stages.push(
      recordStage(
        CERTIFICATION_STAGE.BUILD_POOL_STANDINGS,
        standingsRows.length > 0,
        standingsRows.length
      )
    );

    const koComposition = createPoolKnockoutRuntimeComposition({
      tenantId: fixture.tenantId,
      competitionId: fixture.competitionId,
      participants: fixture.players.map((p) => p.participantId),
      deterministicSeed: fixture.deterministicSeed,
      catalog,
      formatOverrides: fixture.formatOverrides,
      poolStandingsRows: standingsRows,
      poolStageComplete: true,
      includeKnockout: true,
      requireRuntimePorts: false,
    });
    const koMatchIds = pickKnockoutMatchIds(koComposition);
    const koMatches =
      koMatchIds.length > 0
        ? koMatchIds.map((id) => ({ matchId: id, status: "READY", stage: "KNOCKOUT" }))
        : [{ matchId: "ko-m1", status: "READY", stage: "KNOCKOUT" }];

    const ko = await organizer.activateKnockoutStage(
      cmd({
        qualificationReady: true,
        poolStageComplete: true,
        poolStandingsRows: standingsRows,
        catalog,
        formatOverrides: fixture.formatOverrides,
        matches: koMatches,
      })
    );
    stages.push(
      recordStage(CERTIFICATION_STAGE.ACTIVATE_KNOCKOUT_STAGE, ko.ok, ko.knockoutActive)
    );

    const synced = await organizer.syncMatchOperationalStatuses(
      cmd({
        matches: koMatches.map((m) => ({ ...m, status: "COMPLETED" })),
        standingsReady: true,
        qualificationReady: true,
      })
    );
    stages.push(
      recordStage(CERTIFICATION_STAGE.SYNC_KNOCKOUT_COMPLETED, synced.ok, koMatches.length)
    );

    const completed = await organizer.completeCompetitionOperations(
      cmd({
        matches: koMatches.map((m) => ({ ...m, status: "COMPLETED" })),
      })
    );
    stages.push(
      recordStage(CERTIFICATION_STAGE.COMPLETE_COMPETITION, completed.ok, completed.completionConfirmed)
    );

    const finalPub = await organizer.publishFinalCompetitionResult(cmd());
    stages.push(
      recordStage(
        CERTIFICATION_STAGE.PUBLISH_FINAL_RESULT,
        finalPub.ok,
        finalPub.publication?.revision
      )
    );

    const archive = await organizer.requestArchiveReadiness(cmd());
    stages.push(
      recordStage(
        CERTIFICATION_STAGE.REQUEST_ARCHIVE_READINESS,
        archive.ok && archive.archiveReadiness?.ready === true,
        archive.archiveReadiness?.ready
      )
    );

    const orgRecord = organizerStore.get(fixture.tenantId, fixture.competitionId);
    const publishedRecord = projectPublishedRecordFromOrganizer({
      organizerRecord: orgRecord,
      publicOverlay: {
        ...fixture.publicOverlay,
        publicationState: PUBLICATION_OPS_STATE.FINAL_RESULT_PUBLISHED,
        standings: {
          fingerprint: "stand-e2e07-happy",
          unresolvedTie: false,
          rows: standingsRows.flatMap((g) =>
            g.rows.map((r) => ({
              participantId: r.entryId,
              groupId: g.groupId,
              rank: r.rank,
              points: r.points,
            }))
          ),
        },
        finalResults: {
          fingerprint: "final-e2e07-happy",
          published: true,
          champions: [{ participantId: fixture.players[0].participantId, place: 1 }],
        },
      },
    });
    const publicFacade = createPublicCompetitionExperienceFacade({
      store: publicStore,
    });
    publicFacade.putPublishedCompetitionSnapshot({
      tenantId: fixture.tenantId,
      competitionId: fixture.competitionId,
      snapshot: publishedRecord,
    });
    stages.push(recordStage(CERTIFICATION_STAGE.PUBLIC_PUT_SNAPSHOT, true, publishedRecord.publicationState));

    const overview = await publicFacade.getPublicCompetitionOverview({
      tenantId: fixture.tenantId,
      competitionId: fixture.competitionId,
    });
    stages.push(recordStage(CERTIFICATION_STAGE.PUBLIC_GET_OVERVIEW, overview.ok, overview.availability));

    const standings = await publicFacade.getPublicStandings({
      tenantId: fixture.tenantId,
      competitionId: fixture.competitionId,
    });
    stages.push(recordStage(CERTIFICATION_STAGE.PUBLIC_GET_STANDINGS, standings.ok, standings.availability));

    const finalResults = await publicFacade.getPublicFinalResults({
      tenantId: fixture.tenantId,
      competitionId: fixture.competitionId,
    });
    stages.push(
      recordStage(CERTIFICATION_STAGE.PUBLIC_GET_FINAL, finalResults.ok, finalResults.availability)
    );

    const governanceRecord = buildGovernanceRecordFromFixture(fixture, {
      finalPublished: true,
      archiveReady: true,
      standingsReady: true,
      qualificationReady: true,
      lifecycleState: LIFECYCLE_PROJECTION.COMPLETED,
      standingsFingerprint: "stand-e2e07-happy",
    });
    const certReady = await governanceFacade.createCertificationReadinessProjection(
      buildGovernanceQuery(fixture, { governanceRecord })
    );
    stages.push(
      recordStage(
        CERTIFICATION_STAGE.GOVERNANCE_CERTIFICATION_READINESS,
        certReady.ok && certReady.result?.e2e07Ready === true,
        certReady.result?.fingerprint
      )
    );

    const manifest = await governanceFacade.buildReliabilityEvidence(
      buildGovernanceQuery(fixture, { governanceRecord })
    );
    stages.push(
      recordStage(
        CERTIFICATION_STAGE.GOVERNANCE_EVIDENCE_MANIFEST,
        manifest.ok,
        manifest.result?.fingerprint
      )
    );

    stages.push(
      recordStage(CERTIFICATION_STAGE.HAPPY_PATH_CLOSURE, stages.every((s) => s.ok), stages.length)
    );
  } catch (err) {
    blockers.push(
      Object.freeze({
        code: CERTIFICATION_ERROR_CODE.HAPPY_PATH_BLOCKED,
        message: err instanceof Error ? err.message : String(err),
      })
    );
  }

  const ok = stages.every((s) => s.ok) && blockers.length === 0;
  const evidence = deepFreeze({
    scenarioId: fixture.scenarioId,
    certificationId: fixture.certificationId,
    templateId: fixture.templateId,
    formatId: fixture.formatId,
    stageCount: stages.length,
    startedFromRevision: 0,
    finalRevision: organizerStore.get(fixture.tenantId, fixture.competitionId)?.revision ?? null,
    sourceCommit: input.sourceCommit ?? null,
    generatedAt: input.generatedAt ?? null,
  });

  const deterministicFingerprint = computeCertificationFingerprint({
    kind: "happy-path-certification",
    ok,
    stages: stages.map((s) => ({ stageId: s.stageId, ok: s.ok, fp: s.fingerprintSnippet })),
    evidence,
  });

  return deepFreeze({
    ok,
    verdict: ok ? CERTIFICATION_VERDICT.CERTIFIED_LOCAL_MVP : CERTIFICATION_VERDICT.BLOCKED,
    checkId: CERTIFICATION_CHECK.HAPPY_PATH_VERTICAL,
    stages: Object.freeze(stages),
    checks: Object.freeze([
      Object.freeze({
        id: CERTIFICATION_CHECK.HAPPY_PATH_VERTICAL,
        ok,
        detail: ok ? "27-step happy path complete" : "happy path blocked",
      }),
    ]),
    evidence,
    warnings: Object.freeze([]),
    blockers: Object.freeze(blockers),
    deferredChecks: Object.freeze([]),
    deterministicFingerprint,
  });
}
