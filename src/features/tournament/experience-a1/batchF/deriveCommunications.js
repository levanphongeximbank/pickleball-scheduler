import { eventDisplayName } from "../batchB/eventScope.js";
import { listTournamentEvents } from "../deriveOverview.js";

export function deriveCommunicationsModel(tournament, { selectedEventId = "all" } = {}) {
  const events = listTournamentEvents(tournament);
  const event =
    selectedEventId && selectedEventId !== "all"
      ? events.find((item) => String(item.id) === String(selectedEventId)) || null
      : events.length === 1
        ? events.at(0)
        : null;

  const soleEvent = events.length === 1 ? events.at(0) : null;
  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: event ? eventDisplayName(event) : events.length > 1 ? "Mọi nội dung" : eventDisplayName(soleEvent) || "Mọi nội dung",
    events,
    messages: [],
    kpis: {
      sentToday: 0,
      scheduled: 0,
      failed: 0,
      deliveredRate: "—",
    },
    hasCommunicationRecords: false,
  };
}
