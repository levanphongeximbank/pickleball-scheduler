/**
 * Platform-owned auth session lifecycle hooks (Wave 2).
 *
 * Business modules register projectors/cleanup externally at the composition root.
 * Auth storage invokes only these neutral contracts — never BM implementations.
 *
 * Deterministic, idempotent registration; missing hooks are safe no-ops.
 * Payloads must not include secrets/tokens.
 */

import { AUTH_SESSION_CLEAR_REASON } from "./authSessionLifecycle.js";

/** @type {Array<(user: object, meta?: object) => { user: object, changed?: boolean }>} */
const loadProjectors = [];

/** @type {Array<(reason: string) => void>} */
const clearHooks = [];

/**
 * Register a session-load projector (e.g. club governance elevation / membership strip).
 * Idempotent by function identity.
 * @param {(user: object, meta?: object) => { user: object, changed?: boolean }} projector
 */
export function registerAuthSessionLoadProjector(projector) {
  if (typeof projector !== "function") {
    return () => {};
  }
  if (!loadProjectors.includes(projector)) {
    loadProjectors.push(projector);
  }
  return () => {
    const idx = loadProjectors.indexOf(projector);
    if (idx >= 0) loadProjectors.splice(idx, 1);
  };
}

/**
 * Register cleanup that runs on every auth session clear (LOGOUT / USER_SWITCH /
 * AUTH_INVALID / IDENTITY_REPLACE). Mobile queue quarantine registers here.
 * @param {(reason: string) => void} hook
 */
export function registerAuthSessionClearHook(hook) {
  if (typeof hook !== "function") {
    return () => {};
  }
  if (!clearHooks.includes(hook)) {
    clearHooks.push(hook);
  }
  return () => {
    const idx = clearHooks.indexOf(hook);
    if (idx >= 0) clearHooks.splice(idx, 1);
  };
}

/**
 * Apply registered projectors. Failures in one projector must not block others.
 * @param {object} user
 * @param {object} [meta]
 * @returns {{ user: object, changed: boolean }}
 */
export function applyAuthSessionLoadProjectors(user, meta = {}) {
  let next = user;
  let changed = false;
  for (const projector of loadProjectors) {
    try {
      const result = projector(next, meta);
      if (result?.user) {
        if (result.changed) changed = true;
        next = result.user;
      }
    } catch {
      // Optional capability — absence/failure must not break auth storage.
    }
  }
  return { user: next, changed };
}

/**
 * Run clear hooks. Safe when none registered.
 * @param {string} [reason]
 */
export function runAuthSessionClearHooks(reason = AUTH_SESSION_CLEAR_REASON.LOGOUT) {
  const normalized = String(reason || AUTH_SESSION_CLEAR_REASON.LOGOUT).trim();
  for (const hook of clearHooks) {
    try {
      hook(normalized);
    } catch {
      // Optional cleanup — must not break logout.
    }
  }
}

/** Test / composition reset — not for production runtime churn. */
export function __resetAuthSessionHooksForTests() {
  loadProjectors.length = 0;
  clearHooks.length = 0;
}

export function __authSessionHookCountsForTests() {
  return { loadProjectors: loadProjectors.length, clearHooks: clearHooks.length };
}
