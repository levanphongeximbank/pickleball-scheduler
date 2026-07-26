/**
 * Canonical public Court Operations runtime facade.
 * UI/hooks/services should prefer this boundary over raw storage writers.
 */

import { createCourtSession, normalizeCourtSession } from "../models/courtSession.js";
import {
  EVENT_TYPE,
  SESSION_STATUS,
} from "../constants/statuses.js";
import { appendEvent } from "../services/eventLogService.js";
import {
  getCourtRuntimeAuthority,
  getCourtRuntimeWriter,
} from "./composition.js";
import {
  COURT_RUNTIME_ERROR_CODES,
  createCourtRuntimeError,
} from "./errors.js";
import { getSessionFromStore, upsertSessionInStore } from "./createCourtRuntimeWriter.js";

function resolveScope(clubId, options = {}) {
  return {
    tenantId: options.tenantId,
    clubId: String(clubId || "").trim(),
    venueId: options.venueId || null,
  };
}

function unwrapMaybePromise(value, map) {
  if (value && typeof value.then === "function") {
    return value.then(map);
  }
  return map(value);
}

export function inspectCourtRuntimeAuthority() {
  return getCourtRuntimeAuthority();
}

export function loadCourtRuntime(clubId, options = {}) {
  const writerResult = getCourtRuntimeWriter(options.runtime || {});
  if (!writerResult.ok) {
    return writerResult;
  }
  return writerResult.writer.loadRuntime(resolveScope(clubId, options));
}

export function loadActiveCourtSession(clubId, options = {}) {
  const writerResult = getCourtRuntimeWriter(options.runtime || {});
  if (!writerResult.ok) {
    return writerResult;
  }
  return writerResult.writer.loadActiveSession(resolveScope(clubId, options));
}

export function hydrateCourtRuntime(clubId, options = {}) {
  const writerResult = getCourtRuntimeWriter(options.runtime || {});
  if (!writerResult.ok) {
    return writerResult;
  }
  return writerResult.writer.hydrateRuntime(resolveScope(clubId, options));
}

export function persistCourtSession(clubId, session, options = {}) {
  const writerResult = getCourtRuntimeWriter(options.runtime || {});
  if (!writerResult.ok) {
    return writerResult;
  }
  return writerResult.writer.saveSession(
    session,
    resolveScope(clubId, { ...options, clubId }),
    options
  );
}

export function createCourtRuntimeSession(clubId, options = {}) {
  const writerResult = getCourtRuntimeWriter(options.runtime || {});
  if (!writerResult.ok) {
    return writerResult;
  }
  const scope = resolveScope(clubId, options);
  if (!scope.tenantId) {
    return createCourtRuntimeError(
      COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_SCOPE_REQUIRED,
      "tenantId is required to create a Court runtime session."
    );
  }

  const session = createCourtSession({
    clubId,
    tenantId: scope.tenantId,
    venueId: scope.venueId,
    ...options,
  });
  const withEvent = appendEvent(session, {
    eventType: EVENT_TYPE.SESSION_CREATE,
    message: `Tạo session "${session.name}"`,
    createdBy: options.createdBy || null,
  });

  return persistCourtSession(clubId, withEvent, options);
}

export function setActiveCourtSession(clubId, sessionId, options = {}) {
  const writerResult = getCourtRuntimeWriter(options.runtime || {});
  if (!writerResult.ok) {
    return writerResult;
  }
  return writerResult.writer.setActiveSession(
    sessionId,
    resolveScope(clubId, options),
    options
  );
}

export function openCourtRuntimeSession(clubId, sessionId, options = {}) {
  const active = loadActiveCourtSession(clubId, options);
  return unwrapMaybePromise(active, (loaded) => {
    if (!loaded.ok) {
      return loaded;
    }
    const session =
      loaded.session && String(loaded.session.id) === String(sessionId)
        ? loaded.session
        : getSessionFromLoaded(clubId, sessionId, options, loaded);
    if (!session) {
      return createCourtRuntimeError(
        COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_WRITE_FAILED,
        "Không tìm thấy session."
      );
    }
    let next = normalizeCourtSession({
      ...session,
      status: SESSION_STATUS.OPEN,
      startTime: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    next = appendEvent(next, {
      eventType: EVENT_TYPE.SESSION_OPEN,
      message: "Mở session",
      createdBy: options.actor || null,
    });
    return persistCourtSession(clubId, next, options);
  });
}

export function closeCourtRuntimeSession(clubId, sessionId, options = {}) {
  const runtime = loadCourtRuntime(clubId, options);
  return unwrapMaybePromise(runtime, (loaded) => {
    if (!loaded.ok) {
      return loaded;
    }
    const session = getSessionFromStore(loaded.store, sessionId);
    if (!session) {
      return createCourtRuntimeError(
        COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_WRITE_FAILED,
        "Không tìm thấy session."
      );
    }
    let next = normalizeCourtSession({
      ...session,
      status: SESSION_STATUS.CLOSED,
      endTime: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    next = appendEvent(next, {
      eventType: EVENT_TYPE.SESSION_CLOSE,
      message: "Đóng session",
      createdBy: options.actor || null,
    });
    return persistCourtSession(clubId, next, options);
  });
}

function getSessionFromLoaded(clubId, sessionId, options, loadedActive) {
  if (loadedActive?.store) {
    return getSessionFromStore(loadedActive.store, sessionId);
  }
  const runtime = loadCourtRuntime(clubId, options);
  if (runtime && typeof runtime.then === "function") {
    return null;
  }
  if (!runtime?.ok) {
    return null;
  }
  return getSessionFromStore(runtime.store, sessionId);
}

export {
  getSessionFromStore,
  upsertSessionInStore,
};
