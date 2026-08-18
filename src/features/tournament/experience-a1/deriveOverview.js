import {
  EVENT_TYPE_LABELS,
  MATCH_STATUS,
  TOURNAMENT_MODE,
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
  "Giải nội bộ hiện là chế độ tương thích một nội dung. Wave A1 không mở rộng thành nhiều nội dung.";
