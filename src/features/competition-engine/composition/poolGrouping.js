/**
 * Pool grouping composition — reuses CORE-08 snake/seeded/serpentine indices.
 */

import {
  assignSnakeGroups,
  assignSeededGroups,
  assignSerpentineGroups,
  buildGroups,
  attachPlacementsToGroups,
  createDrawCandidate,
  CANDIDATE_TYPE,
  buildDrawIdentityKey,
} from "../../competition-core/draw-runtime/index.js";
import { resolvePoolCount } from "../formats/poolKnockoutFormat.js";
import {
  E2E02_GROUPING_STRATEGY,
} from "./constants.js";
import { E2E02_ERROR_CODE, failE2E02 } from "./errors.js";
import { deepFreeze, isNonEmptyString } from "./fingerprint.js";

/**
 * @param {{
 *   participants: Array<{ participantId: string, seedNumber?: number }|string>,
 *   format: import("../../formats/poolKnockoutFormat.js").PoolKnockoutFormatDefinition,
 *   competitionId: string,
 *   divisionId?: string,
 *   deterministicSeed: string,
 * }} input
 */
export function composePoolGrouping(input) {
  const competitionId = String(input.competitionId || "").trim();
  if (!competitionId) {
    failE2E02(
      E2E02_ERROR_CODE.MISSING_COMPETITION_IDENTITY,
      "competitionId is required for pool grouping",
      {}
    );
  }
  if (!isNonEmptyString(input.deterministicSeed)) {
    failE2E02(
      E2E02_ERROR_CODE.MISSING_DETERMINISTIC_SEED,
      "deterministicSeed is required for pool grouping",
      {}
    );
  }

  const rawParticipants = Array.isArray(input.participants)
    ? input.participants
    : [];
  /** @type {{ participantId: string, seedNumber: number }[]} */
  const normalized = [];
  const seen = new Set();

  rawParticipants.forEach((p, index) => {
    const participantId =
      typeof p === "string"
        ? p.trim()
        : String(p?.participantId || "").trim();
    if (!participantId) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_CONFIGURATION,
        "participantId required",
        { index }
      );
    }
    if (seen.has(participantId)) {
      failE2E02(
        E2E02_ERROR_CODE.DUPLICATE_PARTICIPANT,
        "duplicate participant rejected",
        { participantId }
      );
    }
    seen.add(participantId);
    const seedNumber =
      typeof p === "object" &&
      p != null &&
      Number.isFinite(Number(p.seedNumber)) &&
      Number(p.seedNumber) >= 1
        ? Number(p.seedNumber)
        : index + 1;
    normalized.push({ participantId, seedNumber });
  });

  const min = input.format.participantCountPolicy.minParticipants;
  const max = input.format.participantCountPolicy.maxParticipants;
  if (normalized.length < min) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_PARTICIPANT_COUNT,
      `participant count below minimum (${min})`,
      { count: normalized.length, min }
    );
  }
  if (max != null && normalized.length > max) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_PARTICIPANT_COUNT,
      `participant count above maximum (${max})`,
      { count: normalized.length, max }
    );
  }

  const poolCount = resolvePoolCount(normalized.length, input.format);
  const divisionId = String(input.divisionId || "div-1").trim();
  const drawIdentityKey = buildDrawIdentityKey({
    competitionId,
    contextId: `${divisionId}:pool`,
  });

  const candidates = normalized.map((p) =>
    createDrawCandidate({
      candidateId: p.participantId,
      candidateReference: p.participantId,
      candidateType: CANDIDATE_TYPE.PARTICIPANT,
      seedNumber: p.seedNumber,
      competitionId,
      contextId: `${divisionId}:pool`,
      drawIdentityKey,
      eligible: true,
    })
  );

  const strategy = input.format.poolStage.groupingStrategy;
  /** @type {{ placements: object[], decisionTrace: string[] }} */
  let assignment;
  const options = {
    drawIdentityKey,
    competitionId,
    contextId: `${divisionId}:pool`,
    groupCount: poolCount,
  };

  if (strategy === E2E02_GROUPING_STRATEGY.SEEDED) {
    assignment = assignSeededGroups(candidates, options);
  } else if (strategy === E2E02_GROUPING_STRATEGY.SERPENTINE) {
    assignment = assignSerpentineGroups(candidates, options);
  } else {
    assignment = assignSnakeGroups(candidates, options);
  }

  const groupsBuilt = buildGroups({
    drawIdentityKey,
    competitionId,
    contextId: `${divisionId}:pool`,
    groupCount: poolCount,
  });
  const groupsWithPlacements = attachPlacementsToGroups(
    groupsBuilt,
    assignment.placements
  );

  /** @type {{ groupId: string, groupNumber: number, participantIds: string[] }[]} */
  const groups = groupsWithPlacements.map((g) => {
    const groupNumber = Number(g.groupNumber);
    const groupId = `pool-${groupNumber}`;
    const memberPlacements = (assignment.placements || [])
      .filter((p) => Number(p.metadata?.groupNumber) === groupNumber)
      .sort(
        (a, b) =>
          Number(a.positionNumber || 0) - Number(b.positionNumber || 0)
      );
    const participantIds = memberPlacements.map((p) => {
      const ref =
        p.metadata?.candidateReference ||
        String(p.candidateIdentityKey || "")
          .split("::CANDIDATE::")
          .pop();
      return String(ref);
    });
    return { groupId, groupNumber, participantIds };
  });

  for (const group of groups) {
    if (!group.participantIds.length) {
      failE2E02(E2E02_ERROR_CODE.EMPTY_POOL, "empty pool rejected", {
        groupId: group.groupId,
      });
    }
    if (group.participantIds.length < 2) {
      failE2E02(
        E2E02_ERROR_CODE.INVALID_POOL_SIZING,
        "each pool must have at least 2 participants for GROUP_ROUND_ROBIN",
        {
          groupId: group.groupId,
          size: group.participantIds.length,
          poolCount,
          participantCount: normalized.length,
        }
      );
    }
  }

  return deepFreeze({
    poolCount,
    groupingStrategy: strategy,
    groups,
    decisionTrace: Object.freeze([...(assignment.decisionTrace || [])]),
    participantCount: normalized.length,
  });
}
