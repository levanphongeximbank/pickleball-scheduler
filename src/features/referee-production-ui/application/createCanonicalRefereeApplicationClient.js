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
import {
  evaluateUndoAvailability,
  findLastEligibleScoringEvent,
} from "../../competition-engine/operations/referee/scoring/undoLastScoringActionHelpers.js";
import { CANONICAL_UI_COMMAND, REFEREE_UI_ERROR_CODE } from "../constants.js";
import { buildRefereeAssignmentCard } from "../projection/buildRefereeAssignmentCard.js";
import { buildRefereeMatchView } from "../projection/buildRefereeMatchView.js";
import {
  mapLiveStatusToCore15,
  resolveAuthoritativeMatchLifecycle,
} from "../projection/resolveAuthoritativeMatchLifecycle.js";
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

function clonePlain(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

/**
 * Build a single-match ops record from durable live + verified assignment.
 * Used by the hot submitPoint path to avoid competition-wide reconstruct.
 */
function buildSeedRecordFromLive({
  tenantId,
  competitionId,
  matchId,
  assignment,
  live,
}) {
  const canonical = live?.statePayload?.canonical || {};
  const refereeId = String(
    assignment?.refereeId || assignment?.refereeUserId || ""
  ).trim();
  const status = String(
    assignment?.status || assignment?.opsStatus || ""
  ).toUpperCase();
  return {
    tenantId: String(tenantId || "").trim() || null,
    competitionId: String(competitionId || "").trim() || null,
    venueId: canonical.venueId || assignment?.venueId || null,
    assignments: refereeId
      ? [
          {
            assignmentId: `${matchId}::${refereeId}`,
            matchId,
            refereeId,
            tenantId: assignment?.tenantId || tenantId,
            competitionId: assignment?.competitionId || competitionId,
            venueId: assignment?.venueId || null,
            courtId: assignment?.courtId || null,
            scheduledAt: assignment?.assignedAt || assignment?.scheduledAt || null,
            status: status === "ACTIVE" ? "ASSIGNED" : status || "ASSIGNED",
            participants: [],
            entries: [],
            checkInReady: false,
            source: "referee_assignments",
          },
        ]
      : [],
    matches: canonical.match ? { [matchId]: clonePlain(canonical.match) } : {},
    scoreSessions: canonical.scoreSession
      ? { [matchId]: clonePlain(canonical.scoreSession) }
      : {},
    courtsByMatch: canonical.court
      ? { [matchId]: clonePlain(canonical.court) }
      : {},
    validationByMatch: canonical.validation
      ? { [matchId]: clonePlain(canonical.validation) }
      : {},
    revision: Number(live?.stateVersion ?? live?.version ?? 0),
    updatedAt: live?.updatedAt || null,
  };
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
    if (expectedVersion == null) return null;
    const live = await runtime.matchStateRepository.getLiveState(scope);
    const current = Number(live?.stateVersion ?? live?.version ?? 0);
    if (Number(expectedVersion) !== current) {
      failRefereeAdapter(
        REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE,
        "Fail-closed stale write: expectedVersion mismatch",
        { expectedVersion, actualVersion: current }
      );
    }
    return {
      live,
      expectedVersion: current,
      courtState: live?.statePayload?.canonical?.court || live?.statePayload?.court || {},
    };
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
      seedRecord: command.seedRecord || null,
      currentLive: command.currentLive || null,
      authoritativeAssignment: command.authoritativeAssignment || null,
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
    if (!tenantId) {
      const err = new Error("tenantId is required for referee authorization");
      err.code = REFEREE_UI_ERROR_CODE.MATCH_SCOPE_UNRESOLVED;
      throw err;
    }
    const competitionId = String(command.competitionId || "").trim();
    const refereeUserId = String(
      actor?.actorId || actor?.authUid || actor?.refereeId || ""
    ).trim();
    if (!refereeUserId) {
      const err = new Error("Canonical referee actor is required");
      err.code = REFEREE_UI_ERROR_CODE.MATCH_SCOPE_UNRESOLVED;
      throw err;
    }

    let assignment = null;
    // Prefer single-match assignment read when competitionId is known.
    if (competitionId && runtime.assignmentRepository?.getActiveForMatch) {
      const active = await runtime.assignmentRepository.getActiveForMatch({
        tenantId,
        competitionId,
        matchId,
        refereeUserId,
      });
      if (active) {
        const activeTenant = String(active.tenantId || "").trim();
        const activeCompetition = String(active.competitionId || "").trim();
        if (activeTenant && activeTenant !== tenantId) {
          failRefereeAdapter(
            REFEREE_ADAPTER_ERROR_CODE.CROSS_TENANT_CONTEXT,
            "Cross-tenant referee deep-link denied",
            { tenantId, assignmentTenantId: activeTenant }
          );
        }
        if (activeCompetition && activeCompetition !== competitionId) {
          const err = new Error("Cross-tournament referee deep-link denied");
          err.code = REFEREE_UI_ERROR_CODE.MATCH_SCOPE_UNRESOLVED;
          throw err;
        }
        const status = String(active.opsStatus || active.status || "").toUpperCase();
        assignment = {
          matchId: active.matchId || matchId,
          tenantId: active.tenantId || tenantId,
          competitionId: active.competitionId || competitionId,
          refereeUserId: active.refereeUserId || refereeUserId,
          refereeId: active.refereeUserId || refereeUserId,
          courtId: active.courtId || command.courtId || null,
          status: status === "ACTIVE" ? "ASSIGNED" : status,
          opsStatus: status,
        };
      }
    }
    if (!assignment) {
      const rows = await listAssignmentRows(actor, tenantId);
      const row = rows.find((candidate) => {
        if (String(candidate.matchId) !== matchId) return false;
        if (competitionId) {
          const rowCompetition = String(
            candidate.competitionId || candidate.tournamentId || ""
          ).trim();
          if (rowCompetition && rowCompetition !== competitionId) return false;
        }
        const rowTenant = String(candidate.tenantId || "").trim();
        if (rowTenant && rowTenant !== tenantId) return false;
        return true;
      });
      if (row) {
        const status = String(row.opsStatus || row.status || "").toUpperCase();
        assignment = {
          ...row,
          matchId,
          tenantId: row.tenantId || tenantId,
          competitionId: row.competitionId || row.tournamentId || competitionId,
          refereeUserId: row.refereeUserId || row.refereeId || refereeUserId,
          refereeId: row.refereeId || row.refereeUserId || refereeUserId,
          status: status === "ACTIVE" ? "ASSIGNED" : status,
        };
      }
    }
    // Fail closed: never invent synthetic ASSIGNED scope from competitionId alone.
    if (!assignment) {
      const err = new Error(
        "Assigned match could not be resolved from durable CORE-13 state"
      );
      err.code = REFEREE_UI_ERROR_CODE.MATCH_SCOPE_UNRESOLVED;
      throw err;
    }
    if (!String(assignment.competitionId || "").trim()) {
      const err = new Error(
        "Canonical competition identity required for referee authorization"
      );
      err.code = REFEREE_UI_ERROR_CODE.MATCH_SCOPE_UNRESOLVED;
      throw err;
    }
    const modeState =
      command.modeState || (await resolveModeState(assignment, command));
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
        competitionId: assignment.competitionId || competitionId,
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
    const resolved = extras.resolved || (await resolveScopeByMatchId(command));
    const { assignment, mode, adapter, modeState, actor } = resolved;
    const req = adapterRequest(assignment, modeState);
    const competitionContext = adapter.getCompetitionContext(req);
    const matchContext = adapter.getMatchContext(req);
    const participants = adapter.getParticipants(req);
    const scoringRules = adapter.getScoringRules(req);
    const lifecyclePolicy = adapter.getLifecyclePolicy(req);
    const capabilities = adapter.getCapabilities(req);
    const preStart = adapter.validatePreStart(req);

    const scope = {
      tenantId: assignment.tenantId,
      competitionId: assignment.competitionId,
      matchId: assignment.matchId,
    };

    // Post-mutation path: reuse CORE score + court from the same commit (no second facade read).
    const skipAssignedRead = Boolean(extras.scoreProjection);
    const [names, assignedResult, liveInfo] = await Promise.all([
      resolveNames(assignment, modeState),
      skipAssignedRead
        ? Promise.resolve(null)
        : facade.getAssignedMatch(commandBase(command, assignment)),
      extras.liveInfo
        ? Promise.resolve(extras.liveInfo)
        : readLiveVersion(scope),
    ]);

    const live = liveInfo?.live || {};
    const assignedMatchRaw = assignedResult?.assignedMatch || null;
    const scoreProjection =
      extras.scoreProjection || assignedMatchRaw?.scoreProjection || null;

    // CORE-15 lifecycle: never let Adapter/modeState READY override live/canonical IN_PROGRESS.
    const lifecycleState = resolveAuthoritativeMatchLifecycle({
      live,
      assignedMatch: skipAssignedRead
        ? {
            scoreProjection,
            lifecycleState: null,
            match: live?.statePayload?.canonical?.match || null,
          }
        : assignedMatchRaw,
      matchContext,
      scoreProjection,
      preferInProgressAfterScore: skipAssignedRead,
    });

    const assignedMatch = skipAssignedRead
      ? {
          lifecycleState,
          scoreProjection: extras.scoreProjection,
          scoreEntryReady: true,
          match: {
            ...(live?.statePayload?.canonical?.match || {}),
            status: lifecycleState,
          },
        }
      : assignedMatchRaw
        ? {
            ...assignedMatchRaw,
            lifecycleState: lifecycleState || assignedMatchRaw.lifecycleState,
            match: {
              ...(assignedMatchRaw.match || {}),
              status: lifecycleState || assignedMatchRaw.match?.status,
            },
          }
        : null;

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
      ...(liveInfo?.courtState || {}),
      ...(extras.courtState || {}),
      serverPlayerId:
        extras.courtState?.serverPlayerId ||
        liveInfo?.courtState?.serverPlayerId ||
        live.servingPlayerId ||
        null,
      receiverPlayerId:
        extras.courtState?.receiverPlayerId ||
        liveInfo?.courtState?.receiverPlayerId ||
        live.receivingPlayerId ||
        null,
      servingSide:
        extras.courtState?.servingSide ||
        liveInfo?.courtState?.servingSide ||
        null,
      serverNumber:
        extras.courtState?.serverNumber ??
        liveInfo?.courtState?.serverNumber ??
        live.serverNumber ??
        null,
      lineupConfigured:
        extras.courtState?.lineupConfigured === true ||
        liveInfo?.courtState?.lineupConfigured === true,
      courtOrientation:
        extras.courtState?.courtOrientation ||
        extras.courtState?.orientation ||
        liveInfo?.courtState?.courtOrientation ||
        liveInfo?.courtState?.orientation ||
        live.courtOrientation ||
        null,
      playerPositions:
        extras.courtState?.playerPositions ||
        liveInfo?.courtState?.playerPositions ||
        null,
      homePlayerPositions:
        extras.courtState?.homePlayerPositions ||
        liveInfo?.courtState?.homePlayerPositions ||
        null,
      sideChangeRequired:
        extras.courtState?.sideChangeRequired === true ||
        liveInfo?.courtState?.sideChangeRequired === true,
      sideChangeThreshold:
        extras.courtState?.sideChangeThreshold ??
        liveInfo?.courtState?.sideChangeThreshold ??
        null,
      sideChangeAcknowledgedAtThreshold:
        extras.courtState?.sideChangeAcknowledgedAtThreshold ??
        liveInfo?.courtState?.sideChangeAcknowledgedAtThreshold ??
        null,
      lastSideChangeEventId:
        extras.courtState?.lastSideChangeEventId ||
        liveInfo?.courtState?.lastSideChangeEventId ||
        null,
    };
    const scoreSession =
      live?.statePayload?.canonical?.scoreSession ||
      assignedMatchRaw?.scoreSession ||
      null;
    const validation =
      live?.statePayload?.canonical?.validation ||
      assignedMatchRaw?.validation ||
      (assignedMatchRaw?.validationStatus
        ? { status: assignedMatchRaw.validationStatus }
        : null);
    // Server-derived eligibility only (trusted host). Never invent client-side undo rules.
    const undoAvailability =
      extras.undoAvailability ||
      evaluateUndoAvailability({
        match: assignedMatch?.match || live?.statePayload?.canonical?.match || null,
        session: scoreSession,
        validation,
        court: courtState,
        actualVersion: liveInfo?.expectedVersion,
        targetEvent: findLastEligibleScoringEvent(scoreSession?.state),
        ledger: scoreSession?.actionLedger,
      });
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
        // Authoritative CORE-15 only — never prefer Adapter READY over live IN_PROGRESS.
        status: lifecycleState || mapLiveStatusToCore15(live.status) || null,
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
        ? {
            ...(assignedMatch || {}),
            lifecycleState: lifecycleState || assignedMatch?.lifecycleState,
            scoreProjection: enrichedScoreProjection,
            match: {
              ...(assignedMatch?.match || {}),
              status: lifecycleState || assignedMatch?.match?.status,
            },
          }
        : assignedMatch,
      operationsProjection: assignedResult?.projection || null,
      courtState,
      live,
      modeState,
      participantNames: names,
      expectedVersion: liveInfo?.expectedVersion,
      pendingCanonicalAction: extras.pendingCanonicalAction || null,
      stale: extras.stale === true,
      preStart,
      actor,
      undoAvailability,
      scoreSession,
    });
  }

  async function listMyAssignments(command = {}) {
    rejectLocationStateAuthority(command.locationState);
    const homeT0 = Date.now();
    const homeTiming = {
      assignmentQueryMs: null,
      enrichmentMs: null,
      totalMs: null,
      queryCount: 0,
    };
    const actor = actorFrom(command, defaultActor);
    const tenantId = String(command.tenantId || "").trim();
    const tAssign0 = Date.now();
    const rows = await listAssignmentRows(actor, tenantId);
    homeTiming.assignmentQueryMs = Date.now() - tAssign0;
    homeTiming.queryCount += 1;

    const tEnrich0 = Date.now();
    // Warm modeState in parallel (dedupe happens in resolver cache when present).
    await Promise.all(rows.map((row) => resolveModeState(row, command).catch(() => null)));

    async function buildCardForRow(row) {
      const livePromise = readLiveVersion({
        tenantId: row.tenantId || tenantId,
        competitionId: row.competitionId,
        matchId: row.matchId,
      }).catch(() => null);
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
      const matchFromMode =
        (row.matchId && modeState?.matches?.[row.matchId]) || null;
      const courtIdFromMode =
        matchFromMode?.courtId ||
        matchFromMode?.physicalCourtId ||
        (modeState?.matchups && Object.values(modeState.matchups)[0]?.courtId) ||
        row.courtId ||
        null;
      const courtLabelFromMode =
        matchFromMode?.courtLabel ||
        (courtIdFromMode && modeState?.courtLabels?.[courtIdFromMode]) ||
        (modeState?.matchups && Object.values(modeState.matchups)[0]?.courtLabel) ||
        modeState?.courtLabel ||
        null;
      if (!modeHint) {
        const liveInfo = await livePromise;
        homeTiming.queryCount += 1;
        const liveCore = mapLiveStatusToCore15(liveInfo?.live?.status);
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
            status: liveCore || null,
          },
          participants: { sides: [] },
          participantNames: modeState?.participantNames || {},
          assignedMatch: liveCore
            ? Object.freeze({
                lifecycleState: liveCore,
                scoreProjection: null,
                validationStatus: null,
              })
            : null,
          live: liveInfo?.live || null,
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
        livePromise,
      ]);
      homeTiming.queryCount += 1;
      // Home list: prefer live lifecycle (fast). Full assignedMatch only when live is absent.
      const liveCore = mapLiveStatusToCore15(liveInfo?.live?.status);
      const assignedMatch = liveCore
        ? Object.freeze({
            lifecycleState: liveCore,
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
            .then((got) => {
              homeTiming.queryCount += 1;
              return got.assignedMatch;
            })
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
          status: liveCore || matchContext.status || null,
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
    homeTiming.enrichmentMs = Date.now() - tEnrich0;
    homeTiming.totalMs = Date.now() - homeT0;
    if (typeof console !== "undefined" && console.info) {
      console.info("[referee-home-timing]", homeTiming);
    }
    return Object.freeze({
      ok: true,
      assignments: Object.freeze(cards),
      homeTiming: Object.freeze(homeTiming),
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
      const t0 = Date.now();
      const timing = {
        authMs: null,
        contextResolutionMs: null,
        matchReadMs: null,
        coreWriteMs: null,
        durableCommitMs: null,
        postCommitProjectionMs: null,
        totalMs: null,
      };
      const tContext0 = Date.now();
      const resolved = await resolveScopeByMatchId(command);
      timing.contextResolutionMs = Date.now() - tContext0;
      const scope = {
        tenantId: resolved.assignment.tenantId,
        competitionId: resolved.assignment.competitionId,
        matchId: resolved.assignment.matchId,
      };
      const tMatchRead0 = Date.now();
      const preWriteLiveInfo = await assertExpectedVersion(scope, command.expectedVersion);
      timing.matchReadMs = Date.now() - tMatchRead0;
      // Hot-path seedRecord is only for score submit — other commands still reconstruct.
      const useScoreHotPath = type === CANONICAL_UI_COMMAND.SUBMIT_POINT;
      const authoritativeAssignment = useScoreHotPath
        ? {
            ...resolved.assignment,
            refereeId:
              resolved.assignment.refereeId ||
              resolved.assignment.refereeUserId ||
              actorFrom(command, defaultActor)?.actorId,
            refereeUserId:
              resolved.assignment.refereeUserId ||
              resolved.assignment.refereeId ||
              actorFrom(command, defaultActor)?.actorId,
            status: (() => {
              const ops = String(resolved.assignment.opsStatus || "").toUpperCase();
              if (ops) return ops === "ACTIVE" ? "ASSIGNED" : ops;
              const raw = String(resolved.assignment.status || "").toUpperCase();
              if (raw === "ACTIVE") return "ASSIGNED";
              return raw || null;
            })(),
          }
        : null;
      const seedRecord =
        useScoreHotPath && preWriteLiveInfo?.live
          ? buildSeedRecordFromLive({
              tenantId: scope.tenantId,
              competitionId: scope.competitionId,
              matchId: scope.matchId,
              assignment: authoritativeAssignment,
              live: preWriteLiveInfo.live,
            })
          : null;
      const base = commandBase(
        {
          ...command,
          modeState: resolved.modeState,
          competitionMode: resolved.mode,
          seedRecord,
          currentLive: useScoreHotPath ? preWriteLiveInfo?.live || null : null,
          authoritativeAssignment,
        },
        resolved.assignment
      );
      try {
        const tWrite0 = Date.now();
        const result = await fn(base, resolved);
        timing.coreWriteMs = Date.now() - tWrite0;
        timing.durableCommitMs = timing.coreWriteMs;
        const tProj0 = Date.now();
        // Prefer post-commit live when mutation returns it; else one fresh read for ACK.
        const postLiveInfo =
          result?.liveInfo ||
          (result?.live
            ? {
                live: result.live,
                expectedVersion: Number(
                  result.live.stateVersion ?? result.live.version ?? 0
                ),
                courtState:
                  result.live?.statePayload?.canonical?.court ||
                  result.live?.statePayload?.court ||
                  {},
              }
            : null);
        const view = await projectMatch({
          ...command,
          modeState: resolved.modeState,
          competitionMode: resolved.mode,
          tenantId: scope.tenantId,
          competitionId: scope.competitionId,
        }, {
          resolved,
          courtState: result?.court || undefined,
          scoreProjection: result?.scoreProjection || undefined,
          // After durable score write, never reuse pre-write live for lifecycle/score.
          liveInfo: postLiveInfo || undefined,
          undoAvailability: result?.undoAvailability || undefined,
        });
        timing.postCommitProjectionMs = Date.now() - tProj0;
        timing.totalMs = Date.now() - t0;
        if (result?.commitSubphases) {
          timing.commitSubphases = result.commitSubphases;
        }
        return Object.freeze({
          ok: true,
          command: type,
          result,
          view,
          stale: false,
          duplicateBlocked: false,
          latency: Object.freeze({
            ...timing,
            networkPostCount: 1,
            postCommitRefetch: false,
            ackReturnsFullView: true,
            projectMatchCount: 1,
            durableCommitCount: 1,
            preWriteLiveReused: Boolean(preWriteLiveInfo),
            postCommitLiveFromCommit: Boolean(result?.liveInfo || result?.live),
          }),
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
          }, { stale: true, resolved, liveInfo: preWriteLiveInfo || undefined });
          timing.totalMs = Date.now() - t0;
          return Object.freeze({
            ok: false,
            command: type,
            stale: true,
            failClosed: true,
            code: REFEREE_ADAPTER_ERROR_CODE.STALE_WRITE,
            error: err.message,
            view,
            latency: Object.freeze({
              ...timing,
              networkPostCount: 1,
              postCommitRefetch: false,
              ackReturnsFullView: true,
            }),
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

  async function undoLastScoringAction(command = {}) {
    return runCommand(
      command,
      CANONICAL_UI_COMMAND.UNDO_LAST_SCORING_ACTION,
      (base) => facade.undoLastScoringAction(base)
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
    return runCommand(command, CANONICAL_UI_COMMAND.CHANGE_ENDS, (base) =>
      facade.confirmChangeEnds(base)
    );
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
      const servingList = servingSide === "SIDE_B" ? sideB : sideA;
      const serverIdx = servingList.indexOf(serverPlayerId);
      const receiverPlayerId =
        String(command.receiverPlayerId || "").trim() ||
        (serverIdx >= 0 ? opposite[serverIdx] : null) ||
        opposite[0] ||
        null;

      const nextCourt = {
        ...current,
        playerPositions: { sideA, sideB },
        homePlayerPositions: {
          sideA: [...sideA],
          sideB: [...sideB],
        },
        serverPlayerId,
        servingSide,
        serverNumber,
        receiverPlayerId,
        lineupConfigured: true,
      };

      const priorCanonical = live?.statePayload?.canonical || {};
      const priorSession = priorCanonical.scoreSession || null;
      let nextScoreSession = priorSession;
      if (priorSession?.state?.serve) {
        nextScoreSession = {
          ...priorSession,
          state: {
            ...priorSession.state,
            serve: Object.freeze({
              servingSide,
              serverNumber,
            }),
          },
        };
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
              ...priorCanonical,
              court: nextCourt,
              ...(nextScoreSession ? { scoreSession: nextScoreSession } : {}),
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
    undoLastScoringAction,
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
