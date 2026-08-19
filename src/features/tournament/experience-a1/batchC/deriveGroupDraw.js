import { normalizeEntries } from "../../../../models/tournament/entry.js";
import { normalizeGroups } from "../../../../models/tournament/group.js";
import { isDrawLocked, getDrawPublishStatus } from "../../../../tournament/engines/publishDrawEngine.js";
import { eventDisplayName, resolveBatchBEvent } from "../batchB/eventScope.js";
import { DRAW_LOCK_LABEL, resolveDrawRoomActionState } from "./drawRoomActionState.js";
import { MULTI_CONTENT_LIMITATION } from "./actionMatrix.js";

export function deriveGroupDrawModel(tournament, { selectedEventId } = {}) {
  const scope = resolveBatchBEvent(tournament, selectedEventId);
  const event = scope.event;
  const entries = event ? normalizeEntries(event.entries) : [];
  const groups = event ? normalizeGroups(event.groups) : [];
  const assignedIds = new Set();
  const groupCards = groups.map((group) => {
    const groupEntries = (group.entryIds || [])
      .map((id) => entries.find((entry) => String(entry.id) === String(id)))
      .filter(Boolean);
    if (!groupEntries.length && Array.isArray(group.entries)) {
      group.entries.forEach((entry) => {
        if (entry?.id) groupEntries.push(entry);
      });
    }
    groupEntries.forEach((entry) => assignedIds.add(String(entry.id)));
    return {
      id: group.label || group.name || group.id,
      count: groupEntries.length,
      capacity: groupEntries.length || 0,
      seedSummary: groupEntries.some((entry) => entry.seed != null) ? "Có hạt giống trên hồ sơ" : "Chưa có",
      pairs: groupEntries.map((entry) => entry.name),
      entryIds: groupEntries.map((entry) => entry.id),
    };
  });

  const awaiting = entries.filter((entry) => !assignedIds.has(String(entry.id)));
  const ledger = [];
  groupCards.forEach((group) => {
    group.pairs.forEach((name, index) => {
      ledger.push({
        id: `${group.id}-${index}`,
        pair: name,
        group: group.id,
        seed: "—",
        position: index + 1,
        status: "Hợp lệ",
      });
    });
  });

  const expectedTotal = entries.length;
  const drawnCount = assignedIds.size;
  const locked = Boolean(tournament && isDrawLocked(tournament));
  const publish = getDrawPublishStatus(tournament);
  const statusLabel =
    publish.status === "published" ? "Đã công bố" : publish.status === "locked" ? "Đã khóa" : "Bản nháp";
  const actionState = resolveDrawRoomActionState({
    drawnCount,
    expectedTotal,
    locked,
    constraintsPass: groups.length > 0 && awaiting.length === 0,
    remainingNoun: "cặp chưa chia bảng",
    lockAuthority: false,
  });
  const last = ledger[ledger.length - 1] || null;

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: eventDisplayName(event),
    eventId: event?.id || "",
    needsEventChoice: scope.needsEventChoice,
    emptyEvents: scope.emptyEvents,
    events: scope.events,
    locked,
    drawStatusLabel: statusLabel,
    multiContentLimitation: MULTI_CONTENT_LIMITATION,
    drawnCount,
    expectedTotal,
    awaiting: awaiting.map((entry) => ({
      id: entry.id,
      name: entry.name,
      seed: entry.seed != null ? entry.seed : "—",
      pool: "Hồ sơ giải",
    })),
    groupCards,
    live: last
      ? {
          number: ledger.length,
          pair: last.pair,
          group: last.group,
          position: last.position,
          capacity: groupCards.find((item) => item.id === last.group)?.count || last.position,
          valid: true,
        }
      : { number: 0, pair: "Chưa có cặp", group: "—", position: 0, capacity: 0, valid: true },
    ledger,
    history: ledger
      .slice()
      .reverse()
      .slice(0, 6)
      .map((row) => ({
        time: "—",
        text: `${row.pair} → Bảng ${row.group}`,
        tone: "success",
      })),
    summary: {
      totalPairs: entries.length,
      groups: groups.length,
      method: "Đọc từ hồ sơ giải",
      seedRule: "Chưa cấu hình trên màn này",
    },
    rules: [
      { label: "Sức chứa bảng", status: groups.length ? "Theo hồ sơ" : "Chưa có bảng", tone: groups.length ? "info" : "warning", note: groups.length ? `${groups.length} bảng trên hồ sơ` : "Chưa có bảng trên nội dung này." },
      { label: "Khóa theo nội dung", status: "Chưa có", tone: "warning", note: MULTI_CONTENT_LIMITATION },
    ],
    readinessItems: [
      { label: "Đã bốc xong", ready: actionState.drawComplete, note: `${drawnCount}/${expectedTotal || 0}` },
      { label: "Sức chứa cân bằng", ready: groups.length > 0, note: groups.length ? `${groups.length} bảng` : "Chưa có bảng" },
      { label: "Luật hạt giống đạt", ready: false, note: "Chưa có dữ liệu" },
      { label: "Không vi phạm", ready: true, note: "Chưa có dữ liệu vi phạm" },
      { label: "Sẵn sàng khóa", ready: false, note: actionState.lockHelper },
    ],
    actionState,
    lockLabel: DRAW_LOCK_LABEL,
    lockHint: MULTI_CONTENT_LIMITATION,
    undoHint: "Hoàn tác bốc thăm chia bảng chưa có trên màn này.",
    drawNextHint: "Không bốc từng cặp trên màn này.",
    nextHint: locked ? "Hồ sơ giải đã khóa bốc thăm." : "Chưa khóa bốc thăm trên hồ sơ giải.",
  };
}
