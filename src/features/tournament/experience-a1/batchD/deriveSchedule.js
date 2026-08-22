import { isSchedulePublished } from "../../../../tournament/engines/publishScheduleEngine.js";
import { eventDisplayName, resolveBatchBEvent } from "../batchB/eventScope.js";
import { isOfficialOpenFamily } from "../deriveOverview.js";
import { projectOfficialSchedule } from "../../official-tournament-experience/operationsProjection.js";
import {
  courtLabel,
  courtsByIdMap,
  eventMatches,
  isKnockoutMatch,
  isMatchScheduled,
  listTournamentCourts,
  matchTime,
  matchUiStatus,
  resolveEntries,
  scoreLabel,
} from "./matchPresentation.js";

function collectConflicts(matches) {
  const buckets = new Map();
  for (const match of matches) {
    if (match.courtId == null || !isMatchScheduled(match)) continue;
    const key = `${match.courtId}|${matchTime(match)}`;
    const list = buckets.get(key) || [];
    list.push(match);
    buckets.set(key, list);
  }
  const conflicts = [];
  for (const [key, list] of buckets) {
    if (list.length < 2) continue;
    const [courtId, time] = key.split("|");
    conflicts.push({
      id: key,
      text: `${list.map((item) => item.id).join(", ")} trùng sân ${courtId} lúc ${time}`,
    });
  }
  return conflicts;
}

function buildGrid(matches, courts, courtsMap) {
  const times = [...new Set(matches.filter(isMatchScheduled).map((match) => matchTime(match)))]
    .filter((item) => item && item !== "—")
    .sort();
  return times.map((time) => {
    const row = { time };
    for (const court of courts) {
      const cellMatches = matches.filter(
        (match) => String(match.courtId) === String(court.id) && matchTime(match) === time
      );
      if (!cellMatches.length) {
        row[court.id] = { status: "empty" };
        continue;
      }
      const conflict = cellMatches.length > 1;
      const live = cellMatches.some((match) => matchUiStatus(match) === "live");
      const done = cellMatches.every((match) => matchUiStatus(match) === "completed");
      row[court.id] = {
        status: conflict ? "conflict" : live ? "live" : done ? "completed" : "upcoming",
        match: cellMatches.map((item) => item.id).join(", "),
        meta: cellMatches
          .map((item) => `${scoreLabel(item)} • ${courtLabel(item, courtsMap)}`)
          .join(" · "),
      };
    }
    return row;
  });
}

export function deriveScheduleModel(tournament, options = {}) {
  const base = deriveScheduleModelBase(tournament, options);
  if (!isOfficialOpenFamily(tournament) && !tournament?.officialMode) {
    return base;
  }
  const projection = projectOfficialSchedule(tournament, {
    selectedEventId: options.selectedEventId,
  });
  return {
    ...base,
    official: true,
    assignScheduleEnabled: projection.assignEnabled === true,
    publishScheduleEnabled: projection.publishEnabled === true,
    clusterUsedAsPhysicalCourt: projection.clusterUsedAsPhysicalCourt === true,
    courtAuthority: projection.courtAuthority,
    blocker: projection.blocker || (base.needsEventChoice ? { code: "EVENT_REQUIRED", error: "Chọn nội dung." } : null),
    courtEngineForbidden: false,
    publishHint: projection.publishEnabled
      ? "Công bố lịch (settings.schedule) — không tạo trận mới."
      : base.publishHint,
    allocationHint: projection.assignEnabled
      ? "Gán giờ/sân qua scheduleOfficialGroupMatches (sân vật lý)."
      : base.allocationHint,
  };
}

function deriveScheduleModelBase(tournament, { selectedEventId, stage = "group", groupId = "", day = "" } = {}) {
  const scope = resolveBatchBEvent(tournament, selectedEventId);
  const event = scope.event;
  const entries = resolveEntries(event);
  const allMatches = eventMatches(event);
  const groups = Array.isArray(event?.groups) ? event.groups : [];
  const selectedGroup =
    groups.find((group) => String(group.id) === String(groupId)) ||
    (groups.length === 1 ? groups[0] : null);

  let matches = allMatches;
  if (stage === "group") {
    matches = allMatches.filter((match) => !isKnockoutMatch(match));
    if (selectedGroup) {
      matches = matches.filter(
        (match) =>
          String(match.groupId) === String(selectedGroup.id) ||
          String(match.group) === String(selectedGroup.label || selectedGroup.name)
      );
    }
  } else if (stage === "ko") {
    matches = allMatches.filter((match) => isKnockoutMatch(match));
  }

  const unscheduled = matches.filter((match) => !isMatchScheduled(match));
  const conflicts = collectConflicts(matches);
  const unscheduledCount = unscheduled.length;
  const conflictCount = conflicts.length;
  const courts = listTournamentCourts(tournament);
  const courtsMap = courtsByIdMap(tournament);
  const usedCourtIds = new Set(matches.map((match) => (match.courtId == null ? "" : String(match.courtId))).filter(Boolean));
  const published = isSchedulePublished(tournament);
  const unscheduledReady = unscheduledCount === 0;
  const conflictReady = conflictCount === 0;
  const courtsReady = courts.length > 0;
  const readinessItems = [
    {
      label: courts.length
        ? `${courts.length} sân vật lý trên hồ sơ giải`
        : "Chưa có sân trên hồ sơ giải",
      ready: courtsReady,
      note: "Đây là tập sân của cả giải, chưa phải phân bổ theo nội dung.",
    },
    {
      label: unscheduledCount === 0 ? "Không còn trận chưa xếp lịch" : `Còn ${unscheduledCount} trận chưa xếp`,
      ready: unscheduledReady,
      note: matches.length ? undefined : "Chưa có trận trên nội dung đã chọn.",
    },
    {
      label: conflictCount === 0 ? "Không có xung đột sân / giờ" : `Còn ${conflictCount} xung đột`,
      ready: conflictReady,
    },
  ];
  const notReady = readinessItems.some((item) => !item.ready);
  const scheduleStatusLabel = published ? "Đã công bố" : notReady ? "Bản nháp" : "Sẵn sàng";
  const days = tournament?.courtSchedule?.date
    ? [{ id: tournament.courtSchedule.date, label: tournament.courtSchedule.date }]
    : [];

  const cards = matches.map((match) => ({
    id: match.id,
    a: entryNameSafe(entries, match.entryAId),
    b: entryNameSafe(entries, match.entryBId),
    court: courtLabel(match, courtsMap),
    time: matchTime(match),
    status: matchUiStatus(match),
    score: scoreLabel(match),
    event: eventDisplayName(event),
    stage: stage === "ko" ? "Loại trực tiếp" : "Vòng bảng",
    group: selectedGroup?.label || selectedGroup?.name || "—",
  }));

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: eventDisplayName(event),
    eventId: event?.id || "",
    events: scope.events,
    needsEventChoice: scope.needsEventChoice,
    emptyEvents: scope.emptyEvents,
    venueName: tournament?.venueName || tournament?.hostClubName || "Địa điểm trên hồ sơ giải",
    clusterHint: tournament?.courtSchedule?.clusterId
      ? `Cụm ${tournament.courtSchedule.clusterId}`
      : "Cụm sân / địa điểm trên hồ sơ giải",
    courts,
    usedCourtIds: [...usedCourtIds],
    days,
    selectedDay: day || days[0]?.id || "",
    groups: groups.map((group) => ({ id: group.id, label: group.label || group.name || group.id })),
    selectedGroupId: selectedGroup?.id || "",
    selectedGroupLabel: selectedGroup?.label || selectedGroup?.name || "",
    unscheduledCount,
    conflictCount,
    unscheduled,
    conflicts,
    readinessItems,
    notReady,
    published,
    scheduleStatusLabel,
    publishHint:
      "Công bố lịch hiện áp dụng cả giải, không theo từng nội dung. Không mở ghi phân bổ sân trên màn này.",
    allocationHint: "Chưa có phân bổ sân theo nội dung. Các sân dưới đây thuộc hồ sơ giải.",
    grid: buildGrid(matches, courts, courtsMap),
    cards,
    courtEngineForbidden: true,
    official: false,
    assignScheduleEnabled: false,
    publishScheduleEnabled: false,
  };
}

function entryNameSafe(entries, id) {
  const found = entries.find((entry) => String(entry.id) === String(id));
  return found?.name || "Chưa xác định";
}
