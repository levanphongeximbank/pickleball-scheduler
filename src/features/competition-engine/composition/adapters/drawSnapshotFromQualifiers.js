/**
 * Map qualified participants → CORE-09 DrawSnapshot (single elimination).
 * Uses CORE-08 bracket slot + bye helpers for placement math.
 */

import {
  assignBracketSlots,
  calculateByeCount,
  createDrawCandidate,
  CANDIDATE_TYPE,
  buildDrawIdentityKey,
} from "../../../competition-core/draw-runtime/index.js";
import {
  BRACKET_SIZE_POLICY,
  BYE_POLICY,
  computeSingleEliminationBracket,
  createDrawPlacementRef,
  createDrawSnapshot,
  DRAW_COMPLETION_STATUS,
} from "../../../competition-core/match-generation/index.js";
import { E2E02_ERROR_CODE, failE2E02 } from "../errors.js";
import { computeDeterministicFingerprint } from "../fingerprint.js";

/**
 * @param {{
 *   competitionId: string,
 *   divisionId: string,
 *   categoryId?: string|null,
 *   stageId?: string,
 *   qualifiers: Array<{ participantId: string, seedNumber: number }>,
 *   bracketSizePolicy?: string,
 *   byePolicy?: string,
 *   deterministicSeed: string,
 * }} input
 */
export function buildKnockoutDrawSnapshotFromQualifiers(input) {
  const competitionId = String(input.competitionId || "").trim();
  const divisionId = String(input.divisionId || "").trim();
  const categoryId =
    typeof input.categoryId === "string" && input.categoryId.trim()
      ? input.categoryId.trim()
      : null;
  const stageId = String(input.stageId || "stage-knockout").trim();
  const qualifiers = Array.isArray(input.qualifiers) ? input.qualifiers : [];
  const bracketSizePolicy =
    input.bracketSizePolicy || BRACKET_SIZE_POLICY.POWER_OF_TWO;
  const byePolicy = input.byePolicy || BYE_POLICY.EXPLICIT_PLACEMENTS;

  if (qualifiers.length < 2) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_PARTICIPANT_COUNT,
      "knockout requires at least 2 qualifiers",
      { qualifierCount: qualifiers.length }
    );
  }

  const seen = new Set();
  for (const q of qualifiers) {
    const id = String(q.participantId || "").trim();
    if (!id) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "qualifier participantId required",
        {}
      );
    }
    if (seen.has(id)) {
      failE2E02(
        E2E02_ERROR_CODE.DUPLICATE_QUALIFIER,
        "duplicate qualifier rejected",
        { participantId: id }
      );
    }
    seen.add(id);
  }

  const dims = computeSingleEliminationBracket(
    qualifiers.length,
    bracketSizePolicy
  );
  if (!dims.ok) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_BRACKET_SIZE,
      `bracket size computation failed: ${dims.reason}`,
      { reason: dims.reason, qualifierCount: qualifiers.length }
    );
  }

  const byeCount = calculateByeCount(dims.bracketSize, qualifiers.length);
  if (byeCount !== dims.byeCount) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_BYE_CONFIGURATION,
      "bye count mismatch between CORE-08 and CORE-09",
      { core08: byeCount, core09: dims.byeCount }
    );
  }

  const drawIdentityKey = buildDrawIdentityKey({
    competitionId,
    contextId: `${divisionId}:${stageId}`,
  });

  const candidates = qualifiers.map((q, index) =>
    createDrawCandidate({
      candidateId: String(q.participantId),
      candidateReference: String(q.participantId),
      candidateType: CANDIDATE_TYPE.PARTICIPANT,
      seedNumber:
        Number.isFinite(Number(q.seedNumber)) && Number(q.seedNumber) >= 1
          ? Number(q.seedNumber)
          : index + 1,
      competitionId,
      contextId: `${divisionId}:${stageId}`,
      drawIdentityKey,
      eligible: true,
    })
  );

  const bracketResult = assignBracketSlots(candidates, {
    drawIdentityKey,
    competitionId,
    contextId: `${divisionId}:${stageId}`,
    bracketSize: dims.bracketSize,
    bracketId: "ko-main",
    open: false,
    deterministicSeed: input.deterministicSeed,
  });

  /** @type {ReturnType<typeof createDrawPlacementRef>[]} */
  const participantPlacements = [];
  /** @type {Set<number>} */
  const occupied = new Set();

  for (const placement of bracketResult.placements || []) {
    const slot = placement.slotNumber ?? placement.positionNumber;
    if (!Number.isInteger(slot) || slot < 1) continue;
    occupied.add(slot);
    const participantId =
      placement.metadata?.candidateReference ||
      String(placement.candidateIdentityKey || "")
        .split("::CANDIDATE::")
        .pop();
    participantPlacements.push(
      createDrawPlacementRef({
        placementRef: `ko-${participantId}`,
        participantId: String(participantId),
        position: slot,
        bracketId: "ko-main",
        isBye: false,
        seedRef: placement.seedNumber != null ? `seed-${placement.seedNumber}` : null,
      })
    );
  }

  for (const bye of bracketResult.byes || []) {
    const slot = bye.slotNumber;
    if (!Number.isInteger(slot) || slot < 1) continue;
    occupied.add(slot);
    participantPlacements.push(
      createDrawPlacementRef({
        placementRef: `bye-slot-${slot}`,
        participantId: null,
        position: slot,
        bracketId: "ko-main",
        isBye: true,
      })
    );
  }

  // Fail-closed: every slot 1..B must be occupied for EXPLICIT_PLACEMENTS.
  if (byePolicy === BYE_POLICY.EXPLICIT_PLACEMENTS) {
    for (let pos = 1; pos <= dims.bracketSize; pos += 1) {
      if (!occupied.has(pos)) {
        failE2E02(
          E2E02_ERROR_CODE.INVALID_BYE_CONFIGURATION,
          "bracket slot left empty after CORE-08 assignment",
          { position: pos, bracketSize: dims.bracketSize }
        );
      }
    }
  }

  participantPlacements.sort(
    (a, b) => Number(a.position || 0) - Number(b.position || 0)
  );

  const drawFingerprint = computeDeterministicFingerprint(
    {
      competitionId,
      divisionId,
      stageId,
      qualifiers,
      bracketSize: dims.bracketSize,
      byeCount: dims.byeCount,
      deterministicSeed: input.deterministicSeed,
    },
    "draw-ko"
  );

  return {
    drawSnapshot: createDrawSnapshot({
      drawId: `draw-ko-${competitionId}`,
      drawVersion: "1",
      drawFingerprint,
      competitionId,
      divisionId,
      categoryId,
      completionStatus: DRAW_COMPLETION_STATUS.COMPLETE,
      stageDefinitions: [{ stageId, order: 2 }],
      groupPlacements: [],
      bracketPlacements: [{ bracketId: "ko-main", order: 1 }],
      participantPlacements,
      // Byes are carried as participantPlacements with isBye=true (CORE-09 SE contract).
      byePlacements: [],
      seedReferences: qualifiers.map((q) => ({
        participantId: q.participantId,
        seedNumber: q.seedNumber,
      })),
      deterministicOrderingMetadata: {
        seed: String(input.deterministicSeed || ""),
      },
    }),
    bracketSize: dims.bracketSize,
    byeCount: dims.byeCount,
  };
}
