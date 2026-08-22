import { eventDisplayName, resolveBatchBEvent } from "../batchB/eventScope.js";
import { listTournamentEvents, isOfficialOpenFamily } from "../deriveOverview.js";
import { projectOfficialMatchCenter } from "../../official-tournament-experience/operationsProjection.js";
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
} from "./matchPresentation.js";

function toCard(match, event, entries, courtsMap, groups, tournament = null) {
  const group = groups.find((item) => String(item.id) === String(match.groupId));
  const a = entries.find((entry) => String(entry.id) === String(match.entryAId))?.name || "Chưa xác định";
  const b = entries.find((entry) => String(entry.id) === String(match.entryBId))?.name || "Chưa xác định";
  const issues = [];
  if (matchUiStatus(match) === "attention") issues.push("Trận đang hoãn / cần xử lý");
  if (scoreLabel(match) === "Cần đồng bộ") issues.push("Tỷ số chưa đồng bộ");
  return {
    id: match.id,
    event: eventDisplayName(event),
    eventId: event?.id || "",
    stage: stageLabel(match, group?.label),
    group: group?.label || group?.name || "—",
    a,
    b,
    time: matchTime(match),
    court: courtLabel(match, courtsMap),
    referee: refereeLabel(match),
    status: matchUiStatus(match),
    score: scoreLabel(match),
    games: Array.isArray(match.games)
      ? match.games.map((game, index) => ({
          set: game.set || index + 1,
          a: game.a ?? game.scoreA,
          b: game.b ?? game.scoreB,
        }))
      : [],
    timeline: Array.isArray(match.scoreLog)
      ? match.scoreLog.slice(-6).map((item) => ({
          time: item.at || item.time || "",
          text: item.note || item.action || "Cập nhật tỷ số",
        }))
      : [],
    issues,
    refereeLaunchTo: refereeLaunchTo(match, tournament),
  };
}

export function deriveMatchCenterModel(tournament, options = {}) {
  const base = deriveMatchCenterModelBase(tournament, options);
  if (!isOfficialOpenFamily(tournament) && !tournament?.officialMode) {
    return base;
  }
  const selectedEventId =
    options.selectedEventId && options.selectedEventId !== "all"
      ? options.selectedEventId
      : "";
  const projection = projectOfficialMatchCenter(tournament, { selectedEventId });
  return {
    ...base,
    official: true,
    needsEventChoice:
      listTournamentEvents(tournament).length > 1 &&
      (!options.selectedEventId || options.selectedEventId === "all"),
    lifecycleAuthority: projection.lifecycleAuthority,
    scoringAuthority: projection.scoringAuthority,
    resultAuthority: projection.resultAuthority,
    refereeAuthority: projection.refereeAuthority,
    scoringDenied: true,
    scoringHint: projection.scoringHint,
    lifecycleHint: projection.lifecycleHint,
    liveScoreTreatedAsFinal: false,
    completedTreatedAsAccepted: false,
  };
}

function deriveMatchCenterModelBase(
  tournament,
  {
    selectedEventId = "all",
    stage = "all",
    groupId = "all",
    court = "all",
    referee = "all",
    status = "all",
    selectedMatchId = "",
  } = {}
) {
  const events = listTournamentEvents(tournament);
  const scope =
    selectedEventId && selectedEventId !== "all"
      ? resolveBatchBEvent(tournament, selectedEventId)
      : { events, event: null, needsEventChoice: false, emptyEvents: events.length === 0 };
  const courtsMap = courtsByIdMap(tournament);
  const sourceEvents =
    selectedEventId === "all" || !selectedEventId ? events : scope.event ? [scope.event] : [];
  const rows = [];
  for (const event of sourceEvents) {
    const entries = resolveEntries(event);
    const groups = Array.isArray(event?.groups) ? event.groups : [];
    for (const match of eventMatches(event)) {
      rows.push(toCard(match, event, entries, courtsMap, groups, tournament));
    }
  }

  const groups = sourceEvents.flatMap((event) =>
    (event.groups || []).map((group) => ({ id: group.id, label: group.label || group.name || group.id }))
  );
  const filtered = rows.filter((row) => {
    if (stage === "group" && !String(row.stage).includes("bảng") && row.stage !== "Vòng bảng") {
      return false;
    }
    if (stage === "ko" && String(row.stage).includes("bảng")) return false;
    if (groupId !== "all") {
      const group = groups.find((item) => String(item.id) === String(groupId) || item.label === groupId);
      if (group && row.group !== group.label && String(row.group) !== String(group.id)) return false;
      if (!group && row.group !== groupId) return false;
    }
    if (court !== "all" && row.court !== court) return false;
    if (referee !== "all") {
      if (referee === "none" && row.referee !== "Chưa gán") return false;
      if (referee !== "none" && row.referee !== referee) return false;
    }
    if (status !== "all" && row.status !== status) return false;
    return true;
  });

  const selected =
    filtered.find((row) => String(row.id) === String(selectedMatchId)) || filtered[0] || null;
  const uniqueCourts = [
    ...new Set(rows.map((row) => row.court).filter((item) => item && item !== "Chưa gán sân")),
  ];
  const uniqueReferees = [
    ...new Set(rows.map((row) => row.referee).filter((item) => item && item !== "Chưa gán")),
  ];

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    events,
    emptyEvents: events.length === 0,
    needsEventChoice: false,
    rows: filtered,
    selected,
    kpis: {
      total: rows.length,
      upcoming: rows.filter((row) => row.status === "upcoming" || row.status === "waiting").length,
      live: rows.filter((row) => row.status === "live").length,
      completed: rows.filter((row) => row.status === "completed").length,
      attention: rows.filter((row) => row.status === "attention" || row.score === "Cần đồng bộ").length,
    },
    groups,
    courts: uniqueCourts,
    referees: uniqueReferees,
    scoringDenied: true,
    official: false,
    lifecycleAuthority: null,
    scoringAuthority: null,
    resultAuthority: null,
    refereeAuthority: null,
  };
}
