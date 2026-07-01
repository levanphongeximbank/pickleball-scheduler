import { ASSIGNMENT_STATUS, COURT_RUNTIME_STATUS, EVENT_TYPE } from "../constants/statuses.js";

export function getMatchElapsedMinutes(assignment, now = Date.now()) {
  if (!assignment?.startedAt) {
    return 0;
  }
  let elapsed = now - new Date(assignment.startedAt).getTime();
  if (assignment.pausedAt && assignment.totalPausedMs) {
    elapsed -= Number(assignment.totalPausedMs || 0);
  }
  if (assignment.status === ASSIGNMENT_STATUS.PAUSED && assignment.pausedAt) {
    elapsed -= now - new Date(assignment.pausedAt).getTime();
  }
  return Math.max(0, Math.floor(elapsed / 60000));
}

export function getRemainingMinutes(assignment, config = {}, now = Date.now()) {
  const estimated = Number(assignment?.estimatedDurationMinutes ?? config.defaultMatchMinutes ?? 20);
  const elapsed = getMatchElapsedMinutes(assignment, now);
  return Math.max(0, estimated - elapsed);
}

export function resolveTimerStatus(assignment, config = {}, now = Date.now()) {
  if (!assignment) {
    return COURT_RUNTIME_STATUS.EMPTY;
  }

  if (assignment.status === ASSIGNMENT_STATUS.COMPLETED) {
    return COURT_RUNTIME_STATUS.COMPLETED;
  }

  if (assignment.status === ASSIGNMENT_STATUS.PAUSED) {
    return COURT_RUNTIME_STATUS.PAUSED;
  }

  if (assignment.status === ASSIGNMENT_STATUS.PLAYING) {
    const elapsed = getMatchElapsedMinutes(assignment, now);
    const estimated = Number(assignment.estimatedDurationMinutes ?? config.defaultMatchMinutes ?? 20);
    const overrunWarning = Number(config.overrunWarningMinutes ?? 5);
    if (elapsed > estimated + overrunWarning) {
      return COURT_RUNTIME_STATUS.OVERRUN;
    }
    return COURT_RUNTIME_STATUS.PLAYING;
  }

  if (assignment.status === ASSIGNMENT_STATUS.ASSIGNED) {
    return COURT_RUNTIME_STATUS.ASSIGNED;
  }

  return COURT_RUNTIME_STATUS.EMPTY;
}

export function startMatchTimer(session, assignmentId, options = {}) {
  const assignment = (session.assignments || []).find(
    (item) => String(item.id) === String(assignmentId)
  );
  if (!assignment) {
    return { ok: false, error: "Không tìm thấy trận." };
  }

  const now = new Date().toISOString();
  const assignments = (session.assignments || []).map((item) =>
    String(item.id) === String(assignmentId)
      ? {
          ...item,
          status: ASSIGNMENT_STATUS.PLAYING,
          startedAt: item.startedAt || now,
          updatedAt: now,
        }
      : item
  );

  return {
    ok: true,
    session: { ...session, assignments, updatedAt: now },
    event: {
      eventType: EVENT_TYPE.MATCH_START,
      message: `Bắt đầu trận sân ${assignment.courtId}`,
      entityType: "assignment",
      entityId: assignmentId,
      createdBy: options.actor || null,
    },
  };
}

export function pauseMatchTimer(session, assignmentId, options = {}) {
  const assignment = (session.assignments || []).find(
    (item) => String(item.id) === String(assignmentId)
  );
  if (!assignment || assignment.status !== ASSIGNMENT_STATUS.PLAYING) {
    return { ok: false, error: "Chỉ có thể pause trận đang chơi." };
  }

  const now = new Date().toISOString();
  const assignments = (session.assignments || []).map((item) =>
    String(item.id) === String(assignmentId)
      ? {
          ...item,
          status: ASSIGNMENT_STATUS.PAUSED,
          pausedAt: now,
          updatedAt: now,
        }
      : item
  );

  return {
    ok: true,
    session: { ...session, assignments, updatedAt: now },
    event: {
      eventType: EVENT_TYPE.MATCH_PAUSE,
      message: `Pause trận sân ${assignment.courtId}`,
      entityType: "assignment",
      entityId: assignmentId,
      createdBy: options.actor || null,
    },
  };
}

export function resumeMatchTimer(session, assignmentId, options = {}) {
  const assignment = (session.assignments || []).find(
    (item) => String(item.id) === String(assignmentId)
  );
  if (!assignment || assignment.status !== ASSIGNMENT_STATUS.PAUSED) {
    return { ok: false, error: "Chỉ có thể resume trận đang pause." };
  }

  const nowMs = Date.now();
  const pausedMs = assignment.pausedAt
    ? nowMs - new Date(assignment.pausedAt).getTime()
    : 0;
  const now = new Date().toISOString();

  const assignments = (session.assignments || []).map((item) =>
    String(item.id) === String(assignmentId)
      ? {
          ...item,
          status: ASSIGNMENT_STATUS.PLAYING,
          pausedAt: null,
          totalPausedMs: Number(item.totalPausedMs || 0) + pausedMs,
          updatedAt: now,
        }
      : item
  );

  return {
    ok: true,
    session: { ...session, assignments, updatedAt: now },
    event: {
      eventType: EVENT_TYPE.MATCH_RESUME,
      message: `Resume trận sân ${assignment.courtId}`,
      entityType: "assignment",
      entityId: assignmentId,
      createdBy: options.actor || null,
    },
  };
}

export function endMatchTimer(session, assignmentId, options = {}) {
  const assignment = (session.assignments || []).find(
    (item) => String(item.id) === String(assignmentId)
  );
  if (!assignment) {
    return { ok: false, error: "Không tìm thấy trận." };
  }

  const now = new Date().toISOString();
  const actualDurationMinutes = getMatchElapsedMinutes(assignment);

  const assignments = (session.assignments || []).map((item) =>
    String(item.id) === String(assignmentId)
      ? {
          ...item,
          status: ASSIGNMENT_STATUS.COMPLETED,
          endedAt: now,
          actualDurationMinutes,
          updatedAt: now,
        }
      : item
  );

  const playerIds = assignment.players || [];
  const checkIns = (session.checkIns || []).map((item) =>
    playerIds.includes(String(item.playerId))
      ? {
          ...item,
          status: options.markCompleted ? "completed" : "resting",
          updatedAt: now,
        }
      : item
  );

  const courtStates = { ...(session.courtStates || {}) };
  courtStates[String(assignment.courtId)] = {
    status: COURT_RUNTIME_STATUS.EMPTY,
    locked: courtStates[String(assignment.courtId)]?.locked || false,
  };

  return {
    ok: true,
    session: {
      ...session,
      assignments,
      checkIns,
      courtStates,
      updatedAt: now,
    },
    playerIds,
    event: {
      eventType: EVENT_TYPE.MATCH_END,
      message: `Kết thúc trận sân ${assignment.courtId}`,
      entityType: "assignment",
      entityId: assignmentId,
      createdBy: options.actor || null,
    },
  };
}
