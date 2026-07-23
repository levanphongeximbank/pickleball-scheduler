/**
 * CORE-21 — seeded deterministic PRNG foundation.
 * Algorithm: Mulberry32. Version: CORE21_PRNG_MULBERRY32_V1.
 * Ambient RNG is forbidden. Explicit seed required. No host RNG fallback.
 */

import { CORE21_PRNG_VERSION } from "../constants.js";
import { DETERMINISTIC_SEED_REPLAY_ERROR_CODE } from "../errors/errorCodes.js";
import { DeterministicSeedReplayError } from "../errors/DeterministicSeedReplayError.js";
import { hashStringToUint32 } from "../fingerprint/fingerprint.js";
import { normalizeSeed } from "../seed/normalize.js";

/**
 * @typedef {Object} SeededRandom
 * @property {string} prngVersion
 * @property {string} seed
 * @property {() => number} nextFloat — [0, 1)
 * @property {() => number} nextUint32 — unsigned 32-bit
 * @property {(label: unknown) => SeededRandom} fork — derived substream
 */

/**
 * @param {number} seed
 * @returns {() => number}
 */
function createMulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Create a seeded PRNG. Never falls back to host ambient RNG.
 * @param {unknown} seed
 * @returns {SeededRandom}
 */
export function createSeededRandom(seed) {
  const normalized = normalizeSeed(seed);
  const uintSeed = hashStringToUint32(`${CORE21_PRNG_VERSION}:${normalized}`);
  const nextFloat = createMulberry32(uintSeed);

  /** @type {SeededRandom} */
  const api = {
    prngVersion: CORE21_PRNG_VERSION,
    seed: normalized,
    nextFloat,
    nextUint32() {
      return (nextFloat() * 4294967296) >>> 0;
    },
    fork(label) {
      if (label === null || label === undefined || label === "") {
        throw new DeterministicSeedReplayError(
          DETERMINISTIC_SEED_REPLAY_ERROR_CODE.PRNG_INVALID_OPERATION,
          "fork requires a non-empty label",
          {}
        );
      }
      const forkSeed = normalizeSeed(`${normalized}|fork:${String(label)}`);
      return createSeededRandom(forkSeed);
    },
  };
  return Object.freeze(api);
}

export { CORE21_PRNG_VERSION };
