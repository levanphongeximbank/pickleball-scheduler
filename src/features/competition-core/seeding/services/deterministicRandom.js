/**
 * Phase 3G — deterministic PRNG helpers.
 * Core must never call Math.random.
 */

/**
 * Stable string → 32-bit unsigned hash (FNV-1a style).
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
 * Build a deterministic RNG from an arbitrary deterministicSeed value.
 * @param {unknown} deterministicSeed
 * @returns {() => number}
 */
export function createDeterministicRandomFromSeed(deterministicSeed) {
  const material =
    typeof deterministicSeed === "string" || typeof deterministicSeed === "number"
      ? String(deterministicSeed)
      : JSON.stringify(deterministicSeed ?? "");
  return createMulberry32(hashStringToUint32(material));
}

/**
 * Deterministic tie key in [0, 1) from seed + candidate identity.
 * @param {unknown} deterministicSeed
 * @param {string} candidateIdentityKey
 * @returns {number}
 */
export function deterministicTieKey(deterministicSeed, candidateIdentityKey) {
  const material = `${String(deterministicSeed ?? "")}::${String(candidateIdentityKey || "")}`;
  return hashStringToUint32(material) / 4294967296;
}
