/**
 * Pool stage composition — CORE-09 GROUP_ROUND_ROBIN (no algorithm fork).
 */

import {
  MATCH_GENERATION_STRATEGY,
  MATCH_GENERATOR_IDENTITY,
  createMatchGenerationRequest,
  createMatchGenerationContext,
  createParticipantSnapshotRef,
  generateGroupStageRoundRobinMatchPlan,
} from "../../competition-core/match-generation/index.js";
import { buildGroupDrawSnapshotFromPools } from "./adapters/drawSnapshotFromGroups.js";
import { createPoolStageEvaluatedRules } from "./adapters/evaluatedRulesFromFormat.js";
import { composePoolGrouping } from "./poolGrouping.js";
import { E2E02_ERROR_CODE, failE2E02 } from "./errors.js";
import { computeDeterministicFingerprint, deepFreeze } from "./fingerprint.js";

/**
 * @param {{
 *   participants: Array<{ participantId: string, seedNumber?: number }|string>,
 *   format: object,
 *   competitionId: string,
 *   tenantId: string,
 *   divisionId?: string,
 *   categoryId?: string|null,
 *   deterministicSeed: string,
 * }} input
 */
export function composePoolStage(input) {
  const tenantId = String(input.tenantId || "").trim();
  if (!tenantId) {
    failE2E02(E2E02_ERROR_CODE.MISSING_TENANT, "tenantId is required", {});
  }

  const grouping = composePoolGrouping({
    participants: input.participants,
    format: input.format,
    competitionId: input.competitionId,
    divisionId: input.divisionId,
    deterministicSeed: input.deterministicSeed,
  });

  const divisionId = String(input.divisionId || "div-1").trim();
  const categoryId = input.categoryId ?? null;
  const stageId = "stage-pool";

  const drawSnapshot = buildGroupDrawSnapshotFromPools({
    competitionId: input.competitionId,
    divisionId,
    categoryId,
    stageId,
    groups: grouping.groups,
    deterministicSeed: input.deterministicSeed,
  });

  const evaluatedRules = createPoolStageEvaluatedRules(input.format);
  const participantIds = grouping.groups.flatMap((g) => g.participantIds);
  const participantFingerprint = computeDeterministicFingerprint(
    participantIds,
    "participants"
  );

  const participantSnapshot = createParticipantSnapshotRef({
    snapshotId: `part-pool-${input.competitionId}`,
    participantFingerprint,
    participantIds,
  });

  const request = createMatchGenerationRequest({
    competitionId: input.competitionId,
    divisionId,
    categoryId,
    stageId,
    strategy: MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN,
    drawReference: {
      drawId: drawSnapshot.drawId,
      drawVersion: drawSnapshot.drawVersion,
      drawFingerprint: drawSnapshot.drawFingerprint,
    },
    evaluatedRuleReference: {
      ruleSetId: evaluatedRules.ruleSetId,
      ruleSetVersion: evaluatedRules.ruleSetVersion,
      ruleEvaluationFingerprint: evaluatedRules.ruleEvaluationFingerprint,
    },
    participantSnapshotReference: {
      snapshotId: participantSnapshot.snapshotId,
      participantFingerprint: participantSnapshot.participantFingerprint,
    },
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
  });

  const context = createMatchGenerationContext({
    drawSnapshot,
    evaluatedRules,
    participantSnapshot,
    deterministicOrderingInputs: participantIds.map((id) => `placement:${id}`),
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
  });

  const generation = generateGroupStageRoundRobinMatchPlan(request, context);
  if (!generation.ok) {
    failE2E02(
      E2E02_ERROR_CODE.CORE_GENERATION_FAILED,
      "CORE-09 GROUP_ROUND_ROBIN generation failed",
      { issues: generation.issues || generation.diagnostics || null }
    );
  }

  const logicalMatches = generation.matchPlan?.logicalMatches || [];
  assertNoDuplicateOrSelfMatches(logicalMatches);

  const scheduleInput = {
    competitionId: input.competitionId,
    stageId,
    matchPlanReference: {
      generationFingerprint: generation.matchPlan.generationFingerprint,
      logicalMatchCount: logicalMatches.length,
    },
    logicalMatchKeys: logicalMatches.map((m) => m.logicalMatchKey),
  };

  const courtAssignmentInput = {
    competitionId: input.competitionId,
    stageId,
    tenantId,
    matchRefs: logicalMatches.map((m) => ({
      logicalMatchKey: m.logicalMatchKey,
      groupId: m.groupId ?? null,
    })),
  };

  return deepFreeze({
    stage: "POOL",
    tenantId,
    grouping,
    drawSnapshot,
    matchPlan: generation.matchPlan,
    diagnostics: generation.diagnostics || null,
    fingerprints: generation.fingerprints || null,
    scheduleInput,
    courtAssignmentInput,
    compositionFingerprint: computeDeterministicFingerprint(
      {
        grouping: grouping.groups,
        generationFingerprint: generation.matchPlan.generationFingerprint,
        deterministicSeed: input.deterministicSeed,
      },
      "pool-stage"
    ),
  });
}

/**
 * @param {object[]} matches
 */
function assertNoDuplicateOrSelfMatches(matches) {
  const pairs = new Set();
  for (const m of matches) {
    if (m.isByeMatch === true) continue;
    const a = m.participantSlotA?.participantId;
    const b = m.participantSlotB?.participantId;
    if (!a || !b) continue;
    if (a === b) {
      failE2E02(E2E02_ERROR_CODE.CORE_GENERATION_FAILED, "self-match detected", {
        logicalMatchKey: m.logicalMatchKey,
      });
    }
    const key = a < b ? `${m.groupId || ""}:${a}|${b}` : `${m.groupId || ""}:${b}|${a}`;
    if (pairs.has(key)) {
      failE2E02(
        E2E02_ERROR_CODE.CORE_GENERATION_FAILED,
        "duplicate match detected",
        { pair: key }
      );
    }
    pairs.add(key);
  }
}
