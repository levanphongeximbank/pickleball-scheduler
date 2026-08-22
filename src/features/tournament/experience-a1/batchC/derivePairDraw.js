import { normalizeEntries } from "../../../../models/tournament/entry.js";
import { isOfficialOpenFamily } from "../deriveOverview.js";
import {
  eventDisplayName,
  expectedPlayerCount,
  formatViDateTime,
  resolveBatchBEvent,
} from "../batchB/eventScope.js";
import { DRAW_LOCK_LABEL, resolveDrawRoomActionState } from "./drawRoomActionState.js";
import {
  PAIR_FORMATION_MODE,
  resolveOfficialPairFormationMode,
} from "../../official-tournament-experience/pairFormationModeResolver.js";
import {
  listOfficialPairDrawUnits,
  projectOfficialPairDraw,
} from "../../official-tournament-experience/pairDrawProjection.js";

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

function mapLedgerRow(entry, index) {
  const names = splitPairName(entry.name);
  const playerIds = Array.isArray(entry.playerIds)
    ? entry.playerIds.map(String).filter(Boolean)
    : [];
  return {
    id: entry.id,
    number: index + 1,
    a: names.a,
    b: names.b === "—" && playerIds.length >= 2 ? String(playerIds[1]) : names.b,
    playerIds,
    total: ratingLabel(entry.rating),
    diff: "—",
    valid: playerIds.length >= 2,
    time: formatViDateTime(entry.registeredAt || entry.updatedAt) || "—",
    club: entry.clubName || entry.representativeClubName || "—",
    rating: ratingLabel(entry.rating),
  };
}

function deriveInternalPairDrawModel(tournament, { selectedEventId } = {}) {
  const scope = resolveBatchBEvent(tournament, selectedEventId);
  const event = scope.event;
  const needed = expectedPlayerCount(event);
  const entries = event ? normalizeEntries(event.entries) : [];
  const formed = [];
  const unpaired = [];

  entries.forEach((entry) => {
    const playerIds = Array.isArray(entry.playerIds) ? entry.playerIds.filter(Boolean) : [];
    if (needed >= 2 && playerIds.length >= 2) {
      formed.push(mapLedgerRow(entry, formed.length));
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
    official: false,
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
      {
        label: "Bốc thăm ghép cặp",
        status: "Chưa có",
        tone: "warning",
        note: "Đang đọc cặp đã đăng ký cùng. Chưa có bốc thăm ghép riêng.",
      },
    ],
    readinessItems: [
      { label: "Số lượt đã bốc", ready: actionState.drawComplete, note: `${drawnCount}/${expectedTotal || 0}` },
      { label: "Sẵn sàng khóa", ready: false, note: actionState.lockHelper },
    ],
    actionState,
    lockLabel: DRAW_LOCK_LABEL,
    lockHint: "Khóa bốc thăm ghép cặp chưa có trên hệ thống này.",
    undoHint: "Hoàn tác bốc thăm chưa có trên hệ thống này.",
    drawNextHint: "Bốc tiếp chưa có trên hệ thống này.",
    presentHint: "Trình chiếu chưa mở cho Internal trên màn này.",
    presentEnabled: false,
    nextHint: "Chưa có trạng thái khóa bốc thăm ghép cặp.",
    nextLifecyclePath: null,
    blocker: null,
    pairFormationMode: null,
    unitsSource: null,
    groupDrawPublishStatus: null,
    kpis: {
      units: formed.length,
      unpaired: unpaired.length,
      warnings: 0,
      groups: 0,
    },
  };
}

function deriveOfficialPairDrawModel(tournament, { selectedEventId } = {}) {
  const scope = resolveBatchBEvent(tournament, selectedEventId);
  const projection = projectOfficialPairDraw(tournament, { selectedEventId });
  const listed = listOfficialPairDrawUnits(tournament, { selectedEventId });
  const modeResolution =
    projection.modeResolution ||
    (scope.event
      ? resolveOfficialPairFormationMode(tournament, { eventId: scope.event.id })
      : {
          ok: false,
          mode: PAIR_FORMATION_MODE.NOT_SUPPORTED,
          code: "EVENT_REQUIRED",
          error: "Chọn nội dung tường minh trước khi xem bốc thăm ghép cặp.",
        });

  let modeLabel = "Không hỗ trợ";
  if (modeResolution.mode === PAIR_FORMATION_MODE.RANDOM_PAIRING) {
    modeLabel = "Open Individual — cặp từ drawEntries (Screen 06)";
  } else if (modeResolution.mode === PAIR_FORMATION_MODE.AI_BALANCE_PAIRING) {
    modeLabel = "AI Balance — cặp từ drawEntries (Screen 06)";
  } else if (modeResolution.mode === PAIR_FORMATION_MODE.REGISTERED_PAIRS) {
    modeLabel = "Open Pair — cặp đăng ký (event.entries)";
  }

  const ledger = (listed.units || []).map((entry, index) => mapLedgerRow(entry, index));
  const unpaired = [];
  if (
    listed.source === "drawEntries" &&
    listed.substeps &&
    Array.isArray(listed.substeps.eligibleIndividuals)
  ) {
    const paired = new Set();
    ledger.forEach((row) => row.playerIds.forEach((id) => paired.add(id)));
    listed.substeps.eligibleIndividuals.forEach((entry) => {
      const id = String((entry.playerIds || [])[0] || "");
      if (id && paired.has(id)) return;
      unpaired.push({
        id: entry.id || id,
        name: entry.name || "Chưa có tên",
        club: entry.clubName || "—",
        rating: ratingLabel(entry.rating),
        playerIds: id ? [id] : [],
      });
    });
  }

  const expectedTotal = ledger.length;
  const drawnCount = ledger.length;
  const last = ledger[ledger.length - 1] || null;
  const unitsReady = listed.ok === true && ledger.length > 0;
  const groupsCreated = Boolean(listed.substeps?.groupsCreated);
  const actionState = resolveDrawRoomActionState({
    drawnCount,
    expectedTotal,
    contentLocked: false,
    constraintsPass: unitsReady && !groupsCreated,
    remainingNoun: "cặp chưa sẵn sàng",
    lockAuthority: false,
  });

  const blocker = projection.blocker;
  const readinessItems = [
    {
      label: "Đã chọn nội dung",
      ready: !projection.needsEventChoice && Boolean(scope.event),
      note: projection.needsEventChoice ? "Chọn nội dung" : "Đạt",
    },
    {
      label: "Đơn vị cạnh tranh đã hình thành",
      ready: unitsReady,
      note: unitsReady
        ? `${ledger.length} cặp (${listed.source})`
        : blocker?.error || "Thiếu cặp",
    },
    {
      label: "Không đổi membership trên màn này",
      ready: true,
      note: "Pair Draw chỉ đọc / trình chiếu",
    },
    {
      label: "Chưa tạo bảng (Group Draw tách riêng)",
      ready: !groupsCreated,
      note: groupsCreated ? "Đã có bảng — Screen 08" : "Đạt",
    },
  ];

  return {
    official: true,
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: eventDisplayName(scope.event),
    eventId: scope.event?.id || "",
    needsEventChoice: projection.needsEventChoice,
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
          valid: last.valid,
          warning: null,
        }
      : { number: 0, playerA: null, playerB: null, valid: true, warning: null },
    ledger,
    history: ledger
      .slice()
      .reverse()
      .slice(0, 6)
      .map((row) => ({
        time: row.time,
        text: `#${String(row.number).padStart(2, "0")} ${row.a} + ${row.b}`,
        tone: "success",
      })),
    rules: [
      {
        label: "Nguồn đơn vị",
        status: listed.source || "—",
        tone: unitsReady ? "success" : "warning",
        note: modeLabel,
      },
      {
        label: "Membership",
        status: "Cố định",
        tone: "success",
        note: "Không ghép lại / không đổi playerIds trên Screen 07.",
      },
      {
        label: "Writer Pair Draw",
        status: "Không có",
        tone: "draft",
        note: "Trình chiếu không ghi hồ sơ. lock/publish thuộc chia bảng.",
      },
      {
        label: "Group Draw publish",
        status: String(projection.groupDrawPublish?.status || "draft"),
        tone: "draft",
        note: "Trạng thái settings.draw — Screen 08, không phải Pair Draw.",
      },
    ],
    readinessItems,
    actionState: {
      ...actionState,
      statusLabel: blocker
        ? "CHƯA SẴN SÀNG"
        : unitsReady
          ? "SẴN SÀNG TRÌNH CHIẾU"
          : actionState.statusLabel,
      statusTone: unitsReady && !blocker ? "success" : "warning",
      nextLifecycleDisabled: !unitsReady,
    },
    lockLabel: DRAW_LOCK_LABEL,
    lockHint:
      "Khóa Pair Draw riêng không tồn tại — lockDraw thuộc bốc thăm chia bảng (Group Draw).",
    undoHint: "Hoàn tác Pair Draw chưa có — không có writer.",
    drawNextHint: "Bốc tiếp Pair Draw chưa có — đơn vị đã hình thành ở Screen 06.",
    presentHint: unitsReady
      ? "Trình chiếu cặp đã lưu — không đổi membership."
      : blocker?.error || "Chưa có cặp để trình chiếu.",
    presentEnabled: unitsReady,
    nextHint: unitsReady
      ? "Bước tiếp theo: Bốc thăm chia bảng (chưa adopt Wave O4)."
      : "Cần đơn vị cạnh tranh trước khi sang chia bảng.",
    nextLifecyclePath: null,
    blocker,
    pairFormationMode: modeResolution.mode,
    unitsSource: listed.source,
    groupDrawPublishStatus: projection.groupDrawPublish?.status || null,
    guards: projection.guards,
    kpis: {
      units: ledger.length,
      unpaired: unpaired.length,
      warnings: blocker || groupsCreated ? 1 : 0,
      groups: listed.substeps?.groupCount || 0,
    },
  };
}

export function derivePairDrawModel(tournament, { selectedEventId } = {}) {
  if (isOfficialOpenFamily(tournament)) {
    return deriveOfficialPairDrawModel(tournament, { selectedEventId });
  }
  return deriveInternalPairDrawModel(tournament, { selectedEventId });
}
