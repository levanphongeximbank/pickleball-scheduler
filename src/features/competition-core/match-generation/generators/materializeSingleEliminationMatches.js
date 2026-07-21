/**
 * CORE-09 Phase 1D — resolve Draw-owned bracket slots and materialize opening matches.
 * Does not select bye recipients; consumes only canonical Draw slot coordinates.
 */

import {
  createLogicalMatch,
  createParticipantSlot,
  createByeParticipantSlot,
  createMatchGenerationIssue,
} from "../contracts/index.js";
import { PARTICIPANT_SLOT_KIND } from "../enums/participantSlotKind.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { sortMatchGenerationIssues } from "../services/asciiCompare.js";
import { openingSlotPositions } from "./singleEliminationBracket.js";

/**
 * @typedef {{
 *   position: number,
 *   isBye: boolean,
 *   participantId: string|null,
 *   placementRef: string,
 *   bracketId: string|null,
 * }} BracketSlot
 */

/**
 * Collect canonical bracket slots from DrawSnapshot.
 * Sources (union, fail on conflict):
 * - participantPlacements with integer position (participant or isBye)
 * - byePlacements with integer position (treated as bye slots)
 *
 * Requires exactly bracketSize unique positions covering 1..bracketSize,
 * exactly participantCount non-bye slots, and byeCount bye slots.
 *
 * @param {import('../contracts/drawSnapshot.js').DrawSnapshot} drawSnapshot
 * @param {{ bracketSize: number, participantCount: number, byeCount: number }} dims
 * @returns {{
 *   ok: boolean,
 *   slots: ReadonlyArray<BracketSlot>,
 *   bracketId: string|null,
 *   issues: import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[],
 * }}
 */
export function resolveBracketSlotsFromDraw(drawSnapshot, dims) {
  /** @type {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} */
  const issues = [];
  const { bracketSize, participantCount, byeCount } = dims;

  /** @type {Map<number, BracketSlot>} */
  const byPosition = new Map();

  /**
   * @param {object} raw
   * @param {string} path
   * @param {boolean} forceBye
   */
  function ingest(raw, path, forceBye) {
    const position = raw?.position;
    if (typeof position !== "number" || !Number.isInteger(position)) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_MISSING,
          path: `${path}.position`,
          message:
            "Canonical bracket slot position is missing for Single Elimination",
          details: { position: position ?? null },
        })
      );
      return;
    }
    if (position < 1 || position > bracketSize) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_REFERENCE_INVALID,
          path: `${path}.position`,
          message: "Bracket slot position is outside bracket size",
          details: { position, bracketSize },
        })
      );
      return;
    }

    const isBye = forceBye || raw?.isBye === true;
    const participantId =
      typeof raw?.participantId === "string" && raw.participantId.trim()
        ? raw.participantId.trim()
        : null;
    const placementRef = String(raw?.placementRef || "").trim();
    if (!placementRef) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_MISSING,
          path: `${path}.placementRef`,
          message: "Placement reference is missing for bracket slot",
        })
      );
      return;
    }

    if (isBye && participantId) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.INVALID_BYE_REPRESENTATION,
          path,
          message: "Bye bracket slot must not carry a participantId",
          details: { position, participantId },
        })
      );
      return;
    }
    if (!isBye && !participantId) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_MISSING,
          path: `${path}.participantId`,
          message: "Non-bye bracket slot requires participantId",
          details: { position },
        })
      );
      return;
    }

    const slot = Object.freeze({
      position,
      isBye,
      participantId,
      placementRef,
      bracketId:
        typeof raw?.bracketId === "string" && raw.bracketId.trim()
          ? raw.bracketId.trim()
          : null,
    });

    if (byPosition.has(position)) {
      const existing = byPosition.get(position);
      const same =
        existing.isBye === slot.isBye &&
        existing.participantId === slot.participantId &&
        existing.placementRef === slot.placementRef;
      if (!same) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_DUPLICATE,
            path,
            message: "Conflicting canonical placements for the same bracket position",
            details: { position },
          })
        );
      }
      return;
    }
    byPosition.set(position, slot);
  }

  const placements = Array.isArray(drawSnapshot?.participantPlacements)
    ? drawSnapshot.participantPlacements
    : [];
  for (let i = 0; i < placements.length; i += 1) {
    ingest(placements[i], `participantPlacements[${i}]`, false);
  }

  const byePlacements = Array.isArray(drawSnapshot?.byePlacements)
    ? drawSnapshot.byePlacements
    : [];
  for (let i = 0; i < byePlacements.length; i += 1) {
    ingest(byePlacements[i], `byePlacements[${i}]`, true);
  }

  if (byPosition.size < bracketSize) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_MISSING,
        path: "participantPlacements",
        message:
          "Draw does not provide sufficient canonical bracket/bye placements for Single Elimination",
        details: {
          expectedSlots: bracketSize,
          actualSlots: byPosition.size,
          expectedByes: byeCount,
        },
      })
    );
  }

  /** @type {BracketSlot[]} */
  const slots = [];
  let actualByes = 0;
  let actualParticipants = 0;
  /** @type {Set<string>} */
  const seenParticipants = new Set();
  /** @type {string|null} */
  let bracketId = null;

  for (let pos = 1; pos <= bracketSize; pos += 1) {
    const slot = byPosition.get(pos);
    if (!slot) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_MISSING,
          path: "bracketSlots",
          message: "Missing canonical bracket slot position",
          details: { position: pos, bracketSize },
        })
      );
      continue;
    }
    if (slot.isBye) actualByes += 1;
    else {
      actualParticipants += 1;
      if (seenParticipants.has(slot.participantId)) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_DUPLICATE,
            path: "participantPlacements",
            message: "Participant appears in more than one bracket slot",
            details: { participantId: slot.participantId },
          })
        );
      }
      seenParticipants.add(slot.participantId);
    }
    if (slot.bracketId) {
      if (bracketId && bracketId !== slot.bracketId) {
        issues.push(
          createMatchGenerationIssue({
            code: MATCH_GENERATION_ISSUE_CODE.DRAW_REFERENCE_INVALID,
            path: "bracketId",
            message: "Multiple bracketIds in one Single Elimination stage",
            details: { bracketId, other: slot.bracketId },
          })
        );
      } else {
        bracketId = slot.bracketId;
      }
    }
    slots.push(slot);
  }

  if (actualByes !== byeCount && issues.length === 0) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_MISSING,
        path: "byePlacements",
        message: "Draw bye placement count does not equal B − N",
        details: { expectedByes: byeCount, actualByes, participantCount },
      })
    );
  }
  if (actualParticipants !== participantCount && issues.length === 0) {
    issues.push(
      createMatchGenerationIssue({
        code: MATCH_GENERATION_ISSUE_CODE.DRAW_PLACEMENT_MISSING,
        path: "participantPlacements",
        message: "Draw participant slot count does not match participant count",
        details: {
          expectedParticipants: participantCount,
          actualParticipants,
        },
      })
    );
  }

  const sorted = sortMatchGenerationIssues(issues);
  return {
    ok: sorted.length === 0 && slots.length === bracketSize,
    slots: Object.freeze(slots),
    bracketId,
    issues: sorted,
  };
}

/**
 * @param {BracketSlot} slot
 * @returns {import('../contracts/participantSlot.js').ParticipantSlot}
 */
function participantSlotFromBracket(slot) {
  if (slot.isBye) {
    return createByeParticipantSlot({
      phase1d: Object.freeze({ bracketPosition: slot.position }),
    });
  }
  return createParticipantSlot({
    kind: PARTICIPANT_SLOT_KIND.DIRECT_PARTICIPANT,
    participantId: slot.participantId,
    placementRef: slot.placementRef,
    metadata: {
      phase1d: Object.freeze({ bracketPosition: slot.position }),
    },
  });
}

/**
 * Materialize opening-round LogicalMatches from resolved bracket slots.
 *
 * @param {object} args
 * @param {ReadonlyArray<BracketSlot>} args.slots positions 1..B in array order
 * @param {number} args.bracketSize
 * @param {string} args.competitionId
 * @param {string} args.divisionId
 * @param {string|null} args.categoryId
 * @param {string} args.stageId
 * @param {string|null} args.bracketId
 * @param {number} [args.deterministicOrderStart=1]
 * @returns {{
 *   ok: boolean,
 *   logicalMatches: import('../contracts/logicalMatch.js').LogicalMatch[],
 *   nextDeterministicOrder: number,
 *   issues: import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[],
 * }}
 */
export function materializeOpeningRoundMatches(args) {
  /** @type {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} */
  const issues = [];
  const openingMatchCount = args.bracketSize / 2;
  /** @type {Map<number, BracketSlot>} */
  const byPos = new Map(args.slots.map((s) => [s.position, s]));

  /** @type {import('../contracts/logicalMatch.js').LogicalMatch[]} */
  const logicalMatches = [];
  let deterministicOrder = args.deterministicOrderStart ?? 1;

  for (let matchNumber = 1; matchNumber <= openingMatchCount; matchNumber += 1) {
    const [posA, posB] = openingSlotPositions(matchNumber);
    const slotA = byPos.get(posA);
    const slotB = byPos.get(posB);
    if (!slotA || !slotB) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
          path: `openingMatch[${matchNumber}]`,
          message: "Opening match missing bracket slot",
          details: { posA, posB },
        })
      );
      continue;
    }
    if (slotA.isBye && slotB.isBye) {
      issues.push(
        createMatchGenerationIssue({
          code: MATCH_GENERATION_ISSUE_CODE.BRACKET_INVARIANT_VIOLATION,
          path: `openingMatch[${matchNumber}]`,
          message: "Opening match cannot have two BYE slots",
          details: { matchNumber, posA, posB },
        })
      );
      continue;
    }

    const participantSlotA = participantSlotFromBracket(slotA);
    const participantSlotB = participantSlotFromBracket(slotB);
    const isByeMatch = slotA.isBye || slotB.isBye;

    /** @type {string[]} */
    const sourcePlacementRefs = [];
    if (!slotA.isBye && slotA.placementRef) {
      sourcePlacementRefs.push(slotA.placementRef);
    }
    if (!slotB.isBye && slotB.placementRef) {
      sourcePlacementRefs.push(slotB.placementRef);
    }

    logicalMatches.push(
      createLogicalMatch({
        competitionId: args.competitionId,
        divisionId: args.divisionId,
        categoryId: args.categoryId,
        stageId: args.stageId,
        groupId: null,
        bracketId: args.bracketId,
        roundNumber: 1,
        matchNumber,
        deterministicOrder,
        participantSlotA,
        participantSlotB,
        isByeMatch,
        sourcePlacementRefs,
        dependencyInputs: [],
        winnerTo: null,
        loserTo: null,
        metadata: {
          phase1d: Object.freeze({
            role: "OPENING",
            slotPositions: Object.freeze([posA, posB]),
          }),
        },
      })
    );
    deterministicOrder += 1;
  }

  const sorted = sortMatchGenerationIssues(issues);
  return {
    ok: sorted.length === 0,
    logicalMatches,
    nextDeterministicOrder: deterministicOrder,
    issues: sorted,
  };
}
