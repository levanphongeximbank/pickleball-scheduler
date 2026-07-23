/**
 * CORE-21 — UTF-16 code-unit ordering primitives.
 * Locale-sensitive APIs (localeCompare) are forbidden.
 */

import { NULLS_POLICY } from "../constants.js";
import { DETERMINISTIC_SEED_REPLAY_ERROR_CODE } from "../errors/errorCodes.js";
import { DeterministicSeedReplayError } from "../errors/DeterministicSeedReplayError.js";

/**
 * Compare two strings by UTF-16 code units.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number}
 */
export function compareStableString(a, b) {
  const left = String(a ?? "");
  const right = String(b ?? "");
  const len = Math.min(left.length, right.length);
  for (let i = 0; i < len; i += 1) {
    const ca = left.charCodeAt(i);
    const cb = right.charCodeAt(i);
    if (ca !== cb) return ca - cb;
  }
  return left.length - right.length;
}

/**
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number}
 */
export function compareStableId(a, b) {
  return compareStableString(a, b);
}

/**
 * Finite numeric compare. Normalizes -0 → +0. Rejects non-finite.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {number}
 */
export function compareStableNumber(a, b) {
  if (typeof a !== "number" || typeof b !== "number") {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.ORDERING_CONTRACT_VIOLATION,
      "compareStableNumber requires finite numbers",
      { typeA: typeof a, typeB: typeof b }
    );
  }
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.ORDERING_CONTRACT_VIOLATION,
      "compareStableNumber rejects non-finite numbers",
      { a: String(a), b: String(b) }
    );
  }
  const left = Object.is(a, -0) ? 0 : a;
  const right = Object.is(b, -0) ? 0 : b;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Nullable-aware compare. Does not encode business ranking.
 * @param {unknown} a
 * @param {unknown} b
 * @param {{
 *   nullsPolicy?: string,
 *   compare?: (left: unknown, right: unknown) => number,
 * }} [options]
 * @returns {number}
 */
export function compareNullable(a, b, options = {}) {
  const nullsPolicy = options.nullsPolicy ?? NULLS_POLICY.NULLS_LAST;
  if (
    nullsPolicy !== NULLS_POLICY.NULLS_LAST &&
    nullsPolicy !== NULLS_POLICY.NULLS_FIRST
  ) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.ORDERING_CONTRACT_VIOLATION,
      "Unknown nullsPolicy",
      { nullsPolicy }
    );
  }
  const aNull = a === null || a === undefined;
  const bNull = b === null || b === undefined;
  if (aNull && bNull) return 0;
  if (aNull) return nullsPolicy === NULLS_POLICY.NULLS_FIRST ? -1 : 1;
  if (bNull) return nullsPolicy === NULLS_POLICY.NULLS_FIRST ? 1 : -1;
  const compare = options.compare ?? compareStableString;
  return compare(a, b);
}

/**
 * Lexicographic multi-key compare. Final identity key is required when
 * business keys can tie for distinct records.
 *
 * @param {readonly unknown[]} keysA
 * @param {readonly unknown[]} keysB
 * @param {{
 *   compareAt?: (index: number, left: unknown, right: unknown) => number,
 * }} [options]
 * @returns {number}
 */
export function compareKeyTuple(keysA, keysB, options = {}) {
  if (!Array.isArray(keysA) || !Array.isArray(keysB)) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.ORDERING_CONTRACT_VIOLATION,
      "compareKeyTuple requires arrays",
      {}
    );
  }
  if (keysA.length !== keysB.length) {
    throw new DeterministicSeedReplayError(
      DETERMINISTIC_SEED_REPLAY_ERROR_CODE.ORDERING_CONTRACT_VIOLATION,
      "compareKeyTuple key arity mismatch",
      { lenA: keysA.length, lenB: keysB.length }
    );
  }
  for (let i = 0; i < keysA.length; i += 1) {
    const cmp = options.compareAt
      ? options.compareAt(i, keysA[i], keysB[i])
      : compareNullable(keysA[i], keysB[i]);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

/**
 * Sort a copy of strings / IDs. Does not mutate input.
 * @param {readonly unknown[]} values
 * @returns {string[]}
 */
export function sortStableIds(values) {
  const out = Array.isArray(values) ? values.map((v) => String(v)) : [];
  out.sort(compareStableString);
  return out;
}

/**
 * @param {Record<string, unknown>|null|undefined} obj
 * @returns {string[]}
 */
export function sortedObjectKeys(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return [];
  }
  return Object.keys(obj).sort(compareStableString);
}
