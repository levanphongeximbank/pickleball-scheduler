/**
 * CORE-09 Phase 1C/1D — MatchPlan generation orchestrator (capability-local).
 * No production runtime wiring. No schedule/score/lifecycle fields.
 */

import {
  matchGenerationOk,
  matchGenerationFail,
} from "../contracts/index.js";
import { MATCH_GENERATION_STRATEGY } from "../enums/matchGenerationStrategy.js";
import { MATCH_GENERATION_ISSUE_CODE } from "../errors/matchGenerationIssueCodes.js";
import { MATCH_GENERATOR_IDENTITY } from "../constants.js";
import { validateMatchGenerationRequest } from "../services/validateMatchGenerationRequest.js";
import { validateDrawSnapshotForGeneration } from "../services/validateDrawSnapshot.js";
import { validateMatchPlanInvariants } from "../services/validateMatchPlanInvariants.js";
import { sortMatchGenerationIssues } from "../services/asciiCompare.js";
import {
  resolveFlatParticipantsFromDraw,
  resolveGroupedParticipantsFromDraw,
} from "../services/resolveParticipantsFromDraw.js";
import {
  validateRoundRobinRuleBinding,
  resolveRoundRobinLegs,
  PHASE_1C_EXECUTABLE_STRATEGIES,
} from "../services/validateRoundRobinRules.js";
import {
  validateSingleEliminationRuleBinding,
  PHASE_1D_EXECUTABLE_STRATEGIES,
} from "../services/validateSingleEliminationRules.js";
import { validateSingleEliminationBracketInvariants } from "../services/validateSingleEliminationBracketInvariants.js";
import { generateRoundRobinForParticipants } from "../generators/generateRoundRobinForParticipants.js";
import {
  generateSingleEliminationForParticipants,
  countDrawParticipants,
} from "../generators/generateSingleEliminationForParticipants.js";
import { computeSingleEliminationBracket as computeBracket } from "../generators/singleEliminationBracket.js";
import { assembleMatchPlan } from "../generators/assembleMatchPlan.js";
import {
  expectedSingleRoundRobinPlayedMatches,
  expectedSingleRoundRobinRounds,
} from "../generators/roundRobinCircle.js";

/**
 * @param {import('../contracts/matchGenerationIssue.js').MatchGenerationIssue[]} issues
 * @param {object} [fingerprints]
 * @param {object} [diagnostics]
 */
function failWithIssues(issues, fingerprints = {}, diagnostics = {}) {
  const sorted = sortMatchGenerationIssues(issues);
  if (sorted.length === 0) {
    return matchGenerationFail(
      MATCH_GENERATION_ISSUE_CODE.INVALID_REQUEST,
      "Generation failed without structured issues",
      { fingerprints, diagnostics }
    );
  }
  const primary = sorted[0];
  return matchGenerationFail(primary.code, primary.message, {
    path: primary.path,
    details: primary.details,
    issues: sorted.slice(1),
    fingerprints,
    diagnostics,
  });
}

/**
 * Generate a deterministic MatchPlan for ROUND_ROBIN, GROUP_ROUND_ROBIN,
 * or SINGLE_ELIMINATION.
 *
 * @param {import('../contracts/matchGenerationRequest.js').MatchGenerationRequest|object} request
 * @param {import('../contracts/matchGenerationContext.js').MatchGenerationContext|object} context
 * @returns {import('../contracts/matchGenerationResult.js').MatchGenerationResult}
 */
export function generateMatchPlan(request, context) {
  const fingerprints = {
    drawFingerprint: String(context?.drawSnapshot?.drawFingerprint || ""),
    ruleEvaluationFingerprint: String(
      context?.evaluatedRules?.ruleEvaluationFingerprint || ""
    ),
    participantFingerprint: String(
      context?.participantSnapshot?.participantFingerprint ||
        request?.participantSnapshotReference?.participantFingerprint ||
        ""
    ),
    generationFingerprint: "",
  };

  const requestIssues = validateMatchGenerationRequest(request);
  if (requestIssues.length > 0) {
    return failWithIssues(requestIssues, fingerprints, {
      phase: "validateMatchGenerationRequest",
    });
  }

  const isPhase1C = PHASE_1C_EXECUTABLE_STRATEGIES.has(request.strategy);
  const isPhase1D = PHASE_1D_EXECUTABLE_STRATEGIES.has(request.strategy);

  if (!isPhase1C && !isPhase1D) {
    return matchGenerationFail(
      MATCH_GENERATION_ISSUE_CODE.STRATEGY_UNSUPPORTED,
      "Match Generator executor does not support this strategy yet",
      {
        path: "strategy",
        details: { strategy: request.strategy },
        fingerprints,
      }
    );
  }

  if (!context || typeof context !== "object") {
    return matchGenerationFail(
      MATCH_GENERATION_ISSUE_CODE.INVALID_REQUEST,
      "MatchGenerationContext is required",
      { path: "context", fingerprints }
    );
  }

  const drawSnapshot = context.drawSnapshot;
  const evaluatedRules = context.evaluatedRules;

  const drawIssues = validateDrawSnapshotForGeneration(drawSnapshot, {
    drawVersion: request.drawReference.drawVersion,
    drawFingerprint: request.drawReference.drawFingerprint,
  });
  if (drawIssues.length > 0) {
    return failWithIssues(drawIssues, fingerprints, {
      phase: "validateDrawSnapshotForGeneration",
    });
  }

  if (
    String(drawSnapshot.drawId || "").trim() !==
    String(request.drawReference.drawId || "").trim()
  ) {
    return matchGenerationFail(
      MATCH_GENERATION_ISSUE_CODE.DRAW_REFERENCE_INVALID,
      "Draw id does not match request reference",
      {
        path: "drawReference.drawId",
        details: {
          requested: request.drawReference.drawId,
          actual: drawSnapshot.drawId,
        },
        fingerprints,
      }
    );
  }

  const participantFingerprint = String(
    context.participantSnapshot?.participantFingerprint ||
      request.participantSnapshotReference?.participantFingerprint ||
      ""
  ).trim();
  if (!participantFingerprint) {
    return matchGenerationFail(
      MATCH_GENERATION_ISSUE_CODE.PARTICIPANT_FINGERPRINT_MISSING,
      "Participant fingerprint is missing",
      { path: "participantFingerprint", fingerprints }
    );
  }

  const deterministicOrderingInputs = Array.isArray(
    context.deterministicOrderingInputs
  )
    ? [...context.deterministicOrderingInputs]
    : [];

  if (isPhase1D) {
    return generateSingleEliminationPlan({
      request,
      drawSnapshot,
      evaluatedRules,
      participantFingerprint,
      deterministicOrderingInputs,
      fingerprints,
    });
  }

  return generateRoundRobinPlan({
    request,
    drawSnapshot,
    evaluatedRules,
    participantFingerprint,
    deterministicOrderingInputs,
    fingerprints,
  });
}

/**
 * @param {object} args
 */
function generateSingleEliminationPlan(args) {
  const {
    request,
    drawSnapshot,
    evaluatedRules,
    participantFingerprint,
    deterministicOrderingInputs,
    fingerprints,
  } = args;

  const N = countDrawParticipants(drawSnapshot);
  const dims = computeBracket(N, evaluatedRules.bracketSizePolicy);
  const byeCount = dims.ok ? dims.byeCount : undefined;

  const ruleIssues = validateSingleEliminationRuleBinding(
    request,
    evaluatedRules,
    { participantCount: N, byeCount }
  );
  if (ruleIssues.length > 0) {
    return failWithIssues(ruleIssues, fingerprints, {
      phase: "validateSingleEliminationRuleBinding",
    });
  }

  const generated = generateSingleEliminationForParticipants({
    drawSnapshot,
    evaluatedRules,
    competitionId: request.competitionId,
    divisionId: request.divisionId,
    categoryId: request.categoryId,
    stageId: request.stageId,
  });
  if (!generated.ok) {
    return failWithIssues(generated.issues, fingerprints, {
      phase: "generateSingleEliminationForParticipants",
      diagnostics: generated.diagnostics,
    });
  }

  const diagnostics = {
    generatorId: MATCH_GENERATOR_IDENTITY.id,
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
    strategy: request.strategy,
    ...generated.diagnostics,
  };

  const plan = assembleMatchPlan({
    competitionId: request.competitionId,
    divisionId: request.divisionId,
    categoryId: request.categoryId,
    stageId: request.stageId,
    logicalMatches: generated.logicalMatches,
    drawFingerprint: drawSnapshot.drawFingerprint,
    ruleEvaluationFingerprint: evaluatedRules.ruleEvaluationFingerprint,
    participantFingerprint,
    strategy: request.strategy,
    deterministicOrderingInputs,
    diagnostics,
    validationSummary: { ok: false, issueCount: 0, issueCodes: [] },
  });

  const seIssues = validateSingleEliminationBracketInvariants(plan, {
    participantCount: diagnostics.participantCount,
    bracketSize: diagnostics.bracketSize,
    byeCount: diagnostics.byeCount,
    championshipRoundCount: diagnostics.championshipRoundCount,
    includeThirdPlace: diagnostics.includeThirdPlace === true,
  });
  if (seIssues.length > 0) {
    return failWithIssues(
      seIssues,
      { ...fingerprints, generationFingerprint: plan.generationFingerprint },
      { phase: "validateSingleEliminationBracketInvariants", diagnostics }
    );
  }

  const invariantIssues = validateMatchPlanInvariants(plan, {
    boundDrawSnapshot: drawSnapshot,
    expectedDrawFingerprint: drawSnapshot.drawFingerprint,
    expectedRuleEvaluationFingerprint: evaluatedRules.ruleEvaluationFingerprint,
    expectedParticipantFingerprint: participantFingerprint,
    strategy: request.strategy,
    deterministicOrderingInputs,
    requireGenerationFingerprintMatch: true,
    maxDirectPairOccurrences: 1,
  });
  if (invariantIssues.length > 0) {
    return failWithIssues(
      invariantIssues,
      { ...fingerprints, generationFingerprint: plan.generationFingerprint },
      { phase: "validateMatchPlanInvariants", diagnostics }
    );
  }

  const finalPlan = assembleMatchPlan({
    competitionId: request.competitionId,
    divisionId: request.divisionId,
    categoryId: request.categoryId,
    stageId: request.stageId,
    logicalMatches: generated.logicalMatches,
    drawFingerprint: drawSnapshot.drawFingerprint,
    ruleEvaluationFingerprint: evaluatedRules.ruleEvaluationFingerprint,
    participantFingerprint,
    strategy: request.strategy,
    deterministicOrderingInputs,
    diagnostics,
    validationSummary: {
      ok: true,
      issueCount: 0,
      issueCodes: [],
    },
  });

  const finalSe = validateSingleEliminationBracketInvariants(finalPlan, {
    participantCount: diagnostics.participantCount,
    bracketSize: diagnostics.bracketSize,
    byeCount: diagnostics.byeCount,
    championshipRoundCount: diagnostics.championshipRoundCount,
    includeThirdPlace: diagnostics.includeThirdPlace === true,
  });
  const finalIssues = validateMatchPlanInvariants(finalPlan, {
    boundDrawSnapshot: drawSnapshot,
    expectedDrawFingerprint: drawSnapshot.drawFingerprint,
    expectedRuleEvaluationFingerprint: evaluatedRules.ruleEvaluationFingerprint,
    expectedParticipantFingerprint: participantFingerprint,
    strategy: request.strategy,
    deterministicOrderingInputs,
    requireGenerationFingerprintMatch: true,
    maxDirectPairOccurrences: 1,
  });
  const combined = [...finalSe, ...finalIssues];
  if (combined.length > 0) {
    return failWithIssues(
      combined,
      {
        ...fingerprints,
        generationFingerprint: finalPlan.generationFingerprint,
      },
      { phase: "finalInvariantCheck", diagnostics }
    );
  }

  return matchGenerationOk({
    matchPlan: finalPlan,
    issues: [],
    diagnostics,
    fingerprints: {
      drawFingerprint: finalPlan.drawFingerprint,
      ruleEvaluationFingerprint: finalPlan.ruleEvaluationFingerprint,
      participantFingerprint: finalPlan.participantFingerprint,
      generationFingerprint: finalPlan.generationFingerprint,
    },
  });
}

/**
 * @param {object} args
 */
function generateRoundRobinPlan(args) {
  const {
    request,
    drawSnapshot,
    evaluatedRules,
    participantFingerprint,
    deterministicOrderingInputs,
    fingerprints,
  } = args;

  const ruleIssues = validateRoundRobinRuleBinding(request, evaluatedRules);
  if (ruleIssues.length > 0) {
    return failWithIssues(ruleIssues, fingerprints, {
      phase: "validateRoundRobinRuleBinding",
    });
  }

  const { legs, encounterCount } = resolveRoundRobinLegs(evaluatedRules);

  /** @type {import('../contracts/logicalMatch.js').LogicalMatch[]} */
  let logicalMatches = [];
  /** @type {object} */
  let diagnostics = {
    generatorId: MATCH_GENERATOR_IDENTITY.id,
    generatorVersion: MATCH_GENERATOR_IDENTITY.version,
    strategy: request.strategy,
    roundRobinMode: evaluatedRules.roundRobinMode,
    encounterCount,
    legs,
  };

  if (request.strategy === MATCH_GENERATION_STRATEGY.ROUND_ROBIN) {
    const resolved = resolveFlatParticipantsFromDraw(drawSnapshot);
    if (!resolved.ok) {
      return failWithIssues(resolved.issues, fingerprints, {
        phase: "resolveFlatParticipantsFromDraw",
      });
    }

    const generated = generateRoundRobinForParticipants({
      participants: resolved.participants,
      competitionId: request.competitionId,
      divisionId: request.divisionId,
      categoryId: request.categoryId,
      stageId: request.stageId,
      groupId: null,
      legs,
      deterministicOrderStart: 1,
    });
    logicalMatches = generated.logicalMatches;

    const played = logicalMatches.filter((m) => m.isByeMatch !== true);
    diagnostics = {
      ...diagnostics,
      participantCount: resolved.participants.length,
      expectedRoundsPerLeg: expectedSingleRoundRobinRounds(
        resolved.participants.length
      ),
      expectedPlayedPerLeg: expectedSingleRoundRobinPlayedMatches(
        resolved.participants.length
      ),
      actualRounds: generated.leg1RoundCount * legs,
      actualPlayedMatches: played.length,
      actualLogicalMatches: logicalMatches.length,
      byeRecipientIdsByLeg: generated.byeRecipientIdsByLeg,
      placementOrder: resolved.participants.map((p) => p.participantId),
    };
  } else if (
    request.strategy === MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN
  ) {
    const resolved = resolveGroupedParticipantsFromDraw(drawSnapshot);
    if (!resolved.ok) {
      return failWithIssues(resolved.issues, fingerprints, {
        phase: "resolveGroupedParticipantsFromDraw",
      });
    }

    let orderCursor = 1;
    /** @type {object[]} */
    const groupDiagnostics = [];

    for (const group of resolved.groups) {
      const generated = generateRoundRobinForParticipants({
        participants: group.participants,
        competitionId: request.competitionId,
        divisionId: request.divisionId,
        categoryId: request.categoryId,
        stageId: request.stageId,
        groupId: group.groupId,
        legs,
        deterministicOrderStart: orderCursor,
      });
      logicalMatches = logicalMatches.concat(generated.logicalMatches);
      orderCursor = generated.nextDeterministicOrder;
      groupDiagnostics.push({
        groupId: group.groupId,
        participantCount: group.participants.length,
        placementOrder: group.participants.map((p) => p.participantId),
        expectedRoundsPerLeg: expectedSingleRoundRobinRounds(
          group.participants.length
        ),
        expectedPlayedPerLeg: expectedSingleRoundRobinPlayedMatches(
          group.participants.length
        ),
        actualLogicalMatches: generated.logicalMatches.length,
        byeRecipientIdsByLeg: generated.byeRecipientIdsByLeg,
      });
    }

    diagnostics = {
      ...diagnostics,
      groups: groupDiagnostics,
      actualLogicalMatches: logicalMatches.length,
      actualPlayedMatches: logicalMatches.filter((m) => m.isByeMatch !== true)
        .length,
      groupOrder: resolved.groups.map((g) => g.groupId),
    };
  } else {
    return matchGenerationFail(
      MATCH_GENERATION_ISSUE_CODE.STRATEGY_UNSUPPORTED,
      "Unsupported strategy for Phase 1C",
      { path: "strategy", details: { strategy: request.strategy }, fingerprints }
    );
  }

  if (request.strategy === MATCH_GENERATION_STRATEGY.GROUP_ROUND_ROBIN) {
    for (const m of logicalMatches) {
      if (m.isByeMatch) continue;
      const a = m.participantSlotA?.participantId;
      const b = m.participantSlotB?.participantId;
      if (!m.groupId) {
        return matchGenerationFail(
          MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH,
          "Group-stage match missing groupId",
          {
            path: "logicalMatches",
            details: { logicalMatchKey: m.logicalMatchKey },
            fingerprints,
          }
        );
      }
      if (a && b) {
        const aGroup = drawSnapshot.participantPlacements.find(
          (p) => p.participantId === a
        )?.groupId;
        const bGroup = drawSnapshot.participantPlacements.find(
          (p) => p.participantId === b
        )?.groupId;
        if (aGroup !== m.groupId || bGroup !== m.groupId) {
          return matchGenerationFail(
            MATCH_GENERATION_ISSUE_CODE.INVALID_LOGICAL_MATCH,
            "Cross-group pairing detected",
            {
              path: "logicalMatches",
              details: {
                logicalMatchKey: m.logicalMatchKey,
                groupId: m.groupId,
                aGroup,
                bGroup,
              },
              fingerprints,
            }
          );
        }
      }
    }
  }

  const plan = assembleMatchPlan({
    competitionId: request.competitionId,
    divisionId: request.divisionId,
    categoryId: request.categoryId,
    stageId: request.stageId,
    logicalMatches,
    drawFingerprint: drawSnapshot.drawFingerprint,
    ruleEvaluationFingerprint: evaluatedRules.ruleEvaluationFingerprint,
    participantFingerprint,
    strategy: request.strategy,
    deterministicOrderingInputs,
    diagnostics,
    validationSummary: { ok: false, issueCount: 0, issueCodes: [] },
  });

  const invariantIssues = validateMatchPlanInvariants(plan, {
    boundDrawSnapshot: drawSnapshot,
    expectedDrawFingerprint: drawSnapshot.drawFingerprint,
    expectedRuleEvaluationFingerprint: evaluatedRules.ruleEvaluationFingerprint,
    expectedParticipantFingerprint: participantFingerprint,
    strategy: request.strategy,
    deterministicOrderingInputs,
    requireGenerationFingerprintMatch: true,
    maxDirectPairOccurrences: encounterCount,
  });

  if (invariantIssues.length > 0) {
    return failWithIssues(
      invariantIssues,
      {
        ...fingerprints,
        generationFingerprint: plan.generationFingerprint,
      },
      {
        phase: "validateMatchPlanInvariants",
        diagnostics,
      }
    );
  }

  const finalPlan = assembleMatchPlan({
    competitionId: request.competitionId,
    divisionId: request.divisionId,
    categoryId: request.categoryId,
    stageId: request.stageId,
    logicalMatches,
    drawFingerprint: drawSnapshot.drawFingerprint,
    ruleEvaluationFingerprint: evaluatedRules.ruleEvaluationFingerprint,
    participantFingerprint,
    strategy: request.strategy,
    deterministicOrderingInputs,
    diagnostics,
    validationSummary: {
      ok: true,
      issueCount: 0,
      issueCodes: [],
    },
  });

  const finalIssues = validateMatchPlanInvariants(finalPlan, {
    boundDrawSnapshot: drawSnapshot,
    expectedDrawFingerprint: drawSnapshot.drawFingerprint,
    expectedRuleEvaluationFingerprint: evaluatedRules.ruleEvaluationFingerprint,
    expectedParticipantFingerprint: participantFingerprint,
    strategy: request.strategy,
    deterministicOrderingInputs,
    requireGenerationFingerprintMatch: true,
    maxDirectPairOccurrences: encounterCount,
  });
  if (finalIssues.length > 0) {
    return failWithIssues(
      finalIssues,
      {
        ...fingerprints,
        generationFingerprint: finalPlan.generationFingerprint,
      },
      { phase: "finalInvariantCheck", diagnostics }
    );
  }

  return matchGenerationOk({
    matchPlan: finalPlan,
    issues: [],
    diagnostics,
    fingerprints: {
      drawFingerprint: finalPlan.drawFingerprint,
      ruleEvaluationFingerprint: finalPlan.ruleEvaluationFingerprint,
      participantFingerprint: finalPlan.participantFingerprint,
      generationFingerprint: finalPlan.generationFingerprint,
    },
  });
}

/**
 * Capability-local aliases (request.strategy must already match).
 */
export function generateRoundRobinMatchPlan(request, context) {
  return generateMatchPlan(request, context);
}

export function generateGroupStageRoundRobinMatchPlan(request, context) {
  return generateMatchPlan(request, context);
}

export function generateSingleEliminationMatchPlan(request, context) {
  return generateMatchPlan(request, context);
}
