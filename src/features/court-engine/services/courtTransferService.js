import { COURT_RUNTIME_STATUS, EVENT_TYPE } from "../constants/statuses.js";
import { transferMatchToCourt } from "../../../tournament/engines/courtEngine.js";

function createTransferLogId() {
  return `tf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function transferAssignment(session, assignmentId, toCourtId, options = {}) {
  const reason = String(options.reason || "").trim();
  if (!reason) {
    return { ok: false, error: "Bắt buộc nhập lý do chuyển sân." };
  }

  const assignment = (session.assignments || []).find(
    (item) => String(item.id) === String(assignmentId)
  );
  if (!assignment) {
    return { ok: false, error: "Không tìm thấy trận." };
  }

  if (!["assigned", "playing", "paused", "overrun"].includes(assignment.status)) {
    return { ok: false, error: "Chỉ chuyển trận đang assigned/playing/paused." };
  }

  const fromCourtId = String(assignment.courtId);
  const targetCourtId = String(toCourtId);

  if (fromCourtId === targetCourtId) {
    return { ok: false, error: "Sân đích trùng sân hiện tại." };
  }

  const courtStates = session.courtStates || {};
  const targetState = courtStates[targetCourtId] || { status: COURT_RUNTIME_STATUS.EMPTY };

  if (targetState.status === COURT_RUNTIME_STATUS.PLAYING || targetState.status === COURT_RUNTIME_STATUS.ASSIGNED) {
    return { ok: false, error: "Sân đích đang bận." };
  }

  if (targetState.locked || targetState.status === COURT_RUNTIME_STATUS.LOCKED) {
    return { ok: false, error: "Sân đích đang bị khóa." };
  }

  if (targetState.status === COURT_RUNTIME_STATUS.MAINTENANCE) {
    return { ok: false, error: "Sân đích đang bảo trì." };
  }

  const activeOnTarget = (session.assignments || []).find(
    (item) =>
      String(item.courtId) === targetCourtId &&
      ["assigned", "playing", "paused", "overrun"].includes(item.status) &&
      String(item.id) !== String(assignmentId)
  );
  if (activeOnTarget) {
    return { ok: false, error: "Sân đích đang có trận khác." };
  }

  const now = new Date().toISOString();
  const transferLog = {
    id: createTransferLogId(),
    sessionId: session.id,
    assignmentId: assignment.id,
    fromCourtId,
    toCourtId: targetCourtId,
    reason,
    transferredBy: options.actor || null,
    transferredAt: now,
    preservedStartedAt: assignment.startedAt || null,
    preservedStatus: assignment.status,
  };

  const assignments = (session.assignments || []).map((item) =>
    String(item.id) === String(assignmentId)
      ? {
          ...item,
          courtId: targetCourtId,
          updatedAt: now,
          transferHistory: [...(item.transferHistory || []), transferLog],
        }
      : item
  );

  const nextCourtStates = { ...courtStates };
  nextCourtStates[fromCourtId] = {
    ...(nextCourtStates[fromCourtId] || {}),
    status: options.markOldCourtMaintenance
      ? COURT_RUNTIME_STATUS.MAINTENANCE
      : COURT_RUNTIME_STATUS.EMPTY,
    currentMatchId: null,
  };
  nextCourtStates[targetCourtId] = {
    ...(nextCourtStates[targetCourtId] || {}),
    status: assignment.status === "paused" ? COURT_RUNTIME_STATUS.PAUSED : COURT_RUNTIME_STATUS.PLAYING,
    currentMatchId: assignment.id,
    locked: false,
  };

  const refereeAssignments = (session.refereeAssignments || []).map((item) =>
    String(item.courtId) === fromCourtId && item.status !== "released"
      ? { ...item, courtId: targetCourtId }
      : item
  );

  return {
    ok: true,
    session: {
      ...session,
      assignments,
      transferLogs: [transferLog, ...(session.transferLogs || [])],
      courtStates: nextCourtStates,
      refereeAssignments,
      updatedAt: now,
    },
    transferLog,
    event: {
      eventType: EVENT_TYPE.COURT_TRANSFER,
      message: `Chuyển trận từ sân ${fromCourtId} sang sân ${targetCourtId}: ${reason}`,
      entityType: "assignment",
      entityId: assignmentId,
      metadata: transferLog,
      createdBy: options.actor || null,
    },
  };
}

export function setCourtLocked(session, courtId, locked = true, options = {}) {
  const key = String(courtId);
  const now = new Date().toISOString();
  const courtStates = { ...(session.courtStates || {}) };
  courtStates[key] = {
    ...(courtStates[key] || {}),
    locked: Boolean(locked),
    status: locked ? COURT_RUNTIME_STATUS.LOCKED : COURT_RUNTIME_STATUS.EMPTY,
  };

  return {
    ok: true,
    session: { ...session, courtStates, updatedAt: now },
    event: {
      eventType: locked ? EVENT_TYPE.COURT_LOCK : EVENT_TYPE.COURT_UNLOCK,
      message: locked ? `Khóa sân ${key}` : `Mở khóa sân ${key}`,
      entityType: "court",
      entityId: key,
      createdBy: options.actor || null,
    },
  };
}

export function setCourtMaintenance(session, courtId, maintenance = true, options = {}) {
  const key = String(courtId);
  const now = new Date().toISOString();
  const courtStates = { ...(session.courtStates || {}) };

  const active = (session.assignments || []).find(
    (item) =>
      String(item.courtId) === key &&
      ["assigned", "playing", "paused"].includes(item.status)
  );
  if (maintenance && active) {
    return { ok: false, error: "Không thể bảo trì sân đang có trận." };
  }

  courtStates[key] = {
    ...(courtStates[key] || {}),
    status: maintenance ? COURT_RUNTIME_STATUS.MAINTENANCE : COURT_RUNTIME_STATUS.EMPTY,
    maintenance: Boolean(maintenance),
  };

  return {
    ok: true,
    session: { ...session, courtStates, updatedAt: now },
    event: {
      eventType: EVENT_TYPE.COURT_MAINTENANCE,
      message: maintenance ? `Bảo trì sân ${key}` : `Hết bảo trì sân ${key}`,
      entityType: "court",
      entityId: key,
      createdBy: options.actor || null,
    },
  };
}

// Re-export tournament court engine transfer for match-based flows
export { transferMatchToCourt };
