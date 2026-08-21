import { MATCH_STAGE, MATCH_STATUS } from "../../../../models/tournament/constants.js";
import { normalizeEntries } from "../../../../models/tournament/entry.js";
import { normalizeMatches } from "../../../../models/tournament/match.js";
import { getCourtDisplayName } from "../../../../models/court.js";

export function entryName(entries, id) {
  if (!id) return "";
  const found = (entries || []).find((entry) => String(entry.id) === String(id));
  return found?.name || "";
}

export function resolveEntries(event) {
  if (!event) return [];
  const draw = Array.isArray(event.drawEntries) ? event.drawEntries : [];
  const pairDraw = draw.filter(
    (entry) => Array.isArray(entry?.playerIds) && entry.playerIds.filter(Boolean).length >= 2
  );
  if (pairDraw.length > 0) {
    return normalizeEntries(pairDraw);
  }
  return normalizeEntries(event.entries);
}

export function eventMatches(event) {
  return event ? normalizeMatches(event.matches) : [];
}

export function matchUiStatus(match) {
  if (match?.status === MATCH_STATUS.PLAYING) return "live";
  if (match?.status === MATCH_STATUS.COMPLETED || match?.status === MATCH_STATUS.FORFEIT) return "completed";
  if (match?.status === MATCH_STATUS.POSTPONED) return "attention";
  if (match?.status === MATCH_STATUS.ASSIGNED) return "upcoming";
  return "waiting";
}

export function scoreLabel(match) {
  const blob =
    match?.scoreA == null && match?.scoreB == null ? "" : `${match.scoreA ?? "—"}–${match.scoreB ?? "—"}`;
  const log = Array.isArray(match?.scoreLog) ? match.scoreLog[match.scoreLog.length - 1] : null;
  const fromLog =
    log && (log.scoreA != null || log.scoreB != null) ? `${log.scoreA ?? "—"}–${log.scoreB ?? "—"}` : "";
  if (blob && fromLog && blob !== fromLog) return "Cần đồng bộ";
  return blob || fromLog || "—";
}

export function timeLabel(value) {
  if (!value) return null;
  const text = String(value);
  const clock = text.match(/(\d{1,2}:\d{2})/);
  if (clock && !text.includes("T")) return clock[1].padStart(5, "0");
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  return text;
}

export function matchTime(match) {
  return timeLabel(match?.scheduledStart || match?.slot || match?.startedAt) || "—";
}

export function isMatchScheduled(match) {
  return Boolean(match?.scheduledStart || match?.slot != null);
}

export function isKnockoutMatch(match) {
  if (match?.bracketMatchId) return true;
  const stage = match?.stage;
  return (
    stage === MATCH_STAGE.ROUND_OF_16 ||
    stage === MATCH_STAGE.QUARTERFINAL ||
    stage === MATCH_STAGE.SEMIFINAL ||
    stage === MATCH_STAGE.FINAL ||
    stage === MATCH_STAGE.THIRD_PLACE
  );
}

export function stageLabel(match, groupLabel) {
  if (isKnockoutMatch(match)) {
    if (match.stage === MATCH_STAGE.FINAL) return "Chung kết";
    if (match.stage === MATCH_STAGE.SEMIFINAL) return "Bán kết";
    if (match.stage === MATCH_STAGE.QUARTERFINAL) return "Tứ kết";
    if (match.stage === MATCH_STAGE.ROUND_OF_16) return "Vòng 16";
    if (match.stage === MATCH_STAGE.THIRD_PLACE) return "Hạng ba";
    return "Loại trực tiếp";
  }
  return groupLabel ? `Vòng bảng` : "Vòng bảng";
}

export function courtLabel(match, courtsById) {
  if (match?.courtId == null || String(match.courtId).trim() === "") return "Chưa gán sân";
  const court = courtsById?.get(String(match.courtId));
  if (court) return getCourtDisplayName(court);
  return `Sân ${match.courtId}`;
}

export function refereeLabel(match) {
  const name = match?.referee?.name || match?.refereeName;
  if (name) return String(name);
  return "Chưa gán";
}

export function refereeLaunchTo(match) {
  const token = String(match?.referee?.token || match?.refereeToken || "").trim();
  return token ? `/referee/${encodeURIComponent(token)}` : "";
}

export function listTournamentCourts(tournament) {
  const fromBlob = Array.isArray(tournament?.courts) ? tournament.courts : [];
  const ids = tournament?.courtSchedule?.physicalCourtIds || tournament?.courtSchedule?.courtIds || [];
  const byId = new Map(fromBlob.map((court) => [String(court.id), court]));
  if (!ids.length) {
    return fromBlob.map((court, index) => ({
      id: String(court.id),
      name: getCourtDisplayName(court, index),
      status: court.status || "active",
    }));
  }
  return ids.map((id, index) => {
    const court = byId.get(String(id));
    return {
      id: String(id),
      name: court ? getCourtDisplayName(court, index) : `Sân ${id}`,
      status: court?.status || "active",
    };
  });
}

export function courtsByIdMap(tournament) {
  const map = new Map();
  for (const court of listTournamentCourts(tournament)) {
    map.set(String(court.id), court);
  }
  return map;
}
