import { AWARD_KEY, buildAwardsPreview, buildFinalRanking, getAwardsState } from "../../../individual-tournament/engines/awardsEngine.js";
import { MATCH_STAGE, MATCH_STATUS } from "../../../../models/tournament/constants.js";
import { eventDisplayName } from "../batchB/eventScope.js";
import { listTournamentEvents, resolveSelectedEvent } from "../deriveOverview.js";

function resolveFinalistsComplete(event) {
  const finalMatch = (event?.matches || []).find((item) => item.stage === MATCH_STAGE.FINAL);
  return Boolean(
    finalMatch &&
      (finalMatch.status === MATCH_STATUS.COMPLETED || finalMatch.status === MATCH_STATUS.FORFEIT) &&
      finalMatch.winnerId
  );
}

function countTerminalMatches(event) {
  const matches = Array.isArray(event?.matches) ? event.matches : [];
  const terminal = matches.filter(
    (item) => item.status === MATCH_STATUS.COMPLETED || item.status === MATCH_STATUS.FORFEIT
  );
  return { total: matches.length, terminal: terminal.length };
}

export function deriveAwardsModel(tournament, { selectedEventId = "" } = {}) {
  const events = listTournamentEvents(tournament);
  const event = resolveSelectedEvent(events, selectedEventId) || (events.length === 1 ? events.at(0) : null);
  const eventId = event?.id || "";
  const final = eventId ? buildFinalRanking(tournament, eventId) : { ranking: [] };
  const awardsPreview = eventId ? buildAwardsPreview(tournament, { eventId }) : { awards: [] };
  const awardsState = getAwardsState(tournament);
  const matchCounts = event ? countTerminalMatches(event) : { total: 0, terminal: 0 };
  const officialResult = event ? resolveFinalistsComplete(event) : false;
  const champion = final.ranking?.find((item) => item.rank === 1);
  const podium = (final.ranking || []).slice(0, 3).map((item) => ({
    rank: item.rank,
    place: item.rank === 1 ? "Vô địch" : item.rank === 2 ? "Á quân" : "Hạng ba",
    pair: item.name || "Chưa xác định",
    status: item.name ? "CONFIRMED" : "NOT_READY",
  }));

  const specialAwards = (awardsPreview.awards || [])
    .filter((item) => item.key === AWARD_KEY.MVP || item.key === AWARD_KEY.SPORTSMANSHIP)
    .map((item) => ({
      id: item.key,
      place: item.label,
      pair: item.entryName || "Chưa gán",
      assigned: Boolean(item.entryId),
    }));

  const awardsAssigned = (awardsPreview.awards || []).some((item) => Boolean(item.entryId));
  const publicationReady = officialResult && Boolean(champion?.name) && awardsAssigned;

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: event ? eventDisplayName(event) : "Chọn nội dung",
    events,
    needsEventChoice: events.length > 1 && !event,
    eventId,
    podium,
    champion,
    specialAwards,
    matchCounts,
    officialResult,
    awardsAssigned,
    publicationReady,
    readinessItems: [
      {
        label: "Trận chung kết đã kết thúc",
        ready: officialResult,
        note: officialResult ? `${matchCounts.terminal}/${matchCounts.total} trận` : `${matchCounts.terminal}/${matchCounts.total} • còn lại`,
      },
      {
        label: "Kết quả chính thức đã xác nhận",
        ready: officialResult,
        note: officialResult ? "Đã xác nhận trên hồ sơ" : "Vô địch chưa xác định",
      },
      {
        label: "Đã xác định vô địch",
        ready: Boolean(champion?.name),
        note: champion?.name || "Chưa xác định",
      },
      {
        label: "Đã gán giải thưởng",
        ready: awardsAssigned,
        note: awardsAssigned ? "Có trên hồ sơ giải" : "Chưa gán đủ giải phụ",
      },
      {
        label: "Sẵn sàng công bố",
        ready: publicationReady,
        note: publicationReady ? "Có thể công bố" : "Kết quả cuối chưa sẵn sàng",
      },
    ],
    assignments: awardsState.assignments,
  };
}
