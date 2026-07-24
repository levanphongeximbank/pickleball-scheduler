/**
 * Knockout stage composition — CORE-09 SINGLE_ELIMINATION (no bracket fork).
 */

import {
  MATCH_GENERATION_STRATEGY,
  MATCH_GENERATOR_IDENTITY,
  createMatchGenerationRequest,
  createMatchGenerationContext,
  createParticipantSnapshotRef,
  generateSingleEliminationMatchPlan,
} from "../../competition-core/match-generation/index.js";
import { buildKnockoutDrawSnapshotFromQualifiers } from "./adapters/drawSnapshotFromQualifiers.js";
import { createKnockoutStageEvaluatedRules } from "./adapters/evaluatedRulesFromFormat.js";
import { E2E02_ERROR_CODE, failE2E02 } from "./errors.js";
import { computeDeterministicFingerprint, deepFreeze } from "./fingerprint.js";

/**
 * @param {{
 *   format: object,
 *   qualification: { qualifiers: Array<{ participantId: string, seedNumber: number }> },
 *   competitionId: string,
 *   tenantId: string,
 *   divisionId?: string,
 *   categoryId?: string|null,
 *   deterministicSeed: string,
 *   poolStageComplete?: boolean,
 * }} input
 */
export function composeKnockoutStage(input) {
  if (input.poolStageComplete === false) {
    failE2E02(
      E2E02_ERROR_CODE.POOL_STAGE_INCOMPLETE,
      "knockout rejected while pool stage incomplete",
      {}
    );
  }
  const tenantId = String(input.tenantId || "").trim();
  if (!tenantId) {
    failE2E02(E2E02_ERROR_CODE.MISSING_TENANT, "tenantId is required", {});
  }

  const qualifiers = input.qualification?.qualifiers;
  if (!Array.isArray(qualifiers) || qualifiers.length < 2) {
    failE2E02(
      E2E02_ERROR_CODE.INVALID_QUALIFIER_COUNT,
      "qualification output with >=2 qualifiers required",
      { count: Array.isArray(qualifiers) ? qualifiers.length : 0 }
    );
  }

  // Odd qualifier counts are supported via power-of-two bye padding.
  void E2E02_ERROR_CODE.ODD_QUALIFIER_UNSUPPORTED;

  const divisionId = String(input.divisionId || "div-1").trim();
  const categoryId = input.categoryId ?? null;
  const stageId = "stage-knockout";

  const { drawSnapshot, bracketSize, byeCount } =
    buildKnockoutDrawSnapshotFromQualifiers({
      competitionId: input.competitionId,
      divisionId,
      categoryId,
      stageId,
      qualifiers,
      bracketSizePolicy: input.format.knockoutStage.bracketSizePolicy,
      byePolicy: input.format.knockoutStage.byePolicy,
      deterministicSeed: input.deterministicSeed,
    });

  const evaluatedRules = createKnockoutStageEvaluatedRules(input.format);
  const participantIds = qualifiers.map((q) => q.participantId);
  const participantFingerprint = computeDeterministicFingerprint(
    participantIds,
    "ko-participants"
  );
  const participantSnapshot = createParticipantSnapshotRef({
    snapshotId: `part-ko-${input.competitionId}`,
    participantFingerprint,
    participantIds,
  });

  const request = createMatchGenerationRequest({
    competitionId: input.competitionId,
    divisionId,
    categoryId,
    stageId,
    strategy: MATCH_GENERATION_STRATEGY.SINGLE_ELIMINATION,
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
    deterministicOrderingInputs: participantIds.map(
      (id, i) => `seed:${i + 1}:${id}`
    ),
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
  });

  const generation = generateSingleEliminationMatchPlan(request, context);
  if (!generation.ok) {
    failE2E02(
      E2E02_ERROR_CODE.CORE_GENERATION_FAILED,
      "CORE-09 SINGLE_ELIMINATION generation failed",
      { issues: generation.issues || generation.diagnostics || null }
    );
  }

  const logicalMatches = generation.matchPlan?.logicalMatches || [];
  const played = logicalMatches.filter((m) => m.isByeMatch !== true);
  const byes = logicalMatches.filter((m) => m.isByeMatch === true);

  return deepFreeze({
    stage: "KNOCKOUT",
    tenantId,
    bracketSize,
    byeCount,
    qualifiers,
    drawSnapshot,
    matchPlan: generation.matchPlan,
    diagnostics: generation.diagnostics || null,
    fingerprints: generation.fingerprints || null,
    winnerAdvancementCompatible: true,
    matchLifecycleCompatible: true,
    scoringResultValidationCompatible: true,
    playedMatchCount: played.length,
    byeMatchCount: byes.length,
    scheduleInput: {
      competitionId: input.competitionId,
      stageId,
      matchPlanReference: {
        generationFingerprint: generation.matchPlan.generationFingerprint,
        logicalMatchCount: logicalMatches.length,
      },
      logicalMatchKeys: logicalMatches.map((m) => m.logicalMatchKey),
    },
    courtAssignmentInput: {
      competitionId: input.competitionId,
      stageId,
      tenantId,
      matchRefs: logicalMatches.map((m) => ({
        logicalMatchKey: m.logicalMatchKey,
        roundNumber: m.roundNumber ?? null,
      })),
    },
    compositionFingerprint: computeDeterministicFingerprint(
      {
        qualifiers,
        generationFingerprint: generation.matchPlan.generationFingerprint,
        deterministicSeed: input.deterministicSeed,
      },
      "ko-stage"
    ),
  });
}
