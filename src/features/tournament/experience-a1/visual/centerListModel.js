import { MATCH_STATUS, TOURNAMENT_STATUS } from "../../../../models/tournament/constants.js";
import { modeLabelVi, statusLabelVi } from "../../constants/tournamentLabels.js";

export const CENTER_STATUS_FILTERS = Object.freeze([
  { key: "all", label: "Tất cả", statuses: null },
  { key: "draft", label: "Nháp", statuses: [TOURNAMENT_STATUS.DRAFT] },
  { key: "registration", label: "Đăng ký", statuses: [TOURNAMENT_STATUS.REGISTRATION] },
  { key: "ready", label: "Chuẩn bị", statuses: [TOURNAMENT_STATUS.READY] },
  { key: "active", label: "Đang diễn ra", statuses: [TOURNAMENT_STATUS.ACTIVE] },
]);

export const CENTER_STATUS_TONE = Object.freeze({
  [TOURNAMENT_STATUS.ACTIVE]: "success",
  [TOURNAMENT_STATUS.READY]: "info",
  [TOURNAMENT_STATUS.REGISTRATION]: "warning",
  [TOURNAMENT_STATUS.DRAFT]: "draft",
  [TOURNAMENT_STATUS.COMPLETED]: "draft",
  [TOURNAMENT_STATUS.CANCELLED]: "danger",
});

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function countEntries(tournament) {
  return asList(tournament?.events).reduce((sum, event) => sum + asList(event?.entries).length, 0);
}

function countMatches(tournament) {
  return asList(tournament?.events).reduce((sum, event) => sum + asList(event?.matches).length, 0);
}

function countCompletedMatches(tournament) {
  return asList(tournament?.events).reduce(
    (sum, event) =>
      sum + asList(event?.matches).filter((match) => match?.status === MATCH_STATUS.COMPLETED).length,
    0
  );
}

function formatDateLabel(tournament) {
  const scheduleDate = tournament?.courtSchedule?.date;
  if (scheduleDate) return String(scheduleDate);
  const opensAt = tournament?.settings?.registration?.opensAt;
  const closesAt = tournament?.settings?.registration?.closesAt;
  if (opensAt || closesAt) {
    return [opensAt, closesAt].filter(Boolean).join(" → ");
  }
  return null;
}

export function deriveCenterKpis(tournaments) {
  const list = asList(tournaments);
  return {
    ongoing: list.filter((item) => item.status === TOURNAMENT_STATUS.ACTIVE).length,
    upcoming: list.filter((item) => item.status === TOURNAMENT_STATUS.READY).length,
    registering: list.filter((item) => item.status === TOURNAMENT_STATUS.REGISTRATION).length,
    attention: list.filter((item) => item.status === TOURNAMENT_STATUS.DRAFT).length,
  };
}

export function deriveAttentionItems(tournaments) {
  const kpis = deriveCenterKpis(tournaments);
  if (kpis.attention > 0) {
    return [{ label: "Giải nháp cần thiết lập", count: kpis.attention, tone: "warning" }];
  }
  return [];
}

export function filterCenterTournaments(tournaments, { query = "", filterKey = "all" } = {}) {
  const needle = String(query || "").trim().toLowerCase();
  const filter = CENTER_STATUS_FILTERS.find((item) => item.key === filterKey) || CENTER_STATUS_FILTERS[0];
  return asList(tournaments).filter((item) => {
    if (filter.statuses && !filter.statuses.includes(item.status)) return false;
    if (!needle) return true;
    return String(item.name || "").toLowerCase().includes(needle);
  });
}

export function deriveCenterCard(tournament, { clubName = "" } = {}) {
  const events = asList(tournament?.events);
  const matches = countMatches(tournament);
  const completed = countCompletedMatches(tournament);
  const location = String(tournament?.hostClubName || clubName || "").trim() || null;
  return {
    id: tournament?.id,
    name: String(tournament?.name || "Giải đấu"),
    mode: tournament?.mode || "",
    typeLabel: modeLabelVi(tournament?.mode),
    status: tournament?.status || "",
    statusLabel: statusLabelVi(tournament?.status),
    dates: formatDateLabel(tournament),
    location,
    athletes: countEntries(tournament),
    events: events.length,
    matches,
    progress: matches ? Math.round((completed / matches) * 100) : 0,
  };
}
