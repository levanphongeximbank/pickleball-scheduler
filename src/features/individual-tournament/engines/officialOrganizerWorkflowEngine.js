/**
 * Official Organizer Control Center — thin projection over canonical tournament state.
 * UI workflow stages only; does NOT persist a separate lifecycle taxonomy.
 */

import { ENTRY_STATUS, TOURNAMENT_STATUS } from "../../../models/tournament/constants.js";
import { isDrawEligibleEntry } from "../../../models/tournament/entry.js";
import { getRegistrationSettings, isRegistrationLocked } from "./registrationEngine.js";
import { filterDrawEligibleEntries } from "./withdrawalEngine.js";
import { getRefereeAssignments, collectEventMatches, listIndividualReferees } from "./refereeAssignEngine.js";
import { getDrawPublishStatus, DRAW_PUBLISH_STATUS } from "../../../tournament/engines/publishDrawEngine.js";
import { getSchedulePublishStatus } from "../../../tournament/engines/publishScheduleEngine.js";
import { canCloseTournament, isTournamentClosed } from "./tournamentClosingEngine.js";
import { getResultsOps } from "./walkoverEngine.js";
import { buildFinalRanking, buildAwardsPreview, AWARD_KEY } from "./awardsEngine.js";
import { canGenerateBracket } from "../../../tournament/engines/bracketEngine.js";

export const OFFICIAL_STAGE_ID = Object.freeze({
  INFO: "info",
  REGISTRATION: "registration",
  LOCK_ENTRIES: "lock_entries",
  DRAW: "draw",
  SCHEDULE: "schedule",
  REFEREE: "referee",
  SCORING: "scoring",
  RESULTS: "results",
  KNOCKOUT: "knockout",
  CLOSE: "close",
});

export const OFFICIAL_STAGE_STATE = Object.freeze({
  COMPLETED: "COMPLETED",
  CURRENT: "CURRENT",
  READY: "READY",
  BLOCKED: "BLOCKED",
  PENDING: "PENDING",
});

export const OFFICIAL_STAGE_DEFS = Object.freeze([
  { id: OFFICIAL_STAGE_ID.INFO, label: "Thông tin giải", order: 1 },
  { id: OFFICIAL_STAGE_ID.REGISTRATION, label: "Đăng ký", order: 2 },
  { id: OFFICIAL_STAGE_ID.LOCK_ENTRIES, label: "Chốt VĐV", order: 3 },
  { id: OFFICIAL_STAGE_ID.DRAW, label: "Bốc thăm", order: 4 },
  { id: OFFICIAL_STAGE_ID.SCHEDULE, label: "Lịch & sân", order: 5 },
  { id: OFFICIAL_STAGE_ID.REFEREE, label: "Trọng tài", order: 6 },
  { id: OFFICIAL_STAGE_ID.SCORING, label: "Thi đấu & chấm điểm", order: 7 },
  { id: OFFICIAL_STAGE_ID.RESULTS, label: "Kết quả & BXH", order: 8 },
  { id: OFFICIAL_STAGE_ID.KNOCKOUT, label: "Knockout / Chung kết", order: 9 },
  { id: OFFICIAL_STAGE_ID.CLOSE, label: "Vô địch & đóng giải", order: 10 },
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
      status !== "ready")
  );
}

function isMatchLive(match) {
  if (!match || isMatchComplete(match)) return false;
  const status = String(match.status || "").toLowerCase();
  return status === "playing" || status === "in_progress" || status === "live";
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

export function summarizeOfficialMatches(tournament, eventId = "") {
  const matches = collectEventMatches(tournament, eventId);
  const groupMatches = matches.filter(
    (match) => !match.bracketRound && String(match.stage || match.roundType || "").toLowerCase() !== "knockout"
  );
  const knockoutMatches = matches.filter(
    (match) =>
      Boolean(match.bracketRound) ||
      String(match.stage || "").toLowerCase().includes("knock") ||
      String(match.roundName || "").toLowerCase().includes("final")
  );

  const all = matches.length ? matches : groupMatches;
  const completed = all.filter(isMatchComplete);
  const live = all.filter(isMatchLive);
  const waiting = all.filter((match) => !isMatchComplete(match) && !isMatchLive(match));

  return {
    total: all.length,
    completed: completed.length,
    live: live.length,
    waiting: waiting.length,
    groupTotal: groupMatches.length || all.length,
    groupCompleted: (groupMatches.length ? groupMatches : all).filter(isMatchComplete).length,
    knockoutTotal: knockoutMatches.length,
    knockoutCompleted: knockoutMatches.filter(isMatchComplete).length,
    matches: all,
    completedMatches: completed,
    liveMatches: live,
    waitingMatches: waiting,
  };
}

export function summarizeOfficialRefereeOps(tournament, eventId = "") {
  const matches = collectEventMatches(tournament, eventId);
  const assignments = getRefereeAssignments(tournament);
  const roster = listIndividualReferees(tournament);
  let assigned = 0;
  matches.forEach((match) => {
    const fromMap = assignments[String(match.id)];
    const hasToken = Boolean(match?.referee?.token);
    if ((fromMap && fromMap.status !== "revoked") || hasToken) {
      assigned += 1;
    }
  });
  return {
    rosterCount: roster.length,
    matchCount: matches.length,
    assignedCount: assigned,
    unassignedCount: Math.max(0, matches.length - assigned),
    coverage:
      matches.length === 0 ? null : `${assigned}/${matches.length} trận đã có trọng tài`,
  };
}

export function buildOfficialCompetitionFacts(tournament, options = {}) {
  const eventId = options.eventId || "";
  const event = primaryEvent(tournament, eventId);
  const entries = summarizeOfficialEntries(tournament, event?.id || eventId);
  const matches = summarizeOfficialMatches(tournament, event?.id || eventId);
  const referees = summarizeOfficialRefereeOps(tournament, event?.id || eventId);
  const reg = getRegistrationSettings(tournament);
  const locked = isRegistrationLocked(tournament);
  const draw = getDrawPublishStatus(tournament);
  const schedule = getSchedulePublishStatus(tournament);
  const hasGroups = (event?.groups || []).length > 0;
  const hasDraw =
    hasGroups ||
    draw.status === DRAW_PUBLISH_STATUS.LOCKED ||
    draw.status === DRAW_PUBLISH_STATUS.PUBLISHED;
  const courtSchedule = tournament?.courtSchedule || null;
  const hasCourtLock = Boolean(courtSchedule?.date || courtSchedule?.locked || courtSchedule?.courtIds?.length);
  const schedulePublished = Boolean(schedule?.published || schedule?.status === "published");
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
  const hasBracket = Boolean(event?.bracket?.rounds?.length || event?.bracket?.matches?.length);
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
    entries,
    matches,
    referees,
    registration: {
      locked,
      open: Boolean(reg?.opensAt || reg?.open) && !locked,
      opensAt: reg?.opensAt || null,
      closesAt: reg?.closesAt || null,
      maxEntries: reg?.maxEntries ?? null,
    },
    draw: {
      hasDraw,
      hasGroups,
      groupCount: (event?.groups || []).length,
      status: draw.status,
      eligibleCount: entries.drawEligibleCount,
      minDrawEntries,
      canDraw: entries.drawEligibleCount >= minDrawEntries && !closed,
      blockedReason:
        entries.drawEligibleCount < minDrawEntries
          ? `Cần ít nhất ${minDrawEntries} VĐV/cặp đủ điều kiện bốc thăm (hiện ${entries.drawEligibleCount}).`
          : null,
    },
    schedule: {
      published: schedulePublished,
      hasCourtLock,
      courtCount: Array.isArray(courtSchedule?.courtIds)
        ? courtSchedule.courtIds.length
        : Array.isArray(options.courts)
          ? options.courts.length
          : 0,
    },
    bracket: {
      ready: bracketReady,
      hasBracket,
      champion,
    },
    closed,
    incompleteMatchCount,
    resultsOps: getResultsOps(tournament),
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
 * Derive organizer workflow stages from canonical tournament facts.
 */
export function deriveOfficialOrganizerStages(tournament, options = {}) {
  const facts = buildOfficialCompetitionFacts(tournament, options);
  if (!tournament) {
    return {
      facts: null,
      stages: OFFICIAL_STAGE_DEFS.map((def) => ({
        ...def,
        state: OFFICIAL_STAGE_STATE.BLOCKED,
        summary: "Chưa tải giải.",
        blocker: "Thiếu giải.",
        counts: {},
        primaryAction: null,
      })),
      currentStageId: OFFICIAL_STAGE_ID.INFO,
    };
  }

  const { entries, matches, referees, registration, draw, schedule, bracket, closed } = facts;

  const infoCompleted =
    Boolean(tournament.name) && Boolean(tournament.officialMode || tournament.settings);
  const registrationCompleted =
    registration.locked ||
    entries.approvedOrActive > 0 ||
    tournament.status === TOURNAMENT_STATUS.READY ||
    tournament.status === TOURNAMENT_STATUS.ACTIVE ||
    draw.hasDraw;
  const lockCompleted = registration.locked || draw.hasDraw || closed;
  const drawCompleted = draw.hasDraw;
  const scheduleCompleted = schedule.published || schedule.hasCourtLock || (matches.total > 0 && drawCompleted);
  const refereeCompleted =
    matches.total === 0 ? false : referees.assignedCount >= matches.total && matches.total > 0;
  const scoringCompleted = matches.total > 0 && matches.completed >= matches.total;
  const scoringActive = matches.total > 0 && matches.completed < matches.total;
  const resultsCompleted = matches.groupCompleted > 0 || matches.completed > 0;
  const knockoutCompleted =
    (bracket.hasBracket && matches.knockoutTotal > 0 && matches.knockoutCompleted >= matches.knockoutTotal) ||
    Boolean(bracket.champion && scoringCompleted);
  const closeCompleted = closed;

  const stages = [];

  const push = (id, payload) => {
    const def = OFFICIAL_STAGE_DEFS.find((item) => item.id === id);
    stages.push({
      id,
      label: def?.label || id,
      order: def?.order || stages.length + 1,
      ...payload,
    });
  };

  push(OFFICIAL_STAGE_ID.INFO, {
    state: stageState({
      completed: infoCompleted && registrationCompleted,
      current: !infoCompleted,
      ready: true,
    }),
    summary: `${facts.tournamentName || "Giải Official"} · ${facts.officialMode || "—"} · ${facts.status}`,
    blocker: null,
    counts: { events: (tournament.events || []).length },
    primaryAction: { id: "edit_info", label: "Cập nhật thông tin giải" },
  });

  push(OFFICIAL_STAGE_ID.REGISTRATION, {
    state: stageState({
      completed: lockCompleted || (registrationCompleted && entries.pending === 0 && drawCompleted),
      current: infoCompleted && !lockCompleted && !drawCompleted && entries.pending > 0,
      ready: infoCompleted && !drawCompleted,
      blocked: !infoCompleted,
      pending: !infoCompleted,
    }),
    summary:
      entries.total === 0
        ? "Chưa có VĐV đăng ký"
        : `${entries.approvedOrActive} đã duyệt · ${entries.pending} chờ duyệt · ${entries.waitlisted} danh sách chờ`,
    blocker: !infoCompleted ? "Cần thiết lập thông tin giải trước." : null,
    counts: {
      approved: entries.approvedOrActive,
      pending: entries.pending,
      waitlisted: entries.waitlisted,
      total: entries.total,
    },
    primaryAction:
      entries.pending > 0
        ? { id: "approve_entries", label: "Duyệt VĐV" }
        : registration.locked
          ? { id: "view_registration", label: "Xem đăng ký" }
          : { id: "open_registration", label: "Quản lý đăng ký" },
  });

  push(OFFICIAL_STAGE_ID.LOCK_ENTRIES, {
    state: stageState({
      completed: lockCompleted,
      current:
        infoCompleted &&
        !lockCompleted &&
        entries.pending === 0 &&
        entries.drawEligibleCount >= draw.minDrawEntries,
      ready: entries.drawEligibleCount >= draw.minDrawEntries && !lockCompleted,
      blocked: entries.drawEligibleCount < draw.minDrawEntries,
    }),
    summary: lockCompleted
      ? `Đã chốt · ${entries.drawEligibleCount} VĐV đủ điều kiện`
      : `${entries.drawEligibleCount}/${Math.max(entries.total, entries.drawEligibleCount)} VĐV đủ điều kiện`,
    blocker:
      entries.drawEligibleCount < draw.minDrawEntries
        ? draw.blockedReason
        : entries.pending > 0
          ? `Còn ${entries.pending} hồ sơ chờ duyệt.`
          : null,
    counts: { drawEligible: entries.drawEligibleCount, pending: entries.pending },
    primaryAction: lockCompleted
      ? { id: "view_lock", label: "Xem chốt đăng ký" }
      : { id: "lock_registration", label: "Chốt đăng ký" },
  });

  push(OFFICIAL_STAGE_ID.DRAW, {
    state: stageState({
      completed: drawCompleted,
      current: lockCompleted && !drawCompleted && draw.canDraw,
      ready: draw.canDraw && !drawCompleted,
      blocked: !draw.canDraw && !drawCompleted,
    }),
    summary: drawCompleted
      ? `${draw.groupCount} bảng · draw ${draw.status}`
      : draw.canDraw
        ? `${entries.drawEligibleCount}/${entries.drawEligibleCount} VĐV đủ điều kiện — Sẵn sàng bốc thăm`
        : draw.blockedReason || "Chưa sẵn sàng bốc thăm",
    blocker: drawCompleted ? null : draw.blockedReason,
    counts: { eligible: entries.drawEligibleCount, groups: draw.groupCount },
    primaryAction: drawCompleted
      ? { id: "view_draw", label: "Xem bảng đấu" }
      : { id: "run_draw", label: "Bốc thăm" },
  });

  push(OFFICIAL_STAGE_ID.SCHEDULE, {
    state: stageState({
      completed: scheduleCompleted && drawCompleted,
      current: drawCompleted && !scheduleCompleted,
      ready: drawCompleted,
      blocked: !drawCompleted,
      pending: !drawCompleted,
    }),
    summary: !drawCompleted
      ? "Chưa tạo lịch thi đấu"
      : schedule.published || schedule.hasCourtLock
        ? `Lịch ${schedule.published ? "đã công bố" : "đã khóa sân"} · ${matches.total} trận`
        : `${matches.total} trận đã sinh · chưa công bố lịch`,
    blocker: !drawCompleted ? "Cần bốc thăm trước khi xếp lịch." : null,
    counts: { matches: matches.total, courts: schedule.courtCount },
    primaryAction: {
      id: "open_schedule",
      label: schedule.published ? "Xem lịch & sân" : "Xếp lịch",
    },
  });

  push(OFFICIAL_STAGE_ID.REFEREE, {
    state: stageState({
      completed: refereeCompleted,
      current: drawCompleted && matches.total > 0 && referees.unassignedCount > 0,
      ready: drawCompleted && matches.total > 0,
      blocked: !drawCompleted || matches.total === 0,
    }),
    summary:
      matches.total === 0
        ? "Chưa có trận để phân công trọng tài"
        : referees.rosterCount === 0
          ? "Chưa có trọng tài trong danh sách"
          : referees.coverage,
    blocker:
      !drawCompleted
        ? "Cần bốc thăm trước."
        : referees.rosterCount === 0
          ? "Thêm trọng tài vào danh sách trước."
          : referees.unassignedCount > 0
            ? `Còn ${referees.unassignedCount} trận chưa có trọng tài.`
            : null,
    counts: {
      assigned: referees.assignedCount,
      total: referees.matchCount,
      roster: referees.rosterCount,
    },
    primaryAction: { id: "assign_referees", label: "Phân công trọng tài" },
  });

  push(OFFICIAL_STAGE_ID.SCORING, {
    state: stageState({
      completed: scoringCompleted,
      current: scoringActive,
      ready: matches.total > 0 && !scoringCompleted,
      blocked: matches.total === 0,
    }),
    summary:
      matches.total === 0
        ? "Chưa có trận sẵn sàng chấm điểm"
        : scoringCompleted
          ? "Tất cả trận đã hoàn tất"
          : `${matches.live} đang thi đấu · ${matches.waiting} chờ · ${matches.completed} hoàn tất`,
    blocker: matches.total === 0 ? "Cần bốc thăm / sinh trận trước." : null,
    counts: {
      live: matches.live,
      waiting: matches.waiting,
      completed: matches.completed,
      total: matches.total,
    },
    primaryAction: scoringCompleted
      ? { id: "view_scoring", label: "Xem kết quả trận" }
      : { id: "enter_scores", label: "Nhập kết quả" },
  });

  push(OFFICIAL_STAGE_ID.RESULTS, {
    state: stageState({
      completed: resultsCompleted && (bracket.hasBracket || !bracket.ready),
      current: resultsCompleted && !bracket.hasBracket && bracket.ready,
      ready: resultsCompleted,
      blocked: !resultsCompleted,
      pending: !resultsCompleted,
    }),
    summary: resultsCompleted
      ? `BXH vòng bảng đã có · ${matches.groupCompleted}/${matches.groupTotal || matches.total} trận bảng`
      : "Chưa có kết quả để xếp hạng",
    blocker: !resultsCompleted ? "Cần hoàn tất ít nhất một trận." : null,
    counts: { completed: matches.completed },
    primaryAction: { id: "view_standings", label: "Xem BXH" },
  });

  push(OFFICIAL_STAGE_ID.KNOCKOUT, {
    state: stageState({
      completed: knockoutCompleted,
      current: (bracket.hasBracket || bracket.ready) && !knockoutCompleted && resultsCompleted,
      ready: bracket.ready || bracket.hasBracket,
      blocked: !bracket.ready && !bracket.hasBracket,
    }),
    summary: bracket.hasBracket
      ? bracket.champion
        ? `Vô địch: ${bracket.champion}`
        : `Bracket KO · ${matches.knockoutCompleted}/${matches.knockoutTotal || "?"} trận`
      : bracket.ready
        ? "Sẵn sàng tạo vòng loại trực tiếp"
        : "Chưa đủ điều kiện tạo knockout",
    blocker:
      !bracket.ready && !bracket.hasBracket
        ? "Cần hoàn tất vòng bảng đủ điều kiện."
        : null,
    counts: {
      knockoutCompleted: matches.knockoutCompleted,
      knockoutTotal: matches.knockoutTotal,
    },
    primaryAction: bracket.hasBracket
      ? { id: "view_knockout", label: "Xem knockout" }
      : { id: "generate_knockout", label: "Tạo vòng loại trực tiếp" },
  });

  const closeGate = evaluateOfficialCloseGate(tournament, { facts });
  push(OFFICIAL_STAGE_ID.CLOSE, {
    state: stageState({
      completed: closeCompleted,
      current: closeGate.ok && !closeCompleted,
      ready: closeGate.ok && !closeCompleted,
      blocked: !closeGate.ok && !closeCompleted,
    }),
    summary: closeCompleted
      ? bracket.champion
        ? `Đã đóng · Vô địch: ${bracket.champion}`
        : "Giải đã đóng"
      : closeGate.ok
        ? "Sẵn sàng đóng giải"
        : closeGate.error,
    blocker: closeCompleted ? null : closeGate.ok ? null : closeGate.error,
    counts: { incomplete: facts.incompleteMatchCount },
    primaryAction: closeCompleted
      ? { id: "view_close", label: "Xem tóm tắt đóng giải" }
      : { id: "close_tournament", label: "Đóng giải" },
  });

  const current =
    stages.find((stage) => stage.state === OFFICIAL_STAGE_STATE.CURRENT) ||
    stages.find((stage) => stage.state === OFFICIAL_STAGE_STATE.READY) ||
    stages.find((stage) => stage.state === OFFICIAL_STAGE_STATE.BLOCKED) ||
    stages[0];

  return {
    facts,
    stages,
    currentStageId: current?.id || OFFICIAL_STAGE_ID.INFO,
  };
}

export function evaluateOfficialCloseGate(tournament, options = {}) {
  const base = canCloseTournament(tournament);
  if (!base.ok) return base;
  const facts = options.facts || buildOfficialCompetitionFacts(tournament, options);
  if (!facts.draw.hasDraw) {
    return { ok: false, error: "Chưa thể đóng giải — chưa bốc thăm / chưa có bảng đấu." };
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

export function deriveOfficialNextAction(tournament, options = {}) {
  const { stages, facts, currentStageId } = deriveOfficialOrganizerStages(tournament, options);
  const current = stages.find((stage) => stage.id === currentStageId) || stages[0];
  const blocker =
    stages.find((stage) => stage.state === OFFICIAL_STAGE_STATE.BLOCKED && stage.blocker)?.blocker ||
    current?.blocker ||
    null;

  const action = current?.primaryAction || { id: "view_info", label: "Xem thông tin giải" };

  return {
    stageId: current?.id || OFFICIAL_STAGE_ID.INFO,
    label: action.label,
    actionId: action.id,
    blocker,
    summary: current?.summary || "",
    facts,
    stages,
  };
}

export function filterOfficialDrawEntries(entries, tournament) {
  return filterDrawEligibleEntries(entries, tournament).filter(isDrawEligibleEntry);
}

export function buildOfficialDrawBlockMessage(entries, tournament, minEntries = 2) {
  const all = entries || [];
  const eligible = filterOfficialDrawEntries(all, tournament);
  const pending = all.filter((e) => String(e.status).toLowerCase() === ENTRY_STATUS.PENDING).length;
  const rejected = all.filter((e) => String(e.status).toLowerCase() === ENTRY_STATUS.REJECTED).length;
  const waitlisted = all.filter((e) => String(e.status).toLowerCase() === ENTRY_STATUS.WAITLISTED).length;
  const withdrawn = all.filter(
    (e) =>
      String(e.status).toLowerCase() === ENTRY_STATUS.WITHDRAWN ||
      String(e.status).toLowerCase() === ENTRY_STATUS.CANCELLED
  ).length;

  if (eligible.length >= minEntries) {
    return { ok: true, eligible, eligibleCount: eligible.length, total: all.length };
  }

  const parts = [
    `Cần ít nhất ${minEntries} VĐV/cặp đủ điều kiện (approved/active). Hiện đủ điều kiện: ${eligible.length}/${all.length}.`,
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
