/**
 * S1-H — Individual player portal data assembler.
 * Reads tournament blob + S1-A…G outputs; does not modify those engines.
 */

import { MATCH_STATUS, MATCH_STAGE } from "../../../models/tournament/constants.js";
import { isSchedulePublished } from "../../../tournament/engines/publishScheduleEngine.js";
import { isDrawPublished } from "../../../tournament/engines/publishDrawEngine.js";
import { getLiveStandings } from "./resultPropagationEngine.js";
import { buildIndividualAllGroupStandings } from "../adapters/individualStandingsAdapter.js";
import { getPlayerAwardSummary, buildFinalRanking } from "./awardsEngine.js";
import { getFrozenStandings, getTournamentSummary, isTournamentClosed } from "./tournamentClosingEngine.js";
import { collectEventMatches } from "./refereeAssignEngine.js";
import { getMatchResult } from "./matchResultEngine.js";
import { listWalkovers } from "./walkoverEngine.js";

function entryHasPlayer(entry, playerId) {
  if (!entry || !playerId) return false;
  const pid = String(playerId);
  if (Array.isArray(entry.playerIds) && entry.playerIds.some((id) => String(id) === pid)) {
    return true;
  }
  return String(entry.id) === pid;
}

export function findPlayerEntries(tournament, playerId) {
  const found = [];
  (tournament?.events || []).forEach((event) => {
    (event.entries || []).forEach((entry) => {
      if (entryHasPlayer(entry, playerId)) {
        found.push({ entry, event });
      }
    });
  });
  return found;
}

function isUpcoming(match) {
  return (
    match.status === MATCH_STATUS.WAITING ||
    match.status === MATCH_STATUS.ASSIGNED ||
    match.status === MATCH_STATUS.POSTPONED ||
    match.status === MATCH_STATUS.PLAYING
  );
}

function isHistory(match) {
  return (
    match.status === MATCH_STATUS.COMPLETED ||
    match.status === MATCH_STATUS.FORFEIT ||
    match.locked === true
  );
}

function involvesEntry(match, entryId) {
  return (
    String(match.entryAId) === String(entryId) ||
    String(match.entryBId) === String(entryId)
  );
}

export function listUpcomingMatchesForEntry(tournament, entryId, eventId = "") {
  return collectEventMatches(tournament, eventId)
    .filter((m) => involvesEntry(m, entryId) && isUpcoming(m))
    .sort((a, b) => {
      const at = a.scheduledStart || a.scheduledAt || "";
      const bt = b.scheduledStart || b.scheduledAt || "";
      return String(at).localeCompare(String(bt));
    });
}

export function listMatchHistoryForEntry(tournament, entryId, eventId = "") {
  return collectEventMatches(tournament, eventId)
    .filter((m) => involvesEntry(m, entryId) && isHistory(m))
    .map((m) => {
      const stored = getMatchResult(tournament, m.id);
      return {
        ...m,
        resultType: stored?.resultType || m.resultType || "",
        scoreLabel: `${m.scoreA ?? stored?.scoreA ?? "—"} : ${m.scoreB ?? stored?.scoreB ?? "—"}`,
        didWin: String(m.winnerId || stored?.winnerId) === String(entryId),
      };
    })
    .sort((a, b) => String(b.completedAt || "").localeCompare(String(a.completedAt || "")));
}

export function resolvePlayerStanding(tournament, entryId, eventId = "") {
  const event =
    (tournament?.events || []).find((e) => String(e.id) === String(eventId)) ||
    tournament?.events?.[0];
  if (!event) return null;

  const frozen = getFrozenStandings(tournament, event.id);
  const live = getLiveStandings(tournament, event.id);
  const groups =
    frozen?.groups ||
    live?.groups ||
    buildIndividualAllGroupStandings(event, { forceCanonical: false });

  for (const group of groups || []) {
    const row = (group.standing || []).find(
      (r) => String(r.id || r.entryId) === String(entryId)
    );
    if (row) {
      return {
        groupId: group.groupId || group.group,
        row,
        source: frozen ? "frozen" : live ? "live" : "computed",
        tieBreakExplanation: group.tieBreakExplanation || "",
      };
    }
  }
  return null;
}

export function buildScheduleViewForEntry(tournament, entryId, eventId = "") {
  const published = isSchedulePublished(tournament);
  const matches = collectEventMatches(tournament, eventId).filter((m) =>
    involvesEntry(m, entryId)
  );
  return {
    published,
    matches: matches.map((m) => ({
      id: m.id,
      opponentId:
        String(m.entryAId) === String(entryId) ? m.entryBId : m.entryAId,
      scheduledStart: m.scheduledStart || m.scheduledAt || null,
      scheduledEnd: m.scheduledEnd || null,
      courtId: m.courtId || null,
      status: m.status,
      stage: m.stage,
    })),
  };
}

export function buildBracketViewSummary(tournament, eventId = "") {
  const event =
    (tournament?.events || []).find((e) => String(e.id) === String(eventId)) ||
    tournament?.events?.[0];
  const drawPublished = isDrawPublished(tournament);
  const rounds = event?.bracket?.rounds || [];
  const koMatches = (event?.matches || []).filter((m) => m.bracketMatchId);
  return {
    drawPublished,
    hasBracket: rounds.length > 0 || koMatches.length > 0,
    roundCount: rounds.length,
    knockoutMatchCount: koMatches.length,
    final: koMatches.find((m) => m.stage === MATCH_STAGE.FINAL) || null,
    thirdPlace:
      koMatches.find((m) => m.stage === MATCH_STAGE.THIRD_PLACE || m.isThirdPlace) || null,
  };
}

/**
 * Full player tournament dashboard payload.
 */
export function buildPlayerPortalDashboard(tournament, options = {}) {
  if (!tournament) {
    return {
      ok: false,
      error: "Không tìm thấy giải.",
      code: "TOURNAMENT_MISSING",
    };
  }

  const playerId = options.playerId ? String(options.playerId) : "";
  const entries = playerId ? findPlayerEntries(tournament, playerId) : [];
  let entry = null;
  let event = null;

  if (options.entryId) {
    for (const row of tournament.events || []) {
      const found = (row.entries || []).find((e) => String(e.id) === String(options.entryId));
      if (found) {
        entry = found;
        event = row;
        break;
      }
    }
  } else if (entries.length) {
    entry = entries[0].entry;
    event = entries[0].event;
  }

  if (!entry) {
    return {
      ok: true,
      enrolled: false,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        closed: isTournamentClosed(tournament),
      },
      message: "Bạn chưa đăng ký nội dung nào trong giải này.",
    };
  }

  const entryId = entry.id;
  const eventId = event?.id || "";

  return {
    ok: true,
    enrolled: true,
    tournament: {
      id: tournament.id,
      name: tournament.name,
      status: tournament.status,
      closed: isTournamentClosed(tournament),
      summary: getTournamentSummary(tournament),
    },
    entry: {
      id: entry.id,
      name: entry.name,
      status: entry.status,
      seed: entry.seed ?? null,
      groupId: entry.groupId || "",
    },
    event: {
      id: eventId,
      name: event?.name || event?.eventType || "",
    },
    availableEntries: entries.map((row) => ({
      entryId: row.entry.id,
      entryName: row.entry.name,
      eventId: row.event.id,
      eventName: row.event.name || row.event.eventType || "",
    })),
    upcomingMatches: listUpcomingMatchesForEntry(tournament, entryId, eventId),
    matchHistory: listMatchHistoryForEntry(tournament, entryId, eventId),
    standing: resolvePlayerStanding(tournament, entryId, eventId),
    schedule: buildScheduleViewForEntry(tournament, entryId, eventId),
    bracket: buildBracketViewSummary(tournament, eventId),
    awards: getPlayerAwardSummary(tournament, entryId),
    finalRanking: buildFinalRanking(tournament, eventId).ranking || [],
    walkoversInvolving: listWalkovers(tournament).filter(
      (w) => w.winnerId === entryId || w.loserId === entryId
    ),
  };
}

/**
 * List individual tournaments where player is enrolled (portal home).
 */
export function listPlayerTournaments(tournaments = [], playerId) {
  if (!playerId) return [];
  return (tournaments || [])
    .map((tournament) => {
      const entries = findPlayerEntries(tournament, playerId);
      if (!entries.length) return null;
      return {
        id: tournament.id,
        name: tournament.name || tournament.id,
        status: tournament.status,
        closed: isTournamentClosed(tournament),
        entryCount: entries.length,
        nextMatch: listUpcomingMatchesForEntry(
          tournament,
          entries[0].entry.id,
          entries[0].event.id
        )[0] || null,
      };
    })
    .filter(Boolean);
}
