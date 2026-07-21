/**
 * CORE-06 Phase 1D — deterministic lineup random algorithm identity + PRNG.
 * Algorithm: seeded Fisher–Yates over canonically ordered candidates per slot.
 * No Math.random. No Date.now. No system clock.
 *
 * Changing selection behavior REQUIRES bumping `version`.
 */

export const LINEUP_RANDOM_ALGORITHM = Object.freeze({
  id: "CORE06_LINEUP_SEEDED_FISHER_YATES",
  version: "1.0.0",
});

/**
 * Stable string → 32-bit unsigned hash (FNV-1a).
 * @param {string} input
 * @returns {number}
 */
export function hashStringToUint32(input) {
  let hash = 2166136261;
  const str = String(input ?? "");
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Mulberry32 PRNG — returns [0, 1).
 * @param {number} seed
 * @returns {() => number}
 */
export function createMulberry32(seed) {
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
 * @param {string} material
 * @returns {() => number}
 */
export function createRngFromMaterial(material) {
  return createMulberry32(hashStringToUint32(String(material ?? "")));
}

/**
 * Deterministic Fisher–Yates shuffle. Does not mutate input.
 * @template T
 * @param {T[]} items
 * @param {() => number} randomFn
 * @returns {T[]}
 */
export function deterministicShuffle(items, randomFn) {
  if (typeof randomFn !== "function") {
    throw new TypeError("deterministicShuffle requires randomFn");
  }
  const out = Array.isArray(items) ? [...items] : [];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1));
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
