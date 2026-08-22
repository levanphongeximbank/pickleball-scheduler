import { normalizeEntries } from "../../../../models/tournament/entry.js";
import { normalizeGroups } from "../../../../models/tournament/group.js";
import { isDrawLocked } from "../../../../tournament/engines/publishDrawEngine.js";
import { isOfficialOpenFamily } from "../deriveOverview.js";
import { eventDisplayName, resolveBatchBEvent } from "../batchB/eventScope.js";
import { DRAW_LOCK_LABEL, resolveDrawRoomActionState } from "./drawRoomActionState.js";
import { MULTI_CONTENT_LIMITATION } from "./actionMatrix.js";
import { projectOfficialGroupDraw } from "../../official-tournament-experience/groupDrawProjection.js";
import { DRAW_PUBLISH_STATUS } from "../../../../tournament/engines/publishDrawEngine.js";

function deriveInternalGroupDrawModel(tournament, { selectedEventId } = {}) {
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
      playerIdSets: groupEntries.map((entry) =>
        (entry.playerIds || []).map(String).filter(Boolean)
      ),
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
        entryId: group.entryIds[index] || null,
        playerIds: group.playerIdSets[index] || [],
      });
    });
  });

  const expectedTotal = entries.length;
  const drawnCount = assignedIds.size;
  const tournamentDrawLocked = Boolean(tournament && isDrawLocked(tournament));
  const actionState = resolveDrawRoomActionState({
    drawnCount,
    expectedTotal,
    contentLocked: false,
    constraintsPass: groups.length > 0 && awaiting.length === 0,
    remainingNoun: "cặp chưa chia bảng",
    lockAuthority: false,
  });
  const last = ledger[ledger.length - 1] || null;

  return {
    official: false,
    tournamentName: String(tournament?.name || "Giải đấu"),
    eventName: eventDisplayName(event),
    eventId: event?.id || "",
    needsEventChoice: scope.needsEventChoice,
    emptyEvents: scope.emptyEvents,
    events: scope.events,
    locked: false,
    tournamentDrawLocked,
    drawStatusLabel: actionState.readinessLabel,
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
      groupCountConfig: null,
    },
    rules: [
      {
        label: "Sức chứa bảng",
        status: groups.length ? "Theo hồ sơ" : "Chưa có bảng",
        tone: groups.length ? "info" : "warning",
        note: groups.length ? `${groups.length} bảng trên hồ sơ` : "Chưa có bảng trên nội dung này.",
      },
    ],
    readinessItems: [
      { label: "Đã bốc xong", ready: actionState.drawComplete, note: `${drawnCount}/${expectedTotal || 0}` },
      { label: "Sẵn sàng khóa", ready: false, note: actionState.lockHelper },
    ],
    actionState,
    lockLabel: DRAW_LOCK_LABEL,
    lockHint: "Nội dung này chưa có cơ chế khóa riêng.",
    undoHint: "Hoàn tác bốc thăm chia bảng chưa có trên màn này.",
    drawNextHint: "Không bốc từng cặp trên màn này.",
    createHint: "Chia bảng Official chưa mở trên Internal.",
    createEnabled: false,
    regenerateEnabled: false,
    lockEnabled: false,
    publishEnabled: false,
    reopenEnabled: false,
    presentEnabled: groups.length > 0,
    presentHint: groups.length ? "Trình chiếu (read-only)." : "Chưa có bảng.",
    nextHint: "Chưa hoàn tất bốc thăm",
    blocker: null,
    drawPublishStatus: null,
    ratingNeutral: null,
    kpis: {
      units: entries.length,
      groups: groups.length,
      awaiting: awaiting.length,
      warnings: 0,
    },
  };
}

function deriveOfficialGroupDrawModel(tournament, { selectedEventId } = {}) {
  const scope = resolveBatchBEvent(tournament, selectedEventId);
  const projection = projectOfficialGroupDraw(tournament, { selectedEventId });
  const metrics =
    projection.metrics ||
    {
      totalUnits: 0,
      assignedUnits: 0,
      unassignedUnits: 0,
      playerCount: 0,
      progressNumerator: 0,
      progressDenominator: 0,
      drawComplete: false,
      awaiting: [],
      groupCards: [],
      units: [],
      source: null,
    };

  const groups = Array.isArray(projection.groups) ? projection.groups : [];
  const groupCards = metrics.groupCards || [];
  const awaiting = metrics.awaiting || [];
  const expectedTotal = metrics.progressDenominator;
  const drawnCount = metrics.progressNumerator;
  const publishStatus = projection.drawPublish?.status || DRAW_PUBLISH_STATUS.DRAFT;
  const tournamentDrawLocked = Boolean(tournament && isDrawLocked(tournament));
  const actionState = resolveDrawRoomActionState({
    drawnCount,
    expectedTotal,
    contentLocked: tournamentDrawLocked,
    constraintsPass: groups.length > 0 && awaiting.length === 0,
    remainingNoun: "cặp chưa chia bảng",
    lockAuthority: projection.lockEnabled,
  });

  const ledger = [];
  groupCards.forEach((group) => {
    group.entryIds.forEach((entryId, index) => {
      ledger.push({
        id: `${group.groupId || group.id}-${entryId || index}`,
        pair: group.pairs[index] || entryId,
        group: group.id,
        seed: "—",
        position: index + 1,
        status: "Hợp lệ",
        entryId,
        playerIds: group.playerIdSets[index] || [],
      });
    });
  });
  const last = ledger[ledger.length - 1] || null;

  const readinessItems = [
    {
      label: "Đã chọn nội dung",
      ready: !projection.needsEventChoice && Boolean(scope.event),
      note: projection.needsEventChoice ? "Chọn nội dung" : "Đạt",
    },
    {
      label: "Đơn vị cạnh tranh (cặp)",
      ready: metrics.totalUnits > 0,
      note:
        metrics.totalUnits > 0
          ? `${metrics.totalUnits} cặp (${metrics.source || projection.unitsSource || "units"})`
          : projection.blocker?.error || "Thiếu cặp",
    },
    {
      label: "VĐV (thành viên cặp)",
      ready: metrics.playerCount > 0,
      note: `${metrics.playerCount} VĐV — không dùng làm mẫu số chia bảng`,
    },
    {
      label: "Đã bốc xong",
      ready: metrics.drawComplete,
      note: `${drawnCount}/${expectedTotal || 0}`,
    },
    {
      label: `groupCount cấu hình = ${projection.groupCount}`,
      ready: Number(projection.groupCount) > 0,
      note: projection.groupCountSource
        ? `Từ Content ${projection.groupCountSource} (events[].competitionRules.groupStage.groupCount)`
        : "Cần eventId — không dùng settings.officialCompetition.groupCount",
    },
    {
      label: "Group Draw rating-neutral",
      ready: projection.ratingNeutral === true && projection.usesRating !== true,
      note: "buildOfficialOpenPlan / OPEN_RANDOM",
    },
    {
      label: `Draw status: ${publishStatus}`,
      ready: true,
      note: "settings.draw",
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
    locked: tournamentDrawLocked,
    tournamentDrawLocked,
    drawStatusLabel:
      publishStatus === DRAW_PUBLISH_STATUS.PUBLISHED
        ? "ĐÃ CÔNG BỐ"
        : publishStatus === DRAW_PUBLISH_STATUS.LOCKED
          ? "ĐÃ KHÓA"
          : groups.length
            ? metrics.drawComplete
              ? "ĐÃ TẠO (DRAFT)"
              : actionState.statusLabel
            : actionState.statusLabel,
    multiContentLimitation: MULTI_CONTENT_LIMITATION,
    drawnCount,
    expectedTotal,
    playerCount: metrics.playerCount,
    awaiting: awaiting.map((entry) => ({
      id: entry.id,
      name: entry.name || entry.id,
      seed: "—",
      pool: metrics.source || projection.unitsSource || "units",
      playerIds: (entry.playerIds || []).map(String),
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
        text: `${row.pair} → ${row.group}`,
        tone: "success",
      })),
    summary: {
      totalPairs: metrics.totalUnits,
      groups: groups.length,
      playerCount: metrics.playerCount,
      method: "buildOfficialOpenPlan (OPEN_RANDOM)",
      seedRule: "Không dùng seed/rating/VPR/AI Balance cho chia bảng",
      groupCountConfig: projection.groupCount,
    },
    rules: [
      {
        label: "Authority",
        status: "OPEN_RANDOM",
        tone: "success",
        note: "Open + AI Balance dùng chung Group Draw rating-neutral",
      },
      {
        label: "Competition unit",
        status: "PAIR",
        tone: "info",
        note: "Mẫu số chia bảng = số cặp, không = số VĐV",
      },
      {
        label: "Publish status",
        status: publishStatus,
        tone: publishStatus === DRAW_PUBLISH_STATUS.PUBLISHED ? "success" : "draft",
        note: MULTI_CONTENT_LIMITATION,
      },
    ],
    readinessItems,
    actionState: {
      ...actionState,
      statusLabel:
        projection.blocker && !groups.length
          ? "CHƯA SẴN SÀNG"
          : metrics.drawComplete
            ? publishStatus === DRAW_PUBLISH_STATUS.PUBLISHED
              ? "ĐÃ CÔNG BỐ"
              : publishStatus === DRAW_PUBLISH_STATUS.LOCKED
                ? "ĐÃ KHÓA"
                : "SẴN SÀNG"
            : actionState.statusLabel,
      statusTone: metrics.drawComplete && !projection.blocker ? "success" : "warning",
      nextLifecycleDisabled: !metrics.drawComplete,
      lockDisabled: !projection.lockEnabled,
    },
    lockLabel: DRAW_LOCK_LABEL,
    lockHint: projection.lockEnabled
      ? "Khóa settings.draw (cả giải)."
      : "Cần bảng ở trạng thái draft để khóa.",
    undoHint: "Hoàn tác từng bước chưa có — dùng reopen/regenerate theo guard.",
    drawNextHint: "Không bốc từng cặp — chia toàn bộ bảng bằng lệnh tường minh.",
    createHint: projection.createEnabled
      ? "Chia bảng ngẫu nhiên (buildOfficialOpenPlan)."
      : projection.blocker?.error || "Chưa sẵn sàng chia bảng.",
    createEnabled: projection.createEnabled,
    regenerateEnabled: projection.regenerateEnabled,
    regenerateHint: projection.regenerateEnabled
      ? "Chia lại nếu guard cho phép."
      : (projection.downstream?.blockers || [])[0]?.message || "Không chia lại an toàn.",
    lockEnabled: projection.lockEnabled,
    publishEnabled: projection.publishEnabled,
    publishHint: projection.publishEnabled
      ? "Công bố settings.draw — không tạo lịch/trận."
      : "Cần khóa trước khi công bố.",
    reopenEnabled: projection.reopenEnabled,
    reopenHint: "Mở lại theo quyền + downstream guard.",
    presentEnabled: projection.presentEnabled,
    presentHint: projection.presentEnabled
      ? "Trình chiếu bảng đã lưu — không đổi membership."
      : "Chưa có bảng để trình chiếu.",
    nextHint: metrics.drawComplete
      ? "Bước tiếp: Vòng bảng (chưa adopt O5)."
      : "Cần chia bảng trước.",
    blocker: projection.blocker,
    drawPublishStatus: publishStatus,
    ratingNeutral: projection.ratingNeutral,
    guards: projection.downstream,
    kpis: {
      units: metrics.totalUnits,
      players: metrics.playerCount,
      groups: groups.length,
      awaiting: metrics.unassignedUnits,
      warnings: projection.blocker || (projection.downstream?.blockers || []).length ? 1 : 0,
    },
  };
}

export function deriveGroupDrawModel(tournament, { selectedEventId } = {}) {
  const officialShaped =
    isOfficialOpenFamily(tournament) || Boolean(tournament?.officialMode);
  if (officialShaped) {
    return deriveOfficialGroupDrawModel(tournament, { selectedEventId });
  }
  return deriveInternalGroupDrawModel(tournament, { selectedEventId });
}
