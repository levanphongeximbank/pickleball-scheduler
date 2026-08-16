/**
 * Canonical Referee application client.
 *
 * UI → this client → Adapter B → competition.referee.adapter.v1 → E2E-04
 * → CORE-13 / 15 / 16 / 17 → Durable Runtime
 *
 * Projection only at this layer. No second authority. No legacy fallback.
 */

import { SCORING_SIDE } from "../../competition-core/scoring/index.js";
import {
  COMPETITION_REFEREE_MODE,
  REFEREE_ADAPTER_ERROR_CODE,
} from "../../competition-engine/integration/referee/constants.js";
import { normalizeRefereeAdapterMode } from "../../competition-engine/integration/referee/contract.js";
import {
  failRefereeAdapter,
  isRefereeAdapterContractError,
} from "../../competition-engine/integration/referee/errors.js";
import { isRefereeOperationsError } from "../../competition-engine/operations/referee/errors.js";
import { CANONICAL_UI_COMMAND, COURT_ORIENTATION, REFEREE_UI_ERROR_CODE } from "../constants.js";
import { buildRefereeAssignmentCard } from "../projection/buildRefereeAssignmentCard.js";
import { buildRefereeMatchView } from "../projection/buildRefereeMatchView.js";
import {
  assertNotPrivilegedBrowserComposition,
  rejectLocationStateAuthority,
  rejectProductionFixtureFallback,
} from "./assertProductionUiSecurity.js";
import { detectCompetitionModeHint } from "./resolveCanonicalRefereeModeState.js";

function requireRuntime(runtime) {
  if (!runtime || runtime.usesAdapterB !== true || !runtime.facade) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
      "Canonical Referee UI requires Adapter B production runtime/facade",
      { usesAdapterB: runtime?.usesAdapterB === true }
    );
  }
  if (runtime.inMemoryProductionFallback === true) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.IN_MEMORY_PRODUCTION_FORBIDDEN,
      "In-memory production fallback is forbidden in Referee UI client",
      {}
    );
  }
  if (!runtime.modeAdapterRegistry || typeof runtime.modeAdapterRegistry.resolve !== "function") {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MALFORMED_ADAPTER,
      "Canonical Referee UI requires Adapter B registry",
      {}
    );
  }
  return runtime;
}

function requireIdempotency(command) {
  const key = String(command?.idempotencyKey || command?.commandId || "").trim();
  if (!key) {
    failRefereeAdapter(
      REFEREE_ADAPTER_ERROR_CODE.MISSING_IDEMPOTENCY,
      "idempotencyKey is required for canonical Referee commands",
      {}
    );
  }
  return key;
}

function actorFrom(command, defaultActor) {
  return command?.actor || defaultActor || null;
}

function adapterRequest(scope, modeState) {
  return {
    tenantId: scope.tenantId,
    competitionId: scope.competitionId,
    matchId: scope.matchId || null,
    venueId: scope.venueId || modeState?.venueId || null,
    clubId: scope.clubId || modeState?.clubId || null,
    modeState: modeState || null,
    competitionMode: scope.competitionMode || modeState?.competitionMode || null,
  };
}

/**
 * @param {{
 *   runtime: object,
 *   actor?: object,
 *   modeStateResolver?: Function,
 *   participantNameResolver?: Function,
 *   allowFixtureFallback?: boolean,
 * }} options
 */
export function createCanonicalRefereeApplicationClient(options = {}) {
  rejectProductionFixtureFallback(options);
  const runtime = requireRuntime(options.runtime);
  assertNotPrivilegedBrowserComposition(runtime);
  const facade = runtime.facade;
  const registry = runtime.modeAdapterRegistry;
  const defaultActor = options.actor || null;
  const inFlight = new Set();

  async function resolveModeState(assignment, hint) {
    if (hint?.modeState) return hint.modeState;
    if (assignment?.modeState) return assignment.modeState;
    if (typeof options.modeStateResolver === "function") {
      return await options.modeStateResolver(assignment, hint);
    }
    return hint?.modeState || null;
  }

  async function resolveNames(assignment, modeState) {
    if (typeof options.participantNameResolver === "function") {
      return (await options.participantNameResolver(assignment, modeState)) || {};
    }
    return modeState?.participantNames || assignment?.participantNames || {};
  }

  function resolveAdapter(modeHint) {
    const mode = normalizeRefereeAdapterMode(modeHint);
    return { mode, adapter: registry.resolve(mode) };
  }

  async function listAssignmentRows(actor, tenantId) {
    const refereeUserId = String(actor?.actorId || actor?.authUid || actor?.refereeId || "").trim();
    if (!refereeUserId || !tenantId) return [];
    return await runtime.assignmentRepository.listByReferee({
      tenantId,
      refereeUserId,
    });
  }

  async function assertExpectedVersion(scope, expectedVersion) {
    if (expectedVersion == null) return;
    const live = await runtime.matchStateRepository.getLiveState(scope);
    const current = Number(live?.stateVersion ?? live?.version ?? 0);
    if (Number(expectedVersion) !== current) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE,
        "Fail-closed stale write: expectedVersion mismatch",
        { expectedVersion, actualVersion: current }
      );
    }
  }

  async function withInFlight(key, fn) {
    if (inFlight.has(key)) {
      const err = new Error("Duplicate canonical action blocked");
      err.code = REFEREE_UI_ERROR_CODE.DUPLICATE_ACTION_BLOCKED;
      err.duplicateBlocked = true;
      throw err;
    }
    inFlight.add(key);
    try {
      return await fn();
    } finally {
      inFlight.delete(key);
    }
  }

  function commandBase(command, assignment) {
    const actor = actorFrom(command, defaultActor);
    return {
      tenantId: command.tenantId || assignment?.tenantId,
      competitionId: command.competitionId || assignment?.competitionId,
      matchId: command.matchId || assignment?.matchId,
      venueId: command.venueId || assignment?.venueId || command.modeState?.venueId,
      clubId: command.clubId || command.modeState?.clubId,
      actor,
      competitionMode: command.competitionMode || assignment?.competitionMode,
      modeState: command.modeState,
      idempotencyKey: command.idempotencyKey,
      commandId: command.commandId || command.idempotencyKey,
    };
  }

  async function resolveScopeByMatchId(command) {
    rejectLocationStateAuthority(command.locationState);
    const actor = actorFrom(command, defaultActor);
    const tenantId = String(command.tenantId || "").trim();
    const matchId = String(command.matchId || "").trim();
    if (!matchId) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.UNKNOWN_MATCH,
        "matchId is required for deep-link reconstruction",
        {}
      );
    }
    const rows = await listAssignmentRows(actor, tenantId);
    const assignment =
      rows.find((row) => String(row.matchId) === matchId) ||
      (command.competitionId
        ? {
            matchId,
            tenantId,
            competitionId: command.competitionId,
            refereeUserId: actor?.actorId,
            courtId: command.courtId || null,
            status: "ASSIGNED",
          }
        : null);
    if (!assignment) {
      const err = new Error("Assigned match could not be resolved from durable CORE-13 state");
      err.code = REFEREE_UI_ERROR_CODE.MATCH_SCOPE_UNRESOLVED;
      throw err;
    }
    const modeState = await resolveModeState(assignment, command);
    const modeHint =
      command.competitionMode ||
      assignment.competitionMode ||
      modeState?.competitionMode ||
      detectCompetitionModeHint(assignment, modeState) ||
      COMPETITION_REFEREE_MODE.INTERNAL;
    const { mode, adapter } = resolveAdapter(modeHint);
    return {
      assignment: {
        ...assignment,
        competitionId: assignment.competitionId || command.competitionId,
        tenantId: assignment.tenantId || tenantId,
        matchId,
        competitionMode: mode,
        modeState,
      },
      mode,
      adapter,
      modeState,
      actor,
    };
  }

  async function readLiveVersion(scope) {
    const live = await runtime.matchStateRepository.getLiveState(scope);
    return {
      live,
      expectedVersion: Number(live?.stateVersion ?? live?.version ?? 0),
      courtState: live?.statePayload?.canonical?.court || live?.statePayload?.court || {},
    };
  }

  async function projectMatch(command, extras = {}) {
    const resolved = await resolveScopeByMatchId(command);
    const { assignment, mode, adapter, modeState, actor } = resolved;
    const req = adapterRequest(assignment, modeState);
    const competitionContext = adapter.getCompetitionContext(req);
    const matchContext = adapter.getMatchContext(req);
    const participants = adapter.getParticipants(req);
    const scoringRules = adapter.getScoringRules(req);
    const lifecyclePolicy = adapter.getLifecyclePolicy(req);
    const capabilities = adapter.getCapabilities(req);
    const preStart = adapter.validatePreStart(req);
    const names = await resolveNames(assignment, modeState);
    const assigned = await facade.getAssignedMatch(commandBase(command, assignment));
    const liveInfo = await readLiveVersion({
      tenantId: assignment.tenantId,
      competitionId: assignment.competitionId,
      matchId: assignment.matchId,
    });
    const live = liveInfo.live || {};
    const scoreProjection = assigned.assignedMatch?.scoreProjection || null;
    const enrichedScoreProjection =
      scoreProjection && !scoreProjection.serve && (live.servingPlayerId || live.servingTeamId)
        ? {
            ...scoreProjection,
            serve: {
              servingSide:
                live.servingTeamId && live.teamBId && String(live.servingTeamId) === String(live.teamBId)
                  ? "SIDE_B"
                  : "SIDE_A",
              serverNumber: live.serverNumber,
              serverPlayerId: live.servingPlayerId,
              receiverPlayerId: live.receivingPlayerId,
            },
          }
        : scoreProjection;
    const courtState = {
      ...(extras.courtState || liveInfo.courtState || {}),
      serverPlayerId:
        extras.courtState?.serverPlayerId ||
        liveInfo.courtState?.serverPlayerId ||
        live.servingPlayerId ||
        null,
      receiverPlayerId:
        extras.courtState?.receiverPlayerId ||
        liveInfo.courtState?.receiverPlayerId ||
        live.receivingPlayerId ||
        null,
      servingSide:
        extras.courtState?.servingSide ||
        liveInfo.courtState?.servingSide ||
        null,
      serverNumber:
        extras.courtState?.serverNumber ??
        liveInfo.courtState?.serverNumber ??
        live.serverNumber ??
        null,
      lineupConfigured:
        extras.courtState?.lineupConfigured === true ||
        liveInfo.courtState?.lineupConfigured === true,
      courtOrientation:
        extras.courtState?.courtOrientation ||
        liveInfo.courtState?.courtOrientation ||
        live.courtOrientation ||
        null,
    };
    return buildRefereeMatchView({
      matchId: assignment.matchId,
      competitionMode: mode,
      adapterSelected: adapter.adapterId || mode,
      competitionContext: {
        ...competitionContext,
        competitionName:
          modeState?.competitionName || competitionContext.competitionName || null,
      },
      matchContext: {
        ...matchContext,
        status: matchContext.status || live.status || null,
        courtLabel:
          matchContext.courtLabel ||
          modeState?.matchups?.[assignment.matchId]?.courtLabel ||
          Object.values(modeState?.matchups || {})[0]?.courtLabel ||
          null,
      },
      participants,
      scoringRules,
      lifecyclePolicy,
      capabilities,
      assignedMatch: enrichedScoreProjection
        ? { ...assigned.assignedMatch, scoreProjection: enrichedScoreProjection }
        : assigned.assignedMatch,
      operationsProjection: assigned.projection,
      courtState,
      modeState,
      participantNames: names,
      expectedVersion: liveInfo.expectedVersion,
      pendingCanonicalAction: extras.pendingCanonicalAction || null,
      stale: extras.stale === true,
      preStart,
      actor,
    });
  }

  async function listMyAssignments(command = {}) {
    rejectLocationStateAuthority(command.locationState);
    const actor = actorFrom(command, defaultActor);
    const tenantId = String(command.tenantId || "").trim();
    const rows = await listAssignmentRows(actor, tenantId);

    async function buildCardForRow(row) {
      const modeState = await resolveModeState(row, command);
      const modeHint =
        row.competitionMode ||
        modeState?.competitionMode ||
        command.competitionModeByMatchId?.[row.matchId] ||
        command.defaultCompetitionMode ||
        detectCompetitionModeHint(row, modeState);
      const scheduledAt =
        modeState?.matchups && Object.values(modeState.matchups)[0]?.scheduledAt
          ? Object.values(modeState.matchups)[0].scheduledAt
          : row.assignedAt || row.scheduledAt || null;
      const courtLabelFromMode =
        modeState?.matchups && Object.values(modeState.matchups)[0]?.courtLabel
          ? Object.values(modeState.matchups)[0].courtLabel
          : modeState?.courtLabel || null;
      const courtIdFromMode =
        modeState?.matchups && Object.values(modeState.matchups)[0]?.courtId
          ? Object.values(modeState.matchups)[0].courtId
          : row.courtId || null;
      if (!modeHint) {
        return buildRefereeAssignmentCard({
          assignment: {
            ...row,
            competitionId: row.competitionId,
            competitionName: modeState?.competitionName || null,
            scheduledAt,
            courtId: courtIdFromMode,
            courtLabel: courtLabelFromMode,
          },
          competitionMode: "",
          competitionContext: {
            competitionId: row.competitionId,
            competitionName: modeState?.competitionName || null,
          },
          matchContext: {
            matchId: row.matchId,
            courtId: courtIdFromMode,
            courtLabel: courtLabelFromMode,
            scheduledAt,
          },
          participants: { sides: [] },
          participantNames: modeState?.participantNames || {},
          modeState,
        });
      }
      const { mode, adapter } = resolveAdapter(modeHint);
      const req = adapterRequest(
        {
          tenantId: row.tenantId || tenantId,
          competitionId: row.competitionId || modeState?.competitionId,
          matchId: row.matchId,
          venueId: row.venueId || modeState?.venueId,
        },
        modeState
      );
      let competitionContext = {
        competitionId: row.competitionId,
        competitionMode: mode,
        competitionName: modeState?.competitionName || null,
      };
      let matchContext = {
        matchId: row.matchId,
        courtId: courtIdFromMode,
        courtLabel: courtLabelFromMode,
        scheduledAt,
      };
      let participants = { sides: [] };
      try {
        competitionContext = {
          ...adapter.getCompetitionContext(req),
          competitionName: modeState?.competitionName || null,
        };
        matchContext = {
          ...adapter.getMatchContext(req),
          courtLabel:
            courtLabelFromMode ||
            adapter.getMatchContext(req).courtLabel ||
            null,
        };
        participants = adapter.getParticipants(req);
      } catch {
        // Card still lists CORE-13 assignment; Adapter B details optional when modeState missing.
        if (modeState?.matchups) {
          const matchup = Object.values(modeState.matchups)[0];
          if (matchup?.sides?.length === 2) {
            participants = { sides: matchup.sides };
          } else if (matchup?.teamAId && matchup?.teamBId) {
            participants = {
              sides: [
                {
                  sideKey: "A",
                  teamId: matchup.teamAId,
                  teamName: matchup.teamAName || null,
                  displayName: matchup.teamAName || null,
                  participantIds: [],
                },
                {
                  sideKey: "B",
                  teamId: matchup.teamBId,
                  teamName: matchup.teamBName || null,
                  displayName: matchup.teamBName || null,
                  participantIds: [],
                },
              ],
            };
          }
        }
      }
      const [names, liveInfo] = await Promise.all([
        resolveNames(row, modeState),
        readLiveVersion({
          tenantId: row.tenantId || tenantId,
          competitionId: row.competitionId,
          matchId: row.matchId,
        }).catch(() => null),
      ]);
      // Home list: prefer live lifecycle (fast). Full assignedMatch only when live is absent.
      const liveStatus = liveInfo?.live?.status || null;
      const assignedMatch = liveStatus
        ? Object.freeze({
            lifecycleState: liveStatus,
            scoreProjection: null,
            validationStatus: null,
          })
        : await facade
            .getAssignedMatch({
              tenantId: row.tenantId || tenantId,
              competitionId: row.competitionId,
              matchId: row.matchId,
              venueId: row.venueId || modeState?.venueId,
              actor,
              competitionMode: mode,
              modeState,
            })
            .then((got) => got.assignedMatch)
            .catch(() => null);
      return buildRefereeAssignmentCard({
        assignment: {
          ...row,
          status: row.opsStatus || row.status,
          scheduledAt,
          courtId: courtIdFromMode,
          courtLabel: courtLabelFromMode,
          competitionName: modeState?.competitionName || null,
        },
        competitionContext,
        matchContext: {
          ...matchContext,
          status: matchContext.status || liveStatus || null,
        },
        participants,
        assignedMatch,
        live: liveInfo?.live || null,
        participantNames: names,
        competitionMode: mode,
        modeState,
      });
    }

    const cards = await Promise.all(rows.map((row) => buildCardForRow(row)));
    return Object.freeze({
      ok: true,
      assignments: Object.freeze(cards),
      usesAdapterB: true,
      silentLegacyFallback: false,
      locationStateRequired: false,
      productionFixtureFallback: false,
    });
  }

  async function getMatchView(command = {}) {
    return Object.freeze({
      ok: true,
      view: await projectMatch(command),
      usesAdapterB: true,
      silentLegacyFallback: false,
      locationStateRequired: false,
      productionFixtureFallback: false,
    });
  }

  async function runCommand(command, type, fn) {
    const key = requireIdempotency(command);
    return withInFlight(`${type}:${key}`, async () => {
      const resolved = await resolveScopeByMatchId(command);
      const scope = {
        tenantId: resolved.assignment.tenantId,
        competitionId: resolved.assignment.competitionId,
        matchId: resolved.assignment.matchId,
      };
      await assertExpectedVersion(scope, command.expectedVersion);
      const base = commandBase(
        { ...command, modeState: resolved.modeState, competitionMode: resolved.mode },
        resolved.assignment
      );
      try {
        const result = await fn(base, resolved);
        const view = await projectMatch({
          ...command,
          modeState: resolved.modeState,
          competitionMode: resolved.mode,
          tenantId: scope.tenantId,
          competitionId: scope.competitionId,
        });
        return Object.freeze({
          ok: true,
          command: type,
          result,
          view,
          stale: false,
          duplicateBlocked: false,
        });
      } catch (err) {
        if (
          isRefereeAdapterContractError(err) &&
          err.code === REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE
        ) {
          const view = await projectMatch({
            ...command,
            modeState: resolved.modeState,
            competitionMode: resolved.mode,
            tenantId: scope.tenantId,
            competitionId: scope.competitionId,
          }, { stale: true });
          return Object.freeze({
            ok: false,
            command: type,
            stale: true,
            failClosed: true,
            code: REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE,
            error: err.message,
            view,
          });
        }
        throw err;
      }
    });
  }

  async function acknowledgeAssignment(command = {}) {
    return runCommand(command, CANONICAL_UI_COMMAND.ACKNOWLEDGE, (base) =>
      facade.acknowledgeAssignment(base)
    );
  }

  async function openAssignedMatch(command = {}) {
    return runCommand(command, CANONICAL_UI_COMMAND.OPEN, (base) =>
      facade.openAssignedMatch(base)
    );
  }

  async function startScoreSession(command = {}) {
    return runCommand(command, CANONICAL_UI_COMMAND.START_SCORE_SESSION, (base) =>
      facade.createScoreEntrySession(base)
    );
  }

  async function startMatch(command = {}) {
    const opened = await openAssignedMatch(command);
    if (opened.ok === false) return opened;
    return startScoreSession({
      ...command,
      expectedVersion: opened.view?.expectedVersion,
      idempotencyKey: `${command.idempotencyKey}::score-session`,
    });
  }

  async function submitPoint(command = {}) {
    const scoringSide = String(command.scoringSide || "").trim();
    if (scoringSide !== SCORING_SIDE.SIDE_A && scoringSide !== SCORING_SIDE.SIDE_B) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
        "scoringSide must be SIDE_A or SIDE_B",
        { scoringSide }
      );
    }
    return runCommand(command, CANONICAL_UI_COMMAND.SUBMIT_POINT, (base) =>
      facade.submitScoreProjection({ ...base, scoringSide, points: command.points || 1 })
    );
  }

  async function suspendMatch(command = {}) {
    return runCommand(command, CANONICAL_UI_COMMAND.SUSPEND, (base) =>
      facade.suspendAssignedMatch(base)
    );
  }

  async function resumeMatch(command = {}) {
    return runCommand(command, CANONICAL_UI_COMMAND.RESUME, (base) =>
      facade.resumeAssignedMatch(base)
    );
  }

  async function confirmChangeEnds(command = {}) {
    return runCommand(command, CANONICAL_UI_COMMAND.CHANGE_ENDS, async (base, resolved) => {
      const scope = {
        tenantId: resolved.assignment.tenantId,
        competitionId: resolved.assignment.competitionId,
        matchId: resolved.assignment.matchId,
      };
      const live = await runtime.matchStateRepository.getLiveState(scope);
      const current = live?.statePayload?.canonical?.court || {};
      const nextOrientation =
        String(current.courtOrientation || COURT_ORIENTATION.STANDARD) ===
        COURT_ORIENTATION.SWAPPED
          ? COURT_ORIENTATION.STANDARD
          : COURT_ORIENTATION.SWAPPED;
      const nextCourt = {
        ...current,
        courtOrientation: nextOrientation,
        lastSideChangeEventId: command.idempotencyKey,
        sideChangeRequired: false,
      };
      await runtime.matchStateRepository.putLiveState(
        {
          ...scope,
          expectedVersion: command.expectedVersion,
          idempotencyKey: command.idempotencyKey,
          commandId: command.commandId || command.idempotencyKey,
          eventType: CANONICAL_UI_COMMAND.CHANGE_ENDS,
          status: live?.status,
          statePayload: {
            ...(live?.statePayload || {}),
            canonical: {
              ...(live?.statePayload?.canonical || {}),
              court: nextCourt,
            },
          },
        },
        base.actor
      );
      return { ok: true, courtOrientation: nextOrientation, ackRequired: true };
    });
  }

  async function switchPositions(command = {}) {
    return runCommand(command, CANONICAL_UI_COMMAND.SWITCH_POSITIONS, async (base, resolved) => {
      const scope = {
        tenantId: resolved.assignment.tenantId,
        competitionId: resolved.assignment.competitionId,
        matchId: resolved.assignment.matchId,
      };
      const live = await runtime.matchStateRepository.getLiveState(scope);
      const current = live?.statePayload?.canonical?.court || {};
      const sideKey = String(command.sideKey || "A").toUpperCase() === "B" ? "sideB" : "sideA";
      const positions = { ...(current.playerPositions || {}) };
      const list = Array.isArray(positions[sideKey]) ? [...positions[sideKey]] : [];
      if (list.length >= 2) {
        const tmp = list[0];
        list[0] = list[1];
        list[1] = tmp;
        positions[sideKey] = list;
      }
      await runtime.matchStateRepository.putLiveState(
        {
          ...scope,
          expectedVersion: command.expectedVersion,
          idempotencyKey: command.idempotencyKey,
          commandId: command.commandId || command.idempotencyKey,
          eventType: CANONICAL_UI_COMMAND.SWITCH_POSITIONS,
          status: live?.status,
          statePayload: {
            ...(live?.statePayload || {}),
            canonical: {
              ...(live?.statePayload?.canonical || {}),
              court: {
                ...current,
                playerPositions: positions,
              },
            },
          },
        },
        base.actor
      );
      return { ok: true, distinctFromChangeEnds: true };
    });
  }

  async function configureLineup(command = {}) {
    return runCommand(command, CANONICAL_UI_COMMAND.SWITCH_POSITIONS, async (base, resolved) => {
      const scope = {
        tenantId: resolved.assignment.tenantId,
        competitionId: resolved.assignment.competitionId,
        matchId: resolved.assignment.matchId,
      };
      const live = await runtime.matchStateRepository.getLiveState(scope);
      const current = live?.statePayload?.canonical?.court || {};
      const sideA = Array.isArray(command.playerPositions?.sideA)
        ? command.playerPositions.sideA.map(String)
        : Array.isArray(current.playerPositions?.sideA)
          ? current.playerPositions.sideA.map(String)
          : [];
      const sideB = Array.isArray(command.playerPositions?.sideB)
        ? command.playerPositions.sideB.map(String)
        : Array.isArray(current.playerPositions?.sideB)
          ? current.playerPositions.sideB.map(String)
          : [];
      const serverPlayerId = String(command.serverPlayerId || "").trim() || null;
      if (!serverPlayerId) {
        failRefereeAdapter(
          REFEREE_ADAPTER_ERROR_CODE.MALFORMED_CONTEXT,
          "configureLineup requires serverPlayerId",
          {}
        );
      }
      const onSideA = sideA.includes(serverPlayerId);
      const onSideB = sideB.includes(serverPlayerId);
      const servingSide =
        String(command.servingSide || "").toUpperCase() ||
        (onSideA ? "SIDE_A" : onSideB ? "SIDE_B" : "SIDE_A");
      const serverNumberRaw = Number(command.serverNumber);
      const serverNumber =
        Number.isFinite(serverNumberRaw) && serverNumberRaw > 0 ? serverNumberRaw : 1;
      const opposite = servingSide === "SIDE_B" ? sideA : sideB;
      const receiverPlayerId =
        String(command.receiverPlayerId || "").trim() || opposite[0] || null;

      await runtime.matchStateRepository.putLiveState(
        {
          ...scope,
          expectedVersion: command.expectedVersion,
          idempotencyKey: command.idempotencyKey,
          commandId: command.commandId || command.idempotencyKey,
          eventType: CANONICAL_UI_COMMAND.SWITCH_POSITIONS,
          status: live?.status,
          statePayload: {
            ...(live?.statePayload || {}),
            canonical: {
              ...(live?.statePayload?.canonical || {}),
              court: {
                ...current,
                playerPositions: { sideA, sideB },
                serverPlayerId,
                servingSide,
                serverNumber,
                receiverPlayerId,
                lineupConfigured: true,
              },
            },
          },
        },
        base.actor
      );
      return {
        ok: true,
        distinctFromChangeEnds: true,
        lineupConfigured: true,
        serverPlayerId,
        servingSide,
        serverNumber,
      };
    });
  }

  async function submitResult(command = {}) {
    return runCommand(command, CANONICAL_UI_COMMAND.SUBMIT_RESULT, (base) =>
      facade.submitMatchResultForValidation({
        ...base,
        acceptResult: command.acceptResult === true,
      })
    );
  }

  async function correctResult(command = {}) {
    return runCommand(command, CANONICAL_UI_COMMAND.CORRECT_RESULT, (base) =>
      facade.resubmitCorrectedResult({
        ...base,
        acceptResult: command.acceptResult === true,
      })
    );
  }

  return Object.freeze({
    kind: "canonical-referee-application-client",
    usesAdapterB: true,
    silentLegacyFallback: false,
    productionFixtureFallback: false,
    locationStateRequired: false,
    serviceRoleInBrowser: false,
    directPrivilegedRpcFromBrowser: false,
    runtime,
    listMyAssignments,
    getMatchView,
    acknowledgeAssignment,
    openAssignedMatch,
    startScoreSession,
    startMatch,
    submitPoint,
    suspendMatch,
    resumeMatch,
    confirmChangeEnds,
    switchPositions,
    configureLineup,
    submitResult,
    correctResult,
    isRefereeOperationsError,
    isRefereeAdapterContractError,
  });
}
