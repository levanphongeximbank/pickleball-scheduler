import { MATCH_STAGE, MATCH_STATUS, TOURNAMENT_STATUS } from "../../../../models/tournament/constants.js";
import { canCloseTournament, isTournamentClosed } from "../../../individual-tournament/engines/tournamentClosingEngine.js";
import { buildAwardsPreview, buildFinalRanking } from "../../../individual-tournament/engines/awardsEngine.js";
import { getLiveStandings } from "../../../individual-tournament/engines/resultPropagationEngine.js";
import { eventDisplayName } from "../batchB/eventScope.js";
import { listTournamentEvents } from "../deriveOverview.js";
import { deriveExceptionModel } from "../batchE/deriveExceptions.js";

function terminalMatch(match) {
  return (
    match?.status === MATCH_STATUS.COMPLETED ||
    match?.status === MATCH_STATUS.FORFEIT ||
    match?.locked === true
  );
}

function eventMatchCounts(event) {
  const matches = Array.isArray(event?.matches) ? event.matches : [];
  const terminal = matches.filter(terminalMatch);
  return { total: matches.length, terminal: terminal.length };
}

function eventOfficialResult(event) {
  const matches = Array.isArray(event?.matches) ? event.matches : [];
  const fm = matches.find((item) => item.stage === MATCH_STAGE.FINAL);
  return Boolean(fm && terminalMatch(fm) && fm.winnerId);
}

function eventHasStandings(tournament, event) {
  const live = getLiveStandings(tournament, event?.id);
  return Boolean(live?.groups?.length);
}

function eventHasAwards(tournament, event) {
  const preview = buildAwardsPreview(tournament, { eventId: event?.id });
  return (preview.awards || []).some((item) => Boolean(item.entryId));
}

export function deriveCompletionModel(tournament) {
  const events = listTournamentEvents(tournament);
  const ops = { closed: isTournamentClosed(tournament) };
  const exceptions = deriveExceptionModel(tournament, { selectedEventId: "all" });
  const eventRows = events.map((event) => {
    const counts = eventMatchCounts(event);
    const matchesTerminal = counts.total > 0 && counts.terminal === counts.total;
    const officialResult = eventOfficialResult(event);
    const standings = eventHasStandings(tournament, event);
    const awards = eventHasAwards(tournament, event);
    const ranking = buildFinalRanking(tournament, event.id);
    const eventComplete = matchesTerminal && officialResult && standings;
    return {
      id: event.id,
      name: eventDisplayName(event),
      ...counts,
      done: counts.terminal,
      matchesTerminal,
      officialResult,
      standings,
      awards,
      eventComplete,
      status: eventComplete ? "COMPLETED" : counts.terminal < counts.total ? "IN_PROGRESS" : "NOT_READY",
      rankingReady: Boolean(ranking.ranking?.length),
    };
  });

  const tournamentTotalMatches = eventRows.reduce((sum, row) => sum + row.total, 0);
  const tournamentTerminalMatches = eventRows.reduce((sum, row) => sum + row.terminal, 0);
  const tournamentRemainingMatches = tournamentTotalMatches - tournamentTerminalMatches;
  const eventTotalSum = eventRows.reduce((sum, row) => sum + row.total, 0);
  const eventTerminalSum = eventRows.reduce((sum, row) => sum + row.terminal, 0);
  const completedEventCount = eventRows.filter((row) => row.eventComplete).length;
  const activeEventCount = eventRows.filter((row) => !row.eventComplete && row.total > 0).length;

  const blockers = [];
  if (tournamentRemainingMatches > 0) {
    blockers.push({
      id: "remaining-matches",
      label: "Còn trận chưa kết thúc",
      detail: `${tournamentRemainingMatches} trận còn lại trên hồ sơ`,
      to: "matches",
    });
  }
  if (exceptions.allItems.length) {
    blockers.push({
      id: "open-exceptions",
      label: "Còn ngoại lệ trên hồ sơ",
      detail: `${exceptions.allItems.length} mục cần theo dõi`,
      to: "exceptions",
    });
  }
  if (activeEventCount > 0) {
    blockers.push({
      id: "active-events",
      label: "Còn nội dung chưa hoàn tất",
      detail: `${activeEventCount} nội dung vẫn đang diễn ra`,
      to: "awards",
    });
  }

  const readinessItems = [
    { label: "Tất cả trận đã kết thúc", ready: tournamentRemainingMatches === 0 && tournamentTotalMatches > 0, note: `${tournamentTerminalMatches}/${tournamentTotalMatches}` },
    { label: "Tất cả nội dung đã hoàn tất", ready: completedEventCount === events.length && events.length > 0, note: `${completedEventCount}/${events.length}` },
    { label: "Không còn ngoại lệ mở", ready: exceptions.kpis.open === 0, note: `${exceptions.kpis.open} đang mở` },
    { label: "Giải chưa bị đóng trước đó", ready: !ops.closed, note: ops.closed ? "Đã đóng" : "Chưa đóng" },
  ];

  const closeCheck = canCloseTournament(tournament);
  const closeReady = closeCheck.ok && readinessItems.every((item) => item.ready) && blockers.length === 0;
  const closePct = readinessItems.length
    ? Math.round((readinessItems.filter((item) => item.ready).length / readinessItems.length) * 100)
    : 0;

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    statusLabel:
      tournament?.status === TOURNAMENT_STATUS.COMPLETED
        ? "Đã hoàn tất"
        : tournament?.status === TOURNAMENT_STATUS.ACTIVE
          ? "Đang diễn ra"
          : "Chưa sẵn sàng hoàn tất",
    eventRows,
    blockers,
    readinessItems,
    closeReady,
    closePct,
    tournamentTotalMatches,
    tournamentTerminalMatches,
    tournamentRemainingMatches,
    eventTotalSum,
    eventTerminalSum,
    completedEventCount,
    blockerCount: blockers.length,
    activeEventCount,
    eventCount: events.length,
    alreadyClosed: Boolean(ops.closed),
    hasCloseAuthority: false,
  };
}
