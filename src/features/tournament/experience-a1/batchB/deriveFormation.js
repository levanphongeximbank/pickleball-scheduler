import { normalizeEntries } from "../../../../models/tournament/entry.js";
import { eventDisplayName, expectedPlayerCount, resolveBatchBEvent } from "./eventScope.js";

export const FORMATION_MODE_ITEMS = Object.freeze([
  { id: "together", label: "Đăng ký cùng", available: true },
  { id: "manual", label: "BTC ghép thủ công", available: false },
  { id: "random", label: "Ghép ngẫu nhiên", available: false },
  { id: "rating", label: "Cân bằng Rating", available: false },
  { id: "draft", label: "Chọn theo lượt", available: false },
  { id: "hybrid", label: "Kết hợp", available: false },
]);

export const FORMATION_MODE_IMPACT = Object.freeze({
  together: "Ưu tiên cặp đăng ký chung. BTC chỉ xử lý ngoại lệ.",
  manual: "Ghép thủ công chưa có trên hệ thống này. Danh sách dưới đây là cặp đã đăng ký cùng.",
  random: "Ghép ngẫu nhiên chưa có trên hệ thống này. Danh sách dưới đây là cặp đã đăng ký cùng.",
  rating: "Cân bằng Rating chưa có trên hệ thống này. Danh sách dưới đây là cặp đã đăng ký cùng.",
  draft: "Chọn theo lượt chưa có trên hệ thống này. Danh sách dưới đây là cặp đã đăng ký cùng.",
  hybrid: "Kết hợp chưa có trên hệ thống này. Danh sách dưới đây là cặp đã đăng ký cùng.",
});

function splitPairName(name) {
  const raw = String(name || "").trim();
  if (!raw) return { a: "—", b: "—" };
  const parts = raw.split(/\s*\/\s*|\s+\+\s+/).map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) return { a: parts[0], b: parts[1] };
  return { a: raw, b: "—" };
}

function ratingLabel(value) {
  if (value == null || value === "" || Number(value) === 0) return "—";
  return String(value);
}

export function deriveFormationModel(tournament, { selectedEventId, mode = "together" } = {}) {
  const scope = resolveBatchBEvent(tournament, selectedEventId);
  const event = scope.event;
  const needed = expectedPlayerCount(event);
  const entries = event ? normalizeEntries(event.entries) : [];
  const formed = [];
  const unpaired = [];
  let athleteCount = 0;
  let pairedCount = 0;

  entries.forEach((entry, index) => {
    const playerIds = Array.isArray(entry.playerIds) ? entry.playerIds.filter(Boolean) : [];
    const size = playerIds.length || (entry.name ? 1 : 0);
    athleteCount += size;
    if (playerIds.length >= needed && needed >= 2) {
      const names = splitPairName(entry.name);
      formed.push({
        id: entry.id || `PAIR-${String(index + 1).padStart(2, "0")}`,
        a: names.a,
        b: names.b === "—" && playerIds.length >= 2 ? entry.name : names.b,
        mode: "Đăng ký cùng",
        seed: entry.seed != null ? entry.seed : "—",
        ratingA: ratingLabel(entry.ratingA),
        ratingB: ratingLabel(entry.ratingB),
        combined: entry.rating ? ratingLabel(entry.rating) : "—",
        source: "Đăng ký",
        status: "Valid",
      });
      pairedCount += size;
    } else if (needed === 1 && playerIds.length >= 1) {
      formed.push({
        id: entry.id,
        a: entry.name,
        b: "",
        mode: "Đăng ký cùng",
        seed: entry.seed != null ? entry.seed : "—",
        ratingA: ratingLabel(entry.rating),
        ratingB: "—",
        combined: ratingLabel(entry.rating),
        source: "Đăng ký",
        status: "Valid",
      });
      pairedCount += size;
    } else {
      unpaired.push({
        id: entry.id,
        name: entry.name || "Chưa có tên",
        club: entry.clubName || entry.representativeClubName || "—",
        rating: ratingLabel(entry.rating),
        seed: entry.seed != null ? entry.seed : "—",
        status: "Chưa ghép",
      });
    }
  });

  const unpairedAthletes = athleteCount - pairedCount;
  const progressPct = athleteCount ? Math.round((pairedCount / athleteCount) * 100) : 0;
  const warningCount = formed.filter((pair) => pair.status === "Warning").length;
  const selectedMode = FORMATION_MODE_ITEMS.find((item) => item.id === mode) || FORMATION_MODE_ITEMS[0];
  const notReady = unpairedAthletes > 0 || warningCount > 0;
  const readinessItems = [
    {
      label: "Tất cả VĐV đã ghép",
      ready: unpairedAthletes === 0,
      note: unpairedAthletes ? `${unpairedAthletes} VĐV chưa ghép` : "Đạt",
    },
    {
      label: "Không cặp không hợp lệ",
      ready: warningCount === 0,
      note: warningCount ? `${warningCount} cặp cảnh báo` : "Đạt",
    },
    {
      label: "Đã chốt cặp / đội",
      ready: false,
      note: "Chưa chốt cặp/đội",
    },
  ];

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: eventDisplayName(event),
    eventId: event?.id || "",
    needsEventChoice: scope.needsEventChoice,
    emptyEvents: scope.emptyEvents,
    events: scope.events,
    mode: selectedMode.id,
    modeLabel: selectedMode.label,
    modeAvailable: selectedMode.available === true,
    modeImpact: FORMATION_MODE_IMPACT[selectedMode.id] || FORMATION_MODE_IMPACT.together,
    modes: FORMATION_MODE_ITEMS,
    kpis: {
      athletes: athleteCount,
      paired: pairedCount,
      unpaired: unpairedAthletes,
      formed: formed.length,
      warnings: warningCount,
    },
    progressPct,
    formed,
    unpaired,
    notReady: true,
    lockEnabled: false,
    lockHint: "Chốt cặp / đội chưa có trên hệ thống này.",
    drawEnabled: false,
    drawHint: "Bốc thăm ghép chưa mở trên màn này.",
    createPairEnabled: false,
    createPairHint: "Ghép thủ công chưa có trên hệ thống này.",
    readinessItems,
    readinessTitle: notReady ? "Chưa sẵn sàng hình thành cặp" : "Sẵn sàng chốt cặp/đội",
    readinessStatusLabel: notReady
      ? `CHƯA SẴN SÀNG • ${unpairedAthletes + warningCount + 1}`
      : "CHƯA SẴN SÀNG • 1",
  };
}
