/**
 * Diagnostics helpers for unassigned / reason aggregation.
 */

import { compareStableString } from "../deterministic/compare.js";
import { ownedFreeze } from "../contracts/shared.js";

/**
 * Build stable reasonCounts map from a list of codes.
 * @param {readonly string[]} codes
 */
export function buildReasonCounts(codes) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const code of codes || []) {
    if (!code) continue;
    counts[code] = (counts[code] || 0) + 1;
  }
  /** @type {Record<string, number>} */
  const sorted = {};
  for (const key of Object.keys(counts).sort(compareStableString)) {
    sorted[key] = counts[key];
  }
  return ownedFreeze(sorted);
}

/**
 * Stable unique sorted reason code list.
 * @param {readonly string[]} codes
 */
export function stableUniqueReasonCodes(codes) {
  return Object.freeze(
    [...new Set((codes || []).filter(Boolean))].sort(compareStableString)
  );
}
