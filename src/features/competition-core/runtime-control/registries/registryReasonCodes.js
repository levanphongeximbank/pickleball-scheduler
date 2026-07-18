/**
 * Registry reason codes (Phase 3A.3 — Integration Bootstrap).
 * Deterministic, machine-readable. Namespace: REGISTRY_*
 */

export const REGISTRY_REASON_CODE = Object.freeze({
  INVALID_CAPABILITY_ID: "INVALID_CAPABILITY_ID",
  INVALID_REGISTRY_ENTRY: "INVALID_REGISTRY_ENTRY",
  DUPLICATE_REGISTRATION: "DUPLICATE_REGISTRATION",
  CAPABILITY_NOT_REGISTERED: "CAPABILITY_NOT_REGISTERED",
  COMPARATOR_NOT_REGISTERED: "COMPARATOR_NOT_REGISTERED",
  NORMALIZER_NOT_REGISTERED: "NORMALIZER_NOT_REGISTERED",
  ALLOWLIST_NOT_REGISTERED: "ALLOWLIST_NOT_REGISTERED",
  REGISTRY_LOCKED: "REGISTRY_LOCKED",
  OK: "OK",
});

export const REGISTRY_REASON_CODE_VALUES = Object.freeze(
  Object.values(REGISTRY_REASON_CODE)
);

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function isRegistryReasonCode(value) {
  return REGISTRY_REASON_CODE_VALUES.includes(value);
}

/**
 * @param {string} reasonCode
 * @param {string[]} [errors]
 * @param {Record<string, unknown>} [extra]
 * @returns {{ ok: false, reasonCode: string, errors: string[], [key: string]: unknown }}
 */
export function registryFailure(reasonCode, errors = [], extra = {}) {
  return Object.freeze({
    ok: false,
    reasonCode,
    errors: Object.freeze([...errors]),
    ...extra,
  });
}

/**
 * @template T
 * @param {T} value
 * @param {Record<string, unknown>} [extra]
 * @returns {{ ok: true, reasonCode: string, value: T, [key: string]: unknown }}
 */
export function registrySuccess(value, extra = {}) {
  return Object.freeze({
    ok: true,
    reasonCode: REGISTRY_REASON_CODE.OK,
    value,
    ...extra,
  });
}

/**
 * Deterministic capability key sort (localeCompare, numeric).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function compareCapabilityKeys(a, b) {
  return String(a).localeCompare(String(b), "en", { sensitivity: "variant" });
}
