import { MATCH_STATUS } from "../../../../models/tournament/constants.js";
import { normalizeEntries } from "../../../../models/tournament/entry.js";
import { normalizeGroups } from "../../../../models/tournament/group.js";
import { normalizeMatches } from "../../../../models/tournament/match.js";
import { buildGroupStandingFromMatches } from "../../../../tournament/engines/rankingEngine.js";
import { eventDisplayName, resolveBatchBEvent } from "../batchB/eventScope.js";

function matchUiStatus(match) {
  if (match.status === MATCH_STATUS.PLAYING) return { key: "live", label: "ĐANG THI ĐẤU" };
  if (match.status === MATCH_STATUS.COMPLETED || match.status === MATCH_STATUS.FORFEIT) {
    return { key: "completed", label: "HOÀN TẤT" };
  }
  if (match.status === MATCH_STATUS.POSTPONED) return { key: "attention", label: "CẦN XỬ LÝ" };
  if (match.status === MATCH_STATUS.ASSIGNED) return { key: "upcoming", label: "TIẾP THEO" };
  return { key: "waiting", label: "ĐANG CHỜ" };
}

function scoreLabel(match) {
  if (match.scoreA == null && match.scoreB == null) return "—";
  return `${match.scoreA ?? "—"}–${match.scoreB ?? "—"}`;
}

function entryName(entries, id) {
  const found = entries.find((entry) => String(entry.id) === String(id));
  return found?.name || "Chưa xác định";
}

export function deriveGroupStageModel(tournament, { selectedEventId, selectedGroupId } = {}) {
  const scope = resolveBatchBEvent(tournament, selectedEventId);
  const event = scope.event;
  const entries = event ? normalizeEntries(event.entries) : [];
  const groups = event ? normalizeGroups(event.groups) : [];
  const eventMatches = event ? normalizeMatches(event.matches) : [];
  const selected =
    groups.find((group) => String(group.id) === String(selectedGroupId)) ||
    (groups.length === 1 ? groups[0] : null);

  const nestedMatches = selected ? normalizeMatches(selected.matches || []) : [];
  const matches = nestedMatches.length ? nestedMatches : eventMatches;
  const groupMatches = selected
    ? nestedMatches.length
      ? nestedMatches
      : matches.filter(
          (match) =>
            String(match.groupId) === String(selected.id) || String(match.group) === String(selected.label)
        )
    : [];
  const played = groupMatches.filter(
    (match) => match.status === MATCH_STATUS.COMPLETED || match.status === MATCH_STATUS.FORFEIT
  ).length;
  const remaining = Math.max(0, groupMatches.length - played);
  const liveMatch = groupMatches.find((match) => match.status === MATCH_STATUS.PLAYING);
  const nextMatch = groupMatches.find(
    (match) => match.status === MATCH_STATUS.WAITING || match.status === MATCH_STATUS.ASSIGNED
  );

  const standingPack = selected
    ? buildGroupStandingFromMatches({
        group: {
          ...selected,
          entryIds: (selected.entryIds?.length
            ? selected.entryIds
            : (selected.entries || []).map((entry) => entry.id)
          ).filter(Boolean),
        },
        entries,
        matches: groupMatches.length ? groupMatches : matches,
        pointsConfig: selected.pointsConfig,
      })
    : { standing: [] };

  const standings = standingPack.standing.map((row, index) => ({
    rank: index + 1,
    pair: row.name,
    played: row.played,
    won: row.won,
    lost: row.lost,
    points: row.matchPoints,
    diff: row.scoreDiff,
    qualState: "undetermined",
    qualLabel: "Chưa xác định",
  }));

  const matchCards = groupMatches.map((match) => {
    const ui = matchUiStatus(match);
    return {
      id: match.id,
      a: entryName(entries, match.entryAId),
      b: entryName(entries, match.entryBId),
      status: ui.key,
      statusLabel: ui.label,
      score: scoreLabel(match),
      court: match.courtId != null ? `Sân ${match.courtId}` : "Chưa gán sân",
      time: match.startedAt || "—",
      referee: match.referee?.name || "—",
      group: selected?.label || selected?.name || "",
      stage: "Vòng bảng",
    };
  });

  const courts = [...new Set(groupMatches.map((match) => match.courtId).filter((id) => id != null && String(id).trim()))];

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: eventDisplayName(event),
    eventId: event?.id || "",
    needsEventChoice: scope.needsEventChoice,
    emptyEvents: scope.emptyEvents,
    events: scope.events,
    groups: groups.map((group) => ({ id: group.id, label: group.label || group.name || group.id })),
    selectedGroupId: selected?.id || "",
    selectedGroupLabel: selected?.label || selected?.name || "",
    kpis: {
      pairs: selected ? (selected.entryIds?.length || standingPack.standing.length) : 0,
      played,
      remaining,
      qualified: "—",
      qualifiedHint: "Chưa cấu hình số suất đi tiếp",
    },
    standings,
    matches: matchCards,
    liveMatch: liveMatch
      ? {
          id: liveMatch.id,
          court: liveMatch.courtId != null ? `Sân ${liveMatch.courtId}` : "Chưa gán sân",
          a: entryName(entries, liveMatch.entryAId),
          b: entryName(entries, liveMatch.entryBId),
          score: scoreLabel(liveMatch),
        }
      : null,
    nextMatch: nextMatch
      ? {
          id: nextMatch.id,
          time: nextMatch.startedAt || "—",
          a: entryName(entries, nextMatch.entryAId),
          b: entryName(entries, nextMatch.entryBId),
          court: nextMatch.courtId != null ? `Sân ${nextMatch.courtId}` : "Chưa gán sân",
          referee: nextMatch.referee?.name || "—",
        }
      : null,
    courts: courts.map((id) => `Sân ${id}`),
    lockHint: "Chốt bảng xếp hạng nội dung chưa có trên hệ thống này.",
    scoringHint: "Màn này chỉ đọc tỷ số. Ghi điểm thuộc luồng trọng tài / điều hành hiện có.",
  };
}
