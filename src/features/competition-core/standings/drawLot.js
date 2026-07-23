import { compareCanonicalIdentity } from "./canonicalResultAdapter.js";

/**
 * Deterministic draw-lot token — no Math.random.
 *
 * @param {string} drawLotSeed
 * @param {string[]} entryIds
 */
export function buildDrawLotToken(drawLotSeed, entryIds = []) {
  const payload = [drawLotSeed, ...[...entryIds].map(String).sort(compareCanonicalIdentity)].join("::");
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `lot-${(hash >>> 0).toString(16)}`;
}

/**
 * @param {import('./standingsTypes.js').StandingsRow[]} rows
 * @param {string} drawLotSeed
 */
export function orderRowsByDrawLot(rows, drawLotSeed) {
  return [...rows].sort((left, right) => {
    const leftToken = buildDrawLotToken(drawLotSeed, [left.entryId]);
    const rightToken = buildDrawLotToken(drawLotSeed, [right.entryId]);
    return compareCanonicalIdentity(leftToken, rightToken) || compareCanonicalIdentity(left.entryId, right.entryId);
  });
}

/**
 * @param {string[]} entryIds
 * @param {string} drawLotSeed
 */
export function buildDrawLotTokensForEntries(entryIds, drawLotSeed) {
  /** @type {Record<string, string>} */
  const tokens = {};
  entryIds.forEach((entryId) => {
    tokens[String(entryId)] = buildDrawLotToken(drawLotSeed, [String(entryId)]);
  });
  return tokens;
}
