/** Hill-climbing helper — pick best neighbor among a small sample. */
import { isStrictlyBetterCandidate } from "../core/candidateAuthorityComparator.js";

/**
 * @param {object} current
 * @param {Array<object>} neighbors
 * @returns {object|null}
 */
export function pickBestNeighbor(current, neighbors = []) {
  let best = null;
  for (const neighbor of neighbors) {
    if (!neighbor) continue;
    if (!best || isStrictlyBetterCandidate(neighbor, best)) {
      best = neighbor;
    }
  }
  if (best && isStrictlyBetterCandidate(best, current)) {
    return best;
  }
  return null;
}
