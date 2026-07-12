/**
 * @typedef {Object} StandingsShadowComparison
 * @property {boolean} ok
 * @property {boolean} membershipParity
 * @property {boolean} rankParity
 * @property {boolean} pointsParity
 * @property {boolean} statisticsParity
 * @property {boolean} qualificationParity
 * @property {boolean} tieBreakParity
 * @property {string[]} mismatches
 * @property {string[]} unsupportedLegacyBehavior
 * @property {boolean} contextMissing
 * @property {boolean} legacyInstabilityDetected
 * @property {number} legacyContribution
 * @property {number} canonicalContribution
 */

/**
 * @param {Array<Record<string, unknown>>} legacyRows
 * @param {Array<Record<string, unknown>>} canonicalRows
 */
function buildEntryKey(row) {
  return String(row.id || row.entryId || row.teamId || row.participantId || "");
}

/**
 * @param {Object} input
 */
export function buildStandingsShadowComparison(input = {}) {
  const legacyRows = input.legacyRows || [];
  const canonicalRows = input.canonicalRows || [];
  const mismatches = [];

  const legacyKeys = new Set(legacyRows.map(buildEntryKey));
  const canonicalKeys = new Set(canonicalRows.map(buildEntryKey));
  const membershipParity =
    legacyKeys.size === canonicalKeys.size &&
    [...legacyKeys].every((key) => canonicalKeys.has(key));

  if (!membershipParity) {
    mismatches.push("entry_membership_mismatch");
  }

  const rankParity = legacyRows.every((legacyRow, index) => {
    const key = buildEntryKey(legacyRow);
    const canonicalRow = canonicalRows.find((row) => buildEntryKey(row) === key);
    if (!canonicalRow) {
      return false;
    }
    const legacyRank = Number(legacyRow.rank ?? index + 1);
    const canonicalRank = Number(canonicalRow.rank ?? 0);
    return legacyRank === canonicalRank;
  });

  if (!rankParity) {
    mismatches.push("rank_order_mismatch");
  }

  const pointsParity = legacyRows.every((legacyRow) => {
    const key = buildEntryKey(legacyRow);
    const canonicalRow = canonicalRows.find((row) => buildEntryKey(row) === key);
    if (!canonicalRow) {
      return false;
    }
    const legacyPoints = Number(legacyRow.matchPoints ?? legacyRow.rankingPoints ?? legacyRow.points ?? 0);
    const canonicalPoints = Number(canonicalRow.matchPoints ?? canonicalRow.rankingPoints ?? canonicalRow.points ?? 0);
    return legacyPoints === canonicalPoints;
  });

  if (!pointsParity) {
    mismatches.push("points_mismatch");
  }

  const statisticsParity = mismatches.length === 0 || (membershipParity && rankParity);
  const qualificationParity = input.qualificationParity !== false;
  const tieBreakParity = input.tieBreakParity !== false;

  return {
    ok:
      membershipParity &&
      rankParity &&
      pointsParity &&
      !input.contextMissing &&
      !input.legacyInstabilityDetected &&
      !(input.unsupportedLegacyBehavior || []).length,
    membershipParity,
    rankParity,
    pointsParity,
    statisticsParity,
    qualificationParity,
    tieBreakParity,
    mismatches: [...mismatches, ...(input.mismatches || [])],
    unsupportedLegacyBehavior: input.unsupportedLegacyBehavior || [],
    contextMissing: input.contextMissing === true,
    legacyInstabilityDetected: input.legacyInstabilityDetected === true,
    legacyContribution: Number(input.legacyContribution ?? legacyRows.length),
    canonicalContribution: Number(input.canonicalContribution ?? canonicalRows.length),
  };
}

/**
 * @param {() => unknown} legacyExecutor
 */
export function createMemoizedStandingsExecutor(legacyExecutor) {
  let invoked = false;
  let cached;

  return {
    run() {
      if (invoked) {
        return { result: cached, invocationCount: 1, sideEffectSafe: false, duplicateDecision: true };
      }
      invoked = true;
      cached = legacyExecutor();
      return { result: cached, invocationCount: 1, sideEffectSafe: true, duplicateDecision: false };
    },
  };
}
