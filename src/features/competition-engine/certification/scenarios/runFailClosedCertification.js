/**
 * E2E-07 fail-closed certification matrix.
 * Asserts frozen E2E-03/04/05/06 public error codes — no new engine behavior.
 */

import { PERMISSIONS } from "../../../identity/constants/permissions.js";
import { createInMemoryTemplateCatalog } from "../../../competition-management/template-instantiation/index.js";
import {
  ENTRY_OPS_STATUS,
  GOVERNANCE_ERROR_CODE,
  ORGANIZER_ERROR_CODE,
  PLAYER_ERROR_CODE,
  PUBLIC_ERROR_CODE,
  REFEREE_ERROR_CODE,
  createCompetitionGovernanceReliabilityFacade,
  createInMemoryOrganizerOperationsStore,
  createInMemoryPublicExperienceStore,
  createOrganizerOperationsFacade,
  createPlayerCompetitionOperationsFacade,
  createPublicCompetitionExperienceFacade,
  createRefereeCompetitionOperationsFacade,
  isGovernanceReliabilityError,
  isOrganizerOperationsError,
  isPlayerOperationsError,
  isPublicCompetitionExperienceError,
  isRefereeOperationsError,
} from "../../operations/index.js";
import { CERTIFICATION_CHECK, CERTIFICATION_ERROR_CODE } from "../constants.js";
import { createIndividualPoolKnockoutScenarioFixture } from "../fixtures/individualPoolKnockoutScenario.js";
import { computeCertificationFingerprint, deepFreeze } from "../fingerprint.js";
import { createCertificationRuntimePorts } from "../ports/createCertificationRuntimePorts.js";
import {
  buildGovernanceQuery,
  buildOrganizerCommand,
  buildPlayerCommand,
  buildRefereeCommand,
} from "./scenarioHelpers.js";

/**
 * @param {() => Promise<unknown>} fn
 * @param {(err: unknown) => boolean} predicate
 */
async function expectReject(fn, predicate) {
  try {
    await fn();
    return false;
  } catch (err) {
    return predicate(err);
  }
}

/**
 * @param {object} [input]
 */
export async function runFailClosedCertification(input = {}) {
  const fixture =
    input.fixture || createIndividualPoolKnockoutScenarioFixture(input.fixtureOverrides);
  const ports = createCertificationRuntimePorts(input.portDeps);
  const organizerStore = createInMemoryOrganizerOperationsStore({
    clockIso: fixture.clockIso,
  });
  const organizer = createOrganizerOperationsFacade({
    clockIso: fixture.clockIso,
    runtimePorts: ports,
    store: organizerStore,
  });
  const player = createPlayerCompetitionOperationsFacade({
    runtimePorts: ports,
    organizerStore,
  });
  const referee = createRefereeCompetitionOperationsFacade({
    runtimePorts: ports,
    clockIso: fixture.clockIso,
  });
  const publicFacade = createPublicCompetitionExperienceFacade({
    store: createInMemoryPublicExperienceStore({ clockIso: fixture.clockIso }),
  });
  const governance = createCompetitionGovernanceReliabilityFacade({ runtimePorts: ports });

  const cmd = (overrides = {}) => buildOrganizerCommand(fixture, overrides);
  const catalog = createInMemoryTemplateCatalog();

  /** @type {Array<{ category: string, action: string, expectedCode: string, ok: boolean }>} */
  const matrix = [];

  matrix.push({
    category: "tenant/identity",
    action: "organizer missing tenant",
    expectedCode: ORGANIZER_ERROR_CODE.MISSING_TENANT,
    ok: await expectReject(
      () => organizer.lockParticipantField(cmd({ tenantId: "" })),
      (err) =>
        isOrganizerOperationsError(err) &&
        err.code === ORGANIZER_ERROR_CODE.MISSING_TENANT
    ),
  });

  matrix.push({
    category: "tenant/identity",
    action: "organizer permission denied (cashier)",
    expectedCode: ORGANIZER_ERROR_CODE.PERMISSION_DENIED,
    ok: await expectReject(
      () =>
        organizer.lockParticipantField(
          cmd({ actor: { actorId: "cash-1", role: "CASHIER" } })
        ),
      (err) =>
        isOrganizerOperationsError(err) &&
        err.code === ORGANIZER_ERROR_CODE.PERMISSION_DENIED
    ),
  });

  matrix.push({
    category: "tenant/identity",
    action: "organizer client grants rejected",
    expectedCode: ORGANIZER_ERROR_CODE.CLIENT_GRANT_TRUST_REJECTED,
    ok: await expectReject(
      () =>
        organizer.lockParticipantField(
          cmd({
            actor: {
              actorId: "org-x",
              role: "TOURNAMENT_MANAGER",
              grantedPermissions: [PERMISSIONS.TOURNAMENT_UPDATE],
            },
          })
        ),
      (err) =>
        isOrganizerOperationsError(err) &&
        err.code === ORGANIZER_ERROR_CODE.CLIENT_GRANT_TRUST_REJECTED
    ),
  });

  matrix.push({
    category: "eligibility/check-in",
    action: "player check-in when window closed",
    expectedCode: PLAYER_ERROR_CODE.CHECKIN_NOT_OPEN,
    ok: await expectReject(
      async () => {
        await organizer.prepareCompetitionOperations(
          cmd({
            entries: [
              { participantId: fixture.players[0].participantId, status: ENTRY_OPS_STATUS.ELIGIBLE },
            ],
          })
        );
        return player.checkInPlayer(buildPlayerCommand(fixture, fixture.players[0]));
      },
      (err) =>
        isPlayerOperationsError(err) &&
        err.code === PLAYER_ERROR_CODE.CHECKIN_NOT_OPEN
    ),
  });

  matrix.push({
    category: "schedule/court",
    action: "uncertified schedule rejected",
    expectedCode: ORGANIZER_ERROR_CODE.SCHEDULE_UNCERTIFIED,
    ok: await expectReject(
      async () => {
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
        return organizer.prepareOperationalSchedule(
          cmd({ certifiedSchedule: { certified: false, fingerprint: "bad" } })
        );
      },
      (err) =>
        isOrganizerOperationsError(err) &&
        err.code === ORGANIZER_ERROR_CODE.SCHEDULE_UNCERTIFIED
    ),
  });

  matrix.push({
    category: "schedule/court",
    action: "court snapshot missing",
    expectedCode: ORGANIZER_ERROR_CODE.COURT_SNAPSHOT_MISSING,
    ok: await expectReject(
      async () => {
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
        return organizer.confirmCourtAssignments(cmd({ courtAssignmentRequest: { matches: [] } }));
      },
      (err) =>
        isOrganizerOperationsError(err) &&
        err.code === ORGANIZER_ERROR_CODE.COURT_SNAPSHOT_MISSING
    ),
  });

  matrix.push({
    category: "scoring/validation",
    action: "referee score when match not active",
    expectedCode: REFEREE_ERROR_CODE.MATCH_NOT_ACTIVE,
    ok: await expectReject(
      async () => {
        referee.seedAssignments(
          buildRefereeCommand(fixture, fixture.referees[0], {
            assignments: [{ matchId: "m-fail", refereeId: "ref-1", status: "ASSIGNED" }],
          })
        );
        return referee.createScoreEntrySession(
          buildRefereeCommand(fixture, fixture.referees[0], { matchId: "m-fail" })
        );
      },
      (err) =>
        isRefereeOperationsError(err) &&
        err.code === REFEREE_ERROR_CODE.MATCH_NOT_ACTIVE
    ),
  });

  matrix.push({
    category: "standings/qualification",
    action: "knockout without qualification ready",
    expectedCode: ORGANIZER_ERROR_CODE.QUALIFICATION_NOT_READY,
    ok: await expectReject(
      async () => {
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
        return organizer.activateKnockoutStage(cmd());
      },
      (err) =>
        isOrganizerOperationsError(err) &&
        err.code === ORGANIZER_ERROR_CODE.QUALIFICATION_NOT_READY
    ),
  });

  matrix.push({
    category: "publication/privacy",
    action: "public overview unpublished hidden",
    expectedCode: PUBLIC_ERROR_CODE.COMPETITION_UNPUBLISHED,
    ok: await expectReject(
      () =>
        publicFacade.getPublicCompetitionOverview({
          tenantId: fixture.tenantId,
          competitionId: fixture.competitionId,
        }),
      (err) =>
        isPublicCompetitionExperienceError(err) &&
        (err.code === PUBLIC_ERROR_CODE.COMPETITION_UNPUBLISHED ||
          err.code === PUBLIC_ERROR_CODE.RECORD_NOT_FOUND)
    ),
  });

  matrix.push({
    category: "governance/archive",
    action: "archive before final publication",
    expectedCode: ORGANIZER_ERROR_CODE.FINAL_PUBLICATION_REQUIRED,
    ok: await expectReject(
      async () => {
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
        return organizer.requestArchiveReadiness(cmd());
      },
      (err) =>
        isOrganizerOperationsError(err) &&
        err.code === ORGANIZER_ERROR_CODE.FINAL_PUBLICATION_REQUIRED
    ),
  });

  matrix.push({
    category: "governance/archive",
    action: "governance missing record fail-closed",
    expectedCode: GOVERNANCE_ERROR_CODE.RECORD_NOT_FOUND,
    ok: await expectReject(
      () =>
        governance.getGovernanceState(
          buildGovernanceQuery(fixture, { governanceRecord: null })
        ),
      (err) =>
        isGovernanceReliabilityError(err) &&
        err.code === GOVERNANCE_ERROR_CODE.RECORD_NOT_FOUND
    ),
  });

  const ok = matrix.every((m) => m.ok);
  const evidence = deepFreeze({
    scenarioId: fixture.scenarioId,
    matrixCount: matrix.length,
    categories: Object.freeze([...new Set(matrix.map((m) => m.category))]),
    sourceCommit: input.sourceCommit ?? null,
    generatedAt: input.generatedAt ?? null,
  });

  const deterministicFingerprint = computeCertificationFingerprint({
    kind: "fail-closed-certification",
    ok,
    matrix: matrix.map((m) => ({
      category: m.category,
      action: m.action,
      expectedCode: m.expectedCode,
      ok: m.ok,
    })),
    evidence,
  });

  return deepFreeze({
    ok,
    checkId: CERTIFICATION_CHECK.FAIL_CLOSED_MATRIX,
    checks: Object.freeze([
      Object.freeze({
        id: CERTIFICATION_CHECK.FAIL_CLOSED_MATRIX,
        ok,
        detail: `${matrix.filter((m) => m.ok).length}/${matrix.length} fail-closed cases`,
      }),
    ]),
    matrix: Object.freeze(matrix.map((m) => Object.freeze({ ...m }))),
    evidence,
    warnings: Object.freeze([]),
    blockers: Object.freeze(
      ok
        ? []
        : matrix
            .filter((m) => !m.ok)
            .map((m) =>
              Object.freeze({
                code: CERTIFICATION_ERROR_CODE.FAIL_CLOSED_GAP,
                message: `${m.category}: ${m.action}`,
                expectedCode: m.expectedCode,
              })
            )
    ),
    deterministicFingerprint,
  });
}
