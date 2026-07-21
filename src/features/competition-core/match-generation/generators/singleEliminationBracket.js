/**
 * CORE-09 Phase 1D — Single Elimination bracket mathematics (pure helpers).
 * No Draw mutation. No bye recipient selection.
 */

/**
 * @param {number} n
 * @returns {boolean}
 */
export function isPowerOfTwo(n) {
  return (
    typeof n === "number" &&
    Number.isInteger(n) &&
    n >= 1 &&
    (n & (n - 1)) === 0
  );
}

/**
 * Smallest power of two greater than or equal to n.
 * @param {number} n
 * @returns {number}
 */
export function nextPowerOfTwo(n) {
  if (typeof n !== "number" || !Number.isInteger(n) || n < 1) {
    return 0;
  }
  let b = 1;
  while (b < n) b *= 2;
  return b;
}

/**
 * @param {number} participantCount
 * @param {string} bracketSizePolicy POWER_OF_TWO | NEXT_POWER_OF_TWO | EXACT
 * @returns {{
 *   ok: true,
 *   bracketSize: number,
 *   byeCount: number,
 *   championshipRoundCount: number,
 *   openingMatchCount: number,
 * } | {
 *   ok: false,
 *   reason: string,
 * }}
 */
export function computeSingleEliminationBracket(participantCount, bracketSizePolicy) {
  const N = participantCount;
  if (typeof N !== "number" || !Number.isInteger(N) || N < 2) {
    return { ok: false, reason: "PARTICIPANT_COUNT_INSUFFICIENT" };
  }

  const policy = String(bracketSizePolicy || "").trim();
  /** @type {number} */
  let bracketSize;

  if (policy === "EXACT") {
    if (!isPowerOfTwo(N)) {
      return { ok: false, reason: "EXACT_REQUIRES_POWER_OF_TWO" };
    }
    bracketSize = N;
  } else if (policy === "POWER_OF_TWO" || policy === "NEXT_POWER_OF_TWO") {
    // Canonical SE semantics: never shrink; pad to next power of two >= N.
    bracketSize = nextPowerOfTwo(N);
  } else {
    return { ok: false, reason: "BRACKET_SIZE_POLICY_UNSUPPORTED" };
  }

  if (!isPowerOfTwo(bracketSize) || bracketSize < N) {
    return { ok: false, reason: "BRACKET_SIZE_INVALID" };
  }

  let championshipRoundCount = 0;
  let size = bracketSize;
  while (size > 1) {
    size /= 2;
    championshipRoundCount += 1;
  }

  return {
    ok: true,
    bracketSize,
    byeCount: bracketSize - N,
    championshipRoundCount,
    openingMatchCount: bracketSize / 2,
  };
}

/**
 * Expected championship LogicalMatch count (includes explicit bye matches).
 * @param {number} bracketSize
 * @param {boolean} includeThirdPlace
 * @returns {number}
 */
export function expectedLogicalMatchCount(bracketSize, includeThirdPlace) {
  const championship = bracketSize - 1;
  return includeThirdPlace ? championship + 1 : championship;
}

/**
 * Championship played matches (excludes isByeMatch); +1 when third place.
 * @param {number} participantCount
 * @param {boolean} includeThirdPlace
 * @returns {number}
 */
export function expectedPlayedMatchCount(participantCount, includeThirdPlace) {
  const championshipPlayed = participantCount - 1;
  return includeThirdPlace ? championshipPlayed + 1 : championshipPlayed;
}

/**
 * Opening-round slot indices (1-based bracket positions) for matchNumber m.
 * Match m pairs positions (2m-1) and (2m).
 *
 * @param {number} matchNumber 1-based
 * @returns {[number, number]}
 */
export function openingSlotPositions(matchNumber) {
  return [2 * matchNumber - 1, 2 * matchNumber];
}

/**
 * Prior-round matchNumbers that feed championship match m in round r (>1).
 * @param {number} matchNumber
 * @returns {[number, number]}
 */
export function priorChampionshipFeeders(matchNumber) {
  return [2 * matchNumber - 1, 2 * matchNumber];
}
