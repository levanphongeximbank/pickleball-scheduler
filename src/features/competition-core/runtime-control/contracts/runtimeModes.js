/**
 * Runtime mode contracts and allowed transitions (Phase 3A.1).
 * Modes may be defined; Phase 3A.1 activation remains LEGACY_ONLY only.
 */

export const RUNTIME_MODE = Object.freeze({
  LEGACY_ONLY: "LEGACY_ONLY",
  SHADOW: "SHADOW",
  CANONICAL_READ: "CANONICAL_READ",
  DUAL_WRITE: "DUAL_WRITE",
  CANONICAL_PRIMARY: "CANONICAL_PRIMARY",
  LEGACY_FALLBACK: "LEGACY_FALLBACK",
  CANONICAL_ONLY: "CANONICAL_ONLY",
  RETIRED: "RETIRED",
});

export const RUNTIME_MODE_VALUES = Object.freeze(Object.values(RUNTIME_MODE));

export function isRuntimeMode(value) {
  return RUNTIME_MODE_VALUES.includes(value);
}

/**
 * Allowed transitions from Phase 3.0 state machine.
 * Forbidden: LEGACY_ONLY → CANONICAL_ONLY (direct).
 */
export const RUNTIME_MODE_TRANSITIONS = Object.freeze({
  [RUNTIME_MODE.LEGACY_ONLY]: Object.freeze([RUNTIME_MODE.SHADOW]),
  [RUNTIME_MODE.SHADOW]: Object.freeze([
    RUNTIME_MODE.CANONICAL_READ,
    RUNTIME_MODE.DUAL_WRITE,
    RUNTIME_MODE.LEGACY_ONLY,
  ]),
  [RUNTIME_MODE.CANONICAL_READ]: Object.freeze([
    RUNTIME_MODE.DUAL_WRITE,
    RUNTIME_MODE.CANONICAL_PRIMARY,
    RUNTIME_MODE.SHADOW,
    RUNTIME_MODE.LEGACY_ONLY,
  ]),
  [RUNTIME_MODE.DUAL_WRITE]: Object.freeze([
    RUNTIME_MODE.CANONICAL_PRIMARY,
    RUNTIME_MODE.SHADOW,
    RUNTIME_MODE.LEGACY_ONLY,
  ]),
  [RUNTIME_MODE.CANONICAL_PRIMARY]: Object.freeze([
    RUNTIME_MODE.LEGACY_FALLBACK,
    RUNTIME_MODE.CANONICAL_ONLY,
    RUNTIME_MODE.SHADOW,
  ]),
  [RUNTIME_MODE.LEGACY_FALLBACK]: Object.freeze([
    RUNTIME_MODE.SHADOW,
    RUNTIME_MODE.CANONICAL_PRIMARY,
    RUNTIME_MODE.LEGACY_ONLY,
  ]),
  [RUNTIME_MODE.CANONICAL_ONLY]: Object.freeze([RUNTIME_MODE.RETIRED]),
  [RUNTIME_MODE.RETIRED]: Object.freeze([]),
});

/**
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function isRuntimeModeTransitionAllowed(from, to) {
  if (!isRuntimeMode(from) || !isRuntimeMode(to)) {
    return false;
  }
  if (from === RUNTIME_MODE.LEGACY_ONLY && to === RUNTIME_MODE.CANONICAL_ONLY) {
    return false;
  }
  const allowed = RUNTIME_MODE_TRANSITIONS[from] || [];
  return allowed.includes(to);
}

/**
 * Phase 3A.1 may only activate LEGACY_ONLY.
 * @param {string} mode
 * @returns {boolean}
 */
export function isRuntimeModeActivatableInPhase3A1(mode) {
  return mode === RUNTIME_MODE.LEGACY_ONLY;
}
