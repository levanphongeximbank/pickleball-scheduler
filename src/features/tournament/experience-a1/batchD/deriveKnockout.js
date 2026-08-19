import { eventDisplayName, resolveBatchBEvent } from "../batchB/eventScope.js";
import { bracketRoundKey, displayBracketRoundLabel } from "./labels.js";
import {
  eventMatches,
  isKnockoutMatch,
  matchUiStatus,
  refereeLabel,
  resolveEntries,
  scoreLabel,
} from "./matchPresentation.js";

const ROUND_ORDER = ["R32", "R16", "QF", "SF", "Final"];

export function deriveKnockoutModel(tournament, { selectedEventId, round = "" } = {}) {
  const scope = resolveBatchBEvent(tournament, selectedEventId);
  const event = scope.event;
  const entries = resolveEntries(event);
  const matches = eventMatches(event).filter((match) => isKnockoutMatch(match));
  const bracket = event?.bracket && typeof event.bracket === "object" ? event.bracket : null;
  const roundsFromBracket = Array.isArray(bracket?.rounds)
    ? bracket.rounds.map((item) => bracketRoundKey(item.name) || item.name).filter(Boolean)
    : [];
  const roundsFromMatches = [...new Set(matches.map((match) => roundKeyFromMatch(match)))].filter(Boolean);
  const rounds = uniqueRoundOrder([...roundsFromBracket, ...roundsFromMatches]);
  const selectedRound = rounds.includes(round) ? round : rounds[0] || "";
  const roundMatches = matches.filter((match) => roundKeyFromMatch(match) === selectedRound);
  const cards = roundMatches.map((match) => {
    const a = nameOf(entries, match.entryAId) || "Chưa xác định";
    const b = nameOf(entries, match.entryBId) || (!match.entryBId && match.entryAId ? "Miễn" : "Chưa xác định");
    return {
      id: match.id,
      a,
      b,
      status: matchUiStatus(match),
      score: scoreLabel(match),
      court: match.courtId != null ? `Sân ${match.courtId}` : "Chưa gán sân",
      time: match.scheduledStart || "—",
      referee: refereeLabel(match),
      event: eventDisplayName(event),
      stage: displayBracketRoundLabel(selectedRound || roundKeyFromMatch(match)),
      group: "—",
    };
  });
  const kpis = {
    total: cards.length,
    completed: cards.filter((item) => item.status === "completed").length,
    live: cards.filter((item) => item.status === "live").length,
    upcoming: cards.filter((item) => item.status === "upcoming" || item.status === "waiting").length,
    attention: cards.filter((item) => item.status === "attention").length,
  };
  const nextRound = rounds[rounds.indexOf(selectedRound) + 1] || "Champion";
  const roundReady = kpis.total > 0 && kpis.attention === 0 && kpis.live === 0 && kpis.upcoming === 0;

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: eventDisplayName(event),
    eventId: event?.id || "",
    events: scope.events,
    needsEventChoice: scope.needsEventChoice,
    emptyEvents: scope.emptyEvents,
    rounds: rounds.map((id) => ({ id, label: displayBracketRoundLabel(id) })),
    selectedRound,
    nextRound,
    nextRoundLabel: displayBracketRoundLabel(nextRound),
    matches: cards,
    kpis,
    roundReady,
    hasBracket: Boolean(rounds.length),
  };
}

export function deriveBracketModel(tournament, { selectedEventId, round = "" } = {}) {
  const scope = resolveBatchBEvent(tournament, selectedEventId);
  const event = scope.event;
  const entries = resolveEntries(event);
  const liveMatches = eventMatches(event).filter((match) => isKnockoutMatch(match));
  const resolved = Array.isArray(event?.bracket?.rounds) ? event.bracket.rounds : [];
  const columns = [];
  for (const roundBlock of resolved) {
    const key = bracketRoundKey(roundBlock.name) || roundBlock.name;
    const nodes = (roundBlock.matches || []).map((node) => mapBracketNode(node, entries, liveMatches, key));
    columns.push({ id: key, title: key, matches: nodes });
  }
  if (!columns.length) {
    const byRound = new Map();
    for (const match of liveMatches) {
      const key = roundKeyFromMatch(match);
      if (!key) continue;
      const list = byRound.get(key) || [];
      list.push(mapLiveNode(match, entries, key));
      byRound.set(key, list);
    }
    for (const key of uniqueRoundOrder([...byRound.keys()])) {
      columns.push({ id: key, title: key, matches: byRound.get(key) || [] });
    }
  }
  const champion = deriveChampion(columns);
  const roundIds = columns.map((column) => column.id);
  const selectedRound = roundIds.includes(round) ? round : roundIds[0] || "";
  const nextRound = roundIds[roundIds.indexOf(selectedRound) + 1] || (champion ? "Champion" : "");

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: eventDisplayName(event),
    eventId: event?.id || "",
    events: scope.events,
    needsEventChoice: scope.needsEventChoice,
    emptyEvents: scope.emptyEvents,
    columns,
    champion,
    selectedRound,
    nextRound,
    roundItems: [
      ...roundIds.map((id) => ({ id, label: displayBracketRoundLabel(id) })),
      ...(champion ? [{ id: "Champion", label: "Vô địch" }] : []),
    ],
  };
}

function nameOf(entries, id) {
  if (!id) return "";
  return entries.find((entry) => String(entry.id) === String(id))?.name || "";
}

function roundKeyFromMatch(match) {
  if (match.stage === "final") return "Final";
  if (match.stage === "semifinal") return "SF";
  if (match.stage === "quarterfinal") return "QF";
  if (match.stage === "round_of_16") return "R16";
  const fromId = String(match.bracketMatchId || match.id);
  if (/R32/i.test(fromId)) return "R32";
  if (/R16/i.test(fromId)) return "R16";
  if (/QF/i.test(fromId)) return "QF";
  if (/SF/i.test(fromId)) return "SF";
  if (/Final|Chung/i.test(fromId)) return "Final";
  return bracketRoundKey(match.roundName) || "";
}

function uniqueRoundOrder(ids) {
  const set = [...new Set(ids.filter(Boolean))];
  return set.sort((left, right) => {
    const a = ROUND_ORDER.indexOf(left);
    const b = ROUND_ORDER.indexOf(right);
    if (a === -1 && b === -1) return 0;
    if (a === -1) return 1;
    if (b === -1) return -1;
    return a - b;
  });
}

function mapBracketNode(node, entries, liveMatches, roundKey) {
  const live = liveMatches.find(
    (match) => String(match.bracketMatchId) === String(node.id) || String(match.id) === String(node.id)
  );
  const homeName =
    node.home?.name || nameOf(entries, node.home?.id || node.homeId) || (node.homeSeed && !node.home ? displayFromSeed(node.homeSeed) : "");
  const awayName =
    node.away?.name || nameOf(entries, node.away?.id || node.awayId) || (node.awaySeed && !node.away ? displayFromSeed(node.awaySeed) : "");
  const bye = Boolean((homeName && !node.away && !awayName) || (awayName && !node.home && !homeName));
  const a = homeName || "Chưa xác định";
  const b = awayName || (bye ? "Miễn" : "Chưa xác định");
  const winner = live
    ? live.winnerId && String(live.winnerId) === String(live.entryAId)
      ? "a"
      : live.winnerId && String(live.winnerId) === String(live.entryBId)
        ? "b"
        : null
    : bye
      ? "a"
      : null;
  return {
    id: node.id,
    a,
    b,
    status: bye ? "completed" : live ? matchUiStatus(live) : homeName && awayName ? "upcoming" : "waiting",
    score: live ? scoreLabel(live) : bye ? "Miễn" : "—",
    winner,
    sourceA: node.homeSeed || "",
    sourceB: node.awaySeed || "",
    advancesTo: node.advancesTo || "",
    bye,
    round: roundKey,
  };
}

function mapLiveNode(match, entries, key) {
  const a = nameOf(entries, match.entryAId) || "Chưa xác định";
  const b = match.entryBId ? nameOf(entries, match.entryBId) || "Chưa xác định" : "Miễn";
  const bye = !match.entryBId && Boolean(match.entryAId);
  return {
    id: match.id,
    a,
    b,
    status: bye ? "completed" : matchUiStatus(match),
    score: bye ? "Miễn" : scoreLabel(match),
    winner: bye
      ? "a"
      : match.winnerId && String(match.winnerId) === String(match.entryAId)
        ? "a"
        : match.winnerId && String(match.winnerId) === String(match.entryBId)
          ? "b"
          : null,
    bye,
    round: key,
  };
}

function displayFromSeed(seed) {
  const text = String(seed || "");
  if (text.startsWith("W(")) return `Thắng ${text.slice(2, -1)}`;
  return text;
}

function deriveChampion(columns) {
  const finalColumn = columns.find((column) => column.id === "Final") || columns[columns.length - 1];
  const finalMatch = finalColumn?.matches?.find((match) => match.status === "completed" && match.winner);
  if (!finalMatch) return null;
  const name = finalMatch.winner === "a" ? finalMatch.a : finalMatch.b;
  if (!name || name === "Chưa xác định" || name === "Miễn") return null;
  return { id: "champion", a: name, b: "", status: "completed", winner: "a" };
}
