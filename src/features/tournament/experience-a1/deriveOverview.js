import {
  EVENT_TYPE_LABELS,
  MATCH_STAGE,
  MATCH_STATUS,
  TOURNAMENT_MODE,
  TOURNAMENT_STATUS,
} from "../../../models/tournament/constants.js";
import { modeLabelVi, statusLabelVi } from "../constants/tournamentLabels.js";

export const RECORD_AUTHORITY_NOTE =
  "Trạng thái đọc từ hồ sơ giải đã lưu. Không phải khóa máy chủ riêng.";

function readStatus(block) {
  if (!block || typeof block !== "object") return null;
  return block.status || null;
}

export function listTournamentEvents(tournament) {
  return Array.isArray(tournament?.events) ? tournament.events : [];
}

/**
 * Resolve an event by explicit id. If no id is given and exactly one event exists,
 * that single event is used. Never silently picks the first of many.
 */
export function resolveSelectedEvent(events, selectedEventId) {
  const list = Array.isArray(events) ? events : [];
  const wanted = String(selectedEventId || "").trim();
  if (wanted) {
    return list.find((event) => String(event.id) === wanted) || null;
  }
  if (list.length === 1) {
    return list[0];
  }
  return null;
}

export function isOfficialOpenFamily(tournament) {
  return tournament?.mode === TOURNAMENT_MODE.OFFICIAL_TOURNAMENT;
}

export function isInternalCompatibilityFamily(tournament) {
  return tournament?.mode === TOURNAMENT_MODE.INTERNAL_TOURNAMENT;
}

function countEntries(event) {
  return Array.isArray(event?.entries) ? event.entries.length : 0;
}

function countMatches(event) {
  return Array.isArray(event?.matches) ? event.matches.length : 0;
}

function countCompletedMatches(event) {
  return (Array.isArray(event?.matches) ? event.matches : []).filter(
    (match) => match?.status === MATCH_STATUS.COMPLETED
  ).length;
}

export function mapEventSummary(event) {
  if (!event) return null;
  return {
    id: String(event.id),
    name: String(event.name || EVENT_TYPE_LABELS[event.eventType] || "Nội dung"),
    eventType: event.eventType || "",
    eventTypeLabel: EVENT_TYPE_LABELS[event.eventType] || event.eventType || "Nội dung",
    status: event.status || "",
    entryCount: countEntries(event),
    matchCount: countMatches(event),
    completedMatchCount: countCompletedMatches(event),
  };
}

function formatDateTime(value) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return String(value);
  return new Date(parsed).toLocaleString("vi-VN");
}

export function deriveOverviewModel(tournament, { clubName } = {}) {
  const events = listTournamentEvents(tournament).map(mapEventSummary).filter(Boolean);
  const courtIds = Array.isArray(tournament?.courtSchedule?.physicalCourtIds)
    ? tournament.courtSchedule.physicalCourtIds
    : Array.isArray(tournament?.courtSchedule?.courtIds)
      ? tournament.courtSchedule.courtIds
      : [];
  const registration =
    tournament?.settings?.registration && typeof tournament.settings.registration === "object"
      ? tournament.settings.registration
      : {};
  const drawStatus = readStatus(tournament?.settings?.draw);
  const scheduleStatus = readStatus(tournament?.settings?.schedule);
  const venueLabel = String(tournament?.hostClubName || clubName || "").trim() || null;
  const clusterId = tournament?.courtSchedule?.clusterId || null;
  const scheduleDate = tournament?.courtSchedule?.date || null;

  return {
    id: tournament?.id ? String(tournament.id) : "",
    name: String(tournament?.name || "Giải đấu"),
    mode: tournament?.mode || "",
    modeLabel: modeLabelVi(tournament?.mode),
    officialMode: tournament?.officialMode || null,
    status: tournament?.status || "",
    statusLabel: statusLabelVi(tournament?.status),
    hostClubName: tournament?.hostClubName || "",
    clubName: clubName || "",
    events,
    eventCount: events.length,
    kpis: {
      eventCount: events.length,
      entryCount: events.reduce((sum, event) => sum + event.entryCount, 0),
      matchCount: events.reduce((sum, event) => sum + event.matchCount, 0),
      completedMatchCount: events.reduce((sum, event) => sum + event.completedMatchCount, 0),
      courtCount: courtIds.length,
      courtConfigured: courtIds.length > 0,
    },
    venue: {
      label: venueLabel,
      clusterId,
      configured: Boolean(venueLabel || clusterId || courtIds.length),
    },
    dates: {
      createdAt: formatDateTime(tournament?.createdAt),
      updatedAt: formatDateTime(tournament?.updatedAt),
      registrationOpensAt: formatDateTime(registration.opensAt),
      registrationClosesAt: formatDateTime(registration.closesAt),
      scheduleDate,
      hasScheduleDate: Boolean(scheduleDate),
    },
    recordState: {
      note: RECORD_AUTHORITY_NOTE,
      registrationLockedAt: registration.lockedAt || null,
      registrationClosedAt: registration.closedAt || null,
      drawStatus,
      scheduleStatus,
    },
    compatibility: {
      internalSingleContent: isInternalCompatibilityFamily(tournament),
      officialMultiContent: isOfficialOpenFamily(tournament),
    },
  };
}

export const MULTI_CONTENT_LIMITATION_INTERNAL =
  "Giải nội bộ hiện là chế độ tương thích một nội dung. Không mở thành nhiều nội dung trên màn này.";

const EVENT_ACCENT = ["blue", "purple", "pink", "orange", "green"];

const MATCH_STAGE_LABELS_VI = Object.freeze({
  [MATCH_STAGE.GROUP]: "Vòng bảng",
  [MATCH_STAGE.ROUND_OF_16]: "Vòng 16",
  [MATCH_STAGE.QUARTERFINAL]: "Tứ kết",
  [MATCH_STAGE.SEMIFINAL]: "Bán kết",
  [MATCH_STAGE.FINAL]: "Chung kết",
  [MATCH_STAGE.THIRD_PLACE]: "Hạng ba",
});

const RECORD_STATUS_LABELS_VI = Object.freeze({
  draft: "Nháp",
  ready: "Sẵn sàng",
  published: "Đã công bố",
  locked: "Đã đóng",
  closed: "Đã đóng",
  open: "Đang mở",
  completed: "Hoàn tất",
  active: "Đang diễn ra",
});

const EVENT_STATUS_DISPLAY = Object.freeze({
  draft: { label: "Nháp", tone: "draft" },
  ready: { label: "Sắp bắt đầu", tone: "info" },
  registration: { label: "Đang đăng ký", tone: "info" },
  soon: { label: "Sắp bắt đầu", tone: "info" },
  active: { label: "Đang diễn ra", tone: "success" },
  ongoing: { label: "Đang diễn ra", tone: "success" },
  playing: { label: "Đang diễn ra", tone: "success" },
  completed: { label: "Hoàn thành", tone: "success" },
  cancelled: { label: "Đã hủy", tone: "danger" },
});

const TOURNAMENT_HERO_STATUS = Object.freeze({
  [TOURNAMENT_STATUS.DRAFT]: { label: "BẢN NHÁP", tone: "draft" },
  [TOURNAMENT_STATUS.REGISTRATION]: { label: "ĐANG ĐĂNG KÝ", tone: "info" },
  [TOURNAMENT_STATUS.READY]: { label: "SẴN SÀNG", tone: "info" },
  [TOURNAMENT_STATUS.ACTIVE]: { label: "ĐANG DIỄN RA", tone: "success" },
  [TOURNAMENT_STATUS.COMPLETED]: { label: "ĐÃ KẾT THÚC", tone: "success" },
  [TOURNAMENT_STATUS.CANCELLED]: { label: "ĐÃ HỦY", tone: "danger" },
});

function recordStatusLabel(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!key) return "Chưa có";
  return RECORD_STATUS_LABELS_VI[key] || "Đã ghi trên hồ sơ";
}

function eventStatusDisplay(status) {
  const key = String(status || "").trim().toLowerCase();
  return EVENT_STATUS_DISPLAY[key] || { label: "Chưa cấu hình", tone: "draft" };
}

function matchStageLabel(stage) {
  return MATCH_STAGE_LABELS_VI[stage] || "Giai đoạn thi đấu";
}

function formatScore(match) {
  if (match?.scoreA == null && match?.scoreB == null) return "Chưa có tỷ số";
  return `${match.scoreA ?? "—"}–${match.scoreB ?? "—"}`;
}

function findEntryName(event, entryId) {
  const wanted = String(entryId || "").trim();
  if (!wanted) return "Chưa xác định";
  const entry = (Array.isArray(event?.entries) ? event.entries : []).find(
    (item) => String(item.id) === wanted
  );
  return String(entry?.name || "").trim() || "Chưa xác định";
}

function countAthletes(events) {
  const ids = new Set();
  let named = 0;
  for (const event of Array.isArray(events) ? events : []) {
    for (const entry of Array.isArray(event?.entries) ? event.entries : []) {
      const playerIds = Array.isArray(entry.playerIds) ? entry.playerIds.filter(Boolean) : [];
      if (playerIds.length) {
        playerIds.forEach((id) => ids.add(String(id)));
      } else if (entry.id) {
        named += 1;
      }
    }
  }
  return ids.size || named;
}

function collectMatches(tournament) {
  const rows = [];
  for (const event of listTournamentEvents(tournament)) {
    for (const match of Array.isArray(event?.matches) ? event.matches : []) {
      rows.push({ event, match });
    }
  }
  return rows;
}

function deriveLifecycle(tournament, model) {
  const status = tournament?.status;
  const registrationClosed = Boolean(
    model.recordState.registrationLockedAt || model.recordState.registrationClosedAt
  );
  const configDone = status && status !== TOURNAMENT_STATUS.DRAFT;
  const competeDone = status === TOURNAMENT_STATUS.COMPLETED;
  const competeCurrent = status === TOURNAMENT_STATUS.ACTIVE;
  const registrationCurrent = status === TOURNAMENT_STATUS.REGISTRATION && !registrationClosed;
  const registrationDone =
    registrationClosed ||
    status === TOURNAMENT_STATUS.READY ||
    status === TOURNAMENT_STATUS.ACTIVE ||
    status === TOURNAMENT_STATUS.COMPLETED;
  const drawLabel = recordStatusLabel(model.recordState.drawStatus);
  const drawDone = Boolean(model.recordState.drawStatus) && drawLabel !== "Nháp";
  const drawCurrent = Boolean(model.recordState.drawStatus) && !drawDone && !competeCurrent;

  return [
    {
      id: "config",
      label: "Cấu hình",
      state: configDone ? "done" : "current",
      meta: configDone ? "Đã lưu" : "Chưa hoàn tất",
    },
    {
      id: "registration",
      label: "Đăng ký",
      state: registrationDone && !registrationCurrent ? "done" : registrationCurrent ? "current" : "pending",
      meta: registrationClosed ? "Đã đóng" : registrationCurrent ? "Đang mở" : "Chưa mở",
    },
    {
      id: "draw",
      label: "Bốc thăm",
      state: drawDone ? "done" : drawCurrent ? "current" : "pending",
      meta: model.recordState.drawStatus ? drawLabel : "Chưa có",
    },
    {
      id: "compete",
      label: "Thi đấu",
      state: competeDone ? "done" : competeCurrent ? "current" : "pending",
      meta: competeDone ? "Đã xong" : competeCurrent ? "Đang diễn ra" : "Chưa mở",
    },
    {
      id: "results",
      label: "Kết quả",
      state: competeDone ? "done" : "pending",
      meta: competeDone ? "Đã có" : "Chưa mở",
    },
  ];
}

function deriveAttention(tournament, model) {
  const items = [];
  for (const event of model.events) {
    if (event.entryCount === 0) {
      items.push({ label: `${event.name} chưa có đăng ký`, tone: "warning" });
    }
  }
  const postponed = collectMatches(tournament).filter((row) => row.match?.status === MATCH_STATUS.POSTPONED);
  if (postponed.length) {
    items.push({
      label: `${postponed.length} trận hoãn / chưa thi đấu đúng giờ`,
      tone: "danger",
    });
  }
  const playingNoCourt = collectMatches(tournament).filter(
    (row) => row.match?.status === MATCH_STATUS.PLAYING && row.match?.courtId == null
  );
  if (playingNoCourt.length) {
    items.push({
      label: `${playingNoCourt.length} trận đang thi đấu chưa gán sân`,
      tone: "warning",
    });
  }
  return items;
}

function deriveLiveMatches(tournament) {
  return collectMatches(tournament)
    .filter((row) => row.match?.status === MATCH_STATUS.PLAYING)
    .map((row) => ({
      id: String(row.match.id),
      event: String(row.event?.name || EVENT_TYPE_LABELS[row.event?.eventType] || "Nội dung"),
      stage: matchStageLabel(row.match.stage),
      court: row.match.courtId != null && String(row.match.courtId).trim()
        ? `Sân ${row.match.courtId}`
        : "Chưa gán sân",
      a: findEntryName(row.event, row.match.entryAId),
      b: findEntryName(row.event, row.match.entryBId),
      score: formatScore(row.match),
    }));
}

function deriveOps(tournament) {
  const rows = collectMatches(tournament);
  return {
    playing: rows.filter((row) => row.match?.status === MATCH_STATUS.PLAYING).length,
    waiting: rows.filter(
      (row) => row.match?.status === MATCH_STATUS.WAITING || row.match?.status === MATCH_STATUS.ASSIGNED
    ).length,
    late: rows.filter((row) => row.match?.status === MATCH_STATUS.POSTPONED).length,
    completedToday: rows.filter((row) => row.match?.status === MATCH_STATUS.COMPLETED).length,
  };
}

function deriveEventCards(tournament) {
  return listTournamentEvents(tournament).map((event, index) => {
    const status = eventStatusDisplay(event.status);
    const total = Array.isArray(event.matches) ? event.matches.length : 0;
    const done = (Array.isArray(event.matches) ? event.matches : []).filter(
      (match) => match?.status === MATCH_STATUS.COMPLETED
    ).length;
    const playing = (Array.isArray(event.matches) ? event.matches : []).some(
      (match) => match?.status === MATCH_STATUS.PLAYING
    );
    const openMatch = (Array.isArray(event.matches) ? event.matches : []).find(
      (match) => match?.status !== MATCH_STATUS.COMPLETED
    );
    const stage = playing
      ? "Đang thi đấu"
      : total && !openMatch
        ? "Hoàn thành"
        : openMatch
          ? matchStageLabel(openMatch.stage)
          : event.groups?.length
            ? "Vòng bảng"
            : "Chưa có trận";
    return {
      id: String(event.id),
      name: String(event.name || EVENT_TYPE_LABELS[event.eventType] || "Nội dung"),
      pairs: Array.isArray(event.entries) ? event.entries.length : 0,
      status: event.status || "",
      statusLabel: status.label,
      statusTone: status.tone,
      stage,
      done,
      total,
      accent: EVENT_ACCENT[index % EVENT_ACCENT.length],
      category: EVENT_TYPE_LABELS[event.eventType] || "Nội dung",
      format: event.groups?.length && event.bracket
        ? "Vòng bảng + Loại trực tiếp"
        : event.bracket
          ? "Loại trực tiếp"
          : event.groups?.length
            ? "Vòng bảng"
            : "Chưa cấu hình",
      scoring: event.scoring || event.scoringRule || "",
    };
  });
}

export function deriveFormatSteps(event) {
  const steps = [];
  const pairs = Array.isArray(event?.entries) ? event.entries.length : 0;
  if (pairs) steps.push({ id: "pairs", label: `${pairs} cặp`, vi: "Đăng ký hiện có" });
  const groups = Array.isArray(event?.groups) ? event.groups.length : 0;
  if (groups) steps.push({ id: "groups", label: `${groups} bảng`, vi: "Vòng bảng" });
  if (event?.bracket) steps.push({ id: "knockout", label: "Loại trực tiếp", vi: "Nhánh đấu" });
  return steps;
}

export function eventHasStartedCompetition(event) {
  return (Array.isArray(event?.matches) ? event.matches : []).some(
    (match) => match?.status === MATCH_STATUS.PLAYING || match?.status === MATCH_STATUS.COMPLETED
  );
}

export function deriveOverviewVisual(tournament, options = {}) {
  const model = deriveOverviewModel(tournament, options);
  const hero = TOURNAMENT_HERO_STATUS[tournament?.status] || {
    label: model.statusLabel || "Chưa cấu hình",
    tone: "draft",
  };
  const eventCards = deriveEventCards(tournament);
  const initialized = eventCards.filter((event) => event.total > 0 || event.pairs > 0).length;
  return {
    ...model,
    typeLabel: model.modeLabel,
    heroStatusLabel: hero.label,
    heroStatusTone: hero.tone,
    datesLabel: model.dates.scheduleDate || model.dates.registrationOpensAt || null,
    athleteCount: countAthletes(listTournamentEvents(tournament)) || model.kpis.entryCount,
    eventInitHint:
      model.kpis.eventCount > 0
        ? `${Math.round((initialized / model.kpis.eventCount) * 100)}% đã có dữ liệu`
        : "Chưa có nội dung",
    courtHint: model.kpis.courtConfigured
      ? `${model.kpis.courtCount} sân trên hồ sơ`
      : "Chưa cấu hình sân",
    matchHint: model.kpis.matchCount
      ? `${model.kpis.completedMatchCount} xong`
      : "Chưa có trận",
    eventCards,
    lifecycle: deriveLifecycle(tournament, model),
    attention: deriveAttention(tournament, model),
    liveMatches: deriveLiveMatches(tournament),
    ops: deriveOps(tournament),
  };
}

