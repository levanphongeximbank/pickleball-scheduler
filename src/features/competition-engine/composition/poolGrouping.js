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
import {
  resolveAuthoritativeSeedMapFromCore07,
  resolveEffectiveCompetitionScope,
  selectCore07SeedingProjectionForStage,
} from "./core07SeedingProjection.js";
import { E2E02_ERROR_CODE, failE2E02 } from "./errors.js";
import { deepFreeze, isNonEmptyString } from "./fingerprint.js";
import { normalizeCompetitionUnitParticipants } from "./entryIdentity.js";
import { applyGroupStageBypassPopulation } from "./groupStageBypassPopulation.js";

/**
 * @param {{
 *   participants: Array<{ entryId?: string, participantId?: string, seedNumber?: number }|string>,
 *   format: import("../../formats/poolKnockoutFormat.js").PoolKnockoutFormatDefinition,
 *   competitionId: string,
 *   divisionId?: string,
 *   categoryId?: string|null,
 *   deterministicSeed: string,
 *   competitionRulesProfile?: object,
 *   knockoutAdmissionPlan?: object|null,
 *   groupStageBypassEntryIds?: string[],
 *   applyGroupStageBypass?: boolean,
 *   requireCanonicalEntryId?: boolean,
 *   competitionUnitKind?: string|null,
 *   groupStageSeedingProjection?: object|null,
 *   authoritativeSeedingProjection?: object|null,
 *   knockoutSeedingProjection?: object|null,
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

  const applyBypass =
    input.applyGroupStageBypass === true ||
    input.knockoutAdmissionPlan != null ||
    input.competitionRulesProfile != null ||
    (Array.isArray(input.groupStageBypassEntryIds) &&
      input.groupStageBypassEntryIds.length > 0);

  const requireCanonical =
    input.requireCanonicalEntryId === true || applyBypass;

  /** @type {{ entryId: string, participantId: string, seedNumber?: number }[]} */
  let normalized;
  /** @type {object|null} */
  let bypassPopulation = null;

  if (applyBypass) {
    bypassPopulation = applyGroupStageBypassPopulation({
      participants: input.participants,
      competitionRulesProfile: input.competitionRulesProfile,
      knockoutAdmissionPlan: input.knockoutAdmissionPlan,
      groupStageBypassEntryIds: input.groupStageBypassEntryIds,
      requireCanonicalEntryId: requireCanonical,
      competitionUnitKind: input.competitionUnitKind,
    });
    normalized = bypassPopulation.groupStageParticipants.map((p) => ({
      entryId: p.entryId,
      participantId: p.participantId,
      seedNumber: p.seedNumber,
    }));
  } else {
    normalized = normalizeCompetitionUnitParticipants(input.participants || [], {
      requireCanonicalEntryId: requireCanonical,
      competitionUnitKind: input.competitionUnitKind,
    });
  }

  const strategy = input.format.poolStage.groupingStrategy;
  const poolStageId = "stage-pool";
  const effectiveScope = resolveEffectiveCompetitionScope({
    competitionId,
    divisionId: input.divisionId,
    categoryId: input.categoryId,
  });

  if (applyBypass) {
    // Admission-aware: SNAKE/SEEDED/SERPENTINE require proven CORE-07 group seeding
    // when group participants remain after bypass. Do NOT synthesize index+1.
    // Do NOT silently remap to CORE-08 OPEN_* modes.
    if (normalized.length > 0) {
      const groupProjection = selectCore07SeedingProjectionForStage(
        input,
        "GROUP",
        poolStageId
      );
      if (!groupProjection) {
        failE2E02(
          E2E02_ERROR_CODE.INVALID_CONFIGURATION,
          "admission-aware seed-ordered grouping requires compatible CORE-07 groupStageSeedingProjection / authoritativeSeedingProjection — fail closed (E2E02 OPEN grouping not available)",
          {
            groupingStrategy: strategy,
            SEED_ORDERED_GROUPING_WITHOUT_AUTHORITY: "FAIL_CLOSED",
            E2E02_OPEN_GROUPING_EXTENSION: "DEFERRED",
            GROUPING_POLICY_EXECUTION_GAP: true,
            CE_GROUP_SEED_ALLOCATION: false,
          }
        );
      }
      const seedMap = resolveAuthoritativeSeedMapFromCore07(
        groupProjection,
        normalized.map((p) => p.entryId),
        {
          competitionId: effectiveScope.competitionId,
          divisionId: effectiveScope.effectiveDivisionId,
          categoryId: effectiveScope.effectiveCategoryId,
          stageId: poolStageId,
          competitionUnitKind: input.competitionUnitKind,
          role: "GROUP",
        }
      );
      normalized = normalized.map((p) => ({
        ...p,
        seedNumber: seedMap[p.entryId],
      }));
    }
  } else {
    // Legacy non-admission path: historical index fallback for missing seedNumber.
    normalized = normalized.map((p, index) => ({
      ...p,
      seedNumber:
        Number.isFinite(Number(p.seedNumber)) && Number(p.seedNumber) >= 1
          ? Number(p.seedNumber)
          : index + 1,
    }));
  }

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
  const divisionId = effectiveScope.effectiveDivisionId;
  const drawIdentityKey = buildDrawIdentityKey({
    competitionId,
    contextId: `${divisionId}:pool`,
  });

  const candidates = normalized.map((p) =>
    createDrawCandidate({
      candidateId: p.entryId,
      candidateReference: p.entryId,
      candidateType: CANDIDATE_TYPE.PARTICIPANT,
      seedNumber: p.seedNumber,
      competitionId,
      contextId: `${divisionId}:pool`,
      drawIdentityKey,
      eligible: true,
    })
  );
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

  /** @type {{ groupId: string, groupNumber: number, participantIds: string[], entryIds: string[] }[]} */
  const groups = groupsWithPlacements.map((g) => {
    const groupNumber = Number(g.groupNumber);
    const groupId = `pool-${groupNumber}`;
    const memberPlacements = (assignment.placements || [])
      .filter((p) => Number(p.metadata?.groupNumber) === groupNumber)
      .sort(
        (a, b) =>
          Number(a.positionNumber || 0) - Number(b.positionNumber || 0)
      );
    const entryIds = memberPlacements.map((p) => {
      const ref =
        p.metadata?.candidateReference ||
        String(p.candidateIdentityKey || "")
          .split("::CANDIDATE::")
          .pop();
      return String(ref);
    });
    return {
      groupId,
      groupNumber,
      participantIds: entryIds,
      entryIds,
    };
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
    canonicalIdentity: "entryId",
    groupStageBypass: bypassPopulation
      ? Object.freeze({
          applied: true,
          groupStageBypassEntryIds: bypassPopulation.groupStageBypassEntryIds,
          competitionPopulationEntryIds:
            bypassPopulation.competitionPopulationEntryIds,
          groupStageParticipantEntryIds:
            bypassPopulation.groupStageParticipantEntryIds,
        })
      : Object.freeze({ applied: false }),
  });
}
