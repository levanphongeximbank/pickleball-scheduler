/**
 * Canonical Court runtime writer — single write path per command.
 * No dual-write. Authority fixed at construction.
 */

import { normalizeCourtSession } from "../models/courtSession.js";
import { COURT_RUNTIME_AUTHORITY } from "./constants.js";
import {
  COURT_RUNTIME_ERROR_CODES,
  createCourtRuntimeError,
} from "./errors.js";
import {
  authorizeCourtRuntimeMutation,
  validateCourtRuntimeScope,
} from "./scope.js";
import { isLocalCourtRuntimeAuthority } from "./resolveCourtRuntimeAuthority.js";

function getSessionFromStore(store, sessionId) {
  return (store.sessions || []).find((item) => String(item.id) === String(sessionId)) || null;
}

function upsertSessionInStore(store, session) {
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

/**
 * @param {{
 *   authority: string,
 *   adapter: object,
 * }} options
 */
export function createCourtRuntimeWriter(options = {}) {
  const authority = options.authority;
  const adapter = options.adapter;
  if (!authority || !adapter) {
    throw new Error("createCourtRuntimeWriter requires authority and adapter.");
  }

  const writeCounts = new Map();

  function bump(command) {
    writeCounts.set(command, (writeCounts.get(command) || 0) + 1);
  }

  function enforceNoDualWrite() {
    if (adapter.dualWrite === true) {
      return createCourtRuntimeError(
        COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_DUAL_WRITE_FORBIDDEN,
        "Dual-write Court runtime adapters are forbidden."
      );
    }
    if (
      authority === COURT_RUNTIME_AUTHORITY.DURABLE &&
      adapter.usesLocalStorage === true
    ) {
      return createCourtRuntimeError(
        COURT_RUNTIME_ERROR_CODES.COURT_RUNTIME_DUAL_WRITE_FORBIDDEN,
        "Durable Court runtime must not write localStorage."
      );
    }
    return { ok: true };
  }

  function withScopeAndAuth(command, scopeInput, authOptions, run) {
    const dual = enforceNoDualWrite();
    if (!dual.ok) {
      return dual;
    }

    const scope = validateCourtRuntimeScope(scopeInput);
    if (!scope.ok) {
      return scope;
    }

    const authz = authorizeCourtRuntimeMutation(scope.clubId, authOptions || {});
    if (!authz.ok) {
      return authz;
    }

    bump(command);
    return run(scope);
  }

  async function saveSessionAsync(scope, session) {
    const loaded = adapter.loadRuntime(scope.tenantId, scope.clubId);
    if (!loaded.ok) {
      return loaded;
    }
    const nextStore = upsertSessionInStore(loaded.store, session);
    const saved = await Promise.resolve(
      adapter.saveRuntime(scope.tenantId, scope.clubId, nextStore)
    );
    if (!saved.ok) {
      return saved;
    }
    const active = await Promise.resolve(
      adapter.setActiveSessionId(scope.tenantId, scope.clubId, session.id)
    );
    if (!active.ok) {
      return active;
    }
    return {
      ok: true,
      session: normalizeCourtSession(session),
      store: saved.store,
      authority,
      writes: 1,
    };
  }

  return {
    authority,
    adapter,
    usesLocalStorage: Boolean(adapter.usesLocalStorage),
    getWriteCount(command) {
      return writeCounts.get(command) || 0;
    },
    getWriteCounts() {
      return Object.fromEntries(writeCounts);
    },
    resetWriteCounts() {
      writeCounts.clear();
    },

    inspect() {
      return {
        authority,
        mode: adapter.mode,
        usesLocalStorage: Boolean(adapter.usesLocalStorage),
        dualWrite: Boolean(adapter.dualWrite),
        isLocal: isLocalCourtRuntimeAuthority(authority),
        isDurable: authority === COURT_RUNTIME_AUTHORITY.DURABLE,
      };
    },

    loadRuntime(input = {}) {
      const scope = validateCourtRuntimeScope(input);
      if (!scope.ok) {
        return scope;
      }
      return adapter.loadRuntime(scope.tenantId, scope.clubId);
    },

    async hydrateRuntime(input = {}) {
      const scope = validateCourtRuntimeScope(input);
      if (!scope.ok) {
        return scope;
      }
      if (typeof adapter.hydrateRuntime === "function") {
        return adapter.hydrateRuntime(scope.tenantId, scope.clubId);
      }
      return adapter.loadRuntime(scope.tenantId, scope.clubId);
    },

    loadActiveSession(input = {}) {
      const scope = validateCourtRuntimeScope(input);
      if (!scope.ok) {
        return scope;
      }
      const loaded = adapter.loadRuntime(scope.tenantId, scope.clubId);
      if (!loaded.ok) {
        return loaded;
      }
      const sessionId = adapter.loadActiveSessionId(scope.tenantId, scope.clubId);
      if (!sessionId) {
        return { ok: true, session: null };
      }
      return {
        ok: true,
        session: getSessionFromStore(loaded.store, sessionId),
        sessionId,
      };
    },

    /**
     * Persist a full session into the store (canonical mutation path).
     * Local/memory adapters return sync results; durable returns a Promise.
     */
    saveSession(session, input = {}, authOptions = {}) {
      return withScopeAndAuth(
        "saveSession",
        {
          tenantId: input.tenantId || session?.tenantId,
          clubId: input.clubId || session?.clubId,
          venueId: input.venueId || session?.venueId,
          requireVenue: input.requireVenue === true,
          expectedTenantId: input.expectedTenantId,
          expectedClubId: input.expectedClubId,
          expectedVenueId: input.expectedVenueId,
        },
        authOptions,
        (scope) => {
          if (isLocalCourtRuntimeAuthority(authority)) {
            const loaded = adapter.loadRuntime(scope.tenantId, scope.clubId);
            if (!loaded.ok) {
              return loaded;
            }
            const nextStore = upsertSessionInStore(loaded.store, session);
            const saved = adapter.saveRuntime(scope.tenantId, scope.clubId, nextStore);
            if (!saved.ok) {
              return saved;
            }
            const active = adapter.setActiveSessionId(
              scope.tenantId,
              scope.clubId,
              session.id
            );
            if (!active.ok) {
              return active;
            }
            return {
              ok: true,
              session: normalizeCourtSession(session),
              store: saved.store,
              authority,
              writes: 1,
            };
          }
          return saveSessionAsync(scope, session);
        }
      );
    },

    setActiveSession(sessionId, input = {}, authOptions = {}) {
      return withScopeAndAuth(
        "setActiveSession",
        input,
        authOptions,
        (scope) => {
          const loaded = adapter.loadRuntime(scope.tenantId, scope.clubId);
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
          if (isLocalCourtRuntimeAuthority(authority)) {
            const active = adapter.setActiveSessionId(
              scope.tenantId,
              scope.clubId,
              sessionId
            );
            if (!active.ok) {
              return active;
            }
            return { ok: true, session, authority };
          }
          return Promise.resolve(
            adapter.setActiveSessionId(scope.tenantId, scope.clubId, sessionId)
          ).then((active) => {
            if (!active.ok) {
              return active;
            }
            return { ok: true, session, authority };
          });
        }
      );
    },

    clearActiveSession(input = {}, authOptions = {}) {
      return withScopeAndAuth("clearActiveSession", input, authOptions, (scope) => {
        if (isLocalCourtRuntimeAuthority(authority)) {
          const active = adapter.setActiveSessionId(scope.tenantId, scope.clubId, null);
          if (!active.ok) {
            return active;
          }
          return { ok: true, authority };
        }
        return Promise.resolve(
          adapter.setActiveSessionId(scope.tenantId, scope.clubId, null)
        ).then((active) => {
          if (!active.ok) {
            return active;
          }
          return { ok: true, authority };
        });
      });
    },

    replaceStore(store, input = {}, authOptions = {}) {
      return withScopeAndAuth("replaceStore", input, authOptions, (scope) => {
        if (isLocalCourtRuntimeAuthority(authority)) {
          const saved = adapter.saveRuntime(scope.tenantId, scope.clubId, store);
          if (!saved.ok) {
            return saved;
          }
          return { ok: true, store: saved.store, authority };
        }
        return Promise.resolve(
          adapter.saveRuntime(scope.tenantId, scope.clubId, store)
        ).then((saved) => {
          if (!saved.ok) {
            return saved;
          }
          return { ok: true, store: saved.store, authority };
        });
      });
    },
  };
}

export { getSessionFromStore, upsertSessionInStore };
