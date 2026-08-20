import { MATCH_STATUS } from "../../../../models/tournament/constants.js";
import { normalizeGroups } from "../../../../models/tournament/group.js";
import { buildGroupStandingFromMatches } from "../../../../tournament/engines/rankingEngine.js";
import { eventDisplayName, resolveBatchBEvent } from "../batchB/eventScope.js";
import {
  eventMatches,
  isKnockoutMatch,
  matchUiStatus,
  resolveEntries,
  scoreLabel,
} from "./matchPresentation.js";

function qualificationForRow(rank, qualifiersPerGroup) {
  if (!Number.isFinite(qualifiersPerGroup) || qualifiersPerGroup <= 0) {
    return { qualState: "undetermined", qualLabel: "Chưa cấu hình" };
  }
  if (rank <= qualifiersPerGroup) {
    return { qualState: "qualified", qualLabel: "Đã giành quyền đi tiếp" };
  }
  return { qualState: "undetermined", qualLabel: "Chưa xác định" };
}

export function deriveStandingsModel(tournament, { selectedEventId, tab = "group", groupId = "" } = {}) {
  const scope = resolveBatchBEvent(tournament, selectedEventId);
  const event = scope.event;
  const entries = resolveEntries(event);
  const groups = event ? normalizeGroups(event.groups) : [];
  const matches = eventMatches(event);
  const selected =
    groups.find((group) => String(group.id) === String(groupId)) ||
    (groups.length === 1 ? groups[0] : null);
  const configuredQualifiers = Number(event?.bracket?.qualifiersPerGroup);
  const hasQualConfig = Number.isFinite(configuredQualifiers) && configuredQualifiers > 0;

  const groupMatches = selected
    ? matches.filter(
        (match) =>
          !isKnockoutMatch(match) &&
          (String(match.groupId) === String(selected.id) ||
            String(match.group) === String(selected.label || selected.name))
      )
    : matches.filter((match) => !isKnockoutMatch(match));

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
        matches: groupMatches,
        pointsConfig: selected.pointsConfig,
      })
    : { standing: [] };

  const remaining = groupMatches.filter(
    (match) => match.status !== MATCH_STATUS.COMPLETED && match.status !== MATCH_STATUS.FORFEIT
  ).length;

  const standings = standingPack.standing.map((row, index) => {
    const qual =
      hasQualConfig && remaining === 0
        ? qualificationForRow(index + 1, configuredQualifiers)
        : hasQualConfig
          ? { qualState: "undetermined", qualLabel: "Chưa xác định" }
          : { qualState: "undetermined", qualLabel: "Chưa cấu hình" };
    return {
      rank: index + 1,
      pair: row.name,
      played: row.played,
      won: row.won,
      lost: row.lost,
      points: row.matchPoints,
      diff: row.scoreDiff,
      ...qual,
    };
  });

  const koMatches = matches.filter((match) => isKnockoutMatch(match)).map((match) => {
    const a = entries.find((entry) => String(entry.id) === String(match.entryAId))?.name || "Chưa xác định";
    const b = entries.find((entry) => String(entry.id) === String(match.entryBId))?.name || "Chưa xác định";
    const winner =
      match.winnerId && String(match.winnerId) === String(match.entryAId)
        ? a
        : match.winnerId && String(match.winnerId) === String(match.entryBId)
          ? b
          : "Chưa xác định";
    return {
      id: match.id,
      round: stageFromMatch(match),
      a,
      b,
      score: scoreLabel(match),
      winner,
      status: matchUiStatus(match),
    };
  });

  const finalPreview = koMatches
    .filter((row) => row.round === "Chung kết" && row.status === "completed")
    .map((row, index) => ({
      place: index === 0 ? "Vô địch (xem trước)" : `Hạng ${index + 1}`,
      pair: row.winner,
      note: row.score,
    }));

  const readinessItems = [
    {
      label: remaining === 0 && groupMatches.length > 0 ? "Hết trận vòng bảng trên hồ sơ" : "Còn trận vòng bảng",
      ready: remaining === 0 && groupMatches.length > 0,
      note: `${groupMatches.length - remaining}/${groupMatches.length || 0}`,
    },
    {
      label: hasQualConfig ? `Suất đi tiếp: ${configuredQualifiers}/bảng` : "Chưa cấu hình suất đi tiếp",
      ready: hasQualConfig,
    },
    {
      label: "Chốt BXH nội dung",
      ready: false,
      note: "Chưa có khóa bảng xếp hạng theo nội dung.",
    },
  ];

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: eventDisplayName(event),
    eventId: event?.id || "",
    events: scope.events,
    needsEventChoice: scope.needsEventChoice,
    emptyEvents: scope.emptyEvents,
    tab,
    groups: groups.map((group) => ({ id: group.id, label: group.label || group.name || group.id })),
    selectedGroupId: selected?.id || "",
    selectedGroupLabel: selected?.label || selected?.name || "",
    standings,
    koMatches,
    finalPreview,
    hasQualConfig,
    lockHint: "Chốt bảng xếp hạng nội dung chưa có trên hệ thống này.",
    readinessItems,
    notReady: true,
  };
}

function stageFromMatch(match) {
  if (match.stage === "final") return "Chung kết";
  if (match.stage === "semifinal") return "Bán kết";
  if (match.stage === "quarterfinal") return "Tứ kết";
  if (match.stage === "round_of_16") return "Vòng 16";
  return "Loại trực tiếp";
}
