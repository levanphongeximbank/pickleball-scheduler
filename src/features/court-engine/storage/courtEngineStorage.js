import { normalizeCourtSession } from "../models/courtSession.js";

const STORAGE_KEY_PREFIX = "pickleball-court-engine-v1";
const ACTIVE_KEY_PREFIX = "pickleball-court-engine-active-v1";

function storageKey(clubId) {
  return `${STORAGE_KEY_PREFIX}::${clubId}`;
}

function activeKey(clubId) {
  return `${ACTIVE_KEY_PREFIX}::${clubId}`;
}

function safeParse(raw, fallback) {
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function emptyStore(clubId) {
  return {
    clubId: String(clubId || ""),
    sessions: [],
    updatedAt: new Date().toISOString(),
  };
}

export function loadCourtEngineStore(clubId) {
  const id = String(clubId || "").trim();
  if (!id) {
    return emptyStore("");
  }

  const parsed = safeParse(localStorage.getItem(storageKey(id)), emptyStore(id));
  return {
    clubId: id,
    sessions: (parsed.sessions || []).map(normalizeCourtSession),
    updatedAt: parsed.updatedAt || new Date().toISOString(),
  };
}

export function saveCourtEngineStore(clubId, store) {
  const id = String(clubId || "").trim();
  if (!id) {
    return { ok: false, error: "clubId không hợp lệ." };
  }

  const payload = {
    clubId: id,
    sessions: (store.sessions || []).map(normalizeCourtSession),
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(storageKey(id), JSON.stringify(payload));
  return { ok: true, store: payload };
}

export function loadActiveSessionId(clubId) {
  const id = String(clubId || "").trim();
  if (!id) {
    return null;
  }
  return localStorage.getItem(activeKey(id)) || null;
}

export function saveActiveSessionId(clubId, sessionId) {
  const id = String(clubId || "").trim();
  if (!id) {
    return { ok: false, error: "clubId không hợp lệ." };
  }

  if (sessionId) {
    localStorage.setItem(activeKey(id), String(sessionId));
  } else {
    localStorage.removeItem(activeKey(id));
  }

  return { ok: true };
}

export function getSessionFromStore(store, sessionId) {
  return (store.sessions || []).find((item) => String(item.id) === String(sessionId)) || null;
}

export function upsertSessionInStore(store, session) {
  const normalized = normalizeCourtSession(session);
  const sessions = [...(store.sessions || [])];
  const index = sessions.findIndex((item) => String(item.id) === String(normalized.id));

  if (index >= 0) {
    sessions[index] = normalized;
  } else {
    sessions.push(normalized);
  }

  return {
    ...store,
    sessions,
    updatedAt: new Date().toISOString(),
  };
}
