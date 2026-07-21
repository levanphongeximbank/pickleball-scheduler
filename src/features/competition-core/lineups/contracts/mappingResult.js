/**
 * CORE-06 Phase 1F — mapping result envelope (fail closed).
 */

import { LINEUP_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";

/**
 * @typedef {Object} LineupMappingOk
 * @property {true} ok
 * @property {unknown} value
 * @property {null} code
 * @property {null} message
 * @property {Readonly<Record<string, unknown>>} details
 */

/**
 * @typedef {Object} LineupMappingFail
 * @property {false} ok
 * @property {null} value
 * @property {string} code
 * @property {string} message
 * @property {Readonly<Record<string, unknown>>} details
 */

/**
 * @param {unknown} value
 * @param {Record<string, unknown>} [details]
 * @returns {LineupMappingOk}
 */
export function lineupMappingOk(value, details = {}) {
  return Object.freeze({
    ok: true,
    value,
    code: null,
    message: null,
    details: Object.freeze({ ...details }),
  });
}

/**
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 * @returns {LineupMappingFail}
 */
export function lineupMappingFail(
  code,
  message,
  details = {}
) {
  return Object.freeze({
    ok: false,
    value: null,
    code:
      typeof code === "string" && code.trim() !== ""
        ? code.trim()
        : LINEUP_RUNTIME_ERROR_CODE.INVALID_LINEUP_MAPPING,
    message:
      typeof message === "string" && message.trim() !== ""
        ? message.trim()
        : "Lineup mapping failed",
    details: Object.freeze({ ...details }),
  });
}
