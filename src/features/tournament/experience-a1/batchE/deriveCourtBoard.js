import { MATCH_STATUS } from "../../../../models/tournament/constants.js";
import { eventDisplayName } from "../batchB/eventScope.js";
import { listTournamentCourts } from "../batchD/matchPresentation.js";
import { projectEventMatches } from "./collectMatches.js";
import { OPS_STATUS, derivePhysicalCourtStatus } from "./opsStatus.js";

export function deriveCourtBoardModel(tournament, { selectedEventId = "all", stage = "all", status = "all" } = {}) {
  const projected = projectEventMatches(tournament, selectedEventId);
  const physical = listTournamentCourts(tournament);
  const cards = physical.map((court) => {
    const onCourt = projected.matches.filter((match) => String(match.courtId) === String(court.id));
    const current = onCourt.find((item) => item.status === "live") || onCourt.find((item) => item.status === "attention") || null;
    const next = onCourt.find((item) => item.status === "upcoming" || item.status === "waiting") || null;
    const derivedStatus = derivePhysicalCourtStatus(court, onCourt);
    return {
      ...court,
      currentMatch: current,
      nextMatch: next,
      derivedStatus,
      event: current?.event || next?.event || "",
      stage: current?.stage || next?.stage || "",
    };
  });
  const kpis = {
    live: cards.filter((item) => item.derivedStatus === OPS_STATUS.LIVE).length,
    next: cards.filter((item) => item.derivedStatus === OPS_STATUS.NEXT).length,
    available: cards.filter((item) => item.derivedStatus === OPS_STATUS.AVAILABLE).length,
    delay: cards.filter((item) => item.derivedStatus === OPS_STATUS.DELAY).length,
    maintenance: cards.filter((item) => item.derivedStatus === OPS_STATUS.MAINTENANCE).length,
  };
  const filtered = cards.filter((court) => {
    if (stage !== "all" && court.stage !== stage && !String(court.stage).includes(stage)) return false;
    if (status !== "all" && court.derivedStatus !== status) return false;
    return true;
  });
  const waitingQueue = projected.matches
    .filter((item) => item.status === "waiting" || item.status === "upcoming")
    .slice(0, 8);
  const delayed = cards.filter((item) => item.derivedStatus === OPS_STATUS.DELAY);
  const maintenance = cards.filter((item) => item.derivedStatus === OPS_STATUS.MAINTENANCE);

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: projected.event ? eventDisplayName(projected.event) : "Mọi nội dung",
    eventId: projected.event?.id || "",
    events: projected.events,
    emptyEvents: projected.emptyEvents,
    physicalCourtCount: physical.length,
    clusterHint: tournament?.courtSchedule?.clusterName
      ? `Cụm ${tournament.courtSchedule.clusterName}`
      : "Cụm sân trên hồ sơ giải",
    kpis,
    statusCountSum: kpis.live + kpis.next + kpis.available + kpis.delay + kpis.maintenance,
    courts: filtered,
    allCourts: cards,
    waitingQueue,
    delayed,
    maintenance,
    stages: [...new Set(projected.matches.map((item) => item.stage).filter(Boolean))],
    postponedCount: projected.matches.filter((item) => item.rawStatus === MATCH_STATUS.POSTPONED).length,
  };
}
