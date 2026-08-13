/**
 * Official Organizer workflow — Phase 2B round-centric projection.
 * UI stages only; no persisted FSM. Supersedes Phase 2A stage presentation.
 */

import { ENTRY_STATUS, TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";
import { filterDrawEligibleEntries } from "./withdrawalEngine.js";
import { getRefereeAssignments, collectEventMatches } from "./refereeAssignEngine.js";
import { getDrawPublishStatus, DRAW_PUBLISH_STATUS } from "../../../tournament/engines/publishDrawEngine.js";
import { isRegistrationLocked } from "./registrationEngine.js";
import { isTournamentClosed, canCloseTournament } from "./tournamentClosingEngine.js";
import { getResultsOps } from "./walkoverEngine.js";
import { buildFinalRanking, buildAwardsPreview, AWARD_KEY } from "./awardsEngine.js";
import { canGenerateBracket, resolveBracketProgress } from "../../../tournament/engines/bracketEngine.js";
import {
  getOfficialCompetitionSettings,
  OFFICIAL_REGISTRATION_MODE,
  OFFICIAL_REGISTRATION_MODE_LABELS,
  isOfficialRegistrationModeResolved,
} from "./officialTournamentSettingsEngine.js";

export const OFFICIAL_STAGE_ID = Object.freeze({
  SETTINGS: "settings",
  REGISTRATION: "registration",
  LOCK_ENTRIES: "lock_entries",
  DRAW: "draw",
  GROUP_STAGE: "group_stage",
  RESULTS: "results",
  /** Dynamic KO stages use prefix knockout: */
  // Phase 2A aliases kept for next-action map compatibility
  INFO: "settings",
  SCHEDULE: "group_stage",
  REFEREE: "group_stage",
  SCORING: "group_stage",
  KNOCKOUT: "results",
  CLOSE: "results",
});

export const OFFICIAL_STAGE_STATE = Object.freeze({
  COMPLETED: "COMPLETED",
  CURRENT: "CURRENT",
  READY: "READY",
  BLOCKED: "BLOCKED",
  PENDING: "PENDING",
});

/** Base stage defs (knockout rounds appended dynamically). */
export const OFFICIAL_STAGE_DEFS = Object.freeze([
  { id: "settings", label: "Thông tin & cài đặt giải", order: 1 },
  { id: "registration", label: "Đăng ký vận động viên", order: 2 },
  { id: "lock_entries", label: "Chốt vận động viên", order: 3 },
  { id: "draw", label: "Bốc thăm", order: 4 },
  { id: "group_stage", label: "Lịch thi đấu vòng bảng", order: 5 },
  { id: "results", label: "Kết quả / Bảng xếp hạng", order: 1000 },
]);

function primaryEvent(tournament, eventId = "") {
  const events = tournament?.events || [];
  if (eventId) {
    return events.find((event) => String(event.id) === String(eventId)) || events[0] || null;
  }
  return events[0] || null;
}

function isMatchComplete(match) {
  if (!match) return false;
  const status = String(match.status || "").toLowerCase();
  return (
    status === "completed" ||
    status === "complete" ||
    status === "forfeit" ||
    status === "walkover" ||
    match.locked === true ||
    (match.scoreA != null &&
      match.scoreB != null &&
      Number.isFinite(Number(match.scoreA)) &&
      Number.isFinite(Number(match.scoreB)) &&
      status !== "scheduled" &&
      status !== "pending" &&
      status !== "ready" &&
      status !== "waiting")
  );
}

export function summarizeOfficialEntries(tournament, eventId = "") {
  const event = primaryEvent(tournament, eventId);
  const entries = event?.entries || [];
  const byStatus = {
    pending: 0,
    approved: 0,
    active: 0,
    waitlisted: 0,
    rejected: 0,
    withdrawn: 0,
    cancelled: 0,
    other: 0,
  };
  entries.forEach((entry) => {
    const status = String(entry?.status || ENTRY_STATUS.ACTIVE).toLowerCase();
    if (status in byStatus) byStatus[status] += 1;
    else byStatus.other += 1;
  });
  const drawEligible = filterDrawEligibleEntries(entries, tournament);
  return {
    total: entries.length,
    drawEligibleCount: drawEligible.length,
    drawEligible,
    pending: byStatus.pending,
    approved: byStatus.approved,
    active: byStatus.active,
    waitlisted: byStatus.waitlisted,
    rejected: byStatus.rejected,
    withdrawn: byStatus.withdrawn,
    cancelled: byStatus.cancelled,
    approvedOrActive: byStatus.approved + byStatus.active,
  };
}

/**
 * Participant finalization projection — same entry store, no duplicate table.
 * Buckets are derived from canonical statuses + draw eligibility.
 */
export function projectOfficialFinalizationBuckets(tournament, eventId = "") {
  const event = primaryEvent(tournament, eventId);
  const entries = Array.isArray(event?.entries) ? event.entries : [];
  const eligibleIds = new Set(
    filterDrawEligibleEntries(entries, tournament).map((entry) => String(entry.id))
  );

  const eligible = [];
  const pending = [];
  const ineligible = [];

  entries.forEach((entry) => {
    const status = String(entry?.status || "").toLowerCase();
    if (eligibleIds.has(String(entry.id))) {
      eligible.push(entry);
      return;
    }
    if (status === ENTRY_STATUS.PENDING || status === ENTRY_STATUS.WAITLISTED) {
      pending.push(entry);
      return;
    }
    ineligible.push(entry);
  });

  return {
    eligible,
    pending,
    ineligible,
    counts: {
      eligible: eligible.length,
      pending: pending.length,
      ineligible: ineligible.length,
      total: entries.length,
    },
  };
}

export function summarizeOfficialMatches(tournament, eventId = "") {
  const matches = collectEventMatches(tournament, eventId);
  const groupMatches = matches.filter((match) => !match.bracketMatchId && !match.bracketRound);
  const knockoutMatches = matches.filter((match) => match.bracketMatchId || match.bracketRound);
  const all = matches;
  const completed = all.filter(isMatchComplete);
  const waiting = all.filter((match) => !isMatchComplete(match));
  return {
    total: all.length,
    completed: completed.length,
    live: 0,
    waiting: waiting.length,
    groupTotal: groupMatches.length,
    groupCompleted: groupMatches.filter(isMatchComplete).length,
    knockoutTotal: knockoutMatches.length,
    knockoutCompleted: knockoutMatches.filter(isMatchComplete).length,
    matches: all,
    completedMatches: completed,
    liveMatches: [],
    waitingMatches: waiting,
    groupMatches,
    knockoutMatches,
  };
}

export function summarizeOfficialRefereeOps(tournament, eventId = "") {
  const matches = collectEventMatches(tournament, eventId);
  const assignments = getRefereeAssignments(tournament);
  let assigned = 0;
  matches.forEach((match) => {
    const fromMap = assignments[String(match.id)];
    if ((fromMap && fromMap.status !== "revoked") || match?.referee?.token) assigned += 1;
  });
  return {
    rosterCount: (tournament?.settings?.referee?.roster || []).length,
    matchCount: matches.length,
    assignedCount: assigned,
    unassignedCount: Math.max(0, matches.length - assigned),
    coverage: matches.length === 0 ? null : `${assigned}/${matches.length} trận đã có trọng tài`,
  };
}

function stageState({ completed, current, ready, blocked, pending }) {
  if (completed) return OFFICIAL_STAGE_STATE.COMPLETED;
  if (blocked) return OFFICIAL_STAGE_STATE.BLOCKED;
  if (current) return OFFICIAL_STAGE_STATE.CURRENT;
  if (ready) return OFFICIAL_STAGE_STATE.READY;
  if (pending) return OFFICIAL_STAGE_STATE.PENDING;
  return OFFICIAL_STAGE_STATE.PENDING;
}

/**
 * Derive knockout round stages from canonical bracket progress.
 */
export function deriveOfficialKnockoutStages(tournament, eventId = "") {
  const event = primaryEvent(tournament, eventId);
  if (!event?.bracket) return [];
  const progress = resolveBracketProgress(event);
  const rounds = progress.rounds || [];
  return rounds.map((round, index) => {
    const roundName = round.name || round.roundName || `Vòng ${index + 1}`;
    const matches = round.matches || [];
    const completedCount = matches.filter((m) => {
      const side = progress.winnersByMatch?.[m.id] || m.winnerSide;
      return Boolean(side || m.winnerId);
    }).length;
    const total = matches.length;
    const prevComplete =
      index === 0 ||
      (() => {
        const prev = rounds[index - 1];
        const prevMatches = prev?.matches || [];
        return prevMatches.every((m) => progress.winnersByMatch?.[m.id] || m.winnerSide || m.winnerId);
      })();
    const complete = total > 0 && completedCount >= total;
    const id = `knockout:${encodeURIComponent(roundName)}`;
    return {
      id,
      label: roundName,
      order: 100 + index,
      kind: "knockout",
      roundName,
      roundIndex: index,
      state: stageState({
        completed: complete,
        current: prevComplete && !complete,
        ready: prevComplete && !complete,
        blocked: !prevComplete,
        pending: !prevComplete,
      }),
      summary: total
        ? `${completedCount}/${total} trận`
        : "Chưa có trận",
      blocker: !prevComplete ? "Cần hoàn tất vòng trước." : null,
      counts: { completed: completedCount, total },
      primaryAction: {
        id: complete ? "view_knockout_round" : "operate_knockout_round",
        label: complete ? "Xem vòng" : "Vận hành vòng",
      },
    };
  });
}

export function buildOfficialCompetitionFacts(tournament, options = {}) {
  const eventId = options.eventId || "";
  const event = primaryEvent(tournament, eventId);
  const entries = summarizeOfficialEntries(tournament, event?.id || eventId);
  const matches = summarizeOfficialMatches(tournament, event?.id || eventId);
  const referees = summarizeOfficialRefereeOps(tournament, event?.id || eventId);
  const competition = getOfficialCompetitionSettings(tournament);
  const locked = isRegistrationLocked(tournament);
  const draw = getDrawPublishStatus(tournament);
  const hasGroups = (event?.groups || []).length > 0;
  const hasDraw =
    hasGroups ||
    draw.status === DRAW_PUBLISH_STATUS.LOCKED ||
    draw.status === DRAW_PUBLISH_STATUS.PUBLISHED;
  const closed = isTournamentClosed(tournament) || tournament?.status === TOURNAMENT_STATUS.COMPLETED;
  const ranking = event ? buildFinalRanking(tournament, event.id) : { ranking: [] };
  const awardsPreview = event ? buildAwardsPreview(tournament, { eventId: event.id }) : { awards: [] };
  const awards = Array.isArray(awardsPreview) ? awardsPreview : awardsPreview?.awards || [];
  const rankingRows = Array.isArray(ranking) ? ranking : ranking?.ranking || [];
  const champion =
    awards.find((item) => item.key === AWARD_KEY.CHAMPION)?.entryName ||
    rankingRows?.[0]?.name ||
    null;
  const bracketReady = event ? canGenerateBracket(event).ok === true || Boolean(event?.bracket) : false;
  const hasBracket = Boolean(event?.bracket?.rounds?.length);
  const incompleteMatchCount = Math.max(0, matches.total - matches.completed);
  const minDrawEntries = 2;

  return {
    tournamentId: tournament?.id || "",
    tournamentName: tournament?.name || "",
    mode: tournament?.mode || "",
    officialMode: tournament?.officialMode || "",
    status: tournament?.status || TOURNAMENT_STATUS.DRAFT,
    eventId: event?.id || "",
    eventName: event?.name || "",
    competition,
    registrationMode: competition.registrationMode,
    registrationModeLabel: competition.registrationMode
      ? OFFICIAL_REGISTRATION_MODE_LABELS[competition.registrationMode]
      : "Chưa xác định chế độ đăng ký",
    registrationModeUnresolved: Boolean(competition.registrationModeUnresolved),
    registrationModeResolution: competition.registrationModeResolution,
    entries,
    matches,
    referees,
    registration: { locked },
    draw: {
      hasDraw,
      hasGroups,
      groupCount: (event?.groups || []).length || competition.groupCount || 0,
      status: draw.status,
      eligibleCount: entries.drawEligibleCount,
      minDrawEntries,
      modeUnresolved: Boolean(competition.registrationModeUnresolved),
      needsPairing:
        competition.registrationMode === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL && !hasDraw,
      canDraw:
        !competition.registrationModeUnresolved &&
        entries.drawEligibleCount >= minDrawEntries &&
        !closed,
      blockedReason:
        competition.registrationModeUnresolved
          ? "Giải cũ chưa xác định chế độ đăng ký (cá nhân/cặp). Vào Cài đặt giải để chọn rõ trước khi bốc thăm."
          : entries.drawEligibleCount < minDrawEntries
            ? `Cần ít nhất ${minDrawEntries} đơn vị đủ điều kiện (hiện ${entries.drawEligibleCount}).`
            : null,
    },
    schedule: {
      published: false,
      hasCourtLock: Boolean(tournament?.courtSchedule?.date || tournament?.courtSchedule?.courtIds?.length),
      courtCount: Array.isArray(options.courts) ? options.courts.length : 0,
    },
    bracket: { ready: bracketReady, hasBracket, champion },
    closed,
    incompleteMatchCount,
    resultsOps: getResultsOps(tournament),
  };
}

export function evaluateOfficialCloseGate(tournament, options = {}) {
  const base = canCloseTournament(tournament);
  if (!base.ok) return base;
  const facts = options.facts || buildOfficialCompetitionFacts(tournament, options);
  if (!facts.draw.hasDraw) {
    return { ok: false, error: "Chưa thể đóng giải — chưa bốc thăm." };
  }
  if (facts.matches.total === 0) {
    return { ok: false, error: "Chưa thể đóng giải — chưa có trận." };
  }
  if (facts.incompleteMatchCount > 0) {
    return {
      ok: false,
      error: `Chưa thể đóng giải — còn ${facts.incompleteMatchCount} trận chưa hoàn tất`,
    };
  }
  return { ok: true };
}

export function deriveOfficialOrganizerStages(tournament, options = {}) {
  const facts = buildOfficialCompetitionFacts(tournament, options);
  if (!tournament) {
    return {
      facts: null,
      stages: [],
      currentStageId: OFFICIAL_STAGE_ID.SETTINGS,
    };
  }

  const { entries, matches, registration, draw, bracket, closed, competition } = facts;
  const event = primaryEvent(tournament, options.eventId || facts.eventId);
  const stages = [];

  const settingsDone =
    Boolean(tournament.name) &&
    Boolean(competition.registrationMode) &&
    !competition.registrationModeUnresolved;
  stages.push({
    id: OFFICIAL_STAGE_ID.SETTINGS,
    label: "Thông tin & cài đặt giải",
    order: 1,
    kind: "settings",
    state: stageState({
      completed: settingsDone && (registration.locked || draw.hasDraw || entries.total > 0),
      current: !settingsDone,
      ready: true,
    }),
    summary: `${facts.tournamentName || "Giải Official"} · ${facts.registrationModeLabel} · ${facts.status}`,
    blocker: null,
    counts: {},
    primaryAction: { id: "edit_settings", label: "Cài đặt giải" },
  });

  stages.push({
    id: OFFICIAL_STAGE_ID.REGISTRATION,
    label: "Đăng ký vận động viên",
    order: 2,
    kind: "registration",
    state: stageState({
      completed: registration.locked || draw.hasDraw,
      current: settingsDone && !registration.locked && !draw.hasDraw && entries.pending > 0,
      ready: settingsDone && !draw.hasDraw,
      blocked: !settingsDone,
    }),
    summary:
      entries.total === 0
        ? "Chưa có VĐV đăng ký"
        : `${entries.approvedOrActive} hợp lệ · ${entries.pending} chờ · ${entries.waitlisted} chờ danh sách`,
    blocker: !settingsDone ? "Cần cài đặt giải trước." : null,
    counts: {
      approved: entries.approvedOrActive,
      pending: entries.pending,
      waitlisted: entries.waitlisted,
      total: entries.total,
    },
    primaryAction:
      entries.pending > 0
        ? { id: "approve_entries", label: "Duyệt đăng ký" }
        : { id: "open_registration", label: "Quản lý đăng ký" },
  });

  stages.push({
    id: OFFICIAL_STAGE_ID.LOCK_ENTRIES,
    label: "Chốt vận động viên",
    order: 3,
    kind: "finalize",
    state: stageState({
      completed: registration.locked || draw.hasDraw,
      current:
        settingsDone &&
        !registration.locked &&
        !draw.hasDraw &&
        entries.pending === 0 &&
        entries.drawEligibleCount >= draw.minDrawEntries,
      ready: entries.drawEligibleCount >= draw.minDrawEntries && !registration.locked && !draw.hasDraw,
      blocked: entries.drawEligibleCount < draw.minDrawEntries && !draw.hasDraw,
    }),
    summary: registration.locked || draw.hasDraw
      ? `Đã chốt · ${entries.drawEligibleCount} đơn vị đủ điều kiện`
      : `${entries.drawEligibleCount} đủ điều kiện · ${entries.pending} chưa hoàn tất`,
    blocker:
      entries.drawEligibleCount < draw.minDrawEntries
        ? draw.blockedReason
        : entries.pending > 0
          ? `Còn ${entries.pending} hồ sơ chờ duyệt.`
          : null,
    counts: { drawEligible: entries.drawEligibleCount, pending: entries.pending },
    primaryAction: {
      id: registration.locked ? "view_lock" : "lock_registration",
      label: registration.locked ? "Xem chốt VĐV" : "Chốt vận động viên",
    },
  });

  stages.push({
    id: OFFICIAL_STAGE_ID.DRAW,
    label: "Bốc thăm",
    order: 4,
    kind: "draw",
    state: stageState({
      completed: draw.hasDraw,
      current: (registration.locked || entries.drawEligibleCount >= draw.minDrawEntries) && !draw.hasDraw && draw.canDraw,
      ready: draw.canDraw && !draw.hasDraw,
      blocked: !draw.canDraw && !draw.hasDraw,
    }),
    summary: draw.hasDraw
      ? `${draw.groupCount} bảng · ${draw.status}`
      : competition.registrationModeUnresolved
        ? "Chưa xác định chế độ đăng ký"
        : competition.registrationMode === OFFICIAL_REGISTRATION_MODE.INDIVIDUAL
          ? `${entries.drawEligibleCount} VĐV → ghép cặp → chia bảng`
          : `${entries.drawEligibleCount} cặp → chia bảng`,
    blocker: draw.hasDraw ? null : draw.blockedReason,
    counts: { eligible: entries.drawEligibleCount, groups: draw.groupCount },
    primaryAction: {
      id: draw.hasDraw ? "view_draw" : "run_draw",
      label: draw.hasDraw ? "Xem kết quả bốc thăm" : "Bắt đầu bốc thăm",
    },
  });

  const groupComplete =
    matches.groupTotal > 0 && matches.groupCompleted >= matches.groupTotal;
  stages.push({
    id: OFFICIAL_STAGE_ID.GROUP_STAGE,
    label: "Lịch thi đấu vòng bảng",
    order: 5,
    kind: "group_stage",
    state: stageState({
      completed: groupComplete && draw.hasDraw,
      current: draw.hasDraw && !groupComplete,
      ready: draw.hasDraw,
      blocked: !draw.hasDraw,
    }),
    summary: !draw.hasDraw
      ? "Chưa có vòng bảng"
      : `${matches.groupCompleted}/${matches.groupTotal || matches.total} trận bảng · TT ${facts.referees.assignedCount}/${facts.referees.matchCount || 0}`,
    blocker: !draw.hasDraw ? "Cần bốc thăm trước." : null,
    counts: {
      completed: matches.groupCompleted,
      total: matches.groupTotal || matches.total,
      referees: facts.referees.assignedCount,
    },
    primaryAction: { id: "operate_group_stage", label: "Vận hành vòng bảng" },
  });

  const knockoutStages = deriveOfficialKnockoutStages(tournament, event?.id || options.eventId);
  knockoutStages.forEach((stage) => stages.push(stage));

  // If no KO yet but ready, show a locked placeholder for generate
  if (!bracket.hasBracket && draw.hasDraw) {
    stages.push({
      id: "knockout:pending",
      label: "Knockout",
      order: 90,
      kind: "knockout_pending",
      state: stageState({
        completed: false,
        current: groupComplete && bracket.ready,
        ready: bracket.ready,
        blocked: !bracket.ready,
      }),
      summary: bracket.ready ? "Sẵn sàng tạo vòng loại trực tiếp" : "Chờ đủ điều kiện từ BXH bảng",
      blocker: !bracket.ready ? "Cần hoàn tất vòng bảng đủ điều kiện." : null,
      counts: {},
      primaryAction: { id: "generate_knockout", label: "Tạo vòng loại trực tiếp" },
    });
  }

  const closeGate = evaluateOfficialCloseGate(tournament, { facts });
  stages.push({
    id: OFFICIAL_STAGE_ID.RESULTS,
    label: "Kết quả / Bảng xếp hạng",
    order: 1000,
    kind: "results",
    state: stageState({
      completed: closed,
      current: closeGate.ok && !closed,
      ready: matches.completed > 0,
      blocked: matches.completed === 0,
    }),
    summary: closed
      ? bracket.champion
        ? `Đã đóng · Vô địch: ${bracket.champion}`
        : "Giải đã đóng"
      : matches.completed > 0
        ? `Đã có ${matches.completed} kết quả`
        : "Chưa có kết quả",
    blocker: closed ? null : closeGate.ok ? null : closeGate.error,
    counts: { incomplete: facts.incompleteMatchCount },
    primaryAction: {
      id: closed ? "view_results" : closeGate.ok ? "close_tournament" : "view_results",
      label: closed ? "Xem kết quả" : closeGate.ok ? "Đóng giải" : "Xem BXH",
    },
  });

  const current =
    stages.find((stage) => stage.state === OFFICIAL_STAGE_STATE.CURRENT) ||
    stages.find((stage) => stage.state === OFFICIAL_STAGE_STATE.READY) ||
    stages[0];

  return {
    facts,
    stages,
    currentStageId: current?.id || OFFICIAL_STAGE_ID.SETTINGS,
  };
}

export function deriveOfficialNextAction(tournament, options = {}) {
  const { stages, facts, currentStageId } = deriveOfficialOrganizerStages(tournament, options);
  const current = stages.find((stage) => stage.id === currentStageId) || stages[0];
  const blocker =
    stages.find((stage) => stage.state === OFFICIAL_STAGE_STATE.BLOCKED && stage.blocker)?.blocker ||
    current?.blocker ||
    null;
  const action = current?.primaryAction || { id: "edit_settings", label: "Cài đặt giải" };
  return {
    stageId: current?.id || OFFICIAL_STAGE_ID.SETTINGS,
    label: action.label,
    actionId: action.id,
    blocker,
    summary: current?.summary || "",
    facts,
    stages,
  };
}

export function filterOfficialDrawEntries(entries, tournament) {
  return filterDrawEligibleEntries(entries, tournament);
}

export function buildOfficialDrawBlockMessage(entries, tournament, minEntries = 2) {
  if (!isOfficialRegistrationModeResolved(tournament)) {
    return {
      ok: false,
      error:
        "Giải cũ chưa xác định chế độ đăng ký (cá nhân/cặp). Vào Cài đặt giải để chọn rõ trước khi bốc thăm.",
      eligible: [],
      eligibleCount: 0,
      total: (entries || []).length,
      modeUnresolved: true,
    };
  }
  const all = entries || [];
  const eligible = filterOfficialDrawEntries(all, tournament);
  const pending = all.filter((e) => String(e.status).toLowerCase() === ENTRY_STATUS.PENDING).length;
  const rejected = all.filter((e) => String(e.status).toLowerCase() === ENTRY_STATUS.REJECTED).length;
  const waitlisted = all.filter((e) => String(e.status).toLowerCase() === ENTRY_STATUS.WAITLISTED).length;
  const withdrawn = all.filter((e) =>
    [ENTRY_STATUS.WITHDRAWN, ENTRY_STATUS.CANCELLED].includes(String(e.status).toLowerCase())
  ).length;

  if (eligible.length >= minEntries) {
    return { ok: true, eligible, eligibleCount: eligible.length, total: all.length };
  }

  const parts = [
    `Cần ít nhất ${minEntries} đơn vị đủ điều kiện (approved/active). Hiện: ${eligible.length}/${all.length}.`,
  ];
  if (pending) parts.push(`${pending} chờ duyệt`);
  if (waitlisted) parts.push(`${waitlisted} danh sách chờ`);
  if (rejected) parts.push(`${rejected} từ chối`);
  if (withdrawn) parts.push(`${withdrawn} rút/huỷ`);

  return {
    ok: false,
    error: parts.join(" · "),
    eligible,
    eligibleCount: eligible.length,
    total: all.length,
    pending,
    waitlisted,
    rejected,
    withdrawn,
  };
}
