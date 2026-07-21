/**
 * Phase 3H — snake / serpentine / seeded / pot / open group assignment.
 *
 * Snake:       forward then reverse — indices 0..n-1, n-1..0, ...
 * Serpentine:  reverse then forward — indices n-1..0, 0..n-1, ... (distinct)
 */

import { createDrawPlacement } from "../contracts/drawPlacement.js";
import { buildGroupIdentityKey } from "../contracts/drawIdentity.js";
import { PLACEMENT_REASON } from "../enums/placementReasons.js";
import { PLACEMENT_TYPE } from "../enums/placementTypes.js";
import { orderByIdentity, orderBySeedNumber } from "./deterministicOrdering.js";
import {
  createDeterministicRandomFromSeed,
  deterministicShuffle,
} from "./deterministicRandom.js";
import { DRAW_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { DrawRuntimeError } from "../errors/DrawRuntimeError.js";

/**
 * Classic snake group index (0-based) for step.
 * @param {number} step
 * @param {number} groupCount
 * @returns {number}
 */
export function getSnakeGroupIndex(step, groupCount) {
  const row = Math.floor(step / groupCount);
  const col = step % groupCount;
  if (row % 2 === 0) return col;
  return groupCount - 1 - col;
}

/**
 * Serpentine starts in reverse direction (distinct from snake).
 * @param {number} step
 * @param {number} groupCount
 * @returns {number}
 */
export function getSerpentineGroupIndex(step, groupCount) {
  const row = Math.floor(step / groupCount);
  const col = step % groupCount;
  if (row % 2 === 0) return groupCount - 1 - col;
  return col;
}

/**
 * Round-robin / seeded sequential: 0,1,...,n-1,0,1,...
 * @param {number} step
 * @param {number} groupCount
 * @returns {number}
 */
export function getSeededGroupIndex(step, groupCount) {
  return step % groupCount;
}

/**
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} ordered
 * @param {{
 *   drawIdentityKey: string,
 *   competitionId?: string,
 *   contextId?: string,
 *   groupCount: number,
 *   groupCapacity?: number|null,
 *   indexFn: (step: number, groupCount: number) => number,
 *   reason: string,
 *   reserved?: Map<string, { groupNumber: number, positionNumber: number|null }>,
 * }} options
 */
function placeIntoGroups(ordered, options) {
  const {
    drawIdentityKey,
    competitionId,
    contextId,
    groupCount,
    groupCapacity,
    indexFn,
    reason,
    reserved = new Map(),
  } = options;

  /** @type {number[]} */
  const sizes = Array.from({ length: groupCount }, () => 0);
  /** @type {Set<string>} */
  const placedKeys = new Set();
  /** @type {import('../contracts/drawPlacement.js').DrawPlacement[]} */
  const placements = [];
  /** @type {string[]} */
  const decisionTrace = [];

  // Apply reserved (manual/protected) first
  for (const candidate of ordered) {
    const lock = reserved.get(candidate.candidateIdentityKey);
    if (!lock) continue;
    const groupNumber = lock.groupNumber;
    const groupIndex = groupNumber - 1;
    if (groupIndex < 0 || groupIndex >= groupCount) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_MANUAL_PLACEMENT_INVALID,
        "Reserved group out of range",
        { groupNumber, groupCount }
      );
    }
    if (
      groupCapacity != null &&
      sizes[groupIndex] >= groupCapacity
    ) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_GROUP_OVERFLOW,
        "Reserved placement overflows group capacity",
        { groupNumber, groupCapacity }
      );
    }
    const positionNumber =
      lock.positionNumber != null
        ? lock.positionNumber
        : sizes[groupIndex] + 1;
    sizes[groupIndex] += 1;
    placedKeys.add(candidate.candidateIdentityKey);
    const groupIdentityKey = buildGroupIdentityKey({
      drawIdentityKey,
      groupNumber,
    });
    const placementReason = candidate.protectedPlacement
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
        groupIdentityKey,
        positionNumber,
        seedNumber: candidate.seedNumber,
        placementReason,
        metadata: {
          candidateReference: candidate.candidateReference,
          groupNumber,
        },
      })
    );
    decisionTrace.push(
      `${candidate.candidateReference}→G${groupNumber}@${positionNumber}(${placementReason})`
    );
  }

  let step = 0;
  for (const candidate of ordered) {
    if (placedKeys.has(candidate.candidateIdentityKey)) continue;

    // Find next free group via algorithm, skipping full groups
    let attempts = 0;
    let groupIndex = indexFn(step, groupCount);
    while (
      groupCapacity != null &&
      sizes[groupIndex] >= groupCapacity &&
      attempts < groupCount * 2
    ) {
      step += 1;
      attempts += 1;
      groupIndex = indexFn(step, groupCount);
    }
    if (groupCapacity != null && sizes[groupIndex] >= groupCapacity) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_GROUP_OVERFLOW,
        "No group capacity remaining for candidate",
        { candidateReference: candidate.candidateReference }
      );
    }

    const groupNumber = groupIndex + 1;
    const positionNumber = sizes[groupIndex] + 1;
    sizes[groupIndex] += 1;
    step += 1;
    placedKeys.add(candidate.candidateIdentityKey);

    const groupIdentityKey = buildGroupIdentityKey({
      drawIdentityKey,
      groupNumber,
    });
    const placementReason =
      reserved.size > 0 ? PLACEMENT_REASON.PARTIAL_AUTO_FILL : reason;

    placements.push(
      createDrawPlacement({
        drawIdentityKey,
        competitionId,
        contextId,
        candidateIdentityKey: candidate.candidateIdentityKey,
        placementType: PLACEMENT_TYPE.GROUP,
        groupIdentityKey,
        positionNumber,
        seedNumber: candidate.seedNumber,
        placementReason,
        metadata: {
          candidateReference: candidate.candidateReference,
          groupNumber,
        },
      })
    );
    decisionTrace.push(
      `${candidate.candidateReference}→G${groupNumber}@${positionNumber}(${placementReason})`
    );
  }

  return { placements, decisionTrace };
}

/**
 * Build reserved map from candidates with manualPlacement / protected.
 * Protected placements cannot be moved by auto algorithms.
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 */
export function buildReservedGroupMap(candidates) {
  /** @type {Map<string, { groupNumber: number, positionNumber: number|null, protected: boolean }>} */
  const reserved = new Map();
  for (const candidate of candidates) {
    const mp = candidate.manualPlacement;
    if (!mp || mp.groupNumber == null) continue;
    reserved.set(candidate.candidateIdentityKey, {
      groupNumber: Number(mp.groupNumber),
      positionNumber:
        mp.positionNumber != null ? Number(mp.positionNumber) : null,
      protected: candidate.protectedPlacement === true,
    });
  }
  return reserved;
}

/**
 * @param {{ groupNumber?: number|null, slotNumber?: number|null, positionNumber?: number|null }|null|undefined} a
 * @param {{ groupNumber?: number|null, slotNumber?: number|null, positionNumber?: number|null }|null|undefined} b
 * @returns {boolean}
 */
function placementCoordsEqual(a, b) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const ag = a.groupNumber != null ? Number(a.groupNumber) : null;
  const bg = b.groupNumber != null ? Number(b.groupNumber) : null;
  const as = a.slotNumber != null ? Number(a.slotNumber) : null;
  const bs = b.slotNumber != null ? Number(b.slotNumber) : null;
  const ap = a.positionNumber != null ? Number(a.positionNumber) : null;
  const bp = b.positionNumber != null ? Number(b.positionNumber) : null;
  return ag === bg && as === bs && ap === bp;
}

/**
 * Resolve candidate from overlay key.
 * @param {Map<string, import('../contracts/drawCandidate.js').DrawCandidate>} byKey
 * @param {Map<string, import('../contracts/drawCandidate.js').DrawCandidate>} byRef
 * @param {string} key
 */
function findOverlayTarget(byKey, byRef, key) {
  return (
    byKey.get(key) ||
    byRef.get(key) ||
    [...byKey.values()].find(
      (c) =>
        c.candidateReference === key ||
        c.candidateIdentityKey.endsWith(`::CANDIDATE::${key}`)
    ) ||
    null
  );
}

/**
 * Apply request-level manualPlacements / protectedPlacements overlays.
 * Never last-write-wins:
 * - duplicate manual for same candidate → DRAW_MANUAL_PLACEMENT_DUPLICATE
 * - protected vs manual coordinate conflict → DRAW_PROTECTED_PLACEMENT_CONFLICT
 *
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 * @param {Array<Record<string, unknown>>} manualPlacements
 * @param {Array<Record<string, unknown>>} protectedPlacements
 */
export function applyPlacementOverlays(
  candidates,
  manualPlacements = [],
  protectedPlacements = []
) {
  /** @type {Map<string, import('../contracts/drawCandidate.js').DrawCandidate>} */
  const byKey = new Map(
    candidates.map((c) => [c.candidateIdentityKey, { ...c }])
  );
  /** @type {Map<string, import('../contracts/drawCandidate.js').DrawCandidate>} */
  const byRef = new Map(
    candidates.map((c) => [c.candidateReference, byKey.get(c.candidateIdentityKey)])
  );

  /** @type {Set<string>} */
  const manualOverlaySeen = new Set();
  /** @type {Set<string>} */
  const protectedOverlaySeen = new Set();

  function normalizeCoords(row) {
    return {
      groupNumber: row.groupNumber != null ? Number(row.groupNumber) : null,
      slotNumber: row.slotNumber != null ? Number(row.slotNumber) : null,
      positionNumber:
        row.positionNumber != null ? Number(row.positionNumber) : null,
    };
  }

  for (const row of manualPlacements) {
    if (!row || typeof row !== "object") continue;
    const key = String(
      row.candidateIdentityKey || row.candidateReference || row.id || ""
    ).trim();
    const target = findOverlayTarget(byKey, byRef, key);
    if (!target) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_MANUAL_PLACEMENT_INVALID,
        "Placement overlay candidate not found",
        { key, protected: false }
      );
    }
    if (manualOverlaySeen.has(target.candidateIdentityKey)) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_MANUAL_PLACEMENT_DUPLICATE,
        "Duplicate manual placement for the same candidate",
        {
          candidateReference: target.candidateReference,
          candidateIdentityKey: target.candidateIdentityKey,
        }
      );
    }
    const coords = normalizeCoords(row);
    if (
      target.protectedPlacement === true &&
      target.manualPlacement &&
      !placementCoordsEqual(target.manualPlacement, coords)
    ) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_PROTECTED_PLACEMENT_CONFLICT,
        "Manual placement conflicts with existing protected placement",
        {
          candidateReference: target.candidateReference,
          protected: target.manualPlacement,
          manual: coords,
        }
      );
    }
    manualOverlaySeen.add(target.candidateIdentityKey);
    target.manualPlacement = coords;
    byKey.set(target.candidateIdentityKey, target);
  }

  for (const row of protectedPlacements) {
    if (!row || typeof row !== "object") continue;
    const key = String(
      row.candidateIdentityKey || row.candidateReference || row.id || ""
    ).trim();
    const target = findOverlayTarget(byKey, byRef, key);
    if (!target) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_MANUAL_PLACEMENT_INVALID,
        "Protected placement overlay candidate not found",
        { key, protected: true }
      );
    }
    if (protectedOverlaySeen.has(target.candidateIdentityKey)) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_PROTECTED_PLACEMENT_CONFLICT,
        "Duplicate protected placement for the same candidate",
        {
          candidateReference: target.candidateReference,
          candidateIdentityKey: target.candidateIdentityKey,
        }
      );
    }
    const coords = normalizeCoords(row);
    if (
      target.manualPlacement &&
      !placementCoordsEqual(target.manualPlacement, coords)
    ) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_PROTECTED_PLACEMENT_CONFLICT,
        "Protected placement conflicts with existing manual placement",
        {
          candidateReference: target.candidateReference,
          manual: target.manualPlacement,
          protected: coords,
        }
      );
    }
    protectedOverlaySeen.add(target.candidateIdentityKey);
    target.manualPlacement = coords;
    target.protectedPlacement = true;
    byKey.set(target.candidateIdentityKey, target);
  }

  return candidates.map((c) => byKey.get(c.candidateIdentityKey) || c);
}

/**
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 * @param {object} options
 */
export function assignSnakeGroups(candidates, options) {
  const ordered = orderBySeedNumber(candidates);
  return placeIntoGroups(ordered, {
    ...options,
    indexFn: getSnakeGroupIndex,
    reason: PLACEMENT_REASON.SNAKE,
    reserved: buildReservedGroupMap(ordered),
  });
}

/**
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 * @param {object} options
 */
export function assignSerpentineGroups(candidates, options) {
  const ordered = orderBySeedNumber(candidates);
  return placeIntoGroups(ordered, {
    ...options,
    indexFn: getSerpentineGroupIndex,
    reason: PLACEMENT_REASON.SERPENTINE,
    reserved: buildReservedGroupMap(ordered),
  });
}

/**
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 * @param {object} options
 */
export function assignSeededGroups(candidates, options) {
  const ordered = orderBySeedNumber(candidates);
  return placeIntoGroups(ordered, {
    ...options,
    indexFn: getSeededGroupIndex,
    reason: PLACEMENT_REASON.SEEDED_ORDER,
    reserved: buildReservedGroupMap(ordered),
  });
}

/**
 * Compare candidates for deterministic order inside a single pot.
 * @param {import('../contracts/drawCandidate.js').DrawCandidate} a
 * @param {import('../contracts/drawCandidate.js').DrawCandidate} b
 */
function compareInsidePot(a, b) {
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
}

/**
 * True pot/tier placement:
 * for each seedTier (lexicographic; missing/null tier last):
 *   build one pot → deterministic order inside pot → reset snake → distribute independently.
 * Manual/protected reserved placements are applied first and never moved.
 *
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 * @param {{
 *   drawIdentityKey: string,
 *   competitionId?: string,
 *   contextId?: string,
 *   groupCount: number,
 *   groupCapacity?: number|null,
 * }} options
 */
export function assignPotGroups(candidates, options) {
  const {
    drawIdentityKey,
    competitionId,
    contextId,
    groupCount,
    groupCapacity,
  } = options;

  const reserved = buildReservedGroupMap(candidates);

  /** @type {Map<string, import('../contracts/drawCandidate.js').DrawCandidate[]>} */
  const pots = new Map();
  for (const candidate of candidates) {
    const tierKey =
      candidate.seedTier == null || String(candidate.seedTier).trim() === ""
        ? "\uffff"
        : String(candidate.seedTier);
    if (!pots.has(tierKey)) pots.set(tierKey, []);
    pots.get(tierKey).push(candidate);
  }

  const tierKeys = [...pots.keys()].sort((a, b) => {
    if (a < b) return -1;
    if (a > b) return 1;
    return 0;
  });

  /** @type {number[]} */
  const sizes = Array.from({ length: groupCount }, () => 0);
  /** @type {Set<string>} */
  const placedKeys = new Set();
  /** @type {import('../contracts/drawPlacement.js').DrawPlacement[]} */
  const placements = [];
  /** @type {string[]} */
  const decisionTrace = [];

  // 1) Reserved manual/protected across all pots (never moved by pot auto-fill)
  for (const candidate of orderBySeedNumber(candidates)) {
    const lock = reserved.get(candidate.candidateIdentityKey);
    if (!lock) continue;
    const groupNumber = lock.groupNumber;
    const groupIndex = groupNumber - 1;
    if (groupIndex < 0 || groupIndex >= groupCount) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_MANUAL_PLACEMENT_INVALID,
        "Reserved group out of range",
        { groupNumber, groupCount }
      );
    }
    if (groupCapacity != null && sizes[groupIndex] >= groupCapacity) {
      throw new DrawRuntimeError(
        DRAW_RUNTIME_ERROR_CODE.DRAW_GROUP_OVERFLOW,
        "Reserved placement overflows group capacity",
        { groupNumber, groupCapacity }
      );
    }
    const positionNumber =
      lock.positionNumber != null ? lock.positionNumber : sizes[groupIndex] + 1;
    sizes[groupIndex] += 1;
    placedKeys.add(candidate.candidateIdentityKey);
    const groupIdentityKey = buildGroupIdentityKey({
      drawIdentityKey,
      groupNumber,
    });
    const placementReason = candidate.protectedPlacement
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
        groupIdentityKey,
        positionNumber,
        seedNumber: candidate.seedNumber,
        placementReason,
        metadata: {
          candidateReference: candidate.candidateReference,
          groupNumber,
          seedTier: candidate.seedTier,
        },
      })
    );
    decisionTrace.push(
      `${candidate.candidateReference}→G${groupNumber}@${positionNumber}(${placementReason})`
    );
  }

  // 2) Each pot independently: deterministic order, snake reset at step 0
  for (const tierKey of tierKeys) {
    const potMembers = [...pots.get(tierKey)].sort(compareInsidePot);
    const autoMembers = potMembers.filter(
      (c) => !placedKeys.has(c.candidateIdentityKey)
    );

    let step = 0;
    for (const candidate of autoMembers) {
      let attempts = 0;
      let groupIndex = getSnakeGroupIndex(step, groupCount);
      while (
        groupCapacity != null &&
        sizes[groupIndex] >= groupCapacity &&
        attempts < groupCount * 2
      ) {
        step += 1;
        attempts += 1;
        groupIndex = getSnakeGroupIndex(step, groupCount);
      }
      if (groupCapacity != null && sizes[groupIndex] >= groupCapacity) {
        throw new DrawRuntimeError(
          DRAW_RUNTIME_ERROR_CODE.DRAW_GROUP_OVERFLOW,
          "No group capacity remaining for pot candidate",
          {
            candidateReference: candidate.candidateReference,
            seedTier: candidate.seedTier,
          }
        );
      }

      const groupNumber = groupIndex + 1;
      const positionNumber = sizes[groupIndex] + 1;
      sizes[groupIndex] += 1;
      step += 1;
      placedKeys.add(candidate.candidateIdentityKey);

      const groupIdentityKey = buildGroupIdentityKey({
        drawIdentityKey,
        groupNumber,
      });
      const placementReason =
        reserved.size > 0
          ? PLACEMENT_REASON.PARTIAL_AUTO_FILL
          : PLACEMENT_REASON.POT_TIER;

      placements.push(
        createDrawPlacement({
          drawIdentityKey,
          competitionId,
          contextId,
          candidateIdentityKey: candidate.candidateIdentityKey,
          placementType: PLACEMENT_TYPE.GROUP,
          groupIdentityKey,
          positionNumber,
          seedNumber: candidate.seedNumber,
          placementReason,
          metadata: {
            candidateReference: candidate.candidateReference,
            groupNumber,
            seedTier: candidate.seedTier,
            potKey: tierKey === "\uffff" ? null : tierKey,
          },
        })
      );
      decisionTrace.push(
        `${candidate.candidateReference}→G${groupNumber}@${positionNumber}(${placementReason}|pot=${tierKey === "\uffff" ? "untiered" : tierKey})`
      );
    }
  }

  return { placements, decisionTrace };
}

/**
 * Deterministic open groups: shuffle with injected RNG (or identity order if no seed).
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 * @param {object} options
 * @param {unknown} [options.deterministicSeed]
 * @param {() => number} [options.randomFn]
 */
export function assignOpenRandomGroups(candidates, options) {
  let ordered;
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

  return placeIntoGroups(ordered, {
    ...options,
    indexFn: getSeededGroupIndex,
    reason:
      options.deterministicSeed != null || options.randomFn
        ? PLACEMENT_REASON.OPEN_DETERMINISTIC
        : PLACEMENT_REASON.IDENTITY_ORDER,
    reserved: buildReservedGroupMap(ordered),
  });
}

/**
 * CORE-08 Phase 1D — open shuffled snake groups.
 * Composes existing primitives only:
 *   orderByIdentity → deterministicShuffle (when seed/RNG present)
 *   → placeIntoGroups(getSnakeGroupIndex)
 * Does not copy Fisher–Yates or snake-index math.
 *
 * Deterministic seed contract (inherited from OPEN_RANDOM_GROUPS):
 * - With randomFn / deterministicSeed → shuffle then snake
 * - Without → identity order then snake (not seedNumber snake)
 *
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 * @param {object} options
 * @param {unknown} [options.deterministicSeed]
 * @param {() => number} [options.randomFn]
 */
export function assignOpenShuffledSnakeGroups(candidates, options) {
  let ordered;
  const hasRng = typeof options.randomFn === "function";
  const hasSeed =
    options.deterministicSeed !== undefined &&
    options.deterministicSeed !== null;

  if (hasRng) {
    ordered = deterministicShuffle(orderByIdentity(candidates), options.randomFn);
  } else if (hasSeed) {
    const rng = createDeterministicRandomFromSeed(options.deterministicSeed);
    ordered = deterministicShuffle(orderByIdentity(candidates), rng);
  } else {
    ordered = orderByIdentity(candidates);
  }

  return placeIntoGroups(ordered, {
    ...options,
    indexFn: getSnakeGroupIndex,
    reason:
      hasRng || hasSeed
        ? PLACEMENT_REASON.OPEN_SHUFFLED_SNAKE
        : PLACEMENT_REASON.IDENTITY_ORDER,
    reserved: buildReservedGroupMap(ordered),
  });
}

/**
 * Manual-only: place reserved; leave rest unresolved (returned separately by resolver).
 * @param {import('../contracts/drawCandidate.js').DrawCandidate[]} candidates
 * @param {object} options
 */
export function assignManualGroupsOnly(candidates, options) {
  const reserved = buildReservedGroupMap(candidates);
  const withManual = candidates.filter((c) =>
    reserved.has(c.candidateIdentityKey)
  );
  const result = placeIntoGroups(orderByIdentity(withManual), {
    ...options,
    indexFn: getSeededGroupIndex,
    reason: PLACEMENT_REASON.MANUAL,
    reserved,
  });
  const placed = new Set(
    result.placements.map((p) => p.candidateIdentityKey)
  );
  const unresolved = candidates.filter(
    (c) => !placed.has(c.candidateIdentityKey)
  );
  return { ...result, unresolved };
}
