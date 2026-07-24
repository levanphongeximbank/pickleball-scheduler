/**
 * E2E-04 Referee Competition Operations application facade.
 *
 * Orchestrates assignment enforcement, CORE-15 lifecycle, CORE-16 scoring,
 * and CORE-17 result validation handoff — no parallel engines.
 */

import { createCompetitionRuntimePorts } from "../../integration/composition/createCompetitionRuntimePorts.js";
import {
  MATCH_ACTION,
  MATCH_STATUS,
  applyMatchTransition,
  createCompetitionMatch,
  createMatchSide,
} from "../../../competition-core/matches/index.js";
import {
  SCORING_SIDE,
  SCORING_SYSTEM,
  createScoringFormat,
  createInitialScoringState,
  createScoringProjection,
  recordPoint,
} from "../../../competition-core/scoring/index.js";
import {
  ACCEPTANCE_STATUS,
  ACTOR_TYPE,
  LIFECYCLE_COMPLETION_REASON,
  LIFECYCLE_STATUS,
  MATCH_SIDE_KEY,
  OUTCOME,
  RESULT_TYPE,
  SOURCE_TYPE,
  acceptMatchResult,
  validateMatchResult,
} from "../../../competition-core/result-validation/index.js";
import {
  E2E04_REFEREE_OPERATIONS_VERSION,
  REFEREE_ACTION,
  REFEREE_ASSIGNMENT_OPS_STATUS,
  REFEREE_ERROR_CODE,
  REFEREE_VALIDATION_OPS_STATUS,
} from "./constants.js";
import {
  failReferee,
  isRefereeOperationsError,
  normalizeRefereeError,
} from "./errors.js";
import { authorizeRefereeCommand } from "./context/authorizeRefereeCommand.js";
import { assertRefereeAssignmentScope } from "./context/assertRefereeAssignment.js";
import { buildRefereeOperationsProjection } from "./projections/buildRefereeOperationsProjection.js";
import { createInMemoryRefereeOperationsStore } from "./store/createInMemoryRefereeOperationsStore.js";
import {
  computeOrganizerFingerprint,
  deepFreeze,
  isNonEmptyString,
  snapshotInput,
} from "../fingerprint.js";

/**
 * @param {object} deps
 */
export function createRefereeCompetitionOperationsFacade(deps = {}) {
  const clockIso = isNonEmptyString(deps.clockIso)
    ? String(deps.clockIso).trim()
    : "2026-07-24T00:00:00.000Z";

  const store =
    deps.store || createInMemoryRefereeOperationsStore({ clockIso });

  const runtimePorts =
    deps.runtimePorts ||
    createCompetitionRuntimePorts(deps.runtimePortDeps || {});

  let idSeq = 0;
  function nextDeterministicId(prefix) {
    idSeq += 1;
    return `${prefix}-${idSeq}`;
  }

  function grantedFromAuth(auth) {
    return (
      auth.decision?.explanation?.grantedPermissions ||
      auth.decision?.details?.grantedPermissions ||
      []
    );
  }

  async function authorize(command, action) {
    return authorizeRefereeCommand({
      action,
      actor: command.actor,
      tenantId: command.tenantId,
      competitionId: command.competitionId,
      venueId: command.venueId,
      runtimePorts,
      context: command.context,
    });
  }

  function loadRecord(command) {
    const tenantId = String(command.tenantId || "").trim();
    const competitionId = String(command.competitionId || "").trim();
    return store.get(tenantId, competitionId);
  }

  function findAssignment(record, refereeId, matchId) {
    const list = Array.isArray(record.assignments) ? record.assignments : [];
    return (
      list.find(
        (a) =>
          String(a.refereeId).trim() === String(refereeId).trim() &&
          (!matchId || String(a.matchId).trim() === String(matchId).trim()) &&
          a.status !== REFEREE_ASSIGNMENT_OPS_STATUS.RELEASED &&
          a.status !== REFEREE_ASSIGNMENT_OPS_STATUS.REASSIGNED
      ) || null
    );
  }

  function requireAssignedMatch(command, auth, matchId) {
    const record = loadRecord(command);
    const assignment = findAssignment(record, auth.refereeId, matchId);
    assertRefereeAssignmentScope({
      assignment,
      refereeId: auth.refereeId,
      tenantId: command.tenantId,
      competitionId: command.competitionId,
      venueId: command.venueId,
      matchId,
    });
    return { record, assignment };
  }

  function project(command, auth, matchId = null) {
    const record = loadRecord(command);
    return buildRefereeOperationsProjection({
      record,
      refereeId: auth.refereeId,
      grantedPermissions: grantedFromAuth(auth),
      matchId,
    });
  }

  async function run(command, fn) {
    const inputSnap = snapshotInput(command);
    try {
      const result = await fn(command);
      if (JSON.stringify(snapshotInput(command)) !== JSON.stringify(inputSnap)) {
        failReferee(
          REFEREE_ERROR_CODE.INVALID_INPUT,
          "Referee facade must not mutate caller input",
          {}
        );
      }
      return result;
    } catch (err) {
      if (isRefereeOperationsError(err)) throw err;
      throw normalizeRefereeError(
        err,
        REFEREE_ERROR_CODE.CANONICAL_CALL_FAILED,
        "Referee operations canonical call failed"
      );
    }
  }

  /**
   * Seed CORE-13 assignment handoff + optional match snapshots (test/runtime wiring).
   */
  function seedAssignments(command = {}) {
    const tenantId = String(command.tenantId || "").trim();
    const competitionId = String(command.competitionId || "").trim();
    if (!tenantId || !competitionId) {
      failReferee(
        REFEREE_ERROR_CODE.INVALID_INPUT,
        "tenantId and competitionId required to seed assignments",
        {}
      );
    }
    const record = store.upsertAssignments(
      tenantId,
      competitionId,
      command.assignments || [],
      { venueId: command.venueId }
    );
    if (Array.isArray(command.matches)) {
      for (const match of command.matches) {
        store.putMatch(tenantId, competitionId, match);
      }
    }
    return deepFreeze({
      ok: true,
      assignmentCount: record.assignments.length,
      fingerprint: computeOrganizerFingerprint(
        { assignments: record.assignments.map((a) => a.assignmentId) },
        "e2e04-ref-seed"
      ),
    });
  }

  async function getRefereeAssignmentQueue(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, REFEREE_ACTION.ASSIGNMENT_READ);
      const projection = project(cmd, auth);
      return deepFreeze({
        ok: true,
        queue: projection.assignmentQueue,
        projection,
        fingerprint: projection.projectionFingerprint,
      });
    });
  }

  async function getAssignedMatch(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, REFEREE_ACTION.ASSIGNMENT_READ);
      const matchId = String(cmd.matchId || "").trim();
      if (!matchId) {
        failReferee(
          REFEREE_ERROR_CODE.MISSING_MATCH,
          "matchId is required",
          {}
        );
      }
      requireAssignedMatch(cmd, auth, matchId);
      const projection = project(cmd, auth, matchId);
      return deepFreeze({
        ok: true,
        assignedMatch: projection.assignedMatch,
        projection,
        fingerprint: projection.projectionFingerprint,
      });
    });
  }

  async function acknowledgeAssignment(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, REFEREE_ACTION.ASSIGNMENT_ACK);
      const matchId = String(cmd.matchId || "").trim();
      requireAssignedMatch(cmd, auth, matchId);
      let idempotent = false;
      store.update(cmd.tenantId, cmd.competitionId, (draft) => {
        const row = draft.assignments.find(
          (a) =>
            a.matchId === matchId && a.refereeId === auth.refereeId
        );
        if (row) {
          if (
            row.status === REFEREE_ASSIGNMENT_OPS_STATUS.ACKNOWLEDGED ||
            row.status === REFEREE_ASSIGNMENT_OPS_STATUS.READY
          ) {
            idempotent = true;
          } else {
            row.status = REFEREE_ASSIGNMENT_OPS_STATUS.ACKNOWLEDGED;
            idempotent = false;
          }
        }
      });
      const record = loadRecord(cmd);
      return deepFreeze({
        ok: true,
        idempotent,
        status: REFEREE_ASSIGNMENT_OPS_STATUS.ACKNOWLEDGED,
        fingerprint: computeOrganizerFingerprint(
          { matchId, refereeId: auth.refereeId, revision: record.revision },
          "e2e04-ref-ack"
        ),
      });
    });
  }

  function ensureMatchSnapshot(cmd, matchId, assignment) {
    const record = loadRecord(cmd);
    if (record.matches?.[matchId]) return record.matches[matchId];
    const match = createCompetitionMatch({
      id: matchId,
      competitionId: String(cmd.competitionId).trim(),
      contextId: matchId,
      status: MATCH_STATUS.READY_TO_START,
      sides: [
        createMatchSide({ sideKey: "A" }),
        createMatchSide({ sideKey: "B" }),
      ],
      scheduledAt: assignment.scheduledAt || clockIso,
      courtAssignmentRef: assignment.courtId || "court-1",
      refereeAssignmentRef: assignment.assignmentId,
    });
    store.putMatch(cmd.tenantId, cmd.competitionId, match);
    return match;
  }

  async function openAssignedMatch(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, REFEREE_ACTION.MATCH_OPEN);
      const matchId = String(cmd.matchId || "").trim();
      const { assignment } = requireAssignedMatch(cmd, auth, matchId);
      let match = ensureMatchSnapshot(cmd, matchId, assignment);

      // Transition toward IN_PROGRESS using CORE-15 only.
      const authz = {
        allowed: true,
        actorId: auth.subject.actorId,
        actorRole: auth.subject.role,
        decisionCode: "ALLOWED",
        policyId: "e2e04-referee-ops",
      };

      if (match.status === MATCH_STATUS.SCHEDULED) {
        match = applyMatchTransition({
          match,
          action: MATCH_ACTION.MARK_READY_TO_START,
          authorization: authz,
          now: clockIso,
          enforceReadiness: false,
        }).match;
      }
      if (
        match.status === MATCH_STATUS.READY_TO_START ||
        match.status === MATCH_STATUS.SCHEDULED
      ) {
        match = applyMatchTransition({
          match,
          action: MATCH_ACTION.START,
          authorization: authz,
          now: clockIso,
          enforceReadiness: false,
        }).match;
      } else if (match.status === MATCH_STATUS.IN_PROGRESS) {
        store.putMatch(cmd.tenantId, cmd.competitionId, match);
        return deepFreeze({
          ok: true,
          idempotent: true,
          match,
          fingerprint: computeOrganizerFingerprint(
            { matchId, status: match.status },
            "e2e04-ref-open"
          ),
        });
      } else {
        failReferee(
          REFEREE_ERROR_CODE.INVALID_STATE,
          `Cannot open match from status ${match.status}`,
          { status: match.status }
        );
      }

      store.putMatch(cmd.tenantId, cmd.competitionId, match);
      store.update(cmd.tenantId, cmd.competitionId, (draft) => {
        const row = draft.assignments.find(
          (a) => a.matchId === matchId && a.refereeId === auth.refereeId
        );
        if (row) row.status = REFEREE_ASSIGNMENT_OPS_STATUS.READY;
      });

      return deepFreeze({
        ok: true,
        idempotent: false,
        match,
        fingerprint: computeOrganizerFingerprint(
          { matchId, status: match.status },
          "e2e04-ref-open"
        ),
      });
    });
  }

  async function suspendAssignedMatch(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, REFEREE_ACTION.MATCH_SUSPEND);
      const matchId = String(cmd.matchId || "").trim();
      requireAssignedMatch(cmd, auth, matchId);
      const record = loadRecord(cmd);
      const match = record.matches?.[matchId];
      if (!match) {
        failReferee(REFEREE_ERROR_CODE.MISSING_MATCH, "Match snapshot missing", {
          matchId,
        });
      }
      const result = applyMatchTransition({
        match,
        action: MATCH_ACTION.SUSPEND,
        authorization: {
          allowed: true,
          actorId: auth.subject.actorId,
          actorRole: auth.subject.role,
          decisionCode: "ALLOWED",
          policyId: "e2e04-referee-ops",
        },
        now: clockIso,
        enforceReadiness: false,
      });
      store.putMatch(cmd.tenantId, cmd.competitionId, result.match);
      return deepFreeze({
        ok: true,
        match: result.match,
        fingerprint: computeOrganizerFingerprint(
          { matchId, status: result.match.status },
          "e2e04-ref-suspend"
        ),
      });
    });
  }

  async function resumeAssignedMatch(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, REFEREE_ACTION.MATCH_RESUME);
      const matchId = String(cmd.matchId || "").trim();
      requireAssignedMatch(cmd, auth, matchId);
      const record = loadRecord(cmd);
      const match = record.matches?.[matchId];
      if (!match) {
        failReferee(REFEREE_ERROR_CODE.MISSING_MATCH, "Match snapshot missing", {
          matchId,
        });
      }
      const result = applyMatchTransition({
        match,
        action: MATCH_ACTION.RESUME,
        authorization: {
          allowed: true,
          actorId: auth.subject.actorId,
          actorRole: auth.subject.role,
          decisionCode: "ALLOWED",
          policyId: "e2e04-referee-ops",
        },
        now: clockIso,
        enforceReadiness: false,
      });
      store.putMatch(cmd.tenantId, cmd.competitionId, result.match);
      return deepFreeze({
        ok: true,
        match: result.match,
        fingerprint: computeOrganizerFingerprint(
          { matchId, status: result.match.status },
          "e2e04-ref-resume"
        ),
      });
    });
  }

  async function createScoreEntrySession(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, REFEREE_ACTION.SCORE_SESSION);
      const matchId = String(cmd.matchId || "").trim();
      requireAssignedMatch(cmd, auth, matchId);
      const record = loadRecord(cmd);
      const match = record.matches?.[matchId];
      if (!match || String(match.status).toUpperCase() !== MATCH_STATUS.IN_PROGRESS) {
        failReferee(
          REFEREE_ERROR_CODE.MATCH_NOT_ACTIVE,
          "Score entry requires an active (IN_PROGRESS) match",
          { status: match?.status || null }
        );
      }

      if (record.scoreSessions?.[matchId]?.sessionId) {
        return deepFreeze({
          ok: true,
          idempotent: true,
          session: record.scoreSessions[matchId],
          fingerprint: computeOrganizerFingerprint(
            record.scoreSessions[matchId],
            "e2e04-ref-score-session"
          ),
        });
      }

      const format = createScoringFormat({
        scoringSystem: SCORING_SYSTEM.RALLY,
        pointsToWin: Number(cmd.pointsToWin) || 11,
        winBy: Number(cmd.winBy) || 2,
        bestOfGames: Number(cmd.bestOfGames) || 1,
      });
      const state = createInitialScoringState({ matchId, format });
      const projection = createScoringProjection(state);
      const session = Object.freeze({
        sessionId: nextDeterministicId("score-session"),
        matchId,
        refereeId: auth.refereeId,
        openedAt: clockIso,
        state,
        projection,
      });
      store.update(cmd.tenantId, cmd.competitionId, (draft) => {
        draft.scoreSessions[matchId] = session;
      });
      return deepFreeze({
        ok: true,
        idempotent: false,
        session,
        fingerprint: computeOrganizerFingerprint(
          session,
          "e2e04-ref-score-session"
        ),
      });
    });
  }

  async function submitScoreProjection(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, REFEREE_ACTION.SCORE_SUBMIT);
      const matchId = String(cmd.matchId || "").trim();
      requireAssignedMatch(cmd, auth, matchId);
      const record = loadRecord(cmd);
      const match = record.matches?.[matchId];
      if (!match || String(match.status).toUpperCase() !== MATCH_STATUS.IN_PROGRESS) {
        failReferee(
          REFEREE_ERROR_CODE.MATCH_NOT_ACTIVE,
          "Score submit requires an active match",
          { status: match?.status || null }
        );
      }
      const session = record.scoreSessions?.[matchId];
      if (!session) {
        failReferee(
          REFEREE_ERROR_CODE.SCORE_ENTRY_NOT_READY,
          "Score entry session is required before submitting points",
          { matchId }
        );
      }

      const scoringSide = String(cmd.scoringSide || "").trim();
      if (scoringSide !== SCORING_SIDE.SIDE_A && scoringSide !== SCORING_SIDE.SIDE_B) {
        failReferee(
          REFEREE_ERROR_CODE.INVALID_SCORE,
          "scoringSide must be SIDE_A or SIDE_B",
          { scoringSide }
        );
      }

      let state = session.state;
      const points = Math.max(1, Number(cmd.points) || 1);
      for (let i = 0; i < points; i += 1) {
        const applied = recordPoint(
          state,
          {
            scoringSide,
            lifecycleStatus: MATCH_STATUS.IN_PROGRESS,
          },
          {
            now: () => clockIso,
            nextId: () => nextDeterministicId("evt"),
          }
        );
        state = applied.state;
      }
      const projection = createScoringProjection(state);
      const nextSession = Object.freeze({
        ...session,
        state,
        projection,
        updatedAt: clockIso,
      });
      store.update(cmd.tenantId, cmd.competitionId, (draft) => {
        draft.scoreSessions[matchId] = nextSession;
      });
      return deepFreeze({
        ok: true,
        scoreProjection: projection,
        matchComplete: Boolean(state.matchComplete),
        calculatedWinnerSide: state.calculatedWinnerSide || null,
        winnerInferenceByFacade: false,
        fingerprint: computeOrganizerFingerprint(
          { matchId, projection },
          "e2e04-ref-score"
        ),
      });
    });
  }

  function buildSideBindings(cmd, assignment) {
    if (Array.isArray(cmd.sideBindings) && cmd.sideBindings.length === 2) {
      return cmd.sideBindings;
    }
    const entries = assignment.entries || assignment.participants || [];
    return [
      {
        matchSideKey: MATCH_SIDE_KEY.A,
        scoringSide: SCORING_SIDE.SIDE_A,
        matchSideId: "side-a",
        entryId: entries[0]?.entryId || entries[0]?.id || "entry-a",
        teamId: null,
        participantIds: [entries[0]?.participantId || "p-a"],
      },
      {
        matchSideKey: MATCH_SIDE_KEY.B,
        scoringSide: SCORING_SIDE.SIDE_B,
        matchSideId: "side-b",
        entryId: entries[1]?.entryId || entries[1]?.id || "entry-b",
        teamId: null,
        participantIds: [entries[1]?.participantId || "p-b"],
      },
    ];
  }

  async function submitMatchResultForValidation(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, REFEREE_ACTION.RESULT_SUBMIT);
      const matchId = String(cmd.matchId || "").trim();
      const { assignment } = requireAssignedMatch(cmd, auth, matchId);
      const record = loadRecord(cmd);
      const session = record.scoreSessions?.[matchId];
      if (!session?.projection) {
        failReferee(
          REFEREE_ERROR_CODE.VALIDATION_PRECONDITION,
          "Score projection is required before result validation handoff",
          { matchId }
        );
      }
      if (!session.state?.matchComplete) {
        failReferee(
          REFEREE_ERROR_CODE.VALIDATION_PRECONDITION,
          "Match scoring is not complete; cannot submit result",
          { matchId }
        );
      }

      const winnerSide = session.state.calculatedWinnerSide;
      const loserSide =
        winnerSide === SCORING_SIDE.SIDE_A
          ? SCORING_SIDE.SIDE_B
          : SCORING_SIDE.SIDE_A;

      const validated = validateMatchResult(
        {
          matchId,
          competitionId: String(cmd.competitionId).trim(),
          contextId: matchId,
          resultType: RESULT_TYPE.COMPLETED,
          outcome: OUTCOME.WIN_LOSS,
          winnerSide,
          loserSide,
          sideBindings: buildSideBindings(cmd, assignment),
          actor: {
            actorType: ACTOR_TYPE.REFEREE,
            actorId: auth.refereeId,
          },
          source: {
            sourceType: SOURCE_TYPE.CORE16_PROJECTION,
            sourceId: session.sessionId,
          },
        },
        {
          scoringProjection: session.projection,
          now: () => clockIso,
          nextId: () => nextDeterministicId("vr"),
        }
      );

      let status = REFEREE_VALIDATION_OPS_STATUS.PENDING;
      if (validated.acceptanceStatus === ACCEPTANCE_STATUS.PENDING) {
        status = Array.isArray(validated.correctionRequiredCodes) &&
          validated.correctionRequiredCodes.length > 0
          ? REFEREE_VALIDATION_OPS_STATUS.CORRECTION_REQUIRED
          : REFEREE_VALIDATION_OPS_STATUS.PENDING;
      } else if (validated.acceptanceStatus === ACCEPTANCE_STATUS.REJECTED) {
        status = REFEREE_VALIDATION_OPS_STATUS.REJECTED;
      }

      // Optional auto-accept for MVP when command requests director accept handoff.
      let accepted = null;
      if (cmd.acceptResult === true && status === REFEREE_VALIDATION_OPS_STATUS.PENDING) {
        accepted = acceptMatchResult(validated, {
          actor: {
            actorType: ACTOR_TYPE.DIRECTOR,
            actorId: cmd.acceptActorId || "director-ops",
          },
          lifecycleStatus: LIFECYCLE_STATUS.COMPLETED,
          completionReason: LIFECYCLE_COMPLETION_REASON.COMPLETED,
          now: () => clockIso,
        });
        status = REFEREE_VALIDATION_OPS_STATUS.ACCEPTED;

        // Complete match lifecycle after accepted validation — still CORE-15.
        const match = record.matches?.[matchId];
        if (match) {
          const completed = applyMatchTransition({
            match,
            action: MATCH_ACTION.COMPLETE,
            authorization: {
              allowed: true,
              actorId: auth.subject.actorId,
              actorRole: auth.subject.role,
              decisionCode: "ALLOWED",
              policyId: "e2e04-referee-ops",
            },
            now: clockIso,
            enforceReadiness: false,
            completionReason: "COMPLETED",
          });
          store.putMatch(cmd.tenantId, cmd.competitionId, completed.match);
        }
      }

      const validationRecord = Object.freeze({
        status,
        validatedResult: accepted || validated,
        correctionRequiredCodes: validated.correctionRequiredCodes || [],
        standingsEligible:
          status === REFEREE_VALIDATION_OPS_STATUS.ACCEPTED,
        winnerInferenceByFacade: false,
      });

      store.update(cmd.tenantId, cmd.competitionId, (draft) => {
        draft.validationByMatch[matchId] = validationRecord;
      });

      return deepFreeze({
        ok: true,
        validationStatus: status,
        validatedResult: validationRecord.validatedResult,
        standingsEligible: validationRecord.standingsEligible,
        correctionRequiredCodes: validationRecord.correctionRequiredCodes,
        fingerprint: computeOrganizerFingerprint(
          validationRecord,
          "e2e04-ref-validate"
        ),
      });
    });
  }

  async function getCorrectionRequiredState(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, REFEREE_ACTION.RESULT_READ);
      const matchId = String(cmd.matchId || "").trim();
      requireAssignedMatch(cmd, auth, matchId);
      const record = loadRecord(cmd);
      const validation = record.validationByMatch?.[matchId] || null;
      return deepFreeze({
        ok: true,
        correctionRequired:
          validation?.status ===
          REFEREE_VALIDATION_OPS_STATUS.CORRECTION_REQUIRED,
        correctionRequiredCodes: validation?.correctionRequiredCodes || [],
        validationStatus: validation?.status || REFEREE_VALIDATION_OPS_STATUS.NONE,
        fingerprint: computeOrganizerFingerprint(
          { matchId, validation },
          "e2e04-ref-correction"
        ),
      });
    });
  }

  async function resubmitCorrectedResult(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, REFEREE_ACTION.RESULT_CORRECT);
      const matchId = String(cmd.matchId || "").trim();
      requireAssignedMatch(cmd, auth, matchId);
      const record = loadRecord(cmd);
      const validation = record.validationByMatch?.[matchId];
      if (
        !validation ||
        validation.status !== REFEREE_VALIDATION_OPS_STATUS.CORRECTION_REQUIRED
      ) {
        failReferee(
          REFEREE_ERROR_CODE.CORRECTION_NOT_REQUIRED,
          "No correction-required state for this match",
          { status: validation?.status || null }
        );
      }
      // Re-enter validation path with corrected projection/session.
      return submitMatchResultForValidation({
        ...cmd,
        acceptResult: cmd.acceptResult !== false,
      });
    });
  }

  async function getValidatedResultState(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, REFEREE_ACTION.RESULT_READ);
      const matchId = String(cmd.matchId || "").trim();
      requireAssignedMatch(cmd, auth, matchId);
      const record = loadRecord(cmd);
      const validation = record.validationByMatch?.[matchId] || {
        status: REFEREE_VALIDATION_OPS_STATUS.NONE,
        validatedResult: null,
        standingsEligible: false,
      };
      return deepFreeze({
        ok: true,
        validationStatus: validation.status,
        validatedResult:
          validation.status === REFEREE_VALIDATION_OPS_STATUS.ACCEPTED
            ? validation.validatedResult
            : null,
        standingsEligible: validation.standingsEligible === true,
        winnerInferenceByFacade: false,
        fingerprint: computeOrganizerFingerprint(
          validation,
          "e2e04-ref-validated"
        ),
      });
    });
  }

  return Object.freeze({
    kind: "referee-competition-operations-facade",
    version: E2E04_REFEREE_OPERATIONS_VERSION,
    store,
    seedAssignments,
    getRefereeAssignmentQueue,
    getAssignedMatch,
    acknowledgeAssignment,
    openAssignedMatch,
    suspendAssignedMatch,
    resumeAssignedMatch,
    createScoreEntrySession,
    submitScoreProjection,
    submitMatchResultForValidation,
    getCorrectionRequiredState,
    resubmitCorrectedResult,
    getValidatedResultState,
  });
}
