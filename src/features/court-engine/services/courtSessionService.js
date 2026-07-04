import {
  EVENT_TYPE,
  PLAYER_SESSION_STATUS,
  SESSION_STATUS,
} from "../constants/statuses.js";
import { createCourtSession, normalizeCourtSession } from "../models/courtSession.js";
import {
  getSessionFromStore,
  loadActiveSessionId,
  loadCourtEngineStore,
  saveActiveSessionId,
  saveCourtEngineStore,
  upsertSessionInStore,
} from "../storage/courtEngineStorage.js";
import { resolveTenantIdForClub } from "../../tenant/guards/tenantGuard.js";
import { appendEvent } from "./eventLogService.js";

function resolveStorageOptions(clubId, options = {}) {
  return {
    tenantId: options.tenantId || resolveTenantIdForClub(clubId),
  };
}

export function listSessions(clubId, options = {}) {
  const store = loadCourtEngineStore(clubId, resolveStorageOptions(clubId, options));
  return store.sessions || [];
}

export function getActiveSession(clubId, options = {}) {
  const storageOptions = resolveStorageOptions(clubId, options);
  const sessionId = loadActiveSessionId(clubId, storageOptions);
  if (!sessionId) {
    return null;
  }
  const store = loadCourtEngineStore(clubId, storageOptions);
  return getSessionFromStore(store, sessionId);
}

export function createSession(clubId, options = {}) {
  const storageOptions = resolveStorageOptions(clubId, options);
  const session = createCourtSession({ clubId, ...options });
  const store = loadCourtEngineStore(clubId, storageOptions);
  const nextStore = upsertSessionInStore(store, session);
  saveCourtEngineStore(clubId, nextStore, storageOptions);
  saveActiveSessionId(clubId, session.id, storageOptions);

  const withEvent = appendEvent(session, {
    eventType: EVENT_TYPE.SESSION_CREATE,
    message: `Tạo session "${session.name}"`,
    createdBy: options.createdBy || null,
  });

  return persistSession(clubId, withEvent);
}

export function openSession(clubId, sessionId, actor = null) {
  return updateSessionStatus(clubId, sessionId, SESSION_STATUS.OPEN, {
    eventType: EVENT_TYPE.SESSION_OPEN,
    message: "Mở session",
    actor,
    startTime: new Date().toISOString(),
  });
}

export function closeSession(clubId, sessionId, actor = null) {
  return updateSessionStatus(clubId, sessionId, SESSION_STATUS.CLOSED, {
    eventType: EVENT_TYPE.SESSION_CLOSE,
    message: "Đóng session",
    actor,
    endTime: new Date().toISOString(),
  });
}

function updateSessionStatus(clubId, sessionId, status, meta = {}) {
  const session = getSessionById(clubId, sessionId);
  if (!session) {
    return { ok: false, error: "Không tìm thấy session." };
  }

  let next = normalizeCourtSession({
    ...session,
    status,
    updatedAt: new Date().toISOString(),
    ...(meta.startTime ? { startTime: meta.startTime } : {}),
    ...(meta.endTime ? { endTime: meta.endTime } : {}),
  });

  next = appendEvent(next, {
    eventType: meta.eventType,
    message: meta.message,
    createdBy: meta.actor,
  });

  return persistSession(clubId, next);
}

export function getSessionById(clubId, sessionId, options = {}) {
  const store = loadCourtEngineStore(clubId, resolveStorageOptions(clubId, options));
  return getSessionFromStore(store, sessionId);
}

export function persistSession(clubId, session, options = {}) {
  const storageOptions = resolveStorageOptions(clubId, options);
  const normalized = normalizeCourtSession(session);
  const store = loadCourtEngineStore(clubId, storageOptions);
  const nextStore = upsertSessionInStore(store, normalized);
  saveCourtEngineStore(clubId, nextStore, storageOptions);
  saveActiveSessionId(clubId, normalized.id, storageOptions);
  return { ok: true, session: normalized };
}

export function setActiveSession(clubId, sessionId, options = {}) {
  const session = getSessionById(clubId, sessionId, options);
  if (!session) {
    return { ok: false, error: "Không tìm thấy session." };
  }
  saveActiveSessionId(clubId, sessionId, resolveStorageOptions(clubId, options));
  return { ok: true, session };
}

export function getSessionSummary(session) {
  const checkIns = session?.checkIns || [];
  const queue = session?.queue || [];
  const assignments = session?.assignments || [];

  const counts = {
    checkedIn: checkIns.filter((item) =>
      [PLAYER_SESSION_STATUS.CHECKED_IN, PLAYER_SESSION_STATUS.WAITING, PLAYER_SESSION_STATUS.PLAYING, PLAYER_SESSION_STATUS.RESTING].includes(item.status)
    ).length,
    waiting: checkIns.filter((item) => item.status === PLAYER_SESSION_STATUS.WAITING).length,
    playing: checkIns.filter((item) => item.status === PLAYER_SESSION_STATUS.PLAYING).length,
    resting: checkIns.filter((item) => item.status === PLAYER_SESSION_STATUS.RESTING).length,
    completed: checkIns.filter((item) => item.status === PLAYER_SESSION_STATUS.COMPLETED).length,
    queueActive: queue.filter((item) => item.status === "active").length,
    assignmentsActive: assignments.filter((item) =>
      ["assigned", "playing", "paused", "overrun"].includes(item.status)
    ).length,
  };

  return counts;
}
