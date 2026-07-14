/**
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {boolean}
 */
export function timeRangesOverlap(aStart, aEnd, bStart, bEnd) {
  const toMs = (value) => {
    if (value == null || value === "") {
      return null;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    const ms = Date.parse(String(value));
    return Number.isFinite(ms) ? ms : null;
  };

  const a0 = toMs(aStart) ?? Number.NEGATIVE_INFINITY;
  const a1 = toMs(aEnd) ?? Number.POSITIVE_INFINITY;
  const b0 = toMs(bStart) ?? Number.NEGATIVE_INFINITY;
  const b1 = toMs(bEnd) ?? Number.POSITIVE_INFINITY;

  return a0 < b1 && b0 < a1;
}

/**
 * Scope overlap: same type+id, or either GLOBAL, or matching TENANT ancestry when provided.
 *
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} a
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} b
 * @returns {boolean}
 */
export function scopesOverlap(a, b) {
  if (a.scopeType === "GLOBAL" || b.scopeType === "GLOBAL") {
    return true;
  }
  if (a.scopeType !== b.scopeType) {
    return false;
  }
  return String(a.scopeId || "") === String(b.scopeId || "");
}

/**
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} a
 * @param {import('../contracts/normalizePrivatePairingRule.js').PrivatePairingRule} b
 */
export function rulesOverlapInContext(a, b) {
  return scopesOverlap(a, b) && timeRangesOverlap(a.startAt, a.endAt, b.startAt, b.endAt);
}
