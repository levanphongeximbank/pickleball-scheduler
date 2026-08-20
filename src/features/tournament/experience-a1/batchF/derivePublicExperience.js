import { isRegisterableTournament } from "../../../../config/tournamentRoutes.js";
import { TOURNAMENT_STATUS } from "../../../../models/tournament/constants.js";
import { buildFinalRanking } from "../../../individual-tournament/engines/awardsEngine.js";
import { getLiveStandings } from "../../../individual-tournament/engines/resultPropagationEngine.js";
import { buildIndividualAllGroupStandings } from "../../../individual-tournament/adapters/individualStandingsAdapter.js";
import { isDrawPublished } from "../../../../tournament/engines/publishDrawEngine.js";
import { isSchedulePublished } from "../../../../tournament/engines/publishScheduleEngine.js";
import { eventDisplayName } from "../batchB/eventScope.js";
import { listTournamentEvents } from "../deriveOverview.js";
import { projectEventMatches } from "../batchE/collectMatches.js";

function sanitizePublicCourt(label) {
  const text = String(label || "").trim();
  if (!text) return "Sân";
  if (/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(text)) {
    return text.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "…").replace(/…+/g, "…").trim() || "Sân";
  }
  return text;
}

function sanitizePublicMatch(row) {
  return {
    ...row,
    court: sanitizePublicCourt(row.court),
  };
}
  if (status === TOURNAMENT_STATUS.ACTIVE) return "ĐANG DIỄN RA";
  if (status === TOURNAMENT_STATUS.REGISTRATION) return "ĐANG MỞ ĐĂNG KÝ";
  if (status === TOURNAMENT_STATUS.COMPLETED) return "ĐÃ HOÀN TẤT";
  if (status === TOURNAMENT_STATUS.READY) return "SẴN SÀNG THI ĐẤU";
  return "THÔNG TIN GIẢI";
}

export function resolvePublicRegistrationCta(tournament) {
  if (isRegisterableTournament(tournament)) {
    return { label: "Đăng ký ngay", disabled: false, state: "OPEN" };
  }
  return { label: "Đã đóng đăng ký", disabled: true, state: "CLOSED" };
}

export function derivePublicExperienceModel(tournament) {
  const events = listTournamentEvents(tournament);
  const projected = projectEventMatches(tournament, "all");
  const liveMatches = projected.matches.filter((item) => item.status === "live").slice(0, 6);
  const schedulePreview = projected.matches
    .filter((item) => item.status !== "completed")
    .slice()
    .sort((a, b) => String(a.scheduledStart).localeCompare(String(b.scheduledStart)))
    .slice(0, 8);

  const eventCards = events.map((event) => {
    const entries = Array.isArray(event.entries) ? event.entries.length : 0;
    const matches = Array.isArray(event.matches) ? event.matches.length : 0;
    return {
      id: event.id,
      name: eventDisplayName(event),
      pairs: entries,
      stage: matches ? "Đã có lịch trên hồ sơ" : "Chưa có trận",
    };
  });

  const standingsPreview = [];
  for (const event of events) {
    const live = getLiveStandings(tournament, event.id);
    const groups =
      live?.groups || buildIndividualAllGroupStandings(event, { forceCanonical: false });
    for (const group of groups || []) {
      for (const row of group.standing || []) {
        standingsPreview.push({
          id: `${event.id}-${row.id || row.entryId}`,
          pair: row.name,
          points: row.matchPoints ?? row.points ?? 0,
          qual: group.label || group.name || eventDisplayName(event),
        });
      }
    }
  }

  const resultsPreview = [];
  for (const event of events) {
    const ranking = buildFinalRanking(tournament, event.id);
    for (const row of ranking.ranking || []) {
      resultsPreview.push({
        id: `${event.id}-${row.entryId}`,
        rank: row.rank,
        pair: row.name,
        event: eventDisplayName(event),
      });
    }
  }

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    statusLabel: publicStatusLabel(tournament?.status),
    location: tournament?.location || tournament?.venue || "—",
    dates: tournament?.courtSchedule?.date || "—",
    drawPublished: isDrawPublished(tournament),
    schedulePublished: isSchedulePublished(tournament),
    registration: resolvePublicRegistrationCta(tournament),
    eventCards,
    liveMatches: liveMatches.map(sanitizePublicMatch),
    schedulePreview: schedulePreview.map(sanitizePublicMatch),
    standingsPreview: standingsPreview.slice(0, 12),
    resultsPreview: resultsPreview.slice(0, 12),
    hasBracket: events.some((event) => Boolean(event.bracket)),
    mediaAvailable: false,
  };
}
