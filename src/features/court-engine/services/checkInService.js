import { EVENT_TYPE, PLAYER_SESSION_STATUS } from "../constants/statuses.js";
import { appendEvent } from "./eventLogService.js";
import { persistSession } from "./courtSessionService.js";

function createCheckInId() {
  return `ci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function findCheckIn(session, playerId) {
  return (session.checkIns || []).find(
    (item) => String(item.playerId) === String(playerId)
  );
}

export function checkInPlayer(session, playerId, options = {}) {
  const key = String(playerId || "").trim();
  if (!key) {
    return { ok: false, error: "playerId không hợp lệ." };
  }

  const existing = findCheckIn(session, key);
  if (existing && existing.status !== PLAYER_SESSION_STATUS.CANCELLED) {
    return { ok: false, error: "Người chơi đã check-in trong session này." };
  }

  const now = new Date().toISOString();
  const record = {
    id: createCheckInId(),
    sessionId: session.id,
    playerId: key,
    checkInTime: now,
    status: PLAYER_SESSION_STATUS.CHECKED_IN,
    priority: 0,
    locked: false,
    note: options.note || "",
    createdAt: now,
    updatedAt: now,
  };

  const checkIns = [...(session.checkIns || [])];
  if (existing) {
    const index = checkIns.findIndex((item) => String(item.playerId) === key);
    checkIns[index] = { ...record, id: existing.id };
  } else {
    checkIns.push(record);
  }

  return {
    ok: true,
    session: {
      ...session,
      checkIns,
      updatedAt: now,
    },
    checkIn: record,
    event: {
      eventType: EVENT_TYPE.CHECK_IN,
      message: `Check-in VĐV ${key}`,
      entityType: "player",
      entityId: key,
      createdBy: options.actor || null,
    },
  };
}

export function cancelCheckIn(session, playerId, options = {}) {
  const existing = findCheckIn(session, playerId);
  if (!existing) {
    return { ok: false, error: "Người chơi chưa check-in." };
  }

  const now = new Date().toISOString();
  const checkIns = (session.checkIns || []).map((item) =>
    String(item.playerId) === String(playerId)
      ? {
          ...item,
          status: PLAYER_SESSION_STATUS.CANCELLED,
          updatedAt: now,
        }
      : item
  );

  const queue = (session.queue || []).filter(
    (item) => String(item.playerId) !== String(playerId)
  );

  return {
    ok: true,
    session: {
      ...session,
      checkIns,
      queue,
      updatedAt: now,
    },
    event: {
      eventType: EVENT_TYPE.CHECK_IN_CANCEL,
      message: `Hủy check-in VĐV ${playerId}`,
      entityType: "player",
      entityId: String(playerId),
      createdBy: options.actor || null,
    },
  };
}

export function markNoShow(session, playerId, options = {}) {
  const existing = findCheckIn(session, playerId);
  if (!existing) {
    return { ok: false, error: "Người chơi chưa check-in." };
  }

  const now = new Date().toISOString();
  const checkIns = (session.checkIns || []).map((item) =>
    String(item.playerId) === String(playerId)
      ? {
          ...item,
          status: PLAYER_SESSION_STATUS.NO_SHOW,
          updatedAt: now,
        }
      : item
  );

  const queue = (session.queue || []).filter(
    (item) => String(item.playerId) !== String(playerId)
  );

  return {
    ok: true,
    session: {
      ...session,
      checkIns,
      queue,
      updatedAt: now,
    },
    event: {
      eventType: EVENT_TYPE.NO_SHOW,
      message: `Đánh dấu vắng mặt VĐV ${playerId}`,
      entityType: "player",
      entityId: String(playerId),
      createdBy: options.actor || null,
    },
  };
}

export function updateCheckInStatus(session, playerId, status) {
  const checkIns = (session.checkIns || []).map((item) =>
    String(item.playerId) === String(playerId)
      ? { ...item, status, updatedAt: new Date().toISOString() }
      : item
  );

  return { ...session, checkIns, updatedAt: new Date().toISOString() };
}

export function checkInAndPersist(clubId, session, playerId, options = {}) {
  const result = checkInPlayer(session, playerId, options);
  if (!result.ok) {
    return result;
  }
  const withEvent = appendEvent(result.session, result.event);
  return persistSession(clubId, withEvent);
}

export function cancelCheckInAndPersist(clubId, session, playerId, options = {}) {
  const result = cancelCheckIn(session, playerId, options);
  if (!result.ok) {
    return result;
  }
  const withEvent = appendEvent(result.session, result.event);
  return persistSession(clubId, withEvent);
}

export function markNoShowAndPersist(clubId, session, playerId, options = {}) {
  const result = markNoShow(session, playerId, options);
  if (!result.ok) {
    return result;
  }
  const withEvent = appendEvent(result.session, result.event);
  return persistSession(clubId, withEvent);
}
