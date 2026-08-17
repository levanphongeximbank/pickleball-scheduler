/**
 * E2E-04 Referee Competition Operations application facade.
 *
 * Orchestrates assignment enforcement, CORE-15 lifecycle, CORE-16 scoring,
 * and CORE-17 result validation handoff — no parallel engines.
 *
 * Store/runtime is mandatory. In-memory is TEST_DOUBLE_ONLY and must be
 * injected explicitly. Production default is createDefaultCompetitionRefereeRuntime.
 */

import { createCompetitionRuntimePorts } from "../../integration/composition/createCompetitionRuntimePorts.js";
import {
  COMPETITION_TYPE_TO_REFEREE_MODE,
} from "../../integration/referee/constants.js";
import { normalizeRefereeAdapterMode } from "../../integration/referee/contract.js";
import { isRefereeAdapterContractError } from "../../integration/referee/errors.js";
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
  supersedeScoringEvent,
} from "../../../competition-core/scoring/index.js";
import {
  deriveCanonicalCourtAfterScoring,
  resolveSideChangeRequiredAfterScoring,
} from "../../integration/referee/deriveCanonicalCourtAfterScoring.js";
import {
  assertUndoLastScoringEligible,
  evaluateUndoAvailability,
  findLastEligibleScoringEvent,
  SCORING_ACTION_LEDGER_KIND,
} from "./scoring/undoLastScoringActionHelpers.js";
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

  // Host may inject wall-clock nowMs for UNDO_* instrumentation. Default is
  // deterministic (no Date.now) so E2E-04 ops stay architecture-clean.
  const nowMs =
    typeof deps.nowMs === "function"
      ? deps.nowMs
      : (() => {
          let tick = 0;
          return () => {
            tick += 1;
            return tick;
          };
        })();

  const store = deps.store || deps.runtime?.opsStore || null;
  if (!store) {
    failReferee(
      REFEREE_ERROR_CODE.PRECONDITION_FAILED,
      "Referee operations store/runtime is required. In-memory is TEST_DOUBLE_ONLY and must be injected explicitly.",
      {}
    );
  }

  const runtimePorts =
    deps.runtimePorts ||
    createCompetitionRuntimePorts(deps.runtimePortDeps || {});

  const usesAdapterB = deps.runtime?.usesAdapterB === true;
  const modeAdapterRegistry =
    deps.modeAdapterRegistry || deps.runtime?.modeAdapterRegistry || null;

  if (usesAdapterB && (!modeAdapterRegistry || typeof modeAdapterRegistry.resolve !== "function")) {
    failReferee(
      REFEREE_ERROR_CODE.PRECONDITION_FAILED,
      "Canonical Adapter B cutover requires modeAdapterRegistry; silent legacy fallback is forbidden",
      {}
    );
  }

  let idSeq = 0;
  function nextDeterministicId(prefix) {
    idSeq += 1;
    return `${prefix}-${idSeq}`;
  }

  function adapterRequestFromCommand(cmd, matchId = null) {
    return {
      tenantId: cmd.tenantId,
      competitionId: cmd.competitionId,
      matchId: matchId || cmd.matchId || null,
      venueId: cmd.venueId || null,
      clubId: cmd.clubId || null,
      modeState: cmd.modeState || null,
      competitionMode: cmd.competitionMode || null,
      competitionType: cmd.competitionType || null,
    };
  }

  /**
   * Resolve Mode Adapter B when cut over. Fail closed — no legacy fallback.
   * Compatibility facade (no usesAdapterB) returns null and keeps prior path.
   */
  function requireModeAdapter(cmd) {
    if (!usesAdapterB) return null;
    const modeHint =
      cmd.competitionMode ||
      COMPETITION_TYPE_TO_REFEREE_MODE[
        String(cmd.competitionType || "").trim().toLowerCase()
      ] ||
      cmd.modeState?.competitionMode ||
      null;
    const mode = normalizeRefereeAdapterMode(modeHint);
    return modeAdapterRegistry.resolve(mode);
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

  async function loadRecord(command) {
    const tenantId = String(command.tenantId || "").trim();
    const competitionId = String(command.competitionId || "").trim();
    return await store.get(tenantId, competitionId);
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

  async function requireAssignedMatch(command, auth, matchId) {
    const record = await loadRecord(command);
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

  async function project(command, auth, matchId = null) {
    const record = await loadRecord(command);
    return buildRefereeOperationsProjection({
      record,
      refereeId: auth.refereeId,
      grantedPermissions: grantedFromAuth(auth),
      matchId,
    });
  }

  function bindStoreCommand(command = {}) {
    if (typeof store.setCommandContext === "function") {
      store.setCommandContext({
        actor: command.actor || null,
        idempotencyKey: command.idempotencyKey || command.commandId || null,
        commandId: command.commandId || command.idempotencyKey || null,
        tenantId: command.tenantId || null,
        competitionId: command.competitionId || null,
      });
    }
  }

  async function run(command, fn) {
    const inputSnap = snapshotInput(command);
    bindStoreCommand(command);
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
      if (isRefereeAdapterContractError(err)) throw err;
      throw normalizeRefereeError(
        err,
        REFEREE_ERROR_CODE.CANONICAL_CALL_FAILED,
        "Referee operations canonical call failed"
      );
    } finally {
      if (typeof store.setCommandContext === "function") {
        store.setCommandContext(null);
      }
    }
  }

  /**
   * Seed CORE-13 assignment handoff + optional match snapshots (test/runtime wiring).
   */
  async function seedAssignments(command = {}) {
    const tenantId = String(command.tenantId || "").trim();
    const competitionId = String(command.competitionId || "").trim();
    if (!tenantId || !competitionId) {
      failReferee(
        REFEREE_ERROR_CODE.INVALID_INPUT,
        "tenantId and competitionId required to seed assignments",
        {}
      );
    }
    bindStoreCommand(command);
    const record = await store.upsertAssignments(
      tenantId,
      competitionId,
      command.assignments || [],
      { venueId: command.venueId, actor: command.actor }
    );
    if (Array.isArray(command.matches)) {
      for (const match of command.matches) {
        await store.putMatch(tenantId, competitionId, match);
      }
    }
    if (command.courtsByMatch && typeof command.courtsByMatch === "object") {
      await store.update(tenantId, competitionId, (draft) => {
        draft.courtsByMatch = draft.courtsByMatch || {};
        for (const [matchId, court] of Object.entries(command.courtsByMatch)) {
          draft.courtsByMatch[matchId] = court;
        }
      });
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
      const projection = await project(cmd, auth);
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
      await requireAssignedMatch(cmd, auth, matchId);
      const projection = await project(cmd, auth, matchId);
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
      await requireAssignedMatch(cmd, auth, matchId);
      let idempotent = false;
      await store.update(cmd.tenantId, cmd.competitionId, (draft) => {
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
      const record = await loadRecord(cmd);
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

  async function ensureMatchSnapshot(cmd, matchId, assignment) {
    const record = await loadRecord(cmd);
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
    await store.putMatch(cmd.tenantId, cmd.competitionId, match);
    return match;
  }

  async function openAssignedMatch(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, REFEREE_ACTION.MATCH_OPEN);
      const matchId = String(cmd.matchId || "").trim();
      const { assignment } = await requireAssignedMatch(cmd, auth, matchId);

      const adapter = requireModeAdapter(cmd);
      if (adapter) {
        const preStart = adapter.validatePreStart(
          adapterRequestFromCommand(cmd, matchId)
        );
        if (!preStart || preStart.ok !== true) {
          failReferee(
            REFEREE_ERROR_CODE.PRECONDITION_FAILED,
            "Adapter B pre-start validation failed; canonical open denied",
            {
              blockers: preStart?.blockers || [],
              competitionMode: adapter.competitionMode,
              silentLegacyFallback: false,
            }
          );
        }
      }

      let match = await ensureMatchSnapshot(cmd, matchId, assignment);

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
        await store.putMatch(cmd.tenantId, cmd.competitionId, match);
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

      await store.putMatch(cmd.tenantId, cmd.competitionId, match);
      await store.update(cmd.tenantId, cmd.competitionId, (draft) => {
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
      await requireAssignedMatch(cmd, auth, matchId);
      const record = await loadRecord(cmd);
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
      await store.putMatch(cmd.tenantId, cmd.competitionId, result.match);
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
      await requireAssignedMatch(cmd, auth, matchId);
      const record = await loadRecord(cmd);
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
      await store.putMatch(cmd.tenantId, cmd.competitionId, result.match);
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
      await requireAssignedMatch(cmd, auth, matchId);
      const record = await loadRecord(cmd);
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

      const adapter = requireModeAdapter(cmd);
      let format;
      if (adapter) {
        // Adapter B translates scoring rules; CORE-16 remains scoring authority.
        format = adapter.getScoringRules(
          adapterRequestFromCommand(cmd, matchId)
        );
      } else {
        format = createScoringFormat({
          scoringSystem: String(cmd.scoringSystem || SCORING_SYSTEM.RALLY)
            .trim()
            .toUpperCase(),
          pointsToWin: Number(cmd.pointsToWin) || 11,
          winBy: Number(cmd.winBy) || 2,
          bestOfGames: Number(cmd.bestOfGames) || 1,
          sideSwitchAt:
            cmd.sideSwitchAt != null && cmd.sideSwitchAt !== ""
              ? Number(cmd.sideSwitchAt)
              : null,
          serversPerSide: Number(cmd.serversPerSide) || 2,
          initialServingSide: cmd.initialServingSide || SCORING_SIDE.SIDE_A,
        });
      }
      const priorCourt = record.courtsByMatch?.[matchId] || cmd.priorCourt || null;
      const trackServe =
        String(format.scoringSystem).toUpperCase() === SCORING_SYSTEM.SIDE_OUT ||
        cmd.trackServe === true ||
        Boolean(priorCourt?.serverPlayerId) ||
        Boolean(priorCourt?.lineupConfigured);
      let state = createInitialScoringState({ matchId, format, trackServe });
      if (state.serve && priorCourt) {
        const openingFromCourt = Number(priorCourt.serverNumber);
        const sideFromCourt = priorCourt.servingSide
          ? String(priorCourt.servingSide).toUpperCase()
          : null;
        if (
          (Number.isFinite(openingFromCourt) && openingFromCourt >= 1) ||
          sideFromCourt
        ) {
          state = Object.freeze({
            ...state,
            serve: Object.freeze({
              servingSide: sideFromCourt || state.serve.servingSide,
              serverNumber:
                Number.isFinite(openingFromCourt) && openingFromCourt >= 1
                  ? openingFromCourt
                  : state.serve.serverNumber,
            }),
          });
        }
      }
      const projection = createScoringProjection(state);
      const session = Object.freeze({
        sessionId: nextDeterministicId("score-session"),
        matchId,
        refereeId: auth.refereeId,
        openedAt: clockIso,
        state,
        projection,
        actionLedger: Object.freeze([]),
      });
      await store.update(cmd.tenantId, cmd.competitionId, (draft) => {
        draft.scoreSessions[matchId] = session;
        if (priorCourt) {
          draft.courtsByMatch = draft.courtsByMatch || {};
          draft.courtsByMatch[matchId] = priorCourt;
        }
      });
      return deepFreeze({
        ok: true,
        idempotent: false,
        session,
        court: priorCourt,
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
      await requireAssignedMatch(cmd, auth, matchId);
      const record = await loadRecord(cmd);
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

      const priorCourt =
        cmd.priorCourt ||
        record.courtsByMatch?.[matchId] ||
        null;
      const priorPointsForGate = session.state?.points
        ? { ...session.state.points }
        : null;
      const dueBeforeScore = resolveSideChangeRequiredAfterScoring({
        priorCourt: priorCourt || {},
        priorPoints: priorPointsForGate || {},
        nextPoints: priorPointsForGate || {},
        sideSwitchAt: session.state?.format?.sideSwitchAt,
        domainHints: [],
      });
      if (dueBeforeScore.sideChangeRequired === true) {
        failReferee(
          REFEREE_ERROR_CODE.PRECONDITION_FAILED,
          "Change ends is due — confirm Đổi sân before scoring",
          { sideChangeRequired: true, matchId }
        );
      }
      const priorServe = session.state?.serve
        ? {
            servingSide: session.state.serve.servingSide,
            serverNumber: session.state.serve.serverNumber,
          }
        : null;
      const priorPoints = priorPointsForGate;

      let state = session.state;
      const points = Math.max(1, Number(cmd.points) || 1);
      let awardedPoint = false;
      const domainHints = [];
      let lastEvent = null;
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
        lastEvent = applied.event;
        if (applied.event?.payload?.awardedPoint === true) awardedPoint = true;
        const hints = applied.event?.payload?.domainHints;
        if (Array.isArray(hints)) domainHints.push(...hints);
      }
      const projection = createScoringProjection(state);
      const scoringSystem = String(
        state.format?.scoringSystem || session.state?.format?.scoringSystem || ""
      ).toUpperCase();
      const derivedCourt = deriveCanonicalCourtAfterScoring({
        priorCourt: priorCourt || {
          playerPositions: { sideA: [], sideB: [] },
          serverPlayerId: null,
        },
        priorServe,
        nextServe: state.serve,
        priorPoints,
        nextPoints: state.points,
        scoringSystem,
        awardedPoint,
        rallyWinnerSide: scoringSide,
      });
      const sideChange = resolveSideChangeRequiredAfterScoring({
        priorCourt,
        priorPoints,
        nextPoints: state.points,
        sideSwitchAt: state.format?.sideSwitchAt,
        domainHints,
      });
      const nextCourt = Object.freeze({
        ...derivedCourt,
        sideChangeRequired: sideChange.sideChangeRequired,
        sideChangeAcknowledgedAtThreshold:
          sideChange.sideChangeAcknowledgedAtThreshold,
        sideChangeThreshold: sideChange.sideChangeThreshold,
      });
      const ledgerEntry = Object.freeze({
        kind: SCORING_ACTION_LEDGER_KIND.SCORING,
        eventId: lastEvent?.eventId || null,
        atRevision: state.revision,
        priorCourt: priorCourt ? cloneCourtSnapshot(priorCourt) : null,
        nextCourt: cloneCourtSnapshot(nextCourt),
        causedSideChangeDue: sideChange.sideChangeRequired === true,
        scoringSide,
        awardedPoint,
      });
      const nextSession = Object.freeze({
        ...session,
        state,
        projection,
        updatedAt: clockIso,
        actionLedger: Object.freeze([
          ...(Array.isArray(session.actionLedger) ? session.actionLedger : []),
          ledgerEntry,
        ]),
      });
      await store.update(cmd.tenantId, cmd.competitionId, (draft) => {
        draft.scoreSessions[matchId] = nextSession;
        draft.courtsByMatch = draft.courtsByMatch || {};
        draft.courtsByMatch[matchId] = nextCourt;
      });
      const nextRecord = await loadRecord(cmd);
      return deepFreeze({
        ok: true,
        scoreProjection: projection,
        court: nextCourt,
        matchComplete: Boolean(state.matchComplete),
        calculatedWinnerSide: state.calculatedWinnerSide || null,
        winnerInferenceByFacade: false,
        expectedVersion: Number(nextRecord.revision || 0),
        fingerprint: computeOrganizerFingerprint(
          { matchId, projection, court: nextCourt },
          "e2e04-ref-score"
        ),
      });
    });
  }

  function cloneCourtSnapshot(court) {
    if (!court || typeof court !== "object") return null;
    return JSON.parse(JSON.stringify(court));
  }

  async function confirmChangeEnds(command = {}) {
    return run(command, async (cmd) => {
      const auth = await authorize(cmd, REFEREE_ACTION.SCORE_SUBMIT);
      const matchId = String(cmd.matchId || "").trim();
      await requireAssignedMatch(cmd, auth, matchId);
      const record = await loadRecord(cmd);
      const match = record.matches?.[matchId];
      if (!match || String(match.status).toUpperCase() !== MATCH_STATUS.IN_PROGRESS) {
        failReferee(
          REFEREE_ERROR_CODE.MATCH_NOT_ACTIVE,
          "confirmChangeEnds requires an active match",
          { status: match?.status || null }
        );
      }
      const session = record.scoreSessions?.[matchId];
      if (!session) {
        failReferee(
          REFEREE_ERROR_CODE.SCORE_ENTRY_NOT_READY,
          "Score entry session is required before confirmChangeEnds",
          { matchId }
        );
      }
      if (cmd.expectedVersion != null) {
        if (Number(cmd.expectedVersion) !== Number(record.revision || 0)) {
          failReferee(
            REFEREE_ERROR_CODE.STALE_WRITE,
            "Fail-closed stale write: expectedVersion mismatch",
            {
              expectedVersion: cmd.expectedVersion,
              actualVersion: record.revision,
              stale: true,
            }
          );
        }
      }
      const current = record.courtsByMatch?.[matchId] || {};
      if (current.sideChangeRequired !== true) {
        failReferee(
          REFEREE_ERROR_CODE.PRECONDITION_FAILED,
          "confirmChangeEnds requires sideChangeRequired",
          { sideChangeRequired: current.sideChangeRequired === true }
        );
      }
      const ackThreshold =
        current.sideChangeThreshold != null
          ? Number(current.sideChangeThreshold)
          : current.sideChangeAcknowledgedAtThreshold != null
            ? Number(current.sideChangeAcknowledgedAtThreshold)
            : session.state?.format?.sideSwitchAt != null
              ? Number(session.state.format.sideSwitchAt)
              : null;
      const nextOrientation =
        String(current.orientation || "STANDARD").toUpperCase() === "SWAPPED"
          ? "STANDARD"
          : "SWAPPED";
      const nextCourt = Object.freeze({
        ...current,
        orientation: nextOrientation,
        sideChangeRequired: false,
        sideChangeThreshold: current.sideChangeThreshold ?? ackThreshold,
        sideChangeAcknowledgedAtThreshold: ackThreshold,
      });
      const ledgerEntry = Object.freeze({
        kind: SCORING_ACTION_LEDGER_KIND.CHANGE_ENDS,
        atRevision: Number(session.state?.revision || 0),
        acknowledgedAtThreshold: ackThreshold,
        priorCourt: cloneCourtSnapshot(current),
        nextCourt: cloneCourtSnapshot(nextCourt),
      });
      const nextSession = Object.freeze({
        ...session,
        updatedAt: clockIso,
        actionLedger: Object.freeze([
          ...(Array.isArray(session.actionLedger) ? session.actionLedger : []),
          ledgerEntry,
        ]),
      });
      await store.update(cmd.tenantId, cmd.competitionId, (draft) => {
        draft.scoreSessions[matchId] = nextSession;
        draft.courtsByMatch = draft.courtsByMatch || {};
        draft.courtsByMatch[matchId] = nextCourt;
      });
      const nextRecord = await loadRecord(cmd);
      return deepFreeze({
        ok: true,
        court: nextCourt,
        expectedVersion: Number(nextRecord.revision || 0),
        fingerprint: computeOrganizerFingerprint(
          { matchId, court: nextCourt },
          "e2e04-ref-change-ends"
        ),
      });
    });
  }

  async function undoLastScoringAction(command = {}) {
    return run(command, async (cmd) => {
      const timing = {
        UNDO_TOTAL_MS: null,
        UNDO_READ_MS: null,
        UNDO_REPLAY_MS: null,
        UNDO_COMMIT_MS: null,
        UNDO_PROJECT_MS: null,
      };
      const t0 = nowMs();
      const auth = await authorize(cmd, REFEREE_ACTION.SCORE_UNDO);
      const matchId = String(cmd.matchId || "").trim();
      const tRead0 = nowMs();
      await requireAssignedMatch(cmd, auth, matchId);
      const record = await loadRecord(cmd);
      timing.UNDO_READ_MS = nowMs() - tRead0;

      const idemKey = String(cmd.idempotencyKey || cmd.commandId || "").trim();
      const priorReceipt = idemKey
        ? record.idempotencyByMatch?.[matchId]?.[idemKey]
        : null;
      if (priorReceipt) {
        timing.UNDO_TOTAL_MS = nowMs() - t0;
        return deepFreeze({
          ...priorReceipt,
          ok: true,
          idempotent: true,
          timing,
        });
      }

      const match = record.matches?.[matchId];
      const session = record.scoreSessions?.[matchId];
      const validation = record.validationByMatch?.[matchId] || null;
      const court = record.courtsByMatch?.[matchId] || null;
      const targetEvent = findLastEligibleScoringEvent(session?.state);
      const eligible = assertUndoLastScoringEligible({
        match,
        session,
        validation,
        court,
        expectedVersion: cmd.expectedVersion,
        actualVersion: record.revision,
        targetEvent,
        ledger: session?.actionLedger,
      });

      const tReplay0 = nowMs();
      const applied = supersedeScoringEvent(
        session.state,
        {
          targetEventId: eligible.targetEvent.eventId,
          replacementScoringSide: null,
          lifecycleStatus: MATCH_STATUS.IN_PROGRESS,
          reason: "UNDO_LAST_SCORING_ACTION",
          clientEventId: idemKey || nextDeterministicId("undo"),
          occurredAt: clockIso,
        },
        {
          now: () => clockIso,
          nextId: () => nextDeterministicId("supersede"),
        }
      );
      timing.UNDO_REPLAY_MS = nowMs() - tReplay0;

      const projection = createScoringProjection(applied.state);

      // Prefer exact prior court snapshot from the scoring ledger (incl. change-end due).
      let restoredCourt;
      if (eligible.scoringEntry?.priorCourt != null) {
        restoredCourt = Object.freeze({
          ...cloneCourtSnapshot(eligible.scoringEntry.priorCourt),
          servingSide:
            applied.state.serve?.servingSide ||
            eligible.scoringEntry.priorCourt.servingSide ||
            null,
          serverNumber:
            applied.state.serve?.serverNumber ||
            eligible.scoringEntry.priorCourt.serverNumber ||
            null,
          serverPlayerId:
            eligible.scoringEntry.priorCourt.serverPlayerId || null,
        });
      } else {
        const restoredCourtBase = cloneCourtSnapshot(court) || {
          playerPositions: { sideA: [], sideB: [] },
          serverPlayerId: null,
        };
        const sideChange = resolveSideChangeRequiredAfterScoring({
          priorCourt: restoredCourtBase,
          priorPoints: applied.state.points,
          nextPoints: applied.state.points,
          sideSwitchAt: applied.state.format?.sideSwitchAt,
          domainHints: [],
        });
        restoredCourt = Object.freeze({
          ...restoredCourtBase,
          servingSide:
            applied.state.serve?.servingSide ||
            restoredCourtBase.servingSide ||
            null,
          serverNumber:
            applied.state.serve?.serverNumber ||
            restoredCourtBase.serverNumber ||
            null,
          sideChangeRequired: sideChange.sideChangeRequired === true,
          sideChangeAcknowledgedAtThreshold:
            sideChange.sideChangeAcknowledgedAtThreshold,
          sideChangeThreshold: sideChange.sideChangeThreshold,
        });
      }

      const nextSession = Object.freeze({
        ...session,
        state: applied.state,
        projection,
        updatedAt: clockIso,
        actionLedger: Object.freeze([
          ...(Array.isArray(session.actionLedger) ? session.actionLedger : []),
          Object.freeze({
            kind: SCORING_ACTION_LEDGER_KIND.SUPERSEDE,
            eventId: applied.event.eventId,
            targetEventId: eligible.targetEvent.eventId,
            atRevision: applied.state.revision,
            priorCourt: cloneCourtSnapshot(court),
            nextCourt: cloneCourtSnapshot(restoredCourt),
          }),
        ]),
      });

      const tCommit0 = nowMs();
      const resultFingerprint = computeOrganizerFingerprint(
        {
          matchId,
          projection,
          court: restoredCourt,
          supersedeEventId: applied.event.eventId,
        },
        "e2e04-ref-score-undo"
      );
      await store.update(cmd.tenantId, cmd.competitionId, (draft) => {
        draft.scoreSessions[matchId] = nextSession;
        draft.courtsByMatch = draft.courtsByMatch || {};
        draft.courtsByMatch[matchId] = restoredCourt;
        if (idemKey) {
          draft.idempotencyByMatch = draft.idempotencyByMatch || {};
          const nextVersion = Number(draft.revision || 0) + 1;
          draft.idempotencyByMatch[matchId] = {
            ...(draft.idempotencyByMatch[matchId] || {}),
            [idemKey]: {
              scoreProjection: projection,
              court: restoredCourt,
              targetEventId: eligible.targetEvent.eventId,
              supersedeEventId: applied.event.eventId,
              expectedVersion: nextVersion,
              fingerprint: resultFingerprint,
            },
          };
        }
      });
      timing.UNDO_COMMIT_MS = nowMs() - tCommit0;

      const tProject0 = nowMs();
      const nextRecord = await loadRecord(cmd);
      const undoAvailability = evaluateUndoAvailability({
        match: nextRecord.matches?.[matchId],
        session: nextRecord.scoreSessions?.[matchId],
        validation: nextRecord.validationByMatch?.[matchId] || null,
        court: nextRecord.courtsByMatch?.[matchId] || null,
        actualVersion: nextRecord.revision,
        targetEvent: findLastEligibleScoringEvent(
          nextRecord.scoreSessions?.[matchId]?.state
        ),
        ledger: nextRecord.scoreSessions?.[matchId]?.actionLedger,
      });
      timing.UNDO_PROJECT_MS = nowMs() - tProject0;
      timing.UNDO_TOTAL_MS = nowMs() - t0;

      return deepFreeze({
        ok: true,
        idempotent: false,
        command: "UNDO_LAST_SCORING_ACTION",
        scoreProjection: projection,
        court: restoredCourt,
        targetEventId: eligible.targetEvent.eventId,
        supersedeEventId: applied.event.eventId,
        originalEventPreserved: true,
        correctionEventType: applied.event.eventType,
        matchComplete: Boolean(applied.state.matchComplete),
        calculatedWinnerSide: applied.state.calculatedWinnerSide || null,
        expectedVersion: Number(nextRecord.revision || 0),
        undoAvailability,
        fingerprint: resultFingerprint,
        timing,
      });
    });
  }

  function buildSideBindings(cmd, assignment) {
    if (Array.isArray(cmd.sideBindings) && cmd.sideBindings.length === 2) {
      return cmd.sideBindings;
    }

    const adapter = requireModeAdapter(cmd);
    if (adapter) {
      const participants = adapter.getParticipants(
        adapterRequestFromCommand(cmd, cmd.matchId)
      );
      const sides = Array.isArray(participants?.sides) ? participants.sides : [];
      if (sides.length !== 2) {
        failReferee(
          REFEREE_ERROR_CODE.VALIDATION_PRECONDITION,
          "Adapter B participants must provide exactly two sides",
          { sideCount: sides.length }
        );
      }
      return sides.map((side, index) => {
        const isA = index === 0;
        return {
          matchSideKey: isA ? MATCH_SIDE_KEY.A : MATCH_SIDE_KEY.B,
          scoringSide: isA ? SCORING_SIDE.SIDE_A : SCORING_SIDE.SIDE_B,
          matchSideId: isA ? "side-a" : "side-b",
          entryId: side.entryId || (isA ? "entry-a" : "entry-b"),
          teamId: side.teamId || null,
          participantIds: Array.isArray(side.participantIds)
            ? side.participantIds.map(String)
            : [],
        };
      });
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
      const { assignment } = await requireAssignedMatch(cmd, auth, matchId);
      const record = await loadRecord(cmd);
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

      const adapter = requireModeAdapter(cmd);
      let propagation = null;
      if (adapter) {
        propagation = adapter.resolveResultPropagation(
          adapterRequestFromCommand(cmd, matchId)
        );
        if (propagation?.propagateOnlyIfAccepted !== true) {
          failReferee(
            REFEREE_ERROR_CODE.VALIDATION_PRECONDITION,
            "Adapter B result propagation must require CORE-17 accepted active result",
            { propagateOnlyIfAccepted: propagation?.propagateOnlyIfAccepted }
          );
        }
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
      // Adapter B may describe targets but MUST NOT accept; CORE-17 remains authority.
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
          await store.putMatch(cmd.tenantId, cmd.competitionId, completed.match);
        }
      }

      if (
        adapter &&
        propagation?.propagateOnlyIfAccepted === true &&
        status !== REFEREE_VALIDATION_OPS_STATUS.ACCEPTED &&
        cmd.forcePropagateWithoutAccept === true
      ) {
        failReferee(
          REFEREE_ERROR_CODE.VALIDATION_PRECONDITION,
          "Result propagation cannot bypass CORE-17 accepted active result",
          { validationStatus: status, silentLegacyFallback: false }
        );
      }

      const validationRecord = Object.freeze({
        status,
        validatedResult: accepted || validated,
        correctionRequiredCodes: validated.correctionRequiredCodes || [],
        standingsEligible:
          status === REFEREE_VALIDATION_OPS_STATUS.ACCEPTED,
        winnerInferenceByFacade: false,
        propagation: propagation
          ? {
              propagateOnlyIfAccepted: true,
              targets: propagation.targets || [],
            }
          : null,
      });

      await store.update(cmd.tenantId, cmd.competitionId, (draft) => {
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
      await requireAssignedMatch(cmd, auth, matchId);
      const record = await loadRecord(cmd);
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
      await requireAssignedMatch(cmd, auth, matchId);
      const record = await loadRecord(cmd);
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
      await requireAssignedMatch(cmd, auth, matchId);
      const record = await loadRecord(cmd);
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
    runtimeClassification:
      deps.runtime?.classification ||
      store.classification ||
      "TEST_DOUBLE_ONLY",
    wiredToProductionRuntime: deps.runtime?.wiredToProductionRuntime === true,
    usesAdapterB,
    modeAdapterRegistry: modeAdapterRegistry || null,
    seedAssignments,
    getRefereeAssignmentQueue,
    getAssignedMatch,
    acknowledgeAssignment,
    openAssignedMatch,
    suspendAssignedMatch,
    resumeAssignedMatch,
    createScoreEntrySession,
    submitScoreProjection,
    confirmChangeEnds,
    undoLastScoringAction,
    submitMatchResultForValidation,
    getCorrectionRequiredState,
    resubmitCorrectedResult,
    getValidatedResultState,
  });
}
