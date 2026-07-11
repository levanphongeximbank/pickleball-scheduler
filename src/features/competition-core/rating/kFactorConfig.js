/**
 * Dynamic K-factor tiers for Competition Elo V2.
 * Centralized config — do not hardcode K in engine files.
 */

/** @typedef {{ maxMatches: number|null, kFactor: number }} KFactorTier */

/** @type {Readonly<KFactorTier[]>} */
export const DEFAULT_K_FACTOR_TIERS = Object.freeze([
  { maxMatches: 9, kFactor: 40 },
  { maxMatches: 49, kFactor: 32 },
  { maxMatches: null, kFactor: 20 },
]);

/**
 * @param {number} matchCount
 * @param {Readonly<KFactorTier[]>} [tiers]
 * @returns {number}
 */
export function resolveKFactor(matchCount, tiers = DEFAULT_K_FACTOR_TIERS) {
  const count = Math.max(0, Number(matchCount) || 0);

  for (const tier of tiers) {
    if (tier.maxMatches === null || count <= tier.maxMatches) {
      return tier.kFactor;
    }
  }

  return tiers[tiers.length - 1]?.kFactor ?? 32;
}
