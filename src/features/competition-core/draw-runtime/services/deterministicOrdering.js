/**
 * Phase 3H — deterministic candidate ordering.
 */

/**
 * Stable ascending identity-key order.
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 * @returns {import('../contracts/drawCandidate.js').DrawCandidate[]}
 */
export function orderByIdentity(candidates = []) {
  return [...candidates].sort((a, b) => {
    const ak = String(a.candidateIdentityKey || "");
    const bk = String(b.candidateIdentityKey || "");
    if (ak < bk) return -1;
    if (ak > bk) return 1;
    return 0;
  });
}

/**
 * Order by seedNumber ascending; missing seeds last, then identity.
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 * @returns {import('../contracts/drawCandidate.js').DrawCandidate[]}
 */
export function orderBySeedNumber(candidates = []) {
  return [...candidates].sort((a, b) => {
    const as = a.seedNumber;
    const bs = b.seedNumber;
    if (as != null && bs != null && as !== bs) return as - bs;
    if (as != null && bs == null) return -1;
    if (as == null && bs != null) return 1;
    const ak = String(a.candidateIdentityKey || "");
    const bk = String(b.candidateIdentityKey || "");
    if (ak < bk) return -1;
    if (ak > bk) return 1;
    return 0;
  });
}

/**
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 * @param {{
 *   deterministicSeed?: unknown,
 *   randomFn?: (() => number)|null,
 * }} [options]
 * @returns {import('../contracts/drawCandidate.js').DrawCandidate[]}
 */
export function orderCandidatesForDraw(candidates = [], options = {}) {
  if (options.randomFn && typeof options.randomFn === "function") {
    // Caller supplies already-shuffled list or we shuffle below
  }
  if (options.deterministicSeed !== undefined && options.deterministicSeed !== null) {
    return orderByIdentity(candidates);
  }
  return orderByIdentity(candidates);
}

export const deterministicOrdering = {
  orderByIdentity,
  orderBySeedNumber,
  orderCandidatesForDraw,
};
