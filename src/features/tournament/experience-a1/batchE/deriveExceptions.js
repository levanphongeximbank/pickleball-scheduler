import { MATCH_STATUS } from "../../../../models/tournament/constants.js";
import { eventDisplayName } from "../batchB/eventScope.js";
import { projectEventMatches } from "./collectMatches.js";

function overlapConflict(matches) {
  const byCourt = new Map();
  for (const match of matches) {
    if (!match.courtId || !match.scheduledStart) continue;
    const list = byCourt.get(match.courtId) || [];
    list.push(match);
    byCourt.set(match.courtId, list);
  }
  const conflicts = [];
  for (const list of byCourt.values()) {
    const times = new Map();
    for (const match of list) {
      const key = String(match.scheduledStart);
      const existing = times.get(key);
      if (existing) {
        conflicts.push({ a: existing, b: match });
      } else {
        times.set(key, match);
      }
    }
  }
  return conflicts;
}

export function deriveExceptionModel(tournament, { selectedEventId = "all", severity = "all", type = "all", status = "all" } = {}) {
  const projected = projectEventMatches(tournament, selectedEventId);
  const items = [];
  for (const match of projected.matches) {
    if (match.rawStatus === MATCH_STATUS.POSTPONED || match.status === "attention") {
      items.push({
        id: `hoan-${match.id}`,
        title: `Trận ${match.id} đang hoãn`,
        type: "Trận hoãn",
        severity: "warning",
        status: "open",
        match: match.id,
        court: match.court,
        event: match.event,
        owner: "Hồ sơ giải",
        opened: match.time,
        description: "Trận đang ở trạng thái hoãn trên hồ sơ.",
        action: "Xem trận",
        timeline: [{ time: match.time, text: "Hoãn trên hồ sơ trận" }],
      });
    }
    if (match.rawStatus === MATCH_STATUS.FORFEIT) {
      items.push({
        id: `bo-cuoc-${match.id}`,
        title: `Trận ${match.id} bỏ cuộc / xử thua`,
        type: "Bỏ cuộc",
        severity: "warning",
        status: "resolved",
        match: match.id,
        court: match.court,
        event: match.event,
        owner: "Hồ sơ giải",
        opened: match.time,
        description: "Kết quả bỏ cuộc đã có trên hồ sơ trận.",
        action: "Xem trận",
        timeline: [{ time: match.time, text: "Bỏ cuộc trên hồ sơ trận" }],
      });
    }
    if (match.score === "Cần đồng bộ") {
      items.push({
        id: `ty-so-${match.id}`,
        title: `Tỷ số trận ${match.id} chưa đồng bộ`,
        type: "Lệch kết quả",
        severity: "danger",
        status: "open",
        match: match.id,
        court: match.court,
        event: match.event,
        owner: "Hồ sơ giải",
        opened: match.time,
        description: "Tỷ số trên hồ sơ chưa khớp giữa các nguồn đọc.",
        action: "Xem trận",
        timeline: [{ time: match.time, text: "Phát hiện lệch tỷ số khi đọc hồ sơ" }],
      });
    }
    if ((!match.referee || match.referee === "Chưa gán") && match.status !== "completed" && match.status !== "waiting") {
      items.push({
        id: `trong-tai-${match.id}`,
        title: `Trận ${match.id} chưa có trọng tài`,
        type: "Thiếu trọng tài",
        severity: "warning",
        status: "open",
        match: match.id,
        court: match.court,
        event: match.event,
        owner: "Hồ sơ giải",
        opened: match.time,
        description: "Trận đã có trên hồ sơ nhưng chưa gán trọng tài.",
        action: "Xem trọng tài",
        timeline: [{ time: match.time, text: "Chưa gán trọng tài" }],
      });
    }
  }
  for (const pair of overlapConflict(projected.matches)) {
    items.push({
      id: `xung-dot-${pair.a.id}-${pair.b.id}`,
      title: `Trùng giờ sân ${pair.a.court}`,
      type: "Xung đột lịch",
      severity: "danger",
      status: "open",
      match: `${pair.a.id} / ${pair.b.id}`,
      court: pair.a.court,
      event: pair.a.event,
      owner: "Hồ sơ giải",
      opened: pair.a.time,
      description: `${pair.a.id} và ${pair.b.id} cùng giờ trên cùng sân vật lý.`,
      action: "Xem lịch",
      timeline: [{ time: pair.a.time, text: "Phát hiện trùng giờ khi đọc lịch" }],
    });
  }

  const filtered = items.filter((item) => {
    if (severity !== "all" && item.severity !== severity) return false;
    if (type !== "all" && item.type !== type) return false;
    if (status !== "all" && item.status !== status) return false;
    return true;
  });

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: projected.event ? eventDisplayName(projected.event) : "Mọi nội dung",
    eventId: projected.event?.id || "",
    events: projected.events,
    emptyEvents: projected.emptyEvents,
    items: filtered,
    allItems: items,
    types: [...new Set(items.map((item) => item.type))],
    kpis: {
      open: items.filter((item) => item.status === "open").length,
      critical: items.filter((item) => item.severity === "danger" && item.status !== "resolved").length,
      watching: items.filter((item) => item.status === "watching").length,
      resolved: items.filter((item) => item.status === "resolved").length,
    },
  };
}
