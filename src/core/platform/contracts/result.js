/**
 * Shared Result contract (Platform Core Phase 1B).
 *
 * Generic success/failure envelope only. Does not own module error codes,
 * HTTP status mapping, or API error registries.
 */

/**
 * @typedef {{ ok: true, value: *, metadata?: * }} OkResult
 * @typedef {{ ok: false, error: *, metadata?: * }} FailResult
 * @typedef {OkResult | FailResult} Result
 */

/**
 * @param {*} value
 * @param {*} [metadata]
 * @returns {OkResult}
 */
export function ok(value, metadata) {
  /** @type {OkResult} */
  const result = { ok: true, value };
  if (arguments.length > 1) {
    result.metadata = metadata;
  }
  return Object.freeze(result);
}

/**
 * @param {*} error
 * @param {*} [metadata]
 * @returns {FailResult}
 */
export function fail(error, metadata) {
  /** @type {FailResult} */
  const result = { ok: false, error };
  if (arguments.length > 1) {
    result.metadata = metadata;
  }
  return Object.freeze(result);
}

/**
 * @param {*} result
 * @returns {result is OkResult}
 */
export function isOk(result) {
  return Boolean(result) && result.ok === true;
}

/**
 * @param {*} result
 * @returns {result is FailResult}
 */
export function isFail(result) {
  return Boolean(result) && result.ok === false;
}
