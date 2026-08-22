import {
  KNOCKOUT_ENTRY_ROUND_ORDER,
  knockoutEntryRoundRank,
} from "../../competition-rules/constants/enums.js";
import { createDrawPlacement } from "../contracts/drawPlacement.js";
import { createDrawStageReservation } from "../contracts/drawStageReservation.js";
import {
  buildBracketIdentityKey,
  buildCandidateIdentityKey,
  buildSlotIdentityKey,
} from "../contracts/drawIdentity.js";
import { PLACEMENT_REASON } from "../enums/placementReasons.js";
import { PLACEMENT_TYPE } from "../enums/placementTypes.js";
import { DRAW_RUNTIME_ERROR_CODE } from "../errors/runtimeErrorCodes.js";
import { DrawRuntimeError } from "../errors/DrawRuntimeError.js";
import { buildSeededBracketSlotOrder } from "./assignBracket.js";
import {
  createDeterministicRandomFromSeed,
  deterministicShuffle,
} from "./deterministicRandom.js";
import { orderByIdentity } from "./deterministicOrdering.js";

export const STAGE_RESERVATION_PLACEMENT_MODE = Object.freeze({
  SEEDED: "SEEDED",
  OPEN: "OPEN",
});

function fail(code, message, details = {}) {
  throw new DrawRuntimeError(code, message, details);
}

function nominalStageCapacity(stage) {
  const rank = knockoutEntryRoundRank(stage);
  if (rank < 0) return null;
  return 2 ** (KNOCKOUT_ENTRY_ROUND_ORDER.length - rank);
}

function expandBlockedPositions(positions) {
  const expanded = new Set();
  for (const position of positions) {
    expanded.add(2 * position - 1);
    expanded.add(2 * position);
  }
  return expanded;
}

function firstAvailablePosition(capacity, unavailable, occupied) {
  for (let position = 1; position <= capacity; position += 1) {
    if (!unavailable.has(position) && !occupied.has(position)) return position;
  }
  return null;
}

function firstAvailableBalancedPosition(
  seededPositions,
  unavailable,
  occupied
) {
  for (const position of seededPositions.slice(1)) {
    if (!unavailable.has(position) && !occupied.has(position)) return position;
  }
  return null;
}

function normalizeCandidates(candidates) {
  return candidates.map((candidate) => ({
    ...candidate,
    entryId: String(candidate?.entryId || "").trim(),
    targetStage: String(
      candidate?.effectiveTargetStage || candidate?.targetStage || ""
    ).trim(),
    candidateIdentityKey: String(candidate?.entryId || "").trim(),
    seedNumber:
      candidate?.seedNumber != null ? Number(candidate.seedNumber) : null,
  }));
}

/**
 * CORE-08 stage-aware placement for identified later-stage DIRECT entrants.
 * Placement is per target stage; no matches or dependencies are generated.
 *
 * @param {Array<{entryId: string, effectiveTargetStage?: string, targetStage?: string, seedNumber?: number|null}>} rawCandidates
 * @param {{
 *   drawIdentityKey: string,
 *   bracketId?: string,
 *   bracketWideEntryRound: string,
 *   reservationsByStage: Record<string, number>,
 *   requiredEntrantsByStage: Record<string, number>,
 *   firstPlayableCandidates?: Array<{entryId: string, seedNumber?: number|null}>,
 *   placementMode: "SEEDED"|"OPEN",
 *   deterministicSeed?: unknown
 * }} options
 */
export function assignStageDirectReservations(rawCandidates = [], options = {}) {
  const bracketWideEntryRound = options.bracketWideEntryRound;
  const bracketRank = knockoutEntryRoundRank(bracketWideEntryRound);
  if (bracketRank < 0) {
    fail(
      DRAW_RUNTIME_ERROR_CODE.DRAW_INVALID_INPUT,
      "Valid bracketWideEntryRound required for stage reservations",
      { bracketWideEntryRound }
    );
  }

  const placementMode = options.placementMode;
  if (!Object.values(STAGE_RESERVATION_PLACEMENT_MODE).includes(placementMode)) {
    fail(
      DRAW_RUNTIME_ERROR_CODE.DRAW_UNSUPPORTED_MODE,
      "Stage reservation placementMode must be SEEDED or OPEN",
      { placementMode }
    );
  }
  if (
    placementMode === STAGE_RESERVATION_PLACEMENT_MODE.OPEN &&
    (options.deterministicSeed === undefined ||
      options.deterministicSeed === null ||
      String(options.deterministicSeed).length === 0)
  ) {
    fail(
      DRAW_RUNTIME_ERROR_CODE.DRAW_NON_DETERMINISTIC,
      "OPEN stage reservation placement requires deterministicSeed",
      {}
    );
  }

  const stages = KNOCKOUT_ENTRY_ROUND_ORDER.slice(bracketRank);
  const candidates = normalizeCandidates(
    Array.isArray(rawCandidates) ? rawCandidates : []
  );
  const firstPlayableCandidates = normalizeCandidates(
    Array.isArray(options.firstPlayableCandidates)
      ? options.firstPlayableCandidates
      : []
  );
  const seenEntries = new Set();
  for (const candidate of firstPlayableCandidates) {
    if (!candidate.entryId || seenEntries.has(candidate.entryId)) {
      fail(
        DRAW_RUNTIME_ERROR_CODE.DRAW_CANDIDATE_DUPLICATE,
        "First-playable stage-aware placement requires unique canonical entryId",
        { entryId: candidate.entryId || null }
      );
    }
    seenEntries.add(candidate.entryId);
  }
  const byStage = new Map(stages.map((stage) => [stage, []]));

  for (const candidate of candidates) {
    if (!candidate.entryId) {
      fail(
        DRAW_RUNTIME_ERROR_CODE.DRAW_CANDIDATE_REQUIRED,
        "Later-stage DIRECT placement requires canonical entryId",
        {}
      );
    }
    if (seenEntries.has(candidate.entryId)) {
      fail(
        DRAW_RUNTIME_ERROR_CODE.DRAW_CANDIDATE_DUPLICATE,
        "Entry cannot appear in first-playable and later-stage placement",
        { entryId: candidate.entryId }
      );
    }
    seenEntries.add(candidate.entryId);

    const targetRank = knockoutEntryRoundRank(candidate.targetStage);
    if (targetRank <= bracketRank || !byStage.has(candidate.targetStage)) {
      fail(
        DRAW_RUNTIME_ERROR_CODE.DRAW_SLOT_INVALID,
        "Later-stage DIRECT targetStage must be strictly later than bracketWideEntryRound",
        {
          entryId: candidate.entryId,
          targetStage: candidate.targetStage,
          bracketWideEntryRound,
        }
      );
    }
    byStage.get(candidate.targetStage).push(candidate);
  }

  for (const stage of stages) {
    const expected = Number(options.reservationsByStage?.[stage] ?? 0);
    const required = Number(options.requiredEntrantsByStage?.[stage]);
    const actual = byStage.get(stage).length;
    if (
      !Number.isInteger(expected) ||
      expected < 0 ||
      !Number.isInteger(required) ||
      required < 0 ||
      expected > required
    ) {
      fail(
        DRAW_RUNTIME_ERROR_CODE.DRAW_BRACKET_SIZE_INVALID,
        "Invalid canonical stage reservation accounting",
        { stage, expectedReservations: expected, requiredEntrants: required }
      );
    }
    if (actual !== expected) {
      fail(
        DRAW_RUNTIME_ERROR_CODE.DRAW_CANDIDATE_REQUIRED,
        "Resolved later-stage DIRECT identities must exactly cover configured reservations",
        { stage, configuredReservations: expected, resolvedCandidates: actual }
      );
    }
  }

  const bracketIdentityKey = buildBracketIdentityKey({
    drawIdentityKey: options.drawIdentityKey,
    bracketId: options.bracketId || "ko-main",
  });
  const reservations = [];
  const firstPlayablePlacements = [];
  let unavailable = new Set();

  for (let index = stages.length - 1; index >= 0; index -= 1) {
    const stage = stages[index];
    const capacity = nominalStageCapacity(stage);
    const required = Number(options.requiredEntrantsByStage[stage]);
    if (
      capacity == null ||
      [...unavailable].some(
        (position) => position < 1 || position > capacity
      ) ||
      capacity - unavailable.size !== required
    ) {
      fail(
        DRAW_RUNTIME_ERROR_CODE.DRAW_BRACKET_SIZE_INVALID,
        "Stage locations do not match canonical backward slot accounting",
        {
          stage,
          nominalCapacity: capacity,
          unavailableLocations: unavailable.size,
          requiredEntrants: required,
        }
      );
    }

    let stageCandidates = byStage.get(stage);
    if (placementMode === STAGE_RESERVATION_PLACEMENT_MODE.SEEDED) {
      const seedNumbers = new Set();
      for (const candidate of stageCandidates) {
        if (
          !Number.isInteger(candidate.seedNumber) ||
          candidate.seedNumber < 1 ||
          seedNumbers.has(candidate.seedNumber)
        ) {
          fail(
            DRAW_RUNTIME_ERROR_CODE.DRAW_SEED_ASSIGNMENT_REQUIRED,
            "SEEDED stage placement requires unique authoritative seedNumber coverage per target stage",
            {
              stage,
              entryId: candidate.entryId,
              seedNumber: candidate.seedNumber,
            }
          );
        }
        seedNumbers.add(candidate.seedNumber);
      }
      stageCandidates = [...stageCandidates].sort(
        (a, b) =>
          a.seedNumber - b.seedNumber ||
          a.candidateIdentityKey.localeCompare(b.candidateIdentityKey)
      );
    } else {
      const normalized = orderByIdentity(stageCandidates);
      const rng = createDeterministicRandomFromSeed(
        `${String(options.deterministicSeed)}::${stage}`
      );
      stageCandidates = deterministicShuffle(normalized, rng);
    }

    const occupied = new Set();
    const seededPositions =
      placementMode === STAGE_RESERVATION_PLACEMENT_MODE.SEEDED
        ? buildSeededBracketSlotOrder(capacity)
        : null;

    for (let candidateIndex = 0; candidateIndex < stageCandidates.length; candidateIndex += 1) {
      const candidate = stageCandidates[candidateIndex];
      const stageSeedRank = candidateIndex + 1;
      const preferred =
        seededPositions != null ? seededPositions[stageSeedRank] : null;
      const positionNumber =
        preferred != null &&
        !unavailable.has(preferred) &&
        !occupied.has(preferred)
          ? preferred
          : seededPositions != null
            ? firstAvailableBalancedPosition(
                seededPositions,
                unavailable,
                occupied
              )
            : firstAvailablePosition(capacity, unavailable, occupied);
      if (positionNumber == null) {
        fail(
          DRAW_RUNTIME_ERROR_CODE.DRAW_SLOT_INVALID,
          "No legal stage location remains for DIRECT reservation",
          { stage, entryId: candidate.entryId }
        );
      }
      occupied.add(positionNumber);
      reservations.push(
        createDrawStageReservation({
          drawIdentityKey: options.drawIdentityKey,
          bracketIdentityKey,
          entryId: candidate.entryId,
          targetStage: stage,
          positionNumber,
          matchNumber: Math.ceil(positionNumber / 2),
          side: positionNumber % 2 === 1 ? "A" : "B",
          seedNumber: candidate.seedNumber,
          placementMode,
          placementReason:
            placementMode === STAGE_RESERVATION_PLACEMENT_MODE.SEEDED
              ? PLACEMENT_REASON.BRACKET_SEED
              : PLACEMENT_REASON.BRACKET_OPEN,
        })
      );
    }

    if (stage === bracketWideEntryRound) {
      if (firstPlayableCandidates.length !== required) {
        fail(
          DRAW_RUNTIME_ERROR_CODE.DRAW_CANDIDATE_REQUIRED,
          "First-playable identities must exactly cover canonical required entrants",
          {
            requiredEntrants: required,
            resolvedCandidates: firstPlayableCandidates.length,
          }
        );
      }
      let orderedFirstPlayable;
      if (placementMode === STAGE_RESERVATION_PLACEMENT_MODE.SEEDED) {
        const firstPlayableSeeds = new Set();
        for (const candidate of firstPlayableCandidates) {
          if (
            !Number.isInteger(candidate.seedNumber) ||
            candidate.seedNumber < 1 ||
            firstPlayableSeeds.has(candidate.seedNumber)
          ) {
            fail(
              DRAW_RUNTIME_ERROR_CODE.DRAW_SEED_ASSIGNMENT_REQUIRED,
              "SEEDED first-playable placement requires unique authoritative seedNumber coverage",
              { entryId: candidate.entryId, seedNumber: candidate.seedNumber }
            );
          }
          firstPlayableSeeds.add(candidate.seedNumber);
        }
        orderedFirstPlayable = [...firstPlayableCandidates].sort(
          (a, b) =>
            a.seedNumber - b.seedNumber ||
            a.candidateIdentityKey.localeCompare(b.candidateIdentityKey)
        );
      } else {
        const normalized = orderByIdentity(firstPlayableCandidates);
        const rng = createDeterministicRandomFromSeed(
          `${String(options.deterministicSeed)}::${stage}::FIRST_PLAYABLE`
        );
        orderedFirstPlayable = deterministicShuffle(normalized, rng);
      }

      for (const candidate of orderedFirstPlayable) {
        const preferred =
          seededPositions != null &&
          candidate.seedNumber >= 1 &&
          candidate.seedNumber <= capacity
            ? seededPositions[candidate.seedNumber]
            : null;
        const positionNumber =
          preferred != null &&
          !unavailable.has(preferred) &&
          !occupied.has(preferred)
            ? preferred
            : seededPositions != null
              ? firstAvailableBalancedPosition(
                  seededPositions,
                  unavailable,
                  occupied
                )
              : firstAvailablePosition(capacity, unavailable, occupied);
        if (positionNumber == null) {
          fail(
            DRAW_RUNTIME_ERROR_CODE.DRAW_SLOT_INVALID,
            "No legal first-playable stage location remains",
            { entryId: candidate.entryId, stage }
          );
        }
        occupied.add(positionNumber);
        const candidateIdentityKey = buildCandidateIdentityKey({
          drawIdentityKey: options.drawIdentityKey,
          candidateReference: candidate.entryId,
        });
        firstPlayablePlacements.push(
          createDrawPlacement({
            drawIdentityKey: options.drawIdentityKey,
            candidateIdentityKey,
            placementType: PLACEMENT_TYPE.BRACKET_SLOT,
            bracketIdentityKey,
            slotNumber: positionNumber,
            positionNumber,
            seedNumber: candidate.seedNumber,
            placementReason:
              placementMode === STAGE_RESERVATION_PLACEMENT_MODE.SEEDED
                ? PLACEMENT_REASON.BRACKET_SEED
                : PLACEMENT_REASON.BRACKET_OPEN,
            metadata: {
              candidateReference: candidate.entryId,
              slotIdentityKey: buildSlotIdentityKey({
                drawIdentityKey: options.drawIdentityKey,
                slotNumber: positionNumber,
              }),
              stageAwareFirstPlayable: true,
            },
          })
        );
      }
    }

    if (index > 0) {
      unavailable = expandBlockedPositions(
        new Set([...unavailable, ...occupied])
      );
    }
  }

  reservations.sort(
    (a, b) =>
      knockoutEntryRoundRank(a.targetStage) -
        knockoutEntryRoundRank(b.targetStage) ||
      a.positionNumber - b.positionNumber ||
      a.entryId.localeCompare(b.entryId)
  );
  firstPlayablePlacements.sort(
    (a, b) => a.positionNumber - b.positionNumber
  );
  return Object.freeze({
    stageReservations: Object.freeze(reservations),
    firstPlayablePlacements: Object.freeze(firstPlayablePlacements),
    bracketSize: nominalStageCapacity(bracketWideEntryRound),
  });
}
