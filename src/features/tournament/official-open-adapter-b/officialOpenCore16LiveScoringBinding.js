/**
 * Official/Open Adapter B — CORE-16 live scoring execution binding.
 *
 * Translation + delegation + projection only.
 * OwnsAuthority=false. Scoring math/terminal state = CORE-16 only.
 *
 * Durable match_live_states writes remain Edge/service_role.
 * This binding executes CORE-16 in-process and projects for Official UI.
 */

import {
  SCORING_SIDE,
  SCORING_SYSTEM,
  createScoringFormat,
  createInitialScoringState,
  createScoringProjection,
  recordPoint,
  supersedeScoringEvent,
  evaluateGameComplete,
  CORE16_ENGINE_ID,
  CORE16_ENGINE_VERSION,
  isScoringEngineError,
} from "../../competition-core/scoring/index.js";
import {
  COMPETITION_RULES_CAPABILITY_ID,
  projectMatchScoringToCore16Shape,
  SCORING_METHOD,
  MATCH_SERIES,
} from "../../competition-core/competition-rules/index.js";
import { resolveSideChangeRequiredAfterScoring } from "../../competition-engine/integration/referee/index.js";
import { createOfficialOpenCompetitionRulesSurface } from "./officialOpenCompetitionRules.js";
import {
  OFFICIAL_SCORING_METHOD,
  OFFICIAL_MATCH_FORMAT,
  getOfficialCompetitionSettings,
} from "../../individual-tournament/engines/officialTournamentSettingsEngine.js";

export const OFFICIAL_CORE16_LIVE_SCORING_BINDING_ID =
  "official-open-core16-live-scoring-binding";
export const OFFICIAL_CORE16_LIVE_SCORING_BINDING_VERSION = "1.0.0";

/** Execution binding reassessment after this wave. */
export const OFFICIAL_SIDEOUT_EXECUTION_BINDING = "BOUND";
export const OFFICIAL_SIDEOUT_EXECUTION_BINDING_GAP =
  "DURABLE_MATCH_LIVE_STATES_EDGE_REQUIRED — browser token path cannot write match_live_states (service_role only); serve state is CORE-16 session projection until Official scoring Edge host exists.";

export const OFFICIAL_WIN_BY_EXECUTION_BINDING = "BOUND";
export const OFFICIAL_WIN_BY_EXECUTION_BINDING_GAP = null;

export const OFFICIAL_CHANGE_END_EXECUTION_BINDING = "PARTIAL";
export const OFFICIAL_CHANGE_END_EXECUTION_BINDING_GAP =
  "CORE-16 emits ENDS_SWITCH_MILESTONE hint on RALLY only; confirmChangeEnds / orientation ACK is competition-engine ops (not CORE-16 state). Official binds detection+session ACK only — not durable court orientation SSOT.";

export const OFFICIAL_RALLY_EXECUTION_BINDING = "BOUND";

export const SCORING_PERSISTENCE_SSOT = "CORE-16 state (session) + match_live_states (canonical durable; Edge-only)";
export const CLASSIC_LIVE_SCORE_WRITER_ROLE =
  "COMPATIBILITY_PROJECTION_AFTER_CORE16_ACK";

function trim(value) {
  return value != null ? String(value).trim() : "";
}

function fail(code, error, details = {}) {
  return Object.freeze({ ok: false, code, error, details });
}

function mapTeamToScoringSide(team) {
  const raw = String(team || "").trim().toUpperCase();
  if (raw === "A" || raw === "SIDE_A" || raw === SCORING_SIDE.SIDE_A) {
    return SCORING_SIDE.SIDE_A;
  }
  if (raw === "B" || raw === "SIDE_B" || raw === SCORING_SIDE.SIDE_B) {
    return SCORING_SIDE.SIDE_B;
  }
  return null;
}

function mapScoringSideToTeam(side) {
  return String(side).toUpperCase() === SCORING_SIDE.SIDE_B ? "B" : "A";
}

function nextClientEventId(prefix = "official-core16") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Resolve CORE-16 format from Official rules profile / explicit overrides.
 * Does not invent winBy when policy disables it — uses margin 1 (must-win by points only)
 * only when winByEnabled=false; when enabled uses profile margin.
 */
export function resolveOfficialCore16ScoringFormat(input = {}) {
  const tenantId = trim(input.tenantId);
  const tournament = input.tournament || null;
  const match = input.match || {};
  const eventId = trim(input.eventId || match.eventId);
  const explicit = input.format || input.core16Format || null;

  if (explicit && typeof explicit === "object") {
    try {
      const format = createScoringFormat(explicit);
      return {
        ok: true,
        format,
        source: "explicit",
        engineId: CORE16_ENGINE_ID,
        engineVersion: CORE16_ENGINE_VERSION,
      };
    } catch (err) {
      return fail(
        isScoringEngineError(err) ? err.code : "CORE16_FORMAT_INVALID",
        err instanceof Error ? err.message : String(err),
        { engineId: CORE16_ENGINE_ID }
      );
    }
  }

  let core16Shape = null;
  let source = "fallback";

  if (tournament && (tenantId || tournament.tenantId) && eventId) {
    const surface = createOfficialOpenCompetitionRulesSurface({
      tournament,
      tenantId: tenantId || tournament.tenantId,
    });
    const stage = input.stage || match.stage || "GROUP";
    const stageRes = surface.resolveStageMatchRules({ eventId, stage });
    if (stageRes?.ok !== false && stageRes?.core16Projection) {
      core16Shape = { ...stageRes.core16Projection };
      source = "competition.rules.policy.gateway.v1";
    } else if (stageRes?.ok !== false && stageRes?.matchScoring) {
      core16Shape = projectMatchScoringToCore16Shape(stageRes.matchScoring);
      source = "competition.rules.policy.gateway.v1";
    }
  }

  if (!core16Shape && input.rulesEnvelope && typeof input.rulesEnvelope === "object") {
    const env = input.rulesEnvelope;
    const method = String(env.scoringSystem || env.scoringMethod || "")
      .trim()
      .toUpperCase()
      .replace("-", "_");
    core16Shape = {
      scoringSystem:
        method === SCORING_SYSTEM.SIDE_OUT || method === "SIDEOUT"
          ? SCORING_SYSTEM.SIDE_OUT
          : SCORING_SYSTEM.RALLY,
      pointsToWin: Number(env.pointsToWin ?? env.targetPoints ?? env.targetScore) || 11,
      winBy: Number(env.winBy ?? env.winByMargin) || 2,
      maximumScore:
        env.maximumScore != null
          ? Number(env.maximumScore)
          : env.pointCap != null
            ? Number(env.pointCap)
            : null,
      bestOfGames: Number(env.bestOfGames) || 1,
      sideSwitchAt:
        env.sideSwitchAt != null && env.sideSwitchAt !== ""
          ? Number(env.sideSwitchAt)
          : null,
      serversPerSide: Number(env.serversPerSide) || undefined,
      initialServingSide: env.initialServingSide || SCORING_SIDE.SIDE_A,
    };
    source = "rulesEnvelope";
  }

  if (!core16Shape && tournament) {
    const settings = getOfficialCompetitionSettings(tournament);
    const methodRaw = String(
      settings.scoringMethodRequested || settings.scoringMethod || ""
    )
      .trim()
      .toLowerCase();
    const scoringSystem =
      methodRaw === OFFICIAL_SCORING_METHOD.SIDE_OUT
        ? SCORING_SYSTEM.SIDE_OUT
        : SCORING_SYSTEM.RALLY;
    const target =
      Number(input.targetPoints ?? input.targetScore) ||
      Number(settings.roundTargets?.group) ||
      11;
    core16Shape = {
      scoringSystem,
      pointsToWin: target,
      winBy: 2,
      maximumScore: null,
      bestOfGames:
        String(settings.matchFormat || "").toUpperCase() ===
        OFFICIAL_MATCH_FORMAT.BEST_OF_3
          ? 3
          : 1,
      sideSwitchAt: scoringSystem === SCORING_SYSTEM.RALLY ? 11 : null,
      serversPerSide: scoringSystem === SCORING_SYSTEM.SIDE_OUT ? 2 : 1,
      initialServingSide: SCORING_SIDE.SIDE_A,
    };
    source = "settings.officialCompetition";
  }

  if (!core16Shape) {
    const target = Number(input.targetPoints ?? input.targetScore);
    if (!Number.isFinite(target) || target < 1) {
      return fail(
        "CORE16_FORMAT_REQUIRED",
        "Thiếu luật ghi điểm CORE-16 (targetPoints / rules envelope).",
        {}
      );
    }
    core16Shape = {
      scoringSystem: SCORING_SYSTEM.RALLY,
      pointsToWin: target,
      winBy: 2,
      maximumScore: null,
      bestOfGames: 1,
      sideSwitchAt: 11,
      serversPerSide: 1,
      initialServingSide: SCORING_SIDE.SIDE_A,
    };
    source = "live-target-fallback";
  }

  if (input.initialServingSide) {
    const side = mapTeamToScoringSide(input.initialServingSide);
    if (side) core16Shape.initialServingSide = side;
  }
  if (input.serversPerSide != null) {
    core16Shape.serversPerSide = Number(input.serversPerSide);
  }

  // BO3 hard stop for Official classic completion path
  if (Number(core16Shape.bestOfGames) > 1) {
    return fail(
      "BEST_OF_3_NOT_BOUND",
      "Best of 3 chưa bind Official live/result — dùng Best of 1.",
      { bestOfGames: core16Shape.bestOfGames }
    );
  }
  core16Shape.bestOfGames = 1;

  try {
    const format = createScoringFormat(core16Shape);
    return {
      ok: true,
      format,
      source,
      engineId: CORE16_ENGINE_ID,
      engineVersion: CORE16_ENGINE_VERSION,
      matchScoringPolicyHint: {
        scoringMethod:
          format.scoringSystem === SCORING_SYSTEM.SIDE_OUT
            ? SCORING_METHOD.SIDE_OUT
            : SCORING_METHOD.RALLY,
        matchSeries: MATCH_SERIES.BEST_OF_1,
        targetPoints: format.pointsToWin,
      },
    };
  } catch (err) {
    return fail(
      isScoringEngineError(err) ? err.code : "CORE16_FORMAT_INVALID",
      err instanceof Error ? err.message : String(err),
      {}
    );
  }
}

/**
 * Project CORE-16 state → Official/Referee UI read model.
 */
export function projectOfficialCore16ScoringState(state, extras = {}) {
  if (!state) {
    return fail("CORE16_STATE_REQUIRED", "Thiếu CORE-16 scoring state.", {});
  }
  const projection = createScoringProjection(state);
  const points = state.points || {};
  let scoreA = Number(points[SCORING_SIDE.SIDE_A] || 0);
  let scoreB = Number(points[SCORING_SIDE.SIDE_B] || 0);

  // After game/match rollup CORE-16 resets live points to 0. For Official BO1
  // display/commit, surface the last completed game score when terminal.
  if (state.matchComplete === true) {
    const games = Array.isArray(state.completedGames) ? state.completedGames : [];
    const lastGame = games.length ? games[games.length - 1] : null;
    if (lastGame) {
      scoreA = Number(lastGame[SCORING_SIDE.SIDE_A] || 0);
      scoreB = Number(lastGame[SCORING_SIDE.SIDE_B] || 0);
    }
  }

  const serve = state.serve || null;
  const format = state.format || {};
  const sideChange = extras.sideChange || null;
  const court = extras.court || null;

  return Object.freeze({
    ok: true,
    matchId: state.matchId,
    scoringSystem: format.scoringSystem,
    scoringMethodLabel:
      format.scoringSystem === SCORING_SYSTEM.SIDE_OUT
        ? "Truyền thống (Side-out)"
        : "Rally",
    targetPoints: format.pointsToWin,
    winBy: format.winBy,
    pointCap: format.maximumScore,
    sideSwitchAt: format.sideSwitchAt,
    scoreA,
    scoreB,
    servingSide: serve?.servingSide || null,
    servingSideLabel: serve?.servingSide
      ? mapScoringSideToTeam(serve.servingSide)
      : null,
    serverNumber: serve?.serverNumber ?? null,
    matchComplete: state.matchComplete === true,
    calculatedWinnerSide: state.calculatedWinnerSide || null,
    calculatedWinnerTeam: state.calculatedWinnerSide
      ? mapScoringSideToTeam(state.calculatedWinnerSide)
      : null,
    revision: state.revision,
    sideChangeRequired: sideChange?.sideChangeRequired === true,
    sideChangeThreshold: sideChange?.sideChangeThreshold ?? null,
    courtOrientation: court?.orientation || "STANDARD",
    projectionKind: projection.projectionKind,
    authority: "CORE-16",
    bindingId: OFFICIAL_CORE16_LIVE_SCORING_BINDING_ID,
    core16ScoreTerminal: state.matchComplete === true,
    core15Completed: false,
    core17Accepted: false,
  });
}

/**
 * Create Official CORE-16 live scoring session (translation boundary).
 */
export function createOfficialCore16LiveScoringSession(input = {}) {
  const matchId = trim(input.matchId);
  const tenantId = trim(input.tenantId);
  const tournamentId = trim(input.tournamentId || input.competitionId);
  const actorId = trim(input.actorId);

  if (!matchId) {
    return fail("MATCH_REQUIRED", "matchId bắt buộc.", {});
  }
  if (!tenantId) {
    return fail("TENANT_REQUIRED", "tenantId bắt buộc — fail closed.", {});
  }
  if (!tournamentId) {
    return fail("TOURNAMENT_REQUIRED", "tournamentId / competitionId bắt buộc.", {});
  }

  const formatRes = resolveOfficialCore16ScoringFormat(input);
  if (!formatRes.ok) return formatRes;

  const format = formatRes.format;
  const trackServe =
    format.scoringSystem === SCORING_SYSTEM.SIDE_OUT || input.trackServe === true;

  if (format.scoringSystem === SCORING_SYSTEM.SIDE_OUT && !format.initialServingSide) {
    return fail(
      "INITIAL_SERVE_REQUIRED",
      "Side-out cần initialServingSide trước khi bắt đầu ghi điểm.",
      { scoringSystem: format.scoringSystem }
    );
  }

  let state = createInitialScoringState({
    matchId,
    format,
    trackServe,
  });

  if (trackServe && (input.serverNumber != null || input.servingSide)) {
    const servingSide =
      mapTeamToScoringSide(input.servingSide) || state.serve?.servingSide;
    const serverNumber = Number(input.serverNumber);
    state = Object.freeze({
      ...state,
      serve: Object.freeze({
        servingSide,
        serverNumber:
          Number.isFinite(serverNumber) && serverNumber >= 1
            ? serverNumber
            : state.serve?.serverNumber || 1,
      }),
    });
  }

  const court = Object.freeze({
    orientation: "STANDARD",
    sideChangeRequired: false,
    sideChangeThreshold: format.sideSwitchAt,
    sideChangeAcknowledgedAtThreshold: null,
  });

  const readModel = projectOfficialCore16ScoringState(state, { court });

  return Object.freeze({
    ok: true,
    bindingId: OFFICIAL_CORE16_LIVE_SCORING_BINDING_ID,
    bindingVersion: OFFICIAL_CORE16_LIVE_SCORING_BINDING_VERSION,
    ownsScoringAuthority: false,
    translationOnly: true,
    engineId: CORE16_ENGINE_ID,
    engineVersion: CORE16_ENGINE_VERSION,
    tenantId,
    tournamentId,
    eventId: trim(input.eventId) || null,
    matchId,
    actorId: actorId || null,
    formatSource: formatRes.source,
    format,
    state,
    court,
    readModel,
    actionLedger: Object.freeze([]),
  });
}

/**
 * Record a rally outcome through CORE-16 (Rally or Side-out).
 * scoringSide / team = rally winner, not "team to increment".
 */
export function applyOfficialCore16RallyOutcome(session, input = {}) {
  if (!session?.ok || !session.state) {
    return fail("SESSION_REQUIRED", "Cần CORE-16 scoring session.", {});
  }
  if (session.state.matchComplete === true) {
    return fail("MATCH_ALREADY_COMPLETE", "Trận đã terminal theo CORE-16.", {
      calculatedWinnerSide: session.state.calculatedWinnerSide,
    });
  }
  if (session.court?.sideChangeRequired === true) {
    return fail(
      "CHANGE_ENDS_DUE",
      "Cần xác nhận đổi sân (change-end) trước khi ghi điểm tiếp.",
      { sideChangeRequired: true }
    );
  }

  const scoringSide = mapTeamToScoringSide(input.scoringSide || input.team || input.rallyWinner);
  if (!scoringSide) {
    return fail("SCORING_SIDE_REQUIRED", "scoringSide phải là A/B hoặc SIDE_A/SIDE_B.", {});
  }

  const expectedRevision =
    input.expectedRevision != null ? Number(input.expectedRevision) : null;
  if (
    expectedRevision != null &&
    Number.isFinite(expectedRevision) &&
    expectedRevision !== Number(session.state.revision)
  ) {
    return fail("STALE_REVISION", "expectedRevision không khớp — fail closed.", {
      expectedRevision,
      actualRevision: session.state.revision,
    });
  }

  const priorPoints = { ...session.state.points };
  const priorServe = session.state.serve
    ? {
        servingSide: session.state.serve.servingSide,
        serverNumber: session.state.serve.serverNumber,
      }
    : null;

  try {
    const applied = recordPoint(
      session.state,
      {
        scoringSide,
        lifecycleStatus: "IN_PROGRESS",
        clientEventId: input.clientEventId || nextClientEventId("pt"),
        metadata: {
          tenantId: session.tenantId,
          tournamentId: session.tournamentId,
          actorId: input.actorId || session.actorId,
          bindingId: OFFICIAL_CORE16_LIVE_SCORING_BINDING_ID,
        },
      },
      {
        now: () => input.occurredAt || new Date().toISOString(),
        nextId: () => nextClientEventId("evt"),
      }
    );

    const domainHints = applied.event?.payload?.domainHints || [];
    const awardedPoint = applied.event?.payload?.awardedPoint === true;
    const sideChange = resolveSideChangeRequiredAfterScoring({
      priorCourt: session.court || {},
      priorPoints,
      nextPoints: applied.state.points,
      sideSwitchAt: applied.state.format?.sideSwitchAt,
      domainHints,
    });

    const nextCourt = Object.freeze({
      ...(session.court || {}),
      sideChangeRequired: sideChange.sideChangeRequired === true,
      sideChangeThreshold: sideChange.sideChangeThreshold,
      sideChangeAcknowledgedAtThreshold:
        session.court?.sideChangeAcknowledgedAtThreshold ?? null,
    });

    const ledgerEntry = Object.freeze({
      kind: "SCORING",
      eventId: applied.event?.eventId || null,
      atRevision: applied.state.revision,
      scoringSide,
      awardedPoint,
      priorServe,
      nextServe: applied.state.serve || null,
    });

    const nextSession = Object.freeze({
      ...session,
      state: applied.state,
      court: nextCourt,
      readModel: projectOfficialCore16ScoringState(applied.state, {
        court: nextCourt,
        sideChange,
      }),
      actionLedger: Object.freeze([
        ...(Array.isArray(session.actionLedger) ? session.actionLedger : []),
        ledgerEntry,
      ]),
      lastEvent: applied.event,
      lastDomainHints: Object.freeze([...domainHints]),
    });

    return Object.freeze({
      ok: true,
      session: nextSession,
      awardedPoint,
      scoreChanged: awardedPoint,
      readModel: nextSession.readModel,
      classicProjection:
        awardedPoint === true
          ? Object.freeze({
              role: CLASSIC_LIVE_SCORE_WRITER_ROLE,
              scoreA: nextSession.readModel.scoreA,
              scoreB: nextSession.readModel.scoreB,
              // Compatibility sync hint for demoted classic writer (set absolute via deltas).
              team: mapScoringSideToTeam(scoringSide),
              delta: 1,
            })
          : null,
    });
  } catch (err) {
    return fail(
      isScoringEngineError(err) ? err.code : "CORE16_RECORD_POINT_FAILED",
      err instanceof Error ? err.message : String(err),
      {}
    );
  }
}

/**
 * Canonical undo = SUPERSEDE last scoring event (replacementScoringSide null).
 */
export function undoOfficialCore16LastPoint(session, input = {}) {
  if (!session?.ok || !session.state) {
    return fail("SESSION_REQUIRED", "Cần CORE-16 scoring session.", {});
  }
  const events = Array.isArray(session.state.events) ? session.state.events : [];
  const activePointEvents = events.filter(
    (evt) =>
      evt &&
      !session.state.supersededEventIds?.includes(evt.eventId) &&
      String(evt.eventType || "").includes("POINT")
  );
  // Prefer last RECORD_POINT-like event id from ledger, then active point stream
  const ledger = Array.isArray(session.actionLedger) ? session.actionLedger : [];
  const lastScoring = [...ledger].reverse().find((row) => row.kind === "SCORING");
  const targetEventId =
    trim(input.targetEventId) ||
    lastScoring?.eventId ||
    (activePointEvents.length
      ? activePointEvents[activePointEvents.length - 1]?.eventId
      : "") ||
    (events.length ? events[events.length - 1]?.eventId : "");

  if (!targetEventId) {
    return fail("NOTHING_TO_UNDO", "Không còn sự kiện điểm để hoàn tác (CORE-16 SUPERSEDE).", {});
  }

  try {
    const applied = supersedeScoringEvent(
      session.state,
      {
        targetEventId,
        replacementScoringSide: null,
        reason: input.reason || "official-referee-undo",
        clientEventId: input.clientEventId || nextClientEventId("undo"),
        metadata: {
          tenantId: session.tenantId,
          tournamentId: session.tournamentId,
          actorId: input.actorId || session.actorId,
        },
      },
      {
        now: () => input.occurredAt || new Date().toISOString(),
        nextId: () => nextClientEventId("evt"),
      }
    );

    const nextCourt = Object.freeze({
      ...(session.court || {}),
      sideChangeRequired: false,
    });

    const nextSession = Object.freeze({
      ...session,
      state: applied.state,
      court: nextCourt,
      readModel: projectOfficialCore16ScoringState(applied.state, {
        court: nextCourt,
      }),
      actionLedger: Object.freeze([
        ...ledger,
        Object.freeze({
          kind: "UNDO_SUPERSEDE",
          targetEventId,
          atRevision: applied.state.revision,
        }),
      ]),
      lastEvent: applied.event,
    });

    return Object.freeze({
      ok: true,
      session: nextSession,
      readModel: nextSession.readModel,
      undoAuthority: "CORE-16_SUPERSEDE_EVENT",
      classicProjection: Object.freeze({
        role: CLASSIC_LIVE_SCORE_WRITER_ROLE,
        scoreA: nextSession.readModel.scoreA,
        scoreB: nextSession.readModel.scoreB,
        absolute: true,
      }),
    });
  } catch (err) {
    return fail(
      isScoringEngineError(err) ? err.code : "CORE16_UNDO_FAILED",
      err instanceof Error ? err.message : String(err),
      { undoAuthority: "CORE-16_SUPERSEDE_EVENT" }
    );
  }
}

/**
 * Session-level change-end ACK (ops semantics). Not a CORE-16 state mutation.
 */
export function confirmOfficialCore16ChangeEnds(session, input = {}) {
  if (!session?.ok || !session.state) {
    return fail("SESSION_REQUIRED", "Cần CORE-16 scoring session.", {});
  }
  if (session.court?.sideChangeRequired !== true) {
    return fail(
      "CHANGE_ENDS_NOT_DUE",
      "Change-end chưa tới lượt — không ACK.",
      { sideChangeRequired: false }
    );
  }

  const expectedRevision =
    input.expectedRevision != null ? Number(input.expectedRevision) : null;
  if (
    expectedRevision != null &&
    Number.isFinite(expectedRevision) &&
    expectedRevision !== Number(session.state.revision)
  ) {
    return fail("STALE_REVISION", "expectedRevision không khớp — fail closed.", {
      expectedRevision,
      actualRevision: session.state.revision,
    });
  }

  const priorOrientation = String(session.court?.orientation || "STANDARD").toUpperCase();
  const nextOrientation = priorOrientation === "SWAPPED" ? "STANDARD" : "SWAPPED";
  const ackThreshold =
    session.court?.sideChangeThreshold != null
      ? Number(session.court.sideChangeThreshold)
      : session.state.format?.sideSwitchAt != null
        ? Number(session.state.format.sideSwitchAt)
        : null;

  const nextCourt = Object.freeze({
    ...session.court,
    orientation: nextOrientation,
    sideChangeRequired: false,
    sideChangeAcknowledgedAtThreshold: ackThreshold,
  });

  const nextSession = Object.freeze({
    ...session,
    court: nextCourt,
    readModel: projectOfficialCore16ScoringState(session.state, {
      court: nextCourt,
      sideChange: { sideChangeRequired: false, sideChangeThreshold: ackThreshold },
    }),
    actionLedger: Object.freeze([
      ...(Array.isArray(session.actionLedger) ? session.actionLedger : []),
      Object.freeze({
        kind: "CHANGE_ENDS_ACK",
        atRevision: session.state.revision,
        acknowledgedAtThreshold: ackThreshold,
        orientation: nextOrientation,
        authority: "OFFICIAL_ADAPTER_B_SESSION_PROJECTION",
        note: OFFICIAL_CHANGE_END_EXECUTION_BINDING_GAP,
      }),
    ]),
  });

  return Object.freeze({
    ok: true,
    session: nextSession,
    readModel: nextSession.readModel,
    changeEndAuthority: "PARTIAL_SESSION_ACK_NOT_CORE16_STATE",
    bindingGap: OFFICIAL_CHANGE_END_EXECUTION_BINDING_GAP,
  });
}

/**
 * Guard: Official may finalize only when CORE-16 reports terminal.
 */
export function assertOfficialCore16TerminalForCommit(session) {
  if (!session?.ok || !session.state) {
    return fail("SESSION_REQUIRED", "Cần CORE-16 scoring session trước khi chốt.", {});
  }
  if (session.state.matchComplete !== true || !session.state.calculatedWinnerSide) {
    return fail(
      "CORE16_NOT_TERMINAL",
      "CORE-16 chưa terminal — không được chốt kết quả thủ công.",
      {
        matchComplete: session.state.matchComplete === true,
        scoreA: session.readModel?.scoreA,
        scoreB: session.readModel?.scoreB,
        targetPoints: session.format?.pointsToWin,
        winBy: session.format?.winBy,
      }
    );
  }
  return Object.freeze({
    ok: true,
    scoreA: session.readModel.scoreA,
    scoreB: session.readModel.scoreB,
    calculatedWinnerSide: session.state.calculatedWinnerSide,
    calculatedWinnerTeam: mapScoringSideToTeam(session.state.calculatedWinnerSide),
    core16ScoreTerminal: true,
    core15Completed: false,
    core17Accepted: false,
    flow: "CORE16_SCORE_TERMINAL → CORE15_COMPLETED (lifecycle) → CORE17_ACCEPTED",
  });
}

/**
 * Build compact rules envelope for referee URL (policy transport, not score SSOT).
 */
export function buildOfficialCore16RulesEnvelopeFromTournament(tournament, match = {}, options = {}) {
  const formatRes = resolveOfficialCore16ScoringFormat({
    tournament,
    match,
    tenantId: options.tenantId || tournament?.tenantId,
    eventId: options.eventId || match.eventId,
    stage: options.stage,
    initialServingSide: options.initialServingSide,
    serversPerSide: options.serversPerSide,
  });
  if (!formatRes.ok) return formatRes;
  const f = formatRes.format;
  return Object.freeze({
    ok: true,
    envelope: Object.freeze({
      scoringSystem: f.scoringSystem,
      pointsToWin: f.pointsToWin,
      winBy: f.winBy,
      maximumScore: f.maximumScore,
      bestOfGames: f.bestOfGames,
      sideSwitchAt: f.sideSwitchAt,
      serversPerSide: f.serversPerSide,
      initialServingSide: f.initialServingSide,
      tenantId: trim(options.tenantId || tournament?.tenantId) || null,
      tournamentId: trim(tournament?.id || tournament?.tournamentId) || null,
      eventId: trim(options.eventId || match.eventId) || null,
      matchId: trim(match.id || match.matchId) || null,
      formatSource: formatRes.source,
      bindingId: OFFICIAL_CORE16_LIVE_SCORING_BINDING_ID,
    }),
  });
}

export function encodeOfficialCore16RulesQuery(envelope) {
  if (!envelope || typeof envelope !== "object") return "";
  const params = new URLSearchParams();
  params.set("core16", "1");
  params.set("ss", String(envelope.scoringSystem || SCORING_SYSTEM.RALLY));
  params.set("ptw", String(envelope.pointsToWin || ""));
  params.set("wb", String(envelope.winBy || ""));
  if (envelope.maximumScore != null) params.set("cap", String(envelope.maximumScore));
  if (envelope.sideSwitchAt != null) params.set("sw", String(envelope.sideSwitchAt));
  if (envelope.serversPerSide != null) params.set("sps", String(envelope.serversPerSide));
  if (envelope.initialServingSide) params.set("is", String(envelope.initialServingSide));
  if (envelope.tenantId) params.set("tid", String(envelope.tenantId));
  if (envelope.tournamentId) params.set("toid", String(envelope.tournamentId));
  if (envelope.eventId) params.set("eid", String(envelope.eventId));
  if (envelope.matchId) params.set("mid", String(envelope.matchId));
  return params.toString();
}

export function parseOfficialCore16RulesQuery(search) {
  const raw =
    typeof search === "string"
      ? search.startsWith("?")
        ? search.slice(1)
        : search
      : "";
  if (!raw) return { ok: false, code: "NO_QUERY", envelope: null };
  const params = new URLSearchParams(raw);
  if (params.get("core16") !== "1") {
    return { ok: false, code: "NO_CORE16_QUERY", envelope: null };
  }
  const envelope = {
    scoringSystem: params.get("ss") || SCORING_SYSTEM.RALLY,
    pointsToWin: Number(params.get("ptw")) || null,
    winBy: Number(params.get("wb")) || 2,
    maximumScore: params.get("cap") != null ? Number(params.get("cap")) : null,
    sideSwitchAt: params.get("sw") != null ? Number(params.get("sw")) : null,
    serversPerSide: params.get("sps") != null ? Number(params.get("sps")) : null,
    initialServingSide: params.get("is") || SCORING_SIDE.SIDE_A,
    tenantId: params.get("tid") || null,
    tournamentId: params.get("toid") || null,
    eventId: params.get("eid") || null,
    matchId: params.get("mid") || null,
  };
  if (!envelope.pointsToWin || envelope.pointsToWin < 1) {
    return fail("INVALID_RULES_QUERY", "rules query thiếu pointsToWin.", {});
  }
  return { ok: true, envelope: Object.freeze(envelope) };
}

export function buildOfficialRefereeUrlWithCore16Rules(token, envelope) {
  const path = `/referee/${encodeURIComponent(token)}`;
  const q = encodeOfficialCore16RulesQuery(envelope);
  return q ? `${path}?${q}` : path;
}

/**
 * Capability reassessment constants for Official effective selectable.
 */
export function getOfficialCore16ExecutionBindingTruth() {
  return Object.freeze({
    [COMPETITION_RULES_CAPABILITY_ID.SCORING_METHOD_RALLY]: Object.freeze({
      executionBinding: OFFICIAL_RALLY_EXECUTION_BINDING,
      bindingGap: false,
      effectiveSelectable: true,
    }),
    [COMPETITION_RULES_CAPABILITY_ID.SCORING_METHOD_SIDE_OUT]: Object.freeze({
      executionBinding: OFFICIAL_SIDEOUT_EXECUTION_BINDING,
      bindingGap: true,
      bindingGapReason: OFFICIAL_SIDEOUT_EXECUTION_BINDING_GAP,
      // Selectable: CORE-16 Side-out commands are wired; durable serve SSOT still Edge-gap.
      effectiveSelectable: true,
    }),
    [COMPETITION_RULES_CAPABILITY_ID.WIN_BY]: Object.freeze({
      executionBinding: OFFICIAL_WIN_BY_EXECUTION_BINDING,
      bindingGap: false,
      effectiveSelectable: true,
    }),
    [COMPETITION_RULES_CAPABILITY_ID.CHANGE_END]: Object.freeze({
      executionBinding: OFFICIAL_CHANGE_END_EXECUTION_BINDING,
      bindingGap: true,
      bindingGapReason: OFFICIAL_CHANGE_END_EXECUTION_BINDING_GAP,
      effectiveSelectable: false,
    }),
    [COMPETITION_RULES_CAPABILITY_ID.MATCH_SERIES_BEST_OF_3]: Object.freeze({
      executionBinding: "UNBOUND",
      bindingGap: true,
      bindingGapReason: "BO3 hard stop this wave.",
      effectiveSelectable: false,
    }),
    scoringPersistenceSsot: SCORING_PERSISTENCE_SSOT,
    classicLiveWriterRole: CLASSIC_LIVE_SCORE_WRITER_ROLE,
    evaluateGameComplete,
  });
}
