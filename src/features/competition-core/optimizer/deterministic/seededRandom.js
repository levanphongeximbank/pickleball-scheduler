/**
 * CORE-10 — seeded deterministic PRNG foundation.
 * Algorithm: Mulberry32. Version: CORE10_PRNG_MULBERRY32_V1.
 * Ambient RNG is forbidden. Explicit seed required. No host RNG fallback.
 */

import { CORE10_PRNG_VERSION } from "../constants/versions.js";
import { OPTIMIZATION_FAILURE_CODE } from "../enums/failureCodes.js";
import { OptimizerContractError } from "../errors/OptimizerContractError.js";
import { hashStringToUint32 } from "./fingerprint.js";

/**
 * @typedef {Object} SeededRandom
 * @property {string} prngVersion
 * @property {string} seed
 * @property {() => number} nextFloat — [0, 1)
 * @property {() => number} nextUint32 — unsigned 32-bit
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
 * Normalize explicit seed. Fails closed on missing/invalid.
 * @param {unknown} seed
 * @returns {string}
 */
export function normalizeSeed(seed) {
  if (seed === null || seed === undefined) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.NON_DETERMINISTIC_INPUT,
      "Explicit seed is required; host RNG fallback is forbidden",
      { seed: null }
    );
  }
  if (typeof seed === "number") {
    if (!Number.isFinite(seed) || !Number.isInteger(seed)) {
      throw new OptimizerContractError(
        OPTIMIZATION_FAILURE_CODE.NON_DETERMINISTIC_INPUT,
        "Numeric seed must be a finite integer",
        { seed }
      );
    }
    return String(seed);
  }
  if (typeof seed !== "string") {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.NON_DETERMINISTIC_INPUT,
      "Seed must be a string or integer",
      { type: typeof seed }
    );
  }
  if (seed.length === 0) {
    throw new OptimizerContractError(
      OPTIMIZATION_FAILURE_CODE.NON_DETERMINISTIC_INPUT,
      "Seed must be a non-empty string",
      { seed }
    );
  }
  return seed;
}

/**
 * Create a seeded PRNG. Never falls back to host ambient RNG.
 * @param {unknown} seed
 * @returns {SeededRandom}
 */
export function createSeededRandom(seed) {
  const normalized = normalizeSeed(seed);
  const uintSeed = hashStringToUint32(`${CORE10_PRNG_VERSION}:${normalized}`);
  const nextFloat = createMulberry32(uintSeed);
  return Object.freeze({
    prngVersion: CORE10_PRNG_VERSION,
    seed: normalized,
    nextFloat,
    nextUint32() {
      return (nextFloat() * 4294967296) >>> 0;
    },
  });
}

export { CORE10_PRNG_VERSION };
