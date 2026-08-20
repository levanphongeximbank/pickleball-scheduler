import { MATCH_STATUS } from "../../../../models/tournament/constants.js";
import { listTournamentEvents } from "../deriveOverview.js";
import { eventDisplayName, resolveBatchBEvent } from "../batchB/eventScope.js";
import {
  courtLabel,
  courtsByIdMap,
  eventMatches,
  matchTime,
  matchUiStatus,
  refereeLabel,
  refereeLaunchTo,
  resolveEntries,
  scoreLabel,
  stageLabel,
} from "../batchD/matchPresentation.js";

export function sourceEventsForOps(tournament, selectedEventId = "all") {
  const events = listTournamentEvents(tournament);
  if (!selectedEventId || selectedEventId === "all") {
    return { events, sourceEvents: events, needsEventChoice: false, emptyEvents: events.length === 0, event: null };
  }
  const scope = resolveBatchBEvent(tournament, selectedEventId);
  return {
    events,
    sourceEvents: scope.event ? [scope.event] : [],
    needsEventChoice: scope.needsEventChoice,
    emptyEvents: scope.emptyEvents,
    event: scope.event,
  };
}

export function projectEventMatches(tournament, selectedEventId = "all") {
  const scope = sourceEventsForOps(tournament, selectedEventId);
  const courtsMap = courtsByIdMap(tournament);
  const rows = [];
  for (const event of scope.sourceEvents) {
    const entries = resolveEntries(event);
    const groups = Array.isArray(event?.groups) ? event.groups : [];
    for (const match of eventMatches(event)) {
      const group = groups.find((item) => String(item.id) === String(match.groupId));
      rows.push({
        id: match.id,
        eventId: event?.id || "",
        event: eventDisplayName(event),
        stage: stageLabel(match, group?.label),
        group: group?.label || group?.name || "—",
        a: entries.find((entry) => String(entry.id) === String(match.entryAId))?.name || "Chưa xác định",
        b: entries.find((entry) => String(entry.id) === String(match.entryBId))?.name || "Chưa xác định",
        time: matchTime(match),
        courtId: match.courtId != null ? String(match.courtId) : "",
        court: courtLabel(match, courtsMap),
        referee: refereeLabel(match),
        refereeLaunchTo: refereeLaunchTo(match),
        status: matchUiStatus(match),
        rawStatus: match.status,
        score: scoreLabel(match),
        scheduledStart: match.scheduledStart || match.slot || "",
        issues: [
          matchUiStatus(match) === "attention" ? "Trận đang hoãn" : null,
          scoreLabel(match) === "Cần đồng bộ" ? "Tỷ số chưa đồng bộ" : null,
          match.status === MATCH_STATUS.FORFEIT ? "Bỏ cuộc / xử thua" : null,
        ].filter(Boolean),
      });
    }
  }
  return { ...scope, courtsMap, matches: rows };
}
