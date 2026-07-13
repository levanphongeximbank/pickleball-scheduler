/**
 * @typedef {Object} SchedulingShadowComparison
 * @property {boolean} ok
 * @property {boolean} membershipParity
 * @property {boolean} roundParity
 * @property {boolean} courtParity
 * @property {boolean} timeParity
 * @property {boolean} byeParity
 * @property {boolean} overrideParity
 * @property {boolean} refereeParity
 * @property {boolean} warningParity
 * @property {string[]} mismatches
 * @property {string[]} unsupportedLegacyBehavior
 * @property {boolean} contextMissing
 */

function rowKey(row) {
  return String(row.matchId || row.id || row.matchupId || "");
}

function normalizeCourt(row) {
  return String(row.courtId || row.courtLabel || row.court || "");
}

function normalizeTime(row) {
  return String(row.scheduledStart || row.scheduledAt || row.startTime || row.slot || "");
}

/**
 * @param {Object} input
 */
export function buildSchedulingShadowComparison(input = {}) {
  const legacyRows = input.legacyRows || [];
  const canonicalRows = input.canonicalRows || [];
  const mismatches = [];

  const legacyKeys = new Set(legacyRows.map(rowKey).filter(Boolean));
  const canonicalKeys = new Set(canonicalRows.map(rowKey).filter(Boolean));
  const membershipParity =
    legacyKeys.size === canonicalKeys.size &&
    [...legacyKeys].every((key) => canonicalKeys.has(key));

  if (!membershipParity) {
    mismatches.push("match_membership_mismatch");
  }

  const roundParity = legacyRows.every((legacyRow) => {
    const key = rowKey(legacyRow);
    const canonicalRow = canonicalRows.find((row) => rowKey(row) === key);
    if (!canonicalRow) {
      return false;
    }
    const legacyRound = Number(legacyRow.round ?? legacyRow.roundNumber ?? 0);
    const canonicalRound = Number(canonicalRow.round ?? canonicalRow.roundNumber ?? 0);
    return legacyRound === canonicalRound;
  });

  if (!roundParity) {
    mismatches.push("round_order_mismatch");
  }

  const courtParity = legacyRows.every((legacyRow) => {
    const key = rowKey(legacyRow);
    const canonicalRow = canonicalRows.find((row) => rowKey(row) === key);
    if (!canonicalRow) {
      return true;
    }
    return normalizeCourt(legacyRow) === normalizeCourt(canonicalRow);
  });

  if (!courtParity) {
    mismatches.push("court_assignment_mismatch");
  }

  const timeParity = legacyRows.every((legacyRow) => {
    const key = rowKey(legacyRow);
    const canonicalRow = canonicalRows.find((row) => rowKey(row) === key);
    if (!canonicalRow) {
      return true;
    }
    return normalizeTime(legacyRow) === normalizeTime(canonicalRow);
  });

  if (!timeParity) {
    mismatches.push("time_slot_mismatch");
  }

  const byeParity = input.byeParity !== false;
  const overrideParity = input.overrideParity !== false;
  const refereeParity = input.refereeParity !== false;
  const warningParity = input.warningParity !== false;

  return {
    ok:
      membershipParity &&
      roundParity &&
      courtParity &&
      timeParity &&
      byeParity &&
      overrideParity &&
      refereeParity &&
      warningParity &&
      !input.contextMissing &&
      !(input.unsupportedLegacyBehavior || []).length,
    membershipParity,
    roundParity,
    courtParity,
    timeParity,
    byeParity,
    overrideParity,
    refereeParity,
    warningParity,
    mismatches: [...mismatches, ...(input.mismatches || [])],
    unsupportedLegacyBehavior: input.unsupportedLegacyBehavior || [],
    contextMissing: input.contextMissing === true,
  };
}

/**
 * @param {() => unknown} legacyExecutor
 */
export function createMemoizedSchedulingExecutor(legacyExecutor) {
  let invoked = false;
  let cached;

  return {
    run() {
      if (invoked) {
        return { result: cached, sideEffectSafe: false, duplicateDecision: true };
      }
      invoked = true;
      cached = legacyExecutor();
      return { result: cached, sideEffectSafe: true, duplicateDecision: false };
    },
  };
}

export function runSchedulingShadowComparison(input) {
  return input;
}
