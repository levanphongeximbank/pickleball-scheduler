import { normalizeEntries } from "../../../../models/tournament/entry.js";
import { isOfficialOpenFamily } from "../deriveOverview.js";
import {
  listOfficialDrawEntries,
  projectOfficialDrawSubsteps,
  isOfficialPairShapedEntry,
} from "../../../individual-tournament/engines/officialDrawOrchestrationEngine.js";
import {
  PAIR_FORMATION_MODE,
  resolveOfficialPairFormationMode,
} from "../../official-tournament-experience/pairFormationModeResolver.js";
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
  random: "Ghép ngẫu nhiên — Open Individual dùng suggestOpenRandomEntriesFromPlayers (không VPR/Rating/skill/seed).",
  rating: "Cân bằng Rating — AI Balance dùng suggestBalancedEntriesFromIndividuals hiện có.",
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

function mapPairCard(entry, index, modeLabel, source) {
  const playerIds = Array.isArray(entry.playerIds) ? entry.playerIds.map(String).filter(Boolean) : [];
  const names = splitPairName(entry.name);
  return {
    id: entry.id || `PAIR-${String(index + 1).padStart(2, "0")}`,
    a: names.a,
    b: names.b === "—" && playerIds.length >= 2 ? entry.name : names.b,
    playerIds,
    mode: modeLabel,
    seed: entry.seed != null ? entry.seed : "—",
    ratingA: ratingLabel(entry.ratingA),
    ratingB: ratingLabel(entry.ratingB),
    combined: entry.rating ? ratingLabel(entry.rating) : "—",
    source,
    status: "Valid",
  };
}

function deriveInternalFormationModel(tournament, { selectedEventId, mode = "together" } = {}) {
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
      formed.push(mapPairCard(entry, index, "Đăng ký cùng", "Đăng ký"));
      pairedCount += size;
    } else if (needed === 1 && playerIds.length >= 1) {
      formed.push({
        id: entry.id,
        a: entry.name,
        b: "",
        playerIds,
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
        playerIds,
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
    official: false,
    pairFormationMode: null,
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
    formPairsEnabled: false,
    formPairsLabel: "Ghép cặp",
    formPairsHint: "Chỉ dành cho Official/Open.",
    readinessItems,
    readinessTitle: notReady ? "Chưa sẵn sàng hình thành cặp" : "Sẵn sàng chốt cặp/đội",
    readinessStatusLabel: notReady
      ? `CHƯA SẴN SÀNG • ${unpairedAthletes + warningCount + 1}`
      : "CHƯA SẴN SÀNG • 1",
  };
}

function deriveOfficialFormationModel(tournament, { selectedEventId } = {}) {
  const scope = resolveBatchBEvent(tournament, selectedEventId);
  const event = scope.event;
  const modeResolution = event
    ? resolveOfficialPairFormationMode(tournament, { eventId: event.id })
    : {
        ok: false,
        mode: PAIR_FORMATION_MODE.NOT_SUPPORTED,
        code: "EVENT_REQUIRED",
        error: "Chọn nội dung tường minh trước khi hình thành cặp.",
      };
  const sub = event ? projectOfficialDrawSubsteps(tournament, event.id) : null;

  let uiMode = "together";
  let modeLabel = "Đăng ký cùng";
  let formPairsLabel = "Ghép cặp";
  let formPairsHint = modeResolution.error || "Chế độ không được hỗ trợ.";
  let modeImpact = formPairsHint;

  if (modeResolution.mode === PAIR_FORMATION_MODE.RANDOM_PAIRING) {
    uiMode = "random";
    modeLabel = "Ghép ngẫu nhiên (Open)";
    formPairsLabel = "Ghép ngẫu nhiên";
    formPairsHint =
      "Gọi suggestOpenRandomEntriesFromPlayers → event.drawEntries. Không dùng VPR/Rating/skill/seed.";
    modeImpact = FORMATION_MODE_IMPACT.random;
  } else if (modeResolution.mode === PAIR_FORMATION_MODE.AI_BALANCE_PAIRING) {
    uiMode = "rating";
    modeLabel = "Cân bằng Rating (AI Balance)";
    formPairsLabel = "Cân bằng Rating";
    formPairsHint =
      "Gọi suggestBalancedEntriesFromIndividuals → event.drawEntries. Engine hiện có — không viết lại.";
    modeImpact = FORMATION_MODE_IMPACT.rating;
  } else if (modeResolution.mode === PAIR_FORMATION_MODE.REGISTERED_PAIRS) {
    uiMode = "together";
    modeLabel = "Cặp đã đăng ký (Open Pair)";
    formPairsLabel = "Không ghép lại";
    formPairsHint = "Đăng ký theo cặp — không random / không AI Balance.";
    modeImpact =
      "Open Pair: đơn vị thi đấu là cặp đã đăng ký trong event.entries. Không ghép lại trên màn này.";
  }

  const modes = FORMATION_MODE_ITEMS.map((item) => {
    if (item.id === "random" && modeResolution.mode === PAIR_FORMATION_MODE.RANDOM_PAIRING) {
      return { ...item, available: true };
    }
    if (item.id === "rating" && modeResolution.mode === PAIR_FORMATION_MODE.AI_BALANCE_PAIRING) {
      return { ...item, available: true };
    }
    if (item.id === "together" && modeResolution.mode === PAIR_FORMATION_MODE.REGISTERED_PAIRS) {
      return { ...item, available: true };
    }
    return { ...item, available: item.id === uiMode };
  });

  const formed = [];
  const unpaired = [];
  let athleteCount = 0;
  let pairedCount = 0;

  if (event && sub) {
    if (modeResolution.mode === PAIR_FORMATION_MODE.REGISTERED_PAIRS) {
      const pairs = normalizeEntries(event.entries).filter(isOfficialPairShapedEntry);
      pairs.forEach((entry, index) => {
        const card = mapPairCard(entry, index, "Đăng ký cặp", "Đăng ký");
        formed.push(card);
        pairedCount += card.playerIds.length;
        athleteCount += card.playerIds.length;
      });
      normalizeEntries(event.entries)
        .filter((entry) => !isOfficialPairShapedEntry(entry))
        .forEach((entry) => {
          const playerIds = Array.isArray(entry.playerIds)
            ? entry.playerIds.map(String).filter(Boolean)
            : [];
          athleteCount += playerIds.length || 1;
          unpaired.push({
            id: entry.id,
            name: entry.name || "Chưa có tên",
            playerIds,
            club: entry.clubName || "—",
            rating: ratingLabel(entry.rating),
            seed: entry.seed != null ? entry.seed : "—",
            status: "Cặp chưa đủ / chưa hợp lệ",
          });
        });
    } else {
      const drawPairs = listOfficialDrawEntries(event).filter(isOfficialPairShapedEntry);
      const individuals = sub.eligibleIndividuals || [];
      const pairedIds = new Set();
      drawPairs.forEach((entry, index) => {
        const card = mapPairCard(
          entry,
          index,
          modeResolution.mode === PAIR_FORMATION_MODE.AI_BALANCE_PAIRING
            ? "AI Balance"
            : "Open Random",
          "drawEntries"
        );
        formed.push(card);
        card.playerIds.forEach((id) => pairedIds.add(id));
        pairedCount += card.playerIds.length;
        athleteCount += card.playerIds.length;
      });
      individuals.forEach((entry) => {
        const id = String((entry.playerIds || [])[0] || "");
        athleteCount += 1;
        if (id && pairedIds.has(id)) return;
        unpaired.push({
          id: entry.id || id,
          name: entry.name || "Chưa có tên",
          playerIds: id ? [id] : [],
          club: entry.clubName || "—",
          rating: ratingLabel(entry.rating),
          seed: entry.seed != null ? entry.seed : "—",
          status: "Chưa ghép",
        });
      });
    }
  }

  const unpairedAthletes = unpaired.reduce(
    (sum, row) => sum + (row.playerIds?.length || 1),
    0
  );
  const progressPct = athleteCount ? Math.round((pairedCount / athleteCount) * 100) : 0;
  const pairingComplete = Boolean(sub?.pairingComplete);
  const groupsCreated = Boolean(sub?.groupsCreated);
  const formPairsEnabled =
    modeResolution.ok &&
    (modeResolution.mode === PAIR_FORMATION_MODE.RANDOM_PAIRING ||
      modeResolution.mode === PAIR_FORMATION_MODE.AI_BALANCE_PAIRING) &&
    Boolean(event) &&
    !scope.needsEventChoice &&
    !groupsCreated &&
    !sub?.singlesContent;

  const readinessItems = [
    {
      label: "Tất cả VĐV đã ghép",
      ready: unpairedAthletes === 0 && (pairingComplete || modeResolution.mode === PAIR_FORMATION_MODE.REGISTERED_PAIRS),
      note: unpairedAthletes ? `${unpairedAthletes} VĐV chưa ghép` : "Đạt",
    },
    {
      label: "Không bị chặn bởi bảng đã tạo",
      ready: !groupsCreated,
      note: groupsCreated ? "Đã có bảng — không ghép lại" : "Đạt",
    },
    {
      label: "Cặp đã vật liệu hóa (drawEntries)",
      ready: pairingComplete || modeResolution.mode === PAIR_FORMATION_MODE.REGISTERED_PAIRS,
      note:
        modeResolution.mode === PAIR_FORMATION_MODE.REGISTERED_PAIRS
          ? "Open Pair dùng event.entries"
          : pairingComplete
            ? "drawEntries sẵn sàng"
            : "Chưa materialize cặp",
    },
  ];
  const blockers = readinessItems.filter((item) => !item.ready);
  const notReady = blockers.length > 0;

  return {
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: eventDisplayName(event),
    eventId: event?.id || "",
    needsEventChoice: scope.needsEventChoice,
    emptyEvents: scope.emptyEvents,
    events: scope.events,
    official: true,
    pairFormationMode: modeResolution.mode,
    modeResolution,
    mode: uiMode,
    modeLabel,
    modeAvailable: formPairsEnabled || modeResolution.mode === PAIR_FORMATION_MODE.REGISTERED_PAIRS,
    modeImpact,
    modes,
    kpis: {
      athletes: athleteCount,
      paired: pairedCount,
      unpaired: unpairedAthletes,
      formed: formed.length,
      warnings: groupsCreated ? 1 : 0,
    },
    progressPct,
    formed,
    unpaired,
    pairingComplete,
    groupsCreated,
    notReady,
    lockEnabled: false,
    lockHint:
      "Không có lệnh chốt cặp riêng — materialize drawEntries là checkpoint hiện có.",
    drawEnabled: Boolean(pairingComplete || modeResolution.mode === PAIR_FORMATION_MODE.REGISTERED_PAIRS),
    drawHint: pairingComplete || modeResolution.mode === PAIR_FORMATION_MODE.REGISTERED_PAIRS
      ? "Mở Screen 07 Bốc thăm ghép cặp / đội (trình chiếu đơn vị đã hình thành)."
      : "Cần hình thành cặp trước khi sang bốc thăm ghép.",
    createPairEnabled: false,
    createPairHint: "Ghép thủ công chưa có trên hệ thống này.",
    formPairsEnabled,
    formPairsLabel,
    formPairsHint,
    readinessItems,
    readinessTitle: notReady ? "Chưa sẵn sàng hình thành cặp" : "Cặp đã sẵn sàng (read-only lock)",
    readinessStatusLabel: notReady
      ? `CHƯA SẴN SÀNG • ${blockers.length}`
      : "SẴN SÀNG",
  };
}

export function deriveFormationModel(tournament, { selectedEventId, mode = "together" } = {}) {
  if (isOfficialOpenFamily(tournament)) {
    return deriveOfficialFormationModel(tournament, { selectedEventId });
  }
  return deriveInternalFormationModel(tournament, { selectedEventId, mode });
}
