import { toNullableNumber } from "./shared.js";
import { normalizeClassificationCode } from "../keys/normalizeCode.js";

/**
 * Authoritative capacity on CompetitionDivisionCategory.
 * quotaByParticipantType is HARD capacity metadata (not advisory).
 *
 * @typedef {Object} DivisionCategoryCapacity
 * @property {number|null} maxEntries
 * @property {number|null} maxWaitlist
 * @property {number|null} minEntriesToRun
 * @property {Record<string, number>|null} [quotaByParticipantType]
 */

/**
 * Recommended / default capacity on CompetitionCategory only.
 *
 * @typedef {Object} RecommendedCapacity
 * @property {number|null} [maxEntries]
 * @property {number|null} [maxWaitlist]
 * @property {number|null} [minEntriesToRun]
 */

/**
 * Pool / progression sizing metadata on CompetitionDivision only.
 *
 * @typedef {Object} PoolSizeMetadata
 * @property {number|null} [targetPoolSize]
 * @property {number|null} [maxPoolSize]
 * @property {number|null} [advanceCount]
 */

/**
 * @param {unknown} value
 * @returns {number|null}
 */
function toNullableInteger(value) {
  const n = toNullableNumber(value);
  if (n == null) return null;
  return Number.isInteger(n) ? n : n;
}

/**
 * Factory normalizes shape only — call validateDivisionCategoryCapacity for invariants.
 *
 * @param {Partial<DivisionCategoryCapacity>|null|undefined} partial
 * @returns {DivisionCategoryCapacity}
 */
export function createDivisionCategoryCapacity(partial = {}) {
  /** @type {Record<string, number>} */
  const quotas = {};
  if (
    partial?.quotaByParticipantType &&
    typeof partial.quotaByParticipantType === "object" &&
    !Array.isArray(partial.quotaByParticipantType)
  ) {
    for (const [rawKey, rawValue] of Object.entries(partial.quotaByParticipantType).sort(
      ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)
    )) {
      const keyResult = normalizeClassificationCode(rawKey);
      if (!keyResult.ok) continue;
      const n = Number(rawValue);
      if (!Number.isFinite(n)) continue;
      quotas[/** @type {string} */ (keyResult.value)] = n;
    }
  }

  return {
    maxEntries: toNullableInteger(partial?.maxEntries),
    maxWaitlist: toNullableInteger(partial?.maxWaitlist),
    minEntriesToRun: toNullableInteger(partial?.minEntriesToRun),
    quotaByParticipantType: Object.keys(quotas).length ? quotas : null,
  };
}

/**
 * @param {Partial<RecommendedCapacity>|null|undefined} partial
 * @returns {RecommendedCapacity|null}
 */
export function createRecommendedCapacity(partial) {
  if (!partial || typeof partial !== "object") {
    return null;
  }
  return {
    maxEntries: toNullableNumber(partial.maxEntries),
    maxWaitlist: toNullableNumber(partial.maxWaitlist),
    minEntriesToRun: toNullableNumber(partial.minEntriesToRun),
  };
}

/**
 * @param {Partial<PoolSizeMetadata>|null|undefined} partial
 * @returns {PoolSizeMetadata|null}
 */
export function createPoolSizeMetadata(partial) {
  if (!partial || typeof partial !== "object") {
    return null;
  }
  return {
    targetPoolSize: toNullableNumber(partial.targetPoolSize),
    maxPoolSize: toNullableNumber(partial.maxPoolSize),
    advanceCount: toNullableNumber(partial.advanceCount),
  };
}
