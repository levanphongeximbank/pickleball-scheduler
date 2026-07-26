/**
 * Pick_VN V2 → canonical Player Rating write bridge (BM-FINAL-RATING-01).
 *
 * Compatibility import/call surface stays on V2 services; writable rating
 * mutations must go through the foundation write facade or fail closed.
 * Never swallows durable failures into local success.
 *
 * Imports are intentionally narrow to avoid loading Player Management / auth
 * graphs from every V2 read path.
 */

import { PLAYER_RATING_FOUNDATION_ERROR_CODE } from "../../player-rating/foundation/errors/errorCodes.js";
import {
  PlayerRatingFoundationError,
  isPlayerRatingFoundationError,
} from "../../player-rating/foundation/errors/PlayerRatingFoundationError.js";

/** @type {object|null|undefined} */
let writeFacadeOverride;

/**
 * @param {unknown} facade
 */
export function __setPlayerRatingWriteFacadeForTests(facade) {
  writeFacadeOverride = facade;
}

export function __resetPlayerRatingWriteFacadeForTests() {
  writeFacadeOverride = undefined;
}

/**
 * Default composition fails closed (no client V5 CAS runtime).
 * Tests may inject a ready facade via __setPlayerRatingWriteFacadeForTests.
 *
 * @returns {Promise<object>}
 */
export async function getCanonicalPlayerRatingWriteFacade() {
  if (writeFacadeOverride !== undefined) {
    if (writeFacadeOverride == null) {
      throw new PlayerRatingFoundationError(
        PLAYER_RATING_FOUNDATION_ERROR_CODE.DURABLE_RUNTIME_UNAVAILABLE,
        "Player Rating durable runtime unavailable (test override null)",
        { operation: "getCanonicalPlayerRatingWriteFacade" }
      );
    }
    return writeFacadeOverride;
  }

  const { composePlayerRatingWriteFacade } = await import(
    "../../player-rating/foundation/adapters/composePlayerRatingWriteFacade.js"
  );
  // allowUnready → proxy that fails every durable write command.
  return composePlayerRatingWriteFacade({ allowUnready: true });
}

/**
 * @param {string} operation
 * @param {Record<string, unknown>} [extra]
 */
export function frozenWriterResult(operation, extra = {}) {
  return {
    ok: false,
    code: PLAYER_RATING_FOUNDATION_ERROR_CODE.WRITER_FROZEN,
    error: `Player Rating writer frozen: ${operation}`,
    operation,
    ...extra,
  };
}

/**
 * @param {string} operation
 * @param {Record<string, unknown>} [extra]
 */
export function durableUnavailableResult(operation, extra = {}) {
  return {
    ok: false,
    code: PLAYER_RATING_FOUNDATION_ERROR_CODE.DURABLE_RUNTIME_UNAVAILABLE,
    error: `Player Rating durable runtime unavailable: ${operation}`,
    operation,
    ...extra,
  };
}

/**
 * @param {unknown} err
 * @param {string} operation
 */
export function mapWriterErrorToResult(err, operation) {
  if (isPlayerRatingFoundationError(err)) {
    return {
      ok: false,
      code: err.code,
      error: err.message,
      operation,
      details: err.details || {},
    };
  }
  return {
    ok: false,
    code: PLAYER_RATING_FOUNDATION_ERROR_CODE.PERSISTENCE_FAILED,
    error:
      err instanceof Error
        ? err.message
        : `Player Rating persistence failed: ${operation}`,
    operation,
  };
}

/**
 * Attempt a canonical write via the facade. Never falls back to localStorage.
 *
 * @param {(facade: object) => Promise<unknown>} command
 * @param {string} operation
 */
export async function runCanonicalRatingWrite(command, operation) {
  try {
    const facade = await getCanonicalPlayerRatingWriteFacade();
    const result = await command(facade);
    return { ok: true, result, operation };
  } catch (err) {
    return mapWriterErrorToResult(err, operation);
  }
}

export { PLAYER_RATING_FOUNDATION_ERROR_CODE, PlayerRatingFoundationError };
