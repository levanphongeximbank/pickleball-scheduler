/**
 * Preview-only structured roster hydration transition logs.
 * Enable: localStorage.setItem('tt-v6-roster-hydration-debug', '1')
 */

const DEBUG_KEY = "tt-v6-roster-hydration-debug";
const effectCounts = new Map();

function isDebugEnabled() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage?.getItem(DEBUG_KEY) === "1";
  } catch {
    return false;
  }
}

function sanitizePayload(payload = {}) {
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value == null) {
      out[key] = value;
      continue;
    }
    if (typeof value === "object" && !Array.isArray(value)) {
      out[key] = sanitizePayload(value);
      continue;
    }
    if (Array.isArray(value)) {
      out[key] = value.length;
      continue;
    }
    out[key] = value;
  }
  return out;
}

/**
 * @param {string} scope
 * @param {object} payload
 */
export function logTeamRosterHydrationTransition(scope, payload = {}) {
  if (!isDebugEnabled()) return;

  const count = (effectCounts.get(scope) || 0) + 1;
  effectCounts.set(scope, count);

  const entry = {
    ts: new Date().toISOString(),
    scope,
    effectInvocationCount: count,
    ...sanitizePayload(payload),
  };

  console.info("[tt-v6-roster-hydration]", entry);
}

export function resetTeamRosterHydrationDiagnosticsForTests() {
  effectCounts.clear();
}

export function isTeamRosterHydrationDebugEnabled() {
  return isDebugEnabled();
}
