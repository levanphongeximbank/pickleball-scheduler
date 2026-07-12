import { extractFormationTeamMembership } from "./legacyFormationResultMappers.js";

/**
 * @typedef {Object} NormalizedFormationPair
 * @property {string} pairKey
 * @property {string[]} playerIds
 */

/**
 * @typedef {Object} FormationParityComparison
 * @property {boolean} ok
 * @property {string} formationStrategy
 * @property {number} playerCount
 * @property {number} courtCount
 * @property {NormalizedFormationPair[]} legacyPairs
 * @property {NormalizedFormationPair[]} adapterPairs
 * @property {boolean} pairMembershipParity
 * @property {boolean} teamCompositionParity
 * @property {boolean} courtAllocationParity
 * @property {boolean} waitingListParity
 * @property {boolean} unassignedPlayersParity
 * @property {boolean} warningsParity
 * @property {boolean} errorsParity
 * @property {boolean} scoreParity
 * @property {boolean} constraintParity
 * @property {boolean} randomParity
 * @property {boolean} payloadPreservation
 * @property {Record<string, unknown>} traceSummary
 * @property {string[]} mismatches
 * @property {string[]} unsupportedFields
 * @property {boolean} [pairOrderDiffers]
 */

function pairKey(playerIds = []) {
  return [...playerIds].map(String).sort().join("|");
}

/**
 * Normalize teams/pairs to stable pair keys (order-independent).
 *
 * @param {Array<Record<string, unknown>>} teams
 * @returns {NormalizedFormationPair[]}
 */
export function normalizeFormationPairs(teams = []) {
  return (teams || []).map((team) => {
    const playerIds = [...(team.playerIds || team.members?.map((p) => p.id) || [])].map(String);
    return {
      pairKey: pairKey(playerIds),
      playerIds: [...playerIds].sort(),
    };
  });
}

/**
 * Compare pair sets ignoring team order but detecting membership differences.
 *
 * @param {NormalizedFormationPair[]} left
 * @param {NormalizedFormationPair[]} right
 */
export function comparePairMembership(left = [], right = []) {
  const leftKeys = left.map((p) => p.pairKey).sort();
  const rightKeys = right.map((p) => p.pairKey).sort();
  const membershipParity = JSON.stringify(leftKeys) === JSON.stringify(rightKeys);
  const pairOrderDiffers =
    membershipParity &&
    JSON.stringify(left.map((p) => p.pairKey)) !== JSON.stringify(right.map((p) => p.pairKey));

  const allLeftPlayers = left.flatMap((p) => p.playerIds);
  const allRightPlayers = right.flatMap((p) => p.playerIds);
  const leftSet = new Set(allLeftPlayers);
  const rightSet = new Set(allRightPlayers);

  const missingPlayers = allLeftPlayers.filter((id) => !rightSet.has(id));
  const extraPlayers = allRightPlayers.filter((id) => !leftSet.has(id));
  const duplicateLeft = allLeftPlayers.length !== leftSet.size;
  const duplicateRight = allRightPlayers.length !== rightSet.size;

  return {
    membershipParity,
    pairOrderDiffers,
    teamCompositionParity: membershipParity && !duplicateLeft && !duplicateRight,
    missingPlayers: [...new Set(missingPlayers)],
    extraPlayers: [...new Set(extraPlayers)],
    duplicateLeft,
    duplicateRight,
  };
}

function sortedStringList(values = []) {
  return JSON.stringify([...values].map(String).sort());
}

/**
 * Build comprehensive formation parity comparison.
 *
 * @param {Object} input
 * @param {string} input.strategy
 * @param {import('./legacyFormationResultMappers.js').LegacyTeamPairingResult} input.directLegacy
 * @param {import('./legacyFormationResultMappers.js').LegacyTeamPairingResult} input.adapterLegacy
 * @param {import('./formationDecisionTrace.js').FormationRuntimeDecisionTrace} [input.trace]
 * @param {boolean} [input.randomFnPreserved]
 * @param {boolean} [input.payloadPreserved]
 * @param {boolean} [input.scoreParity]
 * @param {boolean} [input.constraintParity]
 * @param {boolean} [input.courtAllocationParity]
 * @param {string[]} [input.mismatches]
 * @param {string[]} [input.unsupportedFields]
 */
export function buildFormationParityComparison(input = {}) {
  const directTeams = input.directLegacy?.teams || [];
  const adapterTeams = input.adapterLegacy?.teams || [];
  const legacyPairs = normalizeFormationPairs(directTeams);
  const adapterPairs = normalizeFormationPairs(adapterTeams);
  const pairCompare = comparePairMembership(legacyPairs, adapterPairs);

  const waitingListParity =
    sortedStringList(input.directLegacy?.waitingPlayerIds) ===
    sortedStringList(input.adapterLegacy?.waitingPlayerIds);

  const warningsParity =
    sortedStringList(input.directLegacy?.warnings) ===
    sortedStringList(input.adapterLegacy?.warnings);

  const errorsParity =
    sortedStringList(input.directLegacy?.errors) === sortedStringList(input.adapterLegacy?.errors);

  const allPlayerIds = legacyPairs.flatMap((p) => p.playerIds);
  const waitingIds = (input.directLegacy?.waitingPlayerIds || []).map(String);
  const assignedSet = new Set(allPlayerIds);
  const unassignedParity =
    waitingListParity &&
    waitingIds.every((id) => !assignedSet.has(id) || waitingIds.includes(id));

  const randomParity = input.randomFnPreserved !== false;
  const payloadPreservation = input.payloadPreserved !== false;
  const scoreParity = input.scoreParity !== false;
  const constraintParity = input.constraintParity !== false;
  const courtAllocationParity = input.courtAllocationParity !== false;

  /** @type {string[]} */
  const mismatches = [...(input.mismatches || [])];
  if (!pairCompare.membershipParity) {
    mismatches.push("PAIR_MEMBERSHIP_MISMATCH");
  }
  if (pairCompare.missingPlayers.length) {
    mismatches.push(`MISSING_PLAYERS:${pairCompare.missingPlayers.join(",")}`);
  }
  if (pairCompare.extraPlayers.length) {
    mismatches.push(`EXTRA_PLAYERS:${pairCompare.extraPlayers.join(",")}`);
  }
  if (pairCompare.duplicateLeft || pairCompare.duplicateRight) {
    mismatches.push("DUPLICATE_PLAYER_IN_PAIR");
  }
  if (!waitingListParity) {
    mismatches.push("WAITING_LIST_MISMATCH");
  }
  if (!warningsParity) {
    mismatches.push("WARNINGS_MISMATCH");
  }
  if (!errorsParity) {
    mismatches.push("ERRORS_MISMATCH");
  }
  if (!randomParity) {
    mismatches.push("RANDOM_FN_NOT_PRESERVED");
  }
  if (!payloadPreservation) {
    mismatches.push("PAYLOAD_NOT_PRESERVED");
  }
  if (!scoreParity) {
    mismatches.push("SCORE_PARITY_MISMATCH");
  }
  if (!constraintParity) {
    mismatches.push("CONSTRAINT_PARITY_MISMATCH");
  }
  if (!courtAllocationParity) {
    mismatches.push("COURT_ALLOCATION_MISMATCH");
  }

  const traceSummary = input.trace
    ? {
        total: input.trace.records?.length || 0,
        usedCanonical: input.trace.records?.some((r) => r.usedCanonical) || false,
        lastConsumer: input.trace.records?.[input.trace.records.length - 1]?.consumer || null,
      }
    : {};

  const ok =
    pairCompare.membershipParity &&
    waitingListParity &&
    warningsParity &&
    errorsParity &&
    randomParity &&
    payloadPreservation &&
    scoreParity &&
    constraintParity &&
    courtAllocationParity;

  return {
    ok,
    formationStrategy: String(input.strategy || "unknown"),
    playerCount: legacyPairs.reduce((sum, p) => sum + p.playerIds.length, 0) + waitingIds.length,
    courtCount: input.courtCount ?? 0,
    legacyPairs,
    adapterPairs,
    pairMembershipParity: pairCompare.membershipParity,
    teamCompositionParity: pairCompare.teamCompositionParity,
    courtAllocationParity,
    waitingListParity,
    unassignedPlayersParity: unassignedParity,
    warningsParity,
    errorsParity,
    scoreParity,
    constraintParity,
    randomParity,
    payloadPreservation,
    traceSummary,
    mismatches: [...new Set(mismatches)],
    unsupportedFields: input.unsupportedFields || [],
    pairOrderDiffers: pairCompare.pairOrderDiffers,
    legacyMembership: extractFormationTeamMembership(directTeams),
    adapterMembership: extractFormationTeamMembership(adapterTeams),
  };
}
