/**
 * Phase 3H — bracket slot placement + first-class bye calculation.
 * Bracket is placement layout only — no match graph.
 */

import { createDrawPlacement } from "../contracts/drawPlacement.js";
import {
  createDrawBracket,
  createDrawBye,
} from "../contracts/drawGroup.js";
import {
  buildBracketIdentityKey,
  buildSlotIdentityKey,
} from "../contracts/drawIdentity.js";
import { PLACEMENT_REASON } from "../enums/placementReasons.js";
import { PLACEMENT_TYPE } from "../enums/placementTypes.js";
import { orderByIdentity, orderBySeedNumber } from "./deterministicOrdering.js";
import {
  createDeterministicRandomFromSeed,
  deterministicShuffle,
} from "./deterministicRandom.js";
import { DRAW_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { DrawRuntimeError } from "../errors/DrawRuntimeError.js";
import { isPowerOfTwo } from "./validateParams.js";

/**
 * Standard seeded bracket slot for seed number (1-based seed → 1-based slot).
 * Uses classic pairing: seed s maps to a fixed slot via recursive bracket order.
 * For simplicity and determinism: slot = seedNumber for seeds 1..n placed in
 * order that separates top seeds — implemented via standard bracket positions array.
 *
 * @param {number} bracketSize
 * @returns {number[]} seedOrder → slot numbers (1-based) for seeds 1..bracketSize
 */
export function buildSeededBracketSlotOrder(bracketSize) {
  // Produce classic single-elim seed positions:
  // For size 8: seeds order into slots [1,8,4,5,2,7,3,6] meaning seed1→slot1, seed2→slot8, ...
  // Algorithm: start [1,2], iteratively expand.
  /** @type {number[]} */
  let seeds = [1, 2];
  while (seeds.length < bracketSize) {
    const next = [];
    const sum = seeds.length * 2 + 1;
    for (const s of seeds) {
      next.push(s);
      next.push(sum - s);
    }
    seeds = next;
  }
  // seeds[i] is the seed number that should occupy slot i+1
  // Invert: slotForSeed[seed] = slot
  /** @type {number[]} */
  const slotForSeed = Array(bracketSize + 1).fill(0);
  for (let slot = 1; slot <= bracketSize; slot += 1) {
    const seed = seeds[slot - 1];
    slotForSeed[seed] = slot;
  }
  return slotForSeed;
}

/**
 * Calculate bye count.
 * @param {number} bracketSize
 * @param {number} candidateCount
 */
export function calculateByeCount(bracketSize, candidateCount) {
  const byeCount = bracketSize - candidateCount;
  if (byeCount < 0) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_BYE_COUNT_INVALID,
      "bye count cannot be negative",
      { bracketSize, candidateCount }
    );
  }
  return byeCount;
}

/**
 * Select bye slots among free (unoccupied) bracket slots.
 *
 * Top-seed protection (SEEDED_BRACKET):
 * Candidates occupy classic seed→slot positions first. Remaining free slots are
 * exactly the slots of missing lower seeds (first-round opponents of top seeds).
 * All free slots become byes when byeCount === freeCount, so top seeds receive
 * byes without creating matchups. Selection walks highest free slot numbers for
 * deterministic ordering of the DrawBye list only.
 *
 * @param {number} bracketSize
 * @param {number} byeCount
 * @param {Set<number>} occupiedSlots
 * @returns {number[]}
 */
export function selectByeSlots(bracketSize, byeCount, occupiedSlots) {
  /** @type {number[]} */
  const byeSlots = [];
  for (let slot = bracketSize; slot >= 1 && byeSlots.length < byeCount; slot -= 1) {
    if (!occupiedSlots.has(slot)) {
      byeSlots.push(slot);
    }
  }
  if (byeSlots.length < byeCount) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_BYE_COUNT_INVALID,
      "Unable to place required byes into free slots",
      { byeCount, placed: byeSlots.length, bracketSize }
    );
  }
  return byeSlots.sort((a, b) => a - b);
}

/**
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 */
function buildReservedSlotMap(candidates) {
  /** @type {Map<string, number>} */
  const reserved = new Map();
  for (const candidate of candidates) {
    const mp = candidate.manualPlacement;
    if (!mp || mp.slotNumber == null) continue;
    reserved.set(candidate.candidateIdentityKey, Number(mp.slotNumber));
  }
  return reserved;
}

/**
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 * @param {{
 *   drawIdentityKey: string,
 *   competitionId?: string,
 *   contextId?: string,
 *   bracketSize: number,
 *   bracketId?: string,
 *   allowNonPowerOfTwo?: boolean,
 *   open?: boolean,
 *   deterministicSeed?: unknown,
 *   randomFn?: (() => number)|null,
 * }} options
 */
export function assignBracketSlots(candidates, options) {
  const {
    drawIdentityKey,
    competitionId,
    contextId,
    bracketSize,
    bracketId = "main",
    allowNonPowerOfTwo = false,
    open = false,
  } = options;

  if (!isPowerOfTwo(bracketSize) && !allowNonPowerOfTwo) {
    throw new DrawRuntimeError(
      DRAW_RUNTIME_ERROR_CODE.DRAW_BRACKET_SIZE_INVALID,
      "bracketSize must be power of two",
      { bracketSize }
    );
  }

  const bracketIdentityKey = buildBracketIdentityKey({
    drawIdentityKey,
    bracketId,
  });

  let ordered;
  if (open) {
    if (typeof options.randomFn === "function") {
      ordered = deterministicShuffle(orderByIdentity(candidates), options.randomFn);
    } else if (
      options.deterministicSeed !== undefined &&
      options.deterministicSeed !== null
    ) {
      const rng = createDeterministicRandomFromSeed(options.deterministicSeed);
      ordered = deterministicShuffle(orderByIdentity(candidates), rng);
    } else {
      ordered = orderByIdentity(candidates);
    }
  } else {
    ordered = orderBySeedNumber(candidates);
  }

  const reserved = buildReservedSlotMap(ordered);
  /** @type {Set<number>} */
  const occupied = new Set();
  /** @type {Set<string>} */
  const placedKeys = new Set();
  /** @type {import('../contracts/drawPlacement.js').DrawPlacement[]} */
  const placements = [];
  /** @type {string[]} */
  const decisionTrace = [];

  // Manual / protected slots first
  for (const candidate of ordered) {
    if (!reserved.has(candidate.candidateIdentityKey)) continue;
    const slotNumber = reserved.get(candidate.candidateIdentityKey);
    if (slotNumber < 1 || slotNumber > bracketSize) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_SLOT_INVALID,
        "Reserved slot out of range",
        { slotNumber, bracketSize }
      );
    }
    if (occupied.has(slotNumber)) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_SLOT_DUPLICATE,
        "Duplicate bracket slot",
        { slotNumber }
      );
    }
    if (
      candidate.protectedPlacement &&
      reserved.has(candidate.candidateIdentityKey)
    ) {
      // protected stays
    }
    occupied.add(slotNumber);
    placedKeys.add(candidate.candidateIdentityKey);
    const reason = candidate.protectedPlacement
      ? PLACEMENT_REASON.PROTECTED
      : PLACEMENT_REASON.MANUAL;
    placements.push(
      createDrawPlacement({
        drawIdentityKey,
        competitionId,
        contextId,
        candidateIdentityKey: candidate.candidateIdentityKey,
        placementType: candidate.protectedPlacement
          ? PLACEMENT_TYPE.PROTECTED
          : PLACEMENT_TYPE.MANUAL,
        bracketIdentityKey,
        slotNumber,
        positionNumber: slotNumber,
        seedNumber: candidate.seedNumber,
        placementReason: reason,
        metadata: {
          candidateReference: candidate.candidateReference,
          slotIdentityKey: buildSlotIdentityKey({
            drawIdentityKey,
            slotNumber,
          }),
        },
      })
    );
    decisionTrace.push(
      `${candidate.candidateReference}→S${slotNumber}(${reason})`
    );
  }

  const slotForSeed = open
    ? null
    : buildSeededBracketSlotOrder(bracketSize);

  // Auto-fill remaining candidates
  let openSlotCursor = 1;
  let autoSeedRank = 0;
  for (const candidate of ordered) {
    if (placedKeys.has(candidate.candidateIdentityKey)) continue;
    autoSeedRank += 1;

    let slotNumber;
    if (open) {
      while (occupied.has(openSlotCursor) && openSlotCursor <= bracketSize) {
        openSlotCursor += 1;
      }
      if (openSlotCursor > bracketSize) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_SLOT_INVALID,
          "No free bracket slots remaining",
          {}
        );
      }
      slotNumber = openSlotCursor;
      openSlotCursor += 1;
    } else {
      const seedNum =
        candidate.seedNumber != null && Number.isFinite(candidate.seedNumber)
          ? Number(candidate.seedNumber)
          : autoSeedRank;
      const preferred =
        seedNum >= 1 && seedNum <= bracketSize
          ? slotForSeed[seedNum]
          : null;
      if (preferred && !occupied.has(preferred)) {
        slotNumber = preferred;
      } else {
        // next free slot from 1
        let s = 1;
        while (s <= bracketSize && occupied.has(s)) s += 1;
        if (s > bracketSize) {
          throw new DrawRuntimeError(
            DRAW_RUNTIME_ERROR_CODE.DRAW_SLOT_INVALID,
            "No free bracket slots remaining",
            {}
          );
        }
        slotNumber = s;
      }
    }

    occupied.add(slotNumber);
    placedKeys.add(candidate.candidateIdentityKey);
    const reason = open
      ? options.deterministicSeed != null || options.randomFn
        ? PLACEMENT_REASON.BRACKET_OPEN
        : PLACEMENT_REASON.IDENTITY_ORDER
      : reserved.size > 0
        ? PLACEMENT_REASON.PARTIAL_AUTO_FILL
        : PLACEMENT_REASON.BRACKET_SEED;

    placements.push(
      createDrawPlacement({
        drawIdentityKey,
        competitionId,
        contextId,
        candidateIdentityKey: candidate.candidateIdentityKey,
        placementType: PLACEMENT_TYPE.BRACKET_SLOT,
        bracketIdentityKey,
        slotNumber,
        positionNumber: slotNumber,
        seedNumber: candidate.seedNumber,
        placementReason: reason,
        metadata: {
          candidateReference: candidate.candidateReference,
          slotIdentityKey: buildSlotIdentityKey({
            drawIdentityKey,
            slotNumber,
          }),
        },
      })
    );
    decisionTrace.push(
      `${candidate.candidateReference}→S${slotNumber}(${reason})`
    );
  }

  const byeCount = calculateByeCount(bracketSize, candidates.length);
  const byeSlots = selectByeSlots(bracketSize, byeCount, occupied);
  /** @type {import('../contracts/drawGroup.js').DrawBye[]} */
  const byes = byeSlots.map((slotNumber) =>
    createDrawBye({
      drawIdentityKey,
      competitionId,
      contextId,
      slotNumber,
      bracketIdentityKey,
      reason: PLACEMENT_REASON.BYE_CALC,
    })
  );

  // First-class bye placements (no candidate)
  for (const bye of byes) {
    decisionTrace.push(`BYE→S${bye.slotNumber}(${PLACEMENT_REASON.BYE_CALC})`);
  }

  const bracket = createDrawBracket({
    drawIdentityKey,
    competitionId,
    contextId,
    bracketId,
    bracketSize,
    occupiedSlots: [...occupied].sort((a, b) => a - b),
    byeSlots,
  });

  return { placements, byes, brackets: [bracket], decisionTrace };
}

/**
 * Standalone bye assignment helper.
 */
export function assignByes({
  drawIdentityKey,
  competitionId,
  contextId,
  bracketSize,
  candidateCount,
  occupiedSlots = [],
  bracketId = "main",
}) {
  const byeCount = calculateByeCount(bracketSize, candidateCount);
  const occupied = new Set(occupiedSlots);
  const byeSlots = selectByeSlots(bracketSize, byeCount, occupied);
  const bracketIdentityKey = buildBracketIdentityKey({
    drawIdentityKey,
    bracketId,
  });
  return byeSlots.map((slotNumber) =>
    createDrawBye({
      drawIdentityKey,
      competitionId,
      contextId,
      slotNumber,
      bracketIdentityKey,
      reason: PLACEMENT_REASON.BYE_CALC,
    })
  );
}
