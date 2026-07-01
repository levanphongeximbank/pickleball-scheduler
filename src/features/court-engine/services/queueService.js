import { EVENT_TYPE, PLAYER_SESSION_STATUS, QUEUE_STATUS } from "../constants/statuses.js";
import { updateCheckInStatus } from "./checkInService.js";

function createQueueId() {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function findQueueEntry(session, playerId) {
  return (session.queue || []).find(
    (item) =>
      String(item.playerId) === String(playerId) &&
      item.status !== QUEUE_STATUS.REMOVED
  );
}

function findCheckIn(session, playerId) {
  return (session.checkIns || []).find(
    (item) => String(item.playerId) === String(playerId)
  );
}

export function computeWaitMinutes(entry, now = Date.now()) {
  if (!entry?.waitingSince) {
    return 0;
  }
  const start = new Date(entry.waitingSince).getTime();
  return Math.max(0, Math.floor((now - start) / 60000));
}

export function computePriorityScore(entry, checkIn, now = Date.now()) {
  const waitMinutes = computeWaitMinutes(entry, now);
  const playCount = Number(entry?.playCount || checkIn?.playCount || 0);
  const restCount = Number(entry?.restCount || checkIn?.restCount || 0);
  const manualPriority = Number(entry?.priority || checkIn?.priority || 0);

  return manualPriority * 1000 + waitMinutes * 10 - playCount * 5 + restCount * 2;
}

export function addToQueue(session, playerId, options = {}) {
  const key = String(playerId || "").trim();
  const checkIn = findCheckIn(session, key);

  if (!checkIn || checkIn.status === PLAYER_SESSION_STATUS.CANCELLED) {
    return { ok: false, error: "Người chơi chưa check-in." };
  }

  if (checkIn.status === PLAYER_SESSION_STATUS.PLAYING) {
    return { ok: false, error: "Người chơi đang chơi, không thể vào queue." };
  }

  const existing = findQueueEntry(session, key);
  if (existing && existing.status === QUEUE_STATUS.ACTIVE) {
    return { ok: false, error: "Người chơi đã có trong queue." };
  }

  const now = new Date().toISOString();
  const entry = {
    id: existing?.id || createQueueId(),
    sessionId: session.id,
    playerId: key,
    queuePosition: (session.queue || []).filter((item) => item.status === QUEUE_STATUS.ACTIVE).length + 1,
    waitingSince: now,
    priorityScore: 0,
    priority: options.priority || 0,
    locked: false,
    hidden: false,
    playCount: checkIn.playCount || 0,
    restCount: checkIn.restCount || 0,
    status: QUEUE_STATUS.ACTIVE,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  entry.priorityScore = computePriorityScore(entry, checkIn);

  const queue = [...(session.queue || [])];
  const index = queue.findIndex((item) => String(item.playerId) === key);
  if (index >= 0) {
    queue[index] = entry;
  } else {
    queue.push(entry);
  }

  let nextSession = updateCheckInStatus(session, key, PLAYER_SESSION_STATUS.WAITING);
  nextSession = { ...nextSession, queue, updatedAt: now };

  return {
    ok: true,
    session: nextSession,
    entry,
    event: {
      eventType: EVENT_TYPE.QUEUE_ADD,
      message: `Thêm VĐV ${key} vào queue`,
      entityType: "player",
      entityId: key,
      createdBy: options.actor || null,
    },
  };
}

export function removeFromQueue(session, playerId, options = {}) {
  const key = String(playerId || "").trim();
  const existing = findQueueEntry(session, key);
  if (!existing) {
    return { ok: false, error: "Người chơi không có trong queue." };
  }

  const now = new Date().toISOString();
  const queue = (session.queue || []).map((item) =>
    String(item.playerId) === key
      ? { ...item, status: QUEUE_STATUS.REMOVED, updatedAt: now }
      : item
  );

  let nextSession = updateCheckInStatus(session, key, PLAYER_SESSION_STATUS.CHECKED_IN);
  nextSession = { ...nextSession, queue, updatedAt: now };

  return {
    ok: true,
    session: nextSession,
    event: {
      eventType: EVENT_TYPE.QUEUE_REMOVE,
      message: `Xóa VĐV ${key} khỏi queue`,
      entityType: "player",
      entityId: key,
      createdBy: options.actor || null,
    },
  };
}

export function setQueuePriority(session, playerId, priority = 1, options = {}) {
  const key = String(playerId || "").trim();
  const existing = findQueueEntry(session, key);
  if (!existing) {
    return { ok: false, error: "Người chơi không có trong queue." };
  }

  const now = new Date().toISOString();
  const queue = (session.queue || []).map((item) => {
    if (String(item.playerId) !== key) {
      return item;
    }
    const next = {
      ...item,
      priority: Number(priority) || 0,
      updatedAt: now,
    };
    next.priorityScore = computePriorityScore(next, findCheckIn(session, key));
    return next;
  });

  return {
    ok: true,
    session: { ...session, queue, updatedAt: now },
    event: {
      eventType: EVENT_TYPE.QUEUE_PRIORITY,
      message: `Ưu tiên VĐV ${key}`,
      entityType: "player",
      entityId: key,
      metadata: { priority },
      createdBy: options.actor || null,
    },
  };
}

export function setQueueLocked(session, playerId, locked = true) {
  const key = String(playerId || "").trim();
  const existing = findQueueEntry(session, key);
  if (!existing) {
    return { ok: false, error: "Người chơi không có trong queue." };
  }

  const now = new Date().toISOString();
  const queue = (session.queue || []).map((item) =>
    String(item.playerId) === key ? { ...item, locked: Boolean(locked), updatedAt: now } : item
  );

  return {
    ok: true,
    session: { ...session, queue, updatedAt: now },
  };
}

export function setQueueHidden(session, playerId, hidden = true) {
  const key = String(playerId || "").trim();
  const existing = findQueueEntry(session, key);
  if (!existing) {
    return { ok: false, error: "Người chơi không có trong queue." };
  }

  const now = new Date().toISOString();
  const queue = (session.queue || []).map((item) =>
    String(item.playerId) === key
      ? {
          ...item,
          hidden: Boolean(hidden),
          status: hidden ? QUEUE_STATUS.HIDDEN : QUEUE_STATUS.ACTIVE,
          updatedAt: now,
        }
      : item
  );

  return { ok: true, session: { ...session, queue, updatedAt: now } };
}

export function reorderQueue(session, orderedPlayerIds = []) {
  const now = new Date().toISOString();
  const positionMap = new Map(
    orderedPlayerIds.map((playerId, index) => [String(playerId), index + 1])
  );

  const queue = (session.queue || []).map((item) => {
    const position = positionMap.get(String(item.playerId));
    if (position == null) {
      return item;
    }
    return {
      ...item,
      queuePosition: position,
      updatedAt: now,
    };
  });

  queue.sort((a, b) => (a.queuePosition || 999) - (b.queuePosition || 999));

  return { ok: true, session: { ...session, queue, updatedAt: now } };
}

export function getActiveQueueEntries(session, { includeHidden = false } = {}) {
  return (session.queue || [])
    .filter((item) => {
      if (item.status === QUEUE_STATUS.REMOVED) {
        return false;
      }
      if (!includeHidden && (item.hidden || item.status === QUEUE_STATUS.HIDDEN)) {
        return false;
      }
      return item.status === QUEUE_STATUS.ACTIVE || item.status === QUEUE_STATUS.HIDDEN;
    })
    .sort((a, b) => {
      const scoreDiff = computePriorityScore(b, findCheckIn(session, b.playerId)) -
        computePriorityScore(a, findCheckIn(session, a.playerId));
      if (scoreDiff !== 0) {
        return scoreDiff;
      }
      return (a.queuePosition || 0) - (b.queuePosition || 0);
    });
}

export function incrementPlayerPlayCount(session, playerIds = []) {
  const ids = new Set(playerIds.map(String));
  const now = new Date().toISOString();

  const checkIns = (session.checkIns || []).map((item) =>
    ids.has(String(item.playerId))
      ? { ...item, playCount: (item.playCount || 0) + 1, updatedAt: now }
      : item
  );

  const queue = (session.queue || []).map((item) =>
    ids.has(String(item.playerId))
      ? { ...item, playCount: (item.playCount || 0) + 1, updatedAt: now }
      : item
  );

  return { ...session, checkIns, queue, updatedAt: now };
}
