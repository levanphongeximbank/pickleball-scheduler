import { normalizeEntries } from "../../../../models/tournament/entry.js";
import { eventDisplayName, expectedPlayerCount, formatViDateTime, resolveBatchBEvent } from "../batchB/eventScope.js";
import { DRAW_LOCK_LABEL, resolveDrawRoomActionState } from "./drawRoomActionState.js";

function ratingLabel(value) {
  if (value == null || value === "" || Number(value) === 0) return "—";
  return String(value);
}

function splitPairName(name) {
  const raw = String(name || "").trim();
  if (!raw) return { a: "—", b: "—" };
  const parts = raw.split(/\s*\/\s*|\s+\+\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return { a: parts[0], b: parts[1] };
  return { a: raw, b: "—" };
}

export function derivePairDrawModel(tournament, { selectedEventId } = {}) {
  const scope = resolveBatchBEvent(tournament, selectedEventId);
  const event = scope.event;
  const needed = expectedPlayerCount(event);
  const entries = event ? normalizeEntries(event.entries) : [];
  const formed = [];
  const unpaired = [];

  entries.forEach((entry) => {
    const playerIds = Array.isArray(entry.playerIds) ? entry.playerIds.filter(Boolean) : [];
    if (needed >= 2 && playerIds.length >= 2) {
      const names = splitPairName(entry.name);
      formed.push({
        id: entry.id,
        number: formed.length + 1,
        a: names.a,
        b: names.b === "—" ? entry.name : names.b,
        total: ratingLabel(entry.rating),
        diff: "—",
        valid: true,
        time: formatViDateTime(entry.registeredAt) || "—",
        club: entry.clubName || entry.representativeClubName || "—",
        rating: ratingLabel(entry.rating),
      });
    } else {
      unpaired.push({
        id: entry.id,
        name: entry.name || "Chưa có tên",
        club: entry.clubName || entry.representativeClubName || "—",
        rating: ratingLabel(entry.rating),
      });
    }
  });

  const expectedTotal = entries.length;
  const drawnCount = formed.length;
  const last = formed[formed.length - 1] || null;
  const actionState = resolveDrawRoomActionState({
    drawnCount,
    expectedTotal,
    contentLocked: false,
    constraintsPass: false,
    remainingNoun: "cặp chưa bốc",
    lockAuthority: false,
  });

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: eventDisplayName(event),
    eventId: event?.id || "",
    needsEventChoice: scope.needsEventChoice,
    emptyEvents: scope.emptyEvents,
    events: scope.events,
    locked: false,
    drawnCount,
    expectedTotal,
    poolA: unpaired,
    poolB: [],
    live: last
      ? {
          number: last.number,
          playerA: { name: last.a, club: last.club, rating: last.rating },
          playerB: { name: last.b, club: "—", rating: "—" },
          valid: true,
          warning: null,
        }
      : { number: 0, playerA: null, playerB: null, valid: true, warning: null },
    ledger: formed,
    history: formed
      .slice()
      .reverse()
      .slice(0, 6)
      .map((row) => ({
        time: row.time,
        text: `#${String(row.number).padStart(2, "0")} ${row.a} + ${row.b}`,
        tone: "success",
      })),
    rules: [
      { label: "Tách CLB", status: "Chưa có dữ liệu", tone: "draft", note: "Chưa có luật tách CLB trên hồ sơ này." },
      { label: "Hạt giống", status: "Chưa có dữ liệu", tone: "draft", note: "Chưa có kiểm tra hạt giống trên màn này." },
      { label: "Bốc thăm ghép cặp", status: "Chưa có", tone: "warning", note: "Đang đọc cặp đã đăng ký cùng. Chưa có bốc thăm ghép riêng." },
    ],
    readinessItems: [
      { label: "Số lượt đã bốc", ready: actionState.drawComplete, note: `${drawnCount}/${expectedTotal || 0}` },
      { label: "Vi phạm luật", ready: true, note: "Chưa có dữ liệu vi phạm" },
      { label: "Kiểm tra ràng buộc", ready: false, note: "Chưa có dữ liệu ràng buộc" },
      { label: "Sẵn sàng khóa", ready: false, note: actionState.lockHelper },
    ],
    actionState,
    lockLabel: DRAW_LOCK_LABEL,
    lockHint: "Khóa bốc thăm ghép cặp chưa có trên hệ thống này.",
    undoHint: "Hoàn tác bốc thăm chưa có trên hệ thống này.",
    drawNextHint: "Bốc tiếp chưa có trên hệ thống này.",
    nextHint: "Chưa có trạng thái khóa bốc thăm ghép cặp.",
  };
}
