import {
  EVENT_TYPE,
  PLAYER_SESSION_STATUS,
  SESSION_STATUS,
} from "../constants/statuses.js";
import { createCourtSession, normalizeCourtSession } from "../models/courtSession.js";
import {
  getCourtRuntimeWriter,
  isLocalCourtRuntimeAuthority,
} from "../runtime/composition.js";
import {
  COURT_RUNTIME_ERROR_CODES,
  createCourtRuntimeError,
} from "../runtime/errors.js";
import {
  closeCourtRuntimeSession,
  createCourtRuntimeSession,
  loadActiveCourtSession,
  loadCourtRuntime,
  openCourtRuntimeSession,
  persistCourtSession,
  setActiveCourtSession,
} from "../runtime/facade.js";
import { getSessionFromStore } from "../runtime/createCourtRuntimeWriter.js";

function resolveTenantId(clubId, options = {}, session = null) {
  const explicit = String(options.tenantId || session?.tenantId || "").trim();
  if (explicit) {
    return explicit;
  }
  return "";
}

function storageOptions(clubId, options = {}, session = null) {
  return {
    ...options,
    tenantId: resolveTenantId(clubId, options, session),
  };
}

export function listSessions(clubId, options = {}) {
  const opts = storageOptions(clubId, options);
  if (!opts.tenantId) {
    return [];
  }
  const loaded = loadCourtRuntime(clubId, opts);
  if (!loaded?.ok) {
    return [];
  }
  return loaded.store?.sessions || [];
}

export function getActiveSession(clubId, options = {}) {
  const opts = storageOptions(clubId, options);
  if (!opts.tenantId) {
    return null;
  }
  const loaded = loadActiveCourtSession(clubId, opts);
  if (!loaded?.ok) {
    return null;
  }
  return loaded.session || null;
}

export function createSession(clubId, options = {}) {
  const opts = storageOptions(clubId, options);
  if (!opts.tenantId) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_REQUIRED,
      "tenantId is required to create a Court session."
    );
  }
  return createCourtRuntimeSession(clubId, opts);
}

export function openSession(clubId, sessionId, actor = null, options = {}) {
  return openCourtRuntimeSession(clubId, sessionId, {
    ...storageOptions(clubId, options),
    actor,
  });
}

export function closeSession(clubId, sessionId, actor = null, options = {}) {
  return closeCourtRuntimeSession(clubId, sessionId, {
    ...storageOptions(clubId, options),
    actor,
  });
}

export function getSessionById(clubId, sessionId, options = {}) {
  const opts = storageOptions(clubId, options);
  if (!opts.tenantId) {
    return null;
  }
  const loaded = loadCourtRuntime(clubId, opts);
  if (!loaded?.ok) {
    return null;
  }
  return getSessionFromStore(loaded.store, sessionId);
}

export function persistSession(clubId, session, options = {}) {
  const opts = storageOptions(clubId, options, session);
  if (!opts.tenantId) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_REQUIRED,
      "tenantId is required to persist a Court session."
    );
  }
  return persistCourtSession(clubId, session, opts);
}

export function setActiveSession(clubId, sessionId, options = {}) {
  const opts = storageOptions(clubId, options);
  if (!opts.tenantId) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_REQUIRED,
      "tenantId is required to set active Court session."
    );
  }
  return setActiveCourtSession(clubId, sessionId, opts);
}

export function getSessionSummary(session) {
  const checkIns = session?.checkIns || [];
  const queue = session?.queue || [];
  const assignments = session?.assignments || [];

  const counts = {
    checkedIn: checkIns.filter((item) =>
      [
        PLAYER_SESSION_STATUS.CHECKED_IN,
        PLAYER_SESSION_STATUS.WAITING,
        PLAYER_SESSION_STATUS.PLAYING,
        PLAYER_SESSION_STATUS.RESTING,
      ].includes(item.status)
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

/** @deprecated Compatibility — prefer inspectCourtRuntimeAuthority */
export function getCourtSessionPersistenceAuthority() {
  const runtime = getCourtRuntimeWriter();
  if (!runtime.ok) {
    return runtime;
  }
  return {
    ok: true,
    authority: runtime.authority,
    isLocal: isLocalCourtRuntimeAuthority(runtime.authority),
  };
}

export { SESSION_STATUS, EVENT_TYPE, createCourtSession, normalizeCourtSession };
