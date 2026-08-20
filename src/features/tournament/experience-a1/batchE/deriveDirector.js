import { MATCH_STATUS } from "../../../../models/tournament/constants.js";
import { eventDisplayName } from "../batchB/eventScope.js";
import { listTournamentCourts } from "../batchD/matchPresentation.js";
import { projectEventMatches } from "./collectMatches.js";
import { derivePhysicalCourtStatus } from "./opsStatus.js";

function matchesOnCourt(matches, courtId) {
  return matches.filter((match) => String(match.courtId) === String(courtId));
}

export function deriveDirectorModel(tournament, { selectedEventId = "all" } = {}) {
  const projected = projectEventMatches(tournament, selectedEventId);
  const matches = projected.matches;
  const courts = listTournamentCourts(tournament).map((court) => {
    const onCourt = matchesOnCourt(matches, court.id);
    const current = onCourt.find((item) => item.status === "live") || onCourt.find((item) => item.status === "attention") || null;
    const next = onCourt.find((item) => item.status === "upcoming" || item.status === "waiting") || null;
    return {
      ...court,
      currentMatch: current,
      nextMatch: next,
      derivedStatus: derivePhysicalCourtStatus(court, onCourt),
    };
  });
  const live = matches.filter((item) => item.status === "live");
  const waiting = matches.filter((item) => item.status === "waiting" || item.status === "upcoming");
  const late = matches.filter((item) => item.status === "attention" || item.rawStatus === MATCH_STATUS.POSTPONED);
  const completed = matches.filter((item) => item.status === "completed" || item.rawStatus === MATCH_STATUS.FORFEIT);
  const issues = matches.filter((item) => item.issues.length);
  const timeline = matches
    .filter((item) => item.time && item.time !== "—")
    .slice()
    .sort((a, b) => String(a.scheduledStart).localeCompare(String(b.scheduledStart)))
    .slice(0, 8)
    .map((item) => ({
      time: item.time,
      status: item.status === "live" ? "LIVE" : item.status === "attention" ? "DELAY" : item.status === "completed" ? "COMPLETED" : "NEXT",
      text: `${item.id} • ${item.court} • ${item.a} vs ${item.b}`,
    }));

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: projected.event ? eventDisplayName(projected.event) : "Mọi nội dung",
    eventId: projected.event?.id || "",
    events: projected.events,
    needsEventChoice: false,
    emptyEvents: projected.emptyEvents,
    kpis: {
      playing: live.length,
      waiting: waiting.length,
      late: late.length,
      completedToday: completed.length,
    },
    courts,
    liveMatches: live,
    issues,
    timeline,
    clusterHint: tournament?.courtSchedule?.clusterId ? `Cụm ${tournament.courtSchedule.clusterId}` : "Cụm sân trên hồ sơ giải",
  };
}
